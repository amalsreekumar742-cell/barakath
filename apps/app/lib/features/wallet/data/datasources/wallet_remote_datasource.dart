import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/app_dimens.dart';
import '../../../../core/constants/cloud_functions.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/wallet_top_up_order.dart';
import '../models/wallet_breakdown_model.dart';
import '../models/wallet_transaction_model.dart';
import '../../../../core/error/firebase_error_message.dart';

/// The raw result of one ledger query — models plus the Firestore cursor. Lives
/// in the data layer so the `DocumentSnapshot` type never escapes it.
class WalletTransactionPageDto {
  const WalletTransactionPageDto({
    required this.items,
    required this.nextCursor,
    required this.hasMore,
  });

  final List<WalletTransactionModel> items;
  final DocumentSnapshot<Map<String, dynamic>>? nextCursor;
  final bool hasMore;
}

/// The ONLY place the wallet touches Firebase (skill: Firebase in datasources
/// only).
///
/// SCHEMA — deployed, not spec §4.9:
///   • `walletTransactions` is a TOP-LEVEL collection filtered by `userId`, NOT
///     `customers/{id}/walletTransactions`. `firestore.rules` allows a read when
///     `resource.data.userId == request.auth.uid`, and the composite index
///     (userId ASC, createdAt DESC) is declared in `firestore.indexes.json`.
///   • the balance lives on `users/{uid}.walletBalance`.
///
/// Everything here is a READ. The balance and the ledger are written by Cloud
/// Functions; the rules forbid a client create on `walletTransactions` anyway.
abstract class WalletRemoteDataSource {
  /// Live `users/{uid}.walletBalance` from an onSnapshot listener.
  Stream<double> watchBalance(String uid);

  /// One page of the ledger, newest first. Throws [ServerException] on failure.
  Future<WalletTransactionPageDto> fetchTransactions({
    required String uid,
    Object? startAfter,
    int limit,
  });

  /// Lifetime Rewards total via aggregation `sum()`.
  Future<WalletBreakdownModel> fetchBreakdown(String uid);

  /// Ask the server to open a Razorpay order for a top-up of [amount] rupees.
  /// Returns everything the Razorpay sheet needs. Throws [ServerException].
  Future<WalletTopUpOrder> createTopUpOrder(double amount);

  /// Hand the Razorpay result back for signature verification and crediting.
  ///
  /// Returns the credited amount in rupees, or `null` when the signature did not
  /// check out. Never credit on the client. The amount comes back from the
  /// server because the caller may no longer know it — see [verifyTopUp] in the
  /// impl for why.
  Future<double?> verifyTopUp({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  });
}

@LazySingleton(as: WalletRemoteDataSource)
class WalletRemoteDataSourceImpl implements WalletRemoteDataSource {
  WalletRemoteDataSourceImpl(this._firestore, this._functions);

  final FirebaseFirestore _firestore;
  final FirebaseFunctions _functions;

  CollectionReference<Map<String, dynamic>> get _ledger =>
      _firestore.collection(FirebaseCollections.walletTransactions);

  @override
  Stream<double> watchBalance(String uid) {
    if (uid.isEmpty) return Stream<double>.value(0);
    // Project convention: the CURRENT user's document is streamed, never read
    // one-shot — a spin reward, an order debit or an admin credit can land while
    // the wallet tab is open and the card has to follow it.
    return _firestore
        .collection(FirebaseCollections.users)
        .doc(uid)
        .snapshots()
        .map((doc) => ModelParse.toDouble(doc.data()?['walletBalance']));
  }

  @override
  Future<WalletTransactionPageDto> fetchTransactions({
    required String uid,
    Object? startAfter,
    int limit = AppDimens.pageSize,
  }) async {
    if (uid.isEmpty) {
      return const WalletTransactionPageDto(
          items: [], nextCursor: null, hasMore: false);
    }
    try {
      Query<Map<String, dynamic>> query = _ledger
          .where('userId', isEqualTo: uid)
          .orderBy('createdAt', descending: true)
          .limit(limit);

      // Cursor pagination (mandatory per the skill) — never an offset.
      if (startAfter is DocumentSnapshot<Map<String, dynamic>>) {
        query = query.startAfterDocument(startAfter);
      }

      final snap = await query.get();
      final docs = snap.docs;
      return WalletTransactionPageDto(
        items: docs.map(WalletTransactionModel.fromFirestore).toList(),
        nextCursor: docs.isEmpty ? null : docs.last,
        // A short page means the ledger is exhausted; a full one MAY have more.
        hasMore: docs.length == limit,
      );
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not load your transactions.',
        e.code,
      );
    }
  }

  /// Every source that counts as a "reward": money the STORE gave the customer,
  /// as opposed to money they added themselves or got back on a refund. An admin
  /// "Add money" is the store handing over money, so it belongs here.
  static const List<WalletSource> _rewardSources = [
    WalletSource.reward,
    WalletSource.adminCredit,
  ];

  @override
  Future<WalletBreakdownModel> fetchBreakdown(String uid) async {
    if (uid.isEmpty) return const WalletBreakdownModel(rewardsTotal: 0);
    try {
      // Server-side sums — one number each over the wire. Paging the ledger to
      // total it client-side is explicitly forbidden by the skill (and would
      // bill one document read per entry).
      //
      // WHY N equality sums rather than one `whereIn` aggregate: the composite
      // index backing this is (userId, type, source) with source EQUAL, and
      // these run in parallel anyway — so it costs the same round-trip and
      // needs no second index.
      final results = await Future.wait([
        for (final source in _rewardSources)
          _sumCredits(uid: uid, source: source.label),
      ]);
      return WalletBreakdownModel(
        // NB: not `sum` as the accumulator name — `sum()` is the Firestore
        // aggregate function imported into this file.
        rewardsTotal: results.fold<double>(0, (total, value) => total + value),
      );
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not load your wallet breakdown.',
        e.code,
      );
    }
  }

  @override
  Future<WalletTopUpOrder> createTopUpOrder(double amount) async {
    try {
      final callable =
          _functions.httpsCallable(CloudFunctions.createWalletTopUpOrder);
      final response = await callable.call<Map<String, dynamic>>({
        'amount': amount,
      });
      final data = response.data;
      return WalletTopUpOrder(
        topUpId: ModelParse.toStr(data['topUpId']),
        razorpayOrderId: ModelParse.toStr(data['razorpayOrderId']),
        // The SERVER's amount, not the one we sent. They should match, but the
        // Razorpay sheet must be opened with the figure the gateway order was
        // actually created for or Razorpay rejects the payment.
        amount: ModelParse.toDouble(data['amount']),
        keyId: ModelParse.toStr(data['key_id']),
      );
    } on FirebaseFunctionsException catch (e) {
      // The callable's messages are written for the customer ("Wallet payments
      // are currently switched off by the store."), so prefer them.
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not start the top-up.',
        e.code,
      );
    }
  }

  @override
  Future<double?> verifyTopUp({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    try {
      final callable = _functions.httpsCallable(CloudFunctions.verifyWalletTopUp);
      final response = await callable.call<Map<String, dynamic>>({
        'razorpay_order_id': razorpayOrderId,
        'razorpay_payment_id': razorpayPaymentId,
        'razorpay_signature': razorpaySignature,
      });
      if (response.data['verified'] != true) return null;
      // `amount` is taken from the response, NOT from anything held on this
      // device. Razorpay opens its own Android Activity and the host app can be
      // destroyed behind it — observed on a real device — so by the time this
      // returns, the page that started the top-up may be a fresh State that
      // never knew the amount. The server always knows.
      //
      // `newBalance` is deliberately ignored: `watchBalance` streams
      // users/{uid} and reports the credit itself. Two writers for one number is
      // how they end up disagreeing.
      return ModelParse.toDouble(response.data['amount']);
    } on FirebaseFunctionsException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not confirm the top-up.',
        e.code,
      );
    }
  }

  /// `sum(amount)` over this user's credits from one source. Backed by the
  /// (userId, type, source) composite index in `firestore.indexes.json`.
  Future<double> _sumCredits({
    required String uid,
    required String source,
  }) async {
    final snapshot = await _ledger
        .where('userId', isEqualTo: uid)
        .where('type', isEqualTo: WalletTxnType.credit.label)
        .where('source', isEqualTo: source)
        .aggregate(sum('amount'))
        .get();
    return snapshot.getSum('amount') ?? 0;
  }
}
