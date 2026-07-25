/// Deployed Cloud Function identifiers for the customer app.
///
/// NOTE: the skill's `cloud_function_urls.dart` pattern assumes HTTPS-triggered
/// functions with unique Cloud Run URLs. The Barakath functions are **callables**
/// (`onCall`) deployed to `asia-south1`, so the client references them by NAME
/// (the callable protocol resolves the name) and must region-pin the instance —
/// `FirebaseFunctions.instanceFor(region: CloudFunctions.region)`. A default
/// (us-central1) instance would 404. Hence names + a region here, not URLs.
class CloudFunctions {
  const CloudFunctions._();

  static const String region = 'asia-south1';

  // Order & payment
  static const String createPaymentOrder = 'createPaymentOrder';
  static const String verifyPayment = 'verifyPayment';
  static const String generateInvoicePDF = 'generateInvoicePDF';

  // Auth (MSG91 OTP — pre-login, no auth required)
  static const String authOTP = 'authOTP';
  static const String verifyOTP = 'verifyOTP';
  static const String resendOTP = 'resendOTP';

  /// Cancels an order and refunds it (spec §5.2).
  ///
  /// NOTE: spec §5.2 describes this as admin-auth, but §2.17 gives the customer
  /// a "Cancel item" action at Pending. If the callable rejects a customer
  /// caller, widen the check server-side — do NOT cancel from the client.
  static const String cancelOrder = 'cancelOrder';

  // Growth
  static const String spinWheel = 'spinWheel';

  /// ADMIN-ONLY (`validateAdmin`): the admin panel crediting a customer's
  /// wallet. NOT the customer top-up path and not callable from this app — a
  /// customer calling it gets permission-denied. Kept here only so the name is
  /// documented in one place; use the two below instead.
  static const String addWalletMoney = 'addWalletMoney';

  // Customer wallet top-up (spec §2.20 "Add money"). Two steps, because the
  // amount must be fixed server-side BEFORE payment and the credit must happen
  // only against a verified signature afterwards.
  /// Opens a bare Razorpay order and records what it is for.
  static const String createWalletTopUpOrder = 'createWalletTopUpOrder';

  /// Verifies the Razorpay signature and credits the wallet. Idempotent — safe
  /// to retry after a dropped connection.
  static const String verifyWalletTopUp = 'verifyWalletTopUp';
}
