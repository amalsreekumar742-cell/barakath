import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb_auth;
import 'package:injectable/injectable.dart';

import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/utils/constants.dart';
import '../models/affiliate_transaction_model.dart';
import '../models/affiliate_withdrawal_model.dart';
import '../models/bank_account_model.dart';
import '../../../../core/error/firebase_error_message.dart';

/// The raw result of one affiliate query — models plus the Firestore cursor.
/// Kept in the data layer so the `DocumentSnapshot` type never escapes it.
class AffiliatePageDto<T> {
  const AffiliatePageDto({
    required this.items,
    required this.nextCursor,
    required this.hasMore,
  });

  final List<T> items;
  final DocumentSnapshot<Map<String, dynamic>>? nextCursor;
  final bool hasMore;
}

/// Every affiliate Firestore read/write. The ONLY place these calls live
/// (skill: Firebase in datasources only).
///
/// SCHEMA NOTE — this follows the DEPLOYED contract
/// (`packages/shared/src/types/affiliate.ts`), not spec §4.16:
///   * the commission ledger is the TOP-LEVEL `affiliateTransactions`
///     collection filtered by `userId` (not `users/{uid}/commissionTransactions`,
///     not `customerId`);
///   * payout requests are the TOP-LEVEL `affiliateWithdrawals` collection
///     (not `withdrawalRequests`), and carry `rejectionReason`, not `adminNote`.
abstract class AffiliateRemoteDataSource {
  Future<AffiliatePageDto<AffiliateTransactionModel>> fetchCommissions({
    required String uid,
    Object? startAfter,
    int limit,
  });

  Future<AffiliatePageDto<AffiliateWithdrawalModel>> fetchWithdrawals({
    required String uid,
    Object? startAfter,
    int limit,
  });

  Future<List<BankAccountModel>> fetchBankAccounts(String uid);

  /// Throws [ServerException] when the 2-account cap is reached or the same
  /// account number is already saved.
  Future<BankAccountModel> addBankAccount({
    required String uid,
    required BankAccountModel account,
  });

  Future<void> deleteBankAccount({
    required String uid,
    required String accountId,
  });

  Future<void> createWithdrawal(AffiliateWithdrawalModel request);
}

@LazySingleton(as: AffiliateRemoteDataSource)
class AffiliateRemoteDataSourceImpl implements AffiliateRemoteDataSource {
  AffiliateRemoteDataSourceImpl(this._firestore, this._auth);

  final FirebaseFirestore _firestore;
  final fb_auth.FirebaseAuth _auth;

  /// Spec §2.22 — an affiliate may save at most 2 payout accounts.
  static const int maxBankAccounts = 2;

  /// Guards every call against the signed-in session. The rules only ever let a
  /// customer touch their own rows, so a uid that isn't theirs would fail with
  /// an opaque permission error — this turns it into a readable message, and
  /// stops a caller passing someone else's uid by accident.
  String _requireUid(String uid) {
    final current = _auth.currentUser?.uid;
    if (current == null) {
      throw const AuthException('Please sign in to view your affiliate account.');
    }
    if (uid.isNotEmpty && uid != current) {
      throw const AuthException('You can only view your own affiliate account.');
    }
    return current;
  }

  CollectionReference<Map<String, dynamic>> _bankAccounts(String uid) =>
      _firestore
          .collection(FirebaseCollections.users)
          .doc(uid)
          .collection(FirebaseCollections.bankAccounts);

  @override
  Future<AffiliatePageDto<AffiliateTransactionModel>> fetchCommissions({
    required String uid,
    Object? startAfter,
    int limit = PageSizes.defaultPageSize,
  }) async {
    final ownerId = _requireUid(uid);
    try {
      var query = _firestore
          .collection(FirebaseCollections.affiliateTransactions)
          .where('userId', isEqualTo: ownerId)
          .orderBy('createdAt', descending: true)
          .limit(limit);

      if (startAfter is DocumentSnapshot<Map<String, dynamic>>) {
        query = query.startAfterDocument(startAfter);
      }

      final snap = await query.get();
      return AffiliatePageDto(
        items: snap.docs.map(AffiliateTransactionModel.fromFirestore).toList(),
        nextCursor: snap.docs.isEmpty ? null : snap.docs.last,
        // A short page means the end; a full page MIGHT have more, and the
        // "View More" tap resolves it without a second count query.
        hasMore: snap.docs.length == limit,
      );
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not load your commission history.',
        e.code,
      );
    }
  }

  @override
  Future<AffiliatePageDto<AffiliateWithdrawalModel>> fetchWithdrawals({
    required String uid,
    Object? startAfter,
    int limit = PageSizes.defaultPageSize,
  }) async {
    final ownerId = _requireUid(uid);
    try {
      var query = _firestore
          .collection(FirebaseCollections.affiliateWithdrawals)
          .where('userId', isEqualTo: ownerId)
          .orderBy('createdAt', descending: true)
          .limit(limit);

      if (startAfter is DocumentSnapshot<Map<String, dynamic>>) {
        query = query.startAfterDocument(startAfter);
      }

      final snap = await query.get();
      return AffiliatePageDto(
        items: snap.docs.map(AffiliateWithdrawalModel.fromFirestore).toList(),
        nextCursor: snap.docs.isEmpty ? null : snap.docs.last,
        hasMore: snap.docs.length == limit,
      );
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not load your withdrawal requests.',
        e.code,
      );
    }
  }

  @override
  Future<List<BankAccountModel>> fetchBankAccounts(String uid) async {
    final ownerId = _requireUid(uid);
    try {
      // Bounded by the product at 2; the limit is defensive, not pagination.
      final snap = await _bankAccounts(ownerId)
          .orderBy('createdAt')
          .limit(maxBankAccounts)
          .get();
      return snap.docs.map(BankAccountModel.fromFirestore).toList();
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not load your bank accounts.',
        e.code,
      );
    }
  }

  @override
  Future<BankAccountModel> addBankAccount({
    required String uid,
    required BankAccountModel account,
  }) async {
    final ownerId = _requireUid(uid);
    try {
      // Re-check server-side rather than trusting the list the screen is
      // holding: a second device could have saved the 2nd account meanwhile.
      final existing = await _bankAccounts(ownerId).get();
      if (existing.docs.length >= maxBankAccounts) {
        throw const ServerException(
          'You can save up to $maxBankAccounts bank accounts. '
          'Delete one to add another.',
        );
      }
      final duplicate = existing.docs.any(
        (doc) =>
            (doc.data()['accountNumber'] ?? '').toString().trim() ==
            account.accountNumber.trim(),
      );
      if (duplicate) {
        throw const ServerException('This bank account is already saved.');
      }

      final ref = _bankAccounts(ownerId).doc();
      await ref.set(account.toFirestore());
      return BankAccountModel(
        id: ref.id,
        accountHolderName: account.accountHolderName,
        accountNumber: account.accountNumber,
        ifscCode: account.ifscCode.toUpperCase(),
        bankName: account.bankName,
        bankBranch: account.bankBranch,
        createdAt: DateTime.now(),
      );
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not save the bank account.',
        e.code,
      );
    }
  }

  @override
  Future<void> deleteBankAccount({
    required String uid,
    required String accountId,
  }) async {
    final ownerId = _requireUid(uid);
    try {
      await _bankAccounts(ownerId).doc(accountId).delete();
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not delete the bank account.',
        e.code,
      );
    }
  }

  @override
  Future<void> createWithdrawal(AffiliateWithdrawalModel request) async {
    _requireUid(request.userId);
    try {
      // `toCreateMap()` is what the Firestore rule validates: own uid, status
      // 'Pending', amount >= 10000 and <= the SERVER's affiliateBalance, empty
      // rejectionReason/processedBy. The balance itself is never written here —
      // admin deducts it on approval, outside the app.
      await _firestore
          .collection(FirebaseCollections.affiliateWithdrawals)
          .add(request.toCreateMap());
    } on FirebaseException catch (e) {
      if (e.code == 'permission-denied') {
        // The rule re-checks the amount against the server's balance, so this
        // is what a stale on-screen balance looks like.
        throw const ServerException(
          'This withdrawal could not be filed. Please check the amount against '
          'your withdrawable balance and try again.',
          'permission-denied',
        );
      }
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not file the withdrawal request.',
        e.code,
      );
    }
  }
}
