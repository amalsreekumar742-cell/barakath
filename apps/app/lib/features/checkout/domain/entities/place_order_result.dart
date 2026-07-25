import 'package:equatable/equatable.dart';

/// What `createPaymentOrder` hands back (spec §2.15).
///
/// The order row already exists in Firestore by this point; [razorpayOrderId] is
/// null when the wallet covered the whole bill, which is the signal to skip the
/// Razorpay sheet entirely.
///
/// [amount] is DISPLAY-ONLY confirmation — the payable figure is computed
/// server-side and Razorpay charges against the order id, so a tampered client
/// can't change what it pays.
class PlaceOrderResult extends Equatable {
  const PlaceOrderResult({
    required this.orderId,
    this.razorpayOrderId,
    this.amount = 0,
    this.keyId = '',
  });

  final String orderId;
  final String? razorpayOrderId;
  final double amount;

  /// Razorpay publishable key id, from the server so the client never hardcodes it.
  final String keyId;

  bool get isWalletOnly =>
      razorpayOrderId == null || razorpayOrderId!.isEmpty || amount <= 0;

  @override
  List<Object?> get props => [orderId, razorpayOrderId, amount, keyId];
}

/// Result of `verifyPayment` — the server re-checks the Razorpay signature, so
/// `verified: false` means the payment could not be trusted, not that the network
/// failed.
class PaymentVerifyResult extends Equatable {
  const PaymentVerifyResult({required this.verified, required this.orderId});

  final bool verified;
  final String orderId;

  @override
  List<Object?> get props => [verified, orderId];
}
