import 'package:equatable/equatable.dart';

/// What the server hands back when a wallet top-up is started: everything the
/// Razorpay sheet needs, and nothing the client is trusted to decide.
///
/// [amount] is the server's figure, not the one typed into the form. The two
/// should agree, but the sheet is opened with THIS one so the paise charged can
/// never drift from the paise the gateway order was created for — Razorpay
/// rejects a mismatch outright.
class WalletTopUpOrder extends Equatable {
  const WalletTopUpOrder({
    required this.topUpId,
    required this.razorpayOrderId,
    required this.amount,
    required this.keyId,
  });

  /// Our `walletTopUps/{id}` record — the row the verifier settles.
  final String topUpId;

  /// Razorpay's own order id, passed to the sheet as `order_id`.
  final String razorpayOrderId;

  /// Rupees, as recorded server-side.
  final double amount;

  /// The Razorpay PUBLIC key. The secret never leaves the backend.
  final String keyId;

  @override
  List<Object?> get props => [topUpId, razorpayOrderId, amount, keyId];
}
