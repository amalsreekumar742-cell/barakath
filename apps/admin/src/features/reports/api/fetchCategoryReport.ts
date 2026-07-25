import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { ProductProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { scanOrdersInRange } from './scanOrdersInRange';
import type { CategoryReportData, CategoryReportItem } from '../types';

/**
 * fetchCategoryReport — revenue and order count attributed to each category over the range, with each
 * category's share of total revenue (spec §1.19 category performance).
 *
 * WHY a client-side order scan + a product→category map (not an aggregation query): orders store their
 * line items as an array carrying only `productId` (no category), so category revenue can't be summed
 * server-side. We build a productId→categoryName lookup from the (denormalized) product docs, then walk
 * the scanned orders' items to tally revenue per category.
 *
 * TODO: move to Cloud Function — this scans raw orders + reads the product catalogue on every view. A
 * nightly `reportsDaily` rollup keyed by category would replace both reads with a single small query.
 */

/** Bounded cap on the product-catalogue lookup read. A larger catalogue truncates (TODO above removes it). */
const PRODUCT_LOOKUP_CAP = 3000;
const CHUNK = 500;

/** Read products (bounded) → productId → categoryName. */
async function buildProductCategoryMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const col = collection(db, FirestoreCollections.products);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firestore pagination cursor
  let cursor: any = null;

  while (map.size < PRODUCT_LOOKUP_CAP) {
    const snap = await getDocs(
      query(col, orderBy('name'), ...(cursor ? [startAfter(cursor)] : []), limit(CHUNK)),
    );
    if (snap.empty) break;
    for (const d of snap.docs) {
      const p = { ...d.data(), id: d.id } as ProductProps;
      map.set(p.id, p.categoryName || 'Uncategorised');
    }
    cursor = snap.docs[snap.docs.length - 1] ?? null;
    if (snap.docs.length < CHUNK) break;
  }
  return map;
}

export const fetchCategoryReport = createAsyncThunk<
  CategoryReportData,
  { from: number; to: number },
  { rejectValue: string }
>('reports/fetchCategory', async ({ from, to }, { rejectWithValue }) => {
  try {
    const [orders, productCategory] = await Promise.all([
      scanOrdersInRange(from, to),
      buildProductCategoryMap(),
    ]);

    const revenueByCat = new Map<string, number>();
    const ordersByCat = new Map<string, Set<string>>();

    for (const o of orders) {
      const seen = new Set<string>();
      for (const item of o.items) {
        const cat = productCategory.get(item.productId) ?? 'Uncategorised';
        revenueByCat.set(cat, (revenueByCat.get(cat) ?? 0) + item.subtotal);
        if (!seen.has(cat)) {
          seen.add(cat);
          if (!ordersByCat.has(cat)) ordersByCat.set(cat, new Set());
          ordersByCat.get(cat)!.add(o.id);
        }
      }
    }

    const totalRevenue = Array.from(revenueByCat.values()).reduce((a, b) => a + b, 0);
    const items: CategoryReportItem[] = Array.from(revenueByCat.entries())
      .map(([categoryName, revenue]) => ({
        categoryName,
        revenue,
        orderCount: ordersByCat.get(categoryName)?.size ?? 0,
        percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return { items, totalRevenue };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load category report');
  }
});
