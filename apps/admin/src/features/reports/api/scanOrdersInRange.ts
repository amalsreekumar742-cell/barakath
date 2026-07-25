import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { OrderStatus } from '@barakath/shared/config/enums';
import type { OrderProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import type { ScannedOrder } from '../types';

/**
 * Upper bound on how many orders a single client-side report scan will read. Reports that need
 * item-level detail (category revenue, per-product revenue) cannot use aggregation queries — items live
 * in an array on each order — so they page the orders collection. This cap keeps a worst-case scan
 * bounded (skill: never an unbounded collection read).
 *
 * TODO: move to Cloud Function — the category and product reports should read a nightly pre-aggregated
 * rollup (revenue-by-category / revenue-by-product per day) instead of scanning raw orders here. Once
 * that exists, delete this scan and query the rollup collection directly.
 */
export const MAX_ORDER_SCAN = 5000;
const CHUNK = 500;

/**
 * scanOrdersInRange — page through non-cancelled orders in [from, to] and project each to a trimmed
 * `ScannedOrder` (id, totals, coupon, items) for the item-level reports.
 *
 * WHY paged 500-doc chunks with a hard cap (not one big read): Firestore has no offset and a full-range
 * read of a large collection would be unbounded/expensive; chunked `startAfter` reads only what's needed
 * up to MAX_ORDER_SCAN, then stops (the callers surface that the figure is a bounded estimate).
 * WHY cancelled orders are filtered client-side (not `where status != Cancelled`): combining a `!=`
 * with the createdAt range would force a second inequality field + composite index on the SCAN path;
 * for a full-doc scan it's cheaper to drop cancelled rows in memory.
 */
export async function scanOrdersInRange(fromMs: number, toMs: number): Promise<ScannedOrder[]> {
  const col = collection(db, FirestoreCollections.orders);
  const from = Timestamp.fromDate(new Date(fromMs));
  const to = Timestamp.fromDate(new Date(toMs));

  const out: ScannedOrder[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firestore pagination cursor
  let cursor: any = null;

  while (out.length < MAX_ORDER_SCAN) {
    const snap = await getDocs(
      query(
        col,
        where('createdAt', '>=', from),
        where('createdAt', '<=', to),
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(CHUNK),
      ),
    );
    if (snap.empty) break;

    for (const d of snap.docs) {
      const o = { ...d.data(), id: d.id } as OrderProps;
      if (o.status === OrderStatus.CANCELLED) continue;
      out.push({
        id: o.id,
        grandTotal: o.grandTotal ?? 0,
        couponCode: o.couponCode ?? '',
        couponDiscount: o.couponDiscount ?? 0,
        createdAt: o.createdAt ?? null,
        items: (o.items ?? []).map((it) => ({
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity ?? 0,
          subtotal: it.subtotal ?? 0,
        })),
      });
    }

    cursor = snap.docs[snap.docs.length - 1] ?? null;
    if (snap.docs.length < CHUNK) break;
  }

  return out;
}
