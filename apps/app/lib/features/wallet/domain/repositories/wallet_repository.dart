import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/wallet_breakdown.dart';
import '../entities/wallet_top_up_order.dart';
import '../entities/wallet_transaction.dart';

/// One cursor-paginated page of wallet ledger entries.
///
/// [nextCursor] is deliberately opaque (`Object?`): it is a Firestore
/// `DocumentSnapshot` minted in — and only ever read back by — the data layer,
/// so the domain never depends on the Firestore SDK. Pass it straight back as
/// `startAfter` to fetch the following page.
class WalletTransactionPage {
  const WalletTransactionPage({
    required this.items,
    required this.nextCursor,
    required this.hasMore,
  });

  final List<WalletTransaction> items;
  final Object? nextCursor;
  final bool hasMore;

  static const empty =
      WalletTransactionPage(items: [], nextCursor: null, hasMore: false);
}

/// Domain contract for the customer's Normal Wallet (spec §2.20).
///
/// The reads are reads. The two top-up methods are the only writes, and even
/// they only ASK: the balance and every ledger entry are written by Cloud
/// Functions. Nothing in the app writes `walletBalance` or `walletTransactions`
/// — the rules forbid it, and money must not be a client-side decision.
abstract class WalletRepository {
  /// Live `users/{uid}.walletBalance`.
  ///
  /// A stream, not a one-shot read: a spin reward, an order debit or an admin
  /// credit can land while the tab is open, and the balance card must follow it
  /// without a manual refresh. Streams are returned bare — an `Either` models a
  /// completed call, not an open subscription (see `WatchAuthUser`).
  Stream<double> watchBalance(String uid);

  /// One page of the customer's ledger, newest first.
  Future<Either<Failure, WalletTransactionPage>> fetchTransactions({
    required String uid,
    Object? startAfter,
    int limit,
  });

  /// Lifetime Rewards + Refunds totals, via Firestore aggregation `sum()`.
  Future<Either<Failure, WalletBreakdown>> fetchBreakdown(String uid);

  /// Step 1 of a top-up: have the server open a Razorpay order for [amount]
  /// rupees and record what it is for. Nothing is credited yet.
  Future<Either<Failure, WalletTopUpOrder>> createTopUpOrder(double amount);

  /// Step 2: hand Razorpay's result back so the server can verify the signature
  /// and credit the wallet. Resolves to the credited amount in rupees, or
  /// `Right(null)` when the signature did not verify — a payment the gateway
  /// will not vouch for, so no credit. The amount comes from the server because
  /// the device may no longer know it.
  Future<Either<Failure, double?>> verifyTopUp({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  });
}
