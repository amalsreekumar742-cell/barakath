/**
 * CloudFunctions — the deployed callable names and the region they live in.
 *
 * WHY names and not URLs: these are `onCall` callables, so the client references them by NAME and the
 * callable protocol resolves the URL. What it CANNOT resolve is the region.
 *
 * WHY the region is the important line in this file: `functions/src/index.ts` sets
 * `setGlobalOptions({ region: 'asia-south1' })` so the onDocument* triggers sit in the same region as
 * the Firestore database. A `getFunctions(app)` with no region silently targets `us-central1`, where
 * nothing is deployed — every call 404s and no function log is written, because the request never
 * reaches one. Mirrors `apps/app/lib/core/constants/cloud_functions.dart`.
 *
 * These names are verified against the deployed functions, not against the spec.
 */
export const CloudFunctions = {
  region: 'asia-south1',

  // --- Auth (MSG91 OTP — pre-login, deliberately NO auth gate) ---
  //
  // THE WEBSITE MUST SEND `source: 'web'` ON authOTP. The site and the app use different MSG91
  // widgets; the server picks the widget from this field and remembers it, so verifyOTP/resendOTP hit
  // the SAME widget the code was issued by (a reqId is not portable across widgets). Omitting it
  // resolves to the APP widget — a code the customer never received on the web widget, so verify then
  // fails for no visible reason. verifyOTP/resendOTP take no source: the server reads it back from the
  // pending request. This is the one field W3 cannot leave off.
  OTP_SOURCE: 'web',
  /** Sends the OTP. `{ phone: '10 digits', countryCode: '+91', source: 'web' }` -> `{ success, message }`. */
  authOTP: 'authOTP',
  /**
   * `{ phone, countryCode, otp }` -> `{ verified: true, customToken, isNewUser }` | `{ verified: false }`.
   * `verified: false` is a WRONG CODE, not an error — show it inline, do not throw.
   */
  verifyOTP: 'verifyOTP',
  /** `{ phone, countryCode, retryType: 'text' | 'voice' }`. */
  resendOTP: 'resendOTP',

  // --- Orders & payment ---
  createPaymentOrder: 'createPaymentOrder',
  verifyPayment: 'verifyPayment',
  generateInvoicePDF: 'generateInvoicePDF',
  cancelOrder: 'cancelOrder',

  // --- Wallet top-up (two steps: the amount is fixed server-side BEFORE payment, and the credit
  //     happens only against a verified signature afterwards). ---
  createWalletTopUpOrder: 'createWalletTopUpOrder',
  verifyWalletTopUp: 'verifyWalletTopUp',

  // --- Growth ---
  spinWheel: 'spinWheel',

  /**
   * ADMIN ONLY (`validateAdmin`). Listed so the name is documented in one place — a customer calling
   * it gets permission-denied. The customer top-up path is the two functions above.
   */
  addWalletMoney: 'addWalletMoney',
} as const;
