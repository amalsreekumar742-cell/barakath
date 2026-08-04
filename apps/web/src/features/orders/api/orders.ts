import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  where,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FirestoreCollections, FirestoreDocs, type OrderProps, type ReplacementProps } from '@barakath/shared';
import { db, functions } from '@/lib/firebaseConfig';
import { CloudFunctions } from '@/config/cloudFunctions';

/**
 * Firestore reads + Cloud Function wrappers for My Orders / Order Detail / Tracking / Invoice.
 *
 * SCHEMA NOTE (verified against `packages/shared/src/types/order.ts`, which itself documents this
 * against `functions/src/orders/createPaymentOrder.ts` and a live order): the owner field is `userId`,
 * NOT `customerId` — the Batch 4 brief's "orders where customerId == uid" does not match either the
 * deployed schema or what `firestore.rules` checks. Every query/read here uses `userId`.
 */

/** The signed-in customer's orders, newest first — feeds `usePaginatedCollection` directly (no
 *  `limit`/`startAfter`, exactly as that hook's contract requires). */
export function ordersQuery(uid: string): Query<DocumentData> {
  return query(
    collection(db, FirestoreCollections.orders),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
  );
}

export function mapOrder(d: QueryDocumentSnapshot<DocumentData>): OrderProps {
  return { ...(d.data() as OrderProps), id: d.id };
}

/**
 * One order by id, scoped to the caller. Returns null for "not found" AND "belongs to someone else" —
 * deliberately the same outcome for both (mirrors `cancelOrder`'s own "Order not found" for a
 * non-owner, WEB_BATCH4_NOTES.md §3): a mistyped/foreign order id must not let a customer distinguish
 * "doesn't exist" from "exists but isn't yours".
 */
export async function fetchOrder(orderId: string, uid: string): Promise<OrderProps | null> {
  const snap = await getDoc(doc(db, FirestoreCollections.orders, orderId));
  if (!snap.exists()) return null;
  const order = { ...(snap.data() as OrderProps), id: snap.id };
  if (order.userId !== uid) return null;
  return order;
}

/** The replacement already raised for one order line, or null. All-equality query (no `orderBy`), so
 *  Firestore serves it from single-field indexes via a merge join — no composite index needed. */
export async function fetchReplacementForLine(
  uid: string,
  orderId: string,
  productId: string,
  variantId: string,
): Promise<ReplacementProps | null> {
  const snap = await getDocs(
    query(
      collection(db, FirestoreCollections.replacements),
      where('userId', '==', uid),
      where('orderId', '==', orderId),
      where('productId', '==', productId),
      where('variantId', '==', variantId),
      fsLimit(1),
    ),
  );
  const first = snap.docs[0];
  if (!first) return null;
  return { ...(first.data() as ReplacementProps), id: first.id };
}

/**
 * cancelOrder — WEB_BATCH4_NOTES.md §3: verified live (`functions/src/orders/cancelOrder.ts`) that the
 * owning customer is explicitly allowed (`isAdmin || ownsOrder`), not admin-only as an earlier prompt
 * doc claimed. Called directly for the signed-in customer; the function pins the cancel reason itself
 * for a non-admin caller, so no reason is sent from here.
 */
export async function cancelOrderCall(orderId: string): Promise<void> {
  const call = httpsCallable<{ orderId: string }, { success: boolean }>(functions, CloudFunctions.cancelOrder);
  await call({ orderId });
}

/** generateInvoicePDF: `{ orderId }` -> `{ invoiceUrl }` (verified against `functions/src/utility/
 *  generateInvoicePDF.ts`). Throws `failed-precondition` server-side unless the order is Delivered. */
export async function generateInvoiceCall(orderId: string): Promise<string> {
  const call = httpsCallable<{ orderId: string }, { invoiceUrl: string }>(functions, CloudFunctions.generateInvoicePDF);
  const res = await call({ orderId });
  return res.data.invoiceUrl;
}

/**
 * The tax-invoice seller block (spec Part 7 "Business Info").
 *
 * GAP (matches a finding already made on the Flutter side — `apps/app/lib/features/orders/domain/
 * entities/invoice_business.dart`'s own header): `packages/shared`'s `GeneralSettingsProps` models only
 * `variables`/`delivery`/`payment`/`privacy`/`terms`/`contactus`/`updatedAt` — but the deployed
 * `generateInvoicePDF` Cloud Function reads `businessName`, `businessAddress` and `businessTRN` off the
 * TOP LEVEL of the same `general/config` document (see that function's `buildPdf`). Those three fields
 * are real and live on the document; they are simply missing from the shared TS type. Rather than widen
 * a shared type used by the admin Settings screen without touching its form, this reads the raw doc
 * itself for exactly the fields it needs — same choice the Flutter app made, flagged again here.
 */
export interface InvoiceBusiness {
  name: string;
  address: string;
  gstin: string;
  trn: string;
  gstPercentage: number;
}

export async function fetchInvoiceBusiness(): Promise<InvoiceBusiness> {
  const snap = await getDoc(doc(db, FirestoreCollections.general, FirestoreDocs.generalConfig));
  const data = (snap.data() ?? {}) as Record<string, unknown>;
  const delivery = (data.delivery ?? {}) as { gstin?: string; gstPercentage?: number };
  return {
    name: typeof data.businessName === 'string' && data.businessName ? data.businessName : 'Barakath',
    address: typeof data.businessAddress === 'string' ? data.businessAddress : '',
    gstin: typeof delivery.gstin === 'string' ? delivery.gstin : '',
    trn: typeof data.businessTRN === 'string' ? data.businessTRN : '',
    gstPercentage: typeof delivery.gstPercentage === 'number' ? delivery.gstPercentage : 0,
  };
}
