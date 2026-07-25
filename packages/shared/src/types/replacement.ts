import type { Timestamp } from 'firebase/firestore';

/**
 * ReplacementProps — a customer's product-replacement request and its admin resolution (spec §1.10).
 *
 * WHY here (not per-app): the customer app CREATES these docs (with photos + reason), and the admin
 * panel + Cloud Functions read/resolve them, so one definition keeps the contract identical everywhere.
 * WHY `Timestamp` (not epoch millis): preserves server-authoritative time and correct range queries.
 * `processedAt`/`replacementOrderId`/`adminNote` stay empty/null until an admin approves or rejects.
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
  replacementOrderId: string;
  processedBy: string;
  processedByName: string;
  processedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
