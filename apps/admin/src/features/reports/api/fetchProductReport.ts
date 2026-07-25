import { createAsyncThunk } from '@reduxjs/toolkit';
import { scanOrdersInRange } from './scanOrdersInRange';
import type { ProductReportData, ProductReportItem } from '../types';

/**
 * fetchProductReport — top products by revenue (and quantity sold) over the range (spec §1.19 "Top 5
 * products with revenue"; we return a longer list and the component shows the top N).
 *
 * WHY a client-side order scan (not aggregation): revenue/quantity per product must be summed from each
 * order's item array, which aggregation queries can't reach. We tally per productId across the scanned
 * orders and return the list sorted by revenue.
 *
 * TODO: pre-aggregate in Cloud Function — a nightly product-revenue rollup would replace this raw-order
 * scan with one small read; this client scan is a bounded (MAX_ORDER_SCAN) stopgap.
 */

const TOP_N = 20;

export const fetchProductReport = createAsyncThunk<
  ProductReportData,
  { from: number; to: number },
  { rejectValue: string }
>('reports/fetchProduct', async ({ from, to }, { rejectWithValue }) => {
  try {
    const orders = await scanOrdersInRange(from, to);

    const acc = new Map<string, ProductReportItem>();
    for (const o of orders) {
      const seen = new Set<string>();
      for (const item of o.items) {
        const cur =
          acc.get(item.productId) ??
          ({
            productId: item.productId,
            productName: item.productName,
            revenue: 0,
            quantity: 0,
            orderCount: 0,
          } as ProductReportItem);
        cur.revenue += item.subtotal;
        cur.quantity += item.quantity;
        if (!seen.has(item.productId)) {
          seen.add(item.productId);
          cur.orderCount += 1;
        }
        acc.set(item.productId, cur);
      }
    }

    const items = Array.from(acc.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, TOP_N);

    return { items };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load product report');
  }
});
