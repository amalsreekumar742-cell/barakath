import type { Timestamp } from 'firebase/firestore';

/**
 * ReplacementProps — a customer's product-replacement request and its admin resolution (spec §1.10).
 *
 * WHY here (not per-app): the customer app CREATES these docs (with photos + reason), and the admin
 * panel + Cloud Functions read/resolve them, so one definition keeps the contract identical everywhere.
 * WHY `Timestamp` (not epoch millis): preserves server-authoritative time and correct range queries.
 * `processedAt`/`adminNote` stay empty/null until an admin approves or rejects.
 *
 * RESOLUTION MODEL: approving a request refunds the line's value to the customer's WALLET
 * (`refundAmount`/`refundedToWallet`/`walletTransactionId`, written by the `approveReplacement` Cloud
 * Function). It used to mint a free ₹0 replacement order instead — see `replacementOrderId`.
 */
export interface ReplacementProps {
  id: string;
  /**
   * Human display reference, `#RP-0001` — NOT part of the original spec field list, but genuinely
   * written by the Flutter app on every create (`replacement_remote_datasource.dart`'s `_nextRequestId`)
   * and absent here only because this type predates that finding. Added so the website's own writer/
   * reader agree with what is actually on the document. Docs written before this existed simply have ''.
   */
  requestId: string;
  orderId: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail: string;
  productId: string;
  productName: string;
  productImage: string;
  variantId: string;
  variantName: string;
  variantColor: string;
  quantity: number;
  reason: string;
  photos: string[];
  status: 'Pending' | 'Approved' | 'Rejected';
  adminNote: string;
  /**
   * LEGACY — the id of the free ₹0 replacement order that approval used to create. Approvals now
   * refund to the wallet instead and always write `''` here. Non-empty only on requests approved
   * before that change; the admin detail page still renders the old "Replacement order" card for
   * those so historical records stay navigable.
   */
  replacementOrderId: string;
  /**
   * Refund written on approval. `refundAmount` is the line's value net of its share of the order's
   * coupon and inclusive of its share of GST (delivery is never refunded) — computed server-side by
   * `computeReplacementRefund`. `walletTransactionId` points at the `walletTransactions` ledger row,
   * whose id is deterministic (`replacement_{id}`) so a re-approval cannot double-credit.
   * All three are 0/false/'' on pending, rejected, and pre-change documents.
   */
  refundAmount: number;
  refundedToWallet: boolean;
  walletTransactionId: string;
  processedBy: string;
  processedByName: string;
  processedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
