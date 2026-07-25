/// Whether the BACKEND can currently accept a customer wallet top-up.
///
/// LIVE as of 2026-07-23. Two Cloud Functions back "Add money" (spec §2.20):
///
///   1. `createWalletTopUpOrder` — validates the amount, checks the store-wide
///      `payment.walletPaymentsEnabled` switch, opens a bare Razorpay order and
///      writes a `walletTopUps/{id}` document holding the amount that order was
///      opened FOR. Nothing is credited yet.
///   2. `verifyWalletTopUp` — verifies the Razorpay signature, then credits
///      `walletBalance` and appends a `walletTransactions` row with
///      `source: 'UPI top-up'` — all in one transaction keyed on the top-up's
///      status, so a retried call cannot credit the same payment twice.
///
/// The amount credited is read from that stored document, never from the
/// client: a signature proves a payment happened, not what it was worth.
///
/// The app never writes `walletBalance`. The balance moves on its own because
/// the wallet streams `users/{uid}`.
///
/// This flag remains the single kill switch for the whole feature — setting it
/// to `false` disables the action on both WalletPage and AddMoneyPage without
/// touching either screen. For a temporary stop the store owner controls,
/// prefer `payment.walletPaymentsEnabled` in `general/config`, which the server
/// enforces as well; this constant is for when the build itself must not offer
/// top-ups at all.
class WalletTopUpSupport {
  const WalletTopUpSupport._();

  /// Both Cloud Functions above are deployed.
  static const bool isAvailable = true;

  /// Shown beside the disabled "Add money" action when [isAvailable] is false.
  static const String unavailableMessage =
      'Adding money is not available right now. Rewards and refunds still credit '
      'your wallet automatically.';
}
