/**
 * Barakath Cloud Functions — entry point (WIRING ONLY).
 *
 * All privileged / financial / cross-user writes (order creation & totals, payment verification, stock
 * decrements, wallet & referral rewards, custom-token / OTP flows, FCM fan-out) live in feature folders
 * and are re-exported here so `firebase deploy` discovers them. The Admin SDK bypasses Security Rules,
 * so this codebase is the trust boundary. No logic in this file — just init + exports.
 */
import { initializeApp } from 'firebase-admin/app';
// initializeApp() must run before any other Firebase Admin call, so it lives at the very top.
initializeApp();

import { setGlobalOptions } from 'firebase-functions/v2';

// region: asia-south1 (Mumbai) — MUST match the Firestore database location so the onDocument* triggers
// can deploy via Eventarc, and it's lowest-latency for this India (INR) store. Client callables must
// target the same region: getFunctions(app, 'asia-south1'). maxInstances caps concurrency for cost.
setGlobalOptions({ maxInstances: 10, region: 'asia-south1' });

// --- Order & Payment core (checkout: server prices the cart, verifies payment, refunds) ---
export { createPaymentOrder } from './orders/createPaymentOrder'; // onCall
export { verifyPayment } from './orders/verifyPayment'; // onCall
export { cancelOrder } from './orders/cancelOrder'; // onCall (admin)
export { processRefund } from './orders/processRefund'; // onCall (admin)
export { razorpayWebhook } from './payments/razorpayWebhook'; // onRequest (Razorpay webhook)
export { expireUnpaidOrders } from './orders/expireUnpaidOrders'; // onSchedule (every 5 min)
export { discardOrderDraft } from './orders/discardOrderDraft'; // onCall (customer abandons checkout)

// --- Firestore triggers (order-status push, review aggregation, product cleanup) ---
export { onOrderStatusUpdate } from './triggers/onOrderStatusUpdate'; // onDocumentUpdated orders/{orderId}
export { onReviewCreate } from './triggers/onReviewCreate'; // onDocumentCreated reviews/{reviewId}
export { onReviewUpdate } from './triggers/onReviewUpdate'; // onDocumentUpdated reviews/{reviewId}
export { onReviewDelete } from './triggers/onReviewDelete'; // onDocumentDeleted reviews/{reviewId}
export { onProductDelete } from './triggers/onProductDelete'; // onDocumentDeleted products/{productId}
export { onProductCategoryCount } from './triggers/onProductCategoryCount'; // onDocumentWritten products/{productId}

// --- Growth & Affiliate (spin wheel, replacement, referral, commission clearing, wallet) ---
export { spinWheel } from './growth/spinWheel'; // onCall
export { approveReplacement } from './growth/approveReplacement'; // onCall (admin)
export { generateReferralCode } from './growth/generateReferralCode'; // onCall (admin)
export { setAffiliateEnabled } from './growth/setAffiliateEnabled'; // onCall (admin)
export { addWalletMoney } from './growth/addWalletMoney'; // onCall (admin)
export { trackReferralSignup } from './growth/trackReferralSignup'; // onDocumentCreated users/{userId}
export { processReferralCommission } from './growth/processReferralCommission'; // onDocumentUpdated orders/{orderId}
export { clearAffiliateCommissions } from './growth/clearAffiliateCommissions'; // onSchedule (daily)

// --- Customer wallet top-up (Razorpay "Add money", spec §2.20) ---
// addWalletMoney above is the ADMIN credit action; these two are the customer's own top-up.
export { createWalletTopUpOrder } from './wallet/createWalletTopUpOrder'; // onCall
export { verifyWalletTopUp } from './wallet/verifyWalletTopUp'; // onCall

// --- Utility & schedulers (sub-admin lifecycle, MSG91 OTP, invoice PDF, flash-sale + daily cron) ---
export { createSubAdmin } from './utility/createSubAdmin'; // onCall (super admin)
export { deleteSubAdmin } from './utility/deleteSubAdmin'; // onCall (super admin)
export { resetSubAdminPassword } from './utility/resetSubAdminPassword'; // onCall (super admin)
export { authOTP } from './utility/authOTP'; // onCall (pre-login)
export { verifyOTP } from './utility/verifyOTP'; // onCall (pre-login)
export { resendOTP } from './utility/resendOTP'; // onCall (pre-login)
export { generateInvoicePDF } from './utility/generateInvoicePDF'; // onCall
export { flashSaleManager } from './utility/flashSaleManager'; // onSchedule (every 5 min)
export { dailyCleanup } from './utility/dailyCleanup'; // onSchedule (daily 02:00 IST)
