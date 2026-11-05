import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getAuth } from "firebase-admin/auth";
import {
  getFirestore,
  Timestamp,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { Collections } from "../config/collections";
import { validateAuth } from "../utils/validateAuth";

/** Order states with nothing left to fulfil. Anything else still needs the customer's details. */
const FINISHED_ORDER_STATUSES = new Set(["Delivered", "Cancelled"]);

const DELETED_CUSTOMER_NAME = "Deleted customer";

/** How long an unpaid wallet top-up counts as in flight (the Razorpay sheet may still be open). */
const TOP_UP_IN_FLIGHT_MS = 30 * 60 * 1000;

/**
 * How long after approval a withdrawal's bank details are kept. Approval only means the admin WILL
 * transfer the money (approveWithdrawal.ts); there is no "paid" status, so this is the window allowed
 * for the manual transfer to happen.
 */
const WITHDRAWAL_PAYOUT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * deleteMyAccount — permanently delete the signed-in customer's account (App Store guideline 5.1.1(v)).
 *
 * Removes: the Auth user, `users/{uid}` with every subcollection (addresses, wishlist, payout accounts,
 *   blocked users), profile photos, their reviews (onReviewDelete refreshes ratings and purges photos),
 *   and their own review reports. Signing in again with the same number creates a new, empty account.
 * Keeps, with personal details removed: orders, released checkout drafts, payments, return requests,
 *   wallet and affiliate ledgers, and withdrawals — financial records the business must retain. City/state/pincode stay on the order for tax purposes.
 *
 * WHY a Cloud Function: a client cannot rewrite its own orders, and Security Rules deliberately forbid
 *   deleting `users/{uid}` from a client.
 * WHY refuse while something is open: an undelivered order still needs the address, and cancelling it or
 *   approving a return would credit a wallet that no longer exists. The customer can retry once it closes.
 *   An unpaid checkout (`orderDrafts`, status Pending) counts too: a payment landing after deletion would
 *   be promoted into a live order for an account that no longer exists. The expiry sweep releases it
 *   within ~15 minutes, or at once if the customer closes the payment sheet. A recent unpaid wallet
 *   top-up and a recently approved withdrawal (still to be transferred by hand) count as open too. A
 *   top-up captured after deletion anyway is recorded as RefundDue by settleWalletTopUp.
 * WHY a released (Cancelled) draft is scrubbed, not deleted: a late payment must still find it, so
 *   promoteDraftToOrder can raise a Cancelled order flagged for refund. Scrubbing it first means that
 *   order (and its payment record) carries no personal details.
 * WHY the Auth user goes last: if anything earlier fails the caller is still signed in and can retry, and
 *   every step is idempotent.
 *
 * Request:  {}
 * Response: { deleted: true }
 */
export const deleteMyAccount = onCall(
  { timeoutSeconds: 300 },
  async (request) => {
    const uid = validateAuth(request);
    const db = getFirestore();

    const byUser = (collection: string) =>
      db.collection(collection).where("userId", "==", uid).get();

    const [
      orders,
      drafts,
      topUps,
      replacements,
      withdrawals,
      payments,
      reviews,
      commissions,
      reports,
      referralsEarned,
    ] = await Promise.all([
      byUser(Collections.orders),
      byUser(Collections.orderDrafts),
      byUser(Collections.walletTopUps),
      byUser(Collections.replacements),
      byUser(Collections.affiliateWithdrawals),
      byUser(Collections.payments),
      byUser(Collections.reviews),
      byUser(Collections.affiliateTransactions),
      db
        .collection(Collections.reviewReports)
        .where("reporterId", "==", uid)
        .get(),
      // Commission rows in the REFERRER's ledger that name this customer as the buyer.
      db
        .collection(Collections.affiliateTransactions)
        .where("referredUserId", "==", uid)
        .get(),
    ]);

    if (
      orders.docs.some(
        (d) => !FINISHED_ORDER_STATUSES.has(String(d.get("status"))),
      )
    ) {
      throw new HttpsError(
        "failed-precondition",
        "You have an order in progress. You can delete your account once it is delivered or cancelled.",
      );
    }
    const isPending = (d: QueryDocumentSnapshot) =>
      d.get("status") === "Pending";
    // Anything not yet released — Pending, or paid and awaiting promotion — is still a live checkout.
    if (drafts.docs.some((d) => d.get("status") !== "Cancelled")) {
      throw new HttpsError(
        "failed-precondition",
        "You have a payment in progress. Please try again in about 15 minutes.",
      );
    }
    if (replacements.docs.some(isPending)) {
      throw new HttpsError(
        "failed-precondition",
        "You have a return request in progress. You can delete your account once it is resolved.",
      );
    }
    const isRecent = (value: unknown, windowMs: number) =>
      value instanceof Timestamp && Date.now() - value.toMillis() < windowMs;
    if (
      topUps.docs.some(
        (d) =>
          isPending(d) && isRecent(d.get("createdAt"), TOP_UP_IN_FLIGHT_MS),
      )
    ) {
      throw new HttpsError(
        "failed-precondition",
        "You have a wallet top-up in progress. Please try again in about 30 minutes.",
      );
    }
    if (
      withdrawals.docs.some(
        (d) =>
          d.get("status") === "Approved" &&
          isRecent(d.get("processedAt"), WITHDRAWAL_PAYOUT_WINDOW_MS),
      )
    ) {
      throw new HttpsError(
        "failed-precondition",
        "A withdrawal is still being transferred to your bank. You can delete your account a week after it was approved.",
      );
    }
    if (withdrawals.docs.some(isPending)) {
      throw new HttpsError(
        "failed-precondition",
        "You have a withdrawal in progress. You can delete your account once it is resolved.",
      );
    }

    try {
      const writer = db.bulkWriter();

      for (const order of [...orders.docs, ...drafts.docs]) {
        writer.update(order.ref, {
          userName: DELETED_CUSTOMER_NAME,
          userPhone: "",
          userEmail: "",
          keywords: [order.id.toLowerCase()],
          "shippingAddress.fullName": DELETED_CUSTOMER_NAME,
          "shippingAddress.phone": "",
          "shippingAddress.addressLine1": "",
          "shippingAddress.addressLine2": "",
          "shippingAddress.landmark": "",
        });
      }
      for (const payment of payments.docs) {
        writer.update(payment.ref, {
          userName: DELETED_CUSTOMER_NAME,
          userPhone: "",
        });
      }
      for (const replacement of replacements.docs) {
        writer.update(replacement.ref, {
          userName: DELETED_CUSTOMER_NAME,
          userPhone: "",
          userEmail: "",
          keywords: [replacement.id.toLowerCase()],
        });
      }
      for (const withdrawal of withdrawals.docs) {
        const accountNumber = String(withdrawal.get("accountNumber") ?? "");
        writer.update(withdrawal.ref, {
          userName: DELETED_CUSTOMER_NAME,
          userPhone: "",
          keywords: [withdrawal.id.toLowerCase()],
          accountHolderName: "",
          ifscCode: "",
          // Last 4 only: enough to reconcile the payout, useless to anyone else.
          accountNumber: accountNumber.slice(-4),
        });
      }
      // A pending commission can never clear into a deleted account, and would fail daily otherwise.
      for (const commission of commissions.docs.filter(isPending)) {
        writer.update(commission.ref, { status: "Forfeited" });
      }
      // Only the buyer's name goes: the referrer keeps the commission they earned.
      for (const referral of referralsEarned.docs) {
        writer.update(referral.ref, {
          referredUserName: DELETED_CUSTOMER_NAME,
        });
      }
      for (const doc of [...reviews.docs, ...reports.docs]) {
        writer.delete(doc.ref);
      }
      await writer.close();

      await db.recursiveDelete(db.collection(Collections.users).doc(uid));
      await getStorage()
        .bucket()
        .deleteFiles({ prefix: `users/${uid}/` });

      await getAuth()
        .deleteUser(uid)
        .catch((err: { code?: string }) => {
          if (err.code !== "auth/user-not-found") throw err;
        });

      return { deleted: true };
    } catch (err) {
      logger.error("deleteMyAccount failed", { uid, err });
      throw new HttpsError(
        "internal",
        "Could not delete your account. Please try again.",
      );
    }
  },
);
