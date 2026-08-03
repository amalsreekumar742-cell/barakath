import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { OrderCostProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { scanOrdersInRange, MAX_ORDER_SCAN } from './scanOrdersInRange';
import type { ReportArgs, ProfitReportData } from '../types';

/**
 * fetchProfitReport — gross profit over the range: what customers paid for the goods, less the
 * purchase payment recorded for those goods.
 *
 * WHY it joins `orderCosts` instead of reading the order: purchase price is confidential — an order
 * document is readable by the customer who placed it, so a cost line there would show every shopper
 * the margin. `createPaymentOrder` snapshots the cost into the admin-only `orderCosts/{orderId}` at
 * purchase time (see FirestoreCollections.orderCosts).
 *
 * WHY the cost is a SNAPSHOT rather than a live read of `variantCosts`: a variant's purchase price
 * changes, and last month's profit must be measured against last month's cost.
 *
 * WHY orders without a cost record are EXCLUDED rather than treated as free: every order placed
 * before this feature existed has no cost on file, and counting them at zero cost would report each
 * one as pure profit. The report returns its own coverage (`measuredOrders` / `totalOrders`) so a
 * partial figure is visibly partial.
 */

/** Firestore caps a `documentId() in [...]` filter at 30 values. */
const ID_CHUNK = 30;

async function fetchCosts(orderIds: string[]): Promise<Map<string, OrderCostProps>> {
  const out = new Map<string, OrderCostProps>();
  const col = collection(db, FirestoreCollections.orderCosts);

  const chunks: string[][] = [];
  for (let i = 0; i < orderIds.length; i += ID_CHUNK) chunks.push(orderIds.slice(i, i + ID_CHUNK));

  // Reads by primary key, so no index and no scan — one query per 30 orders, run concurrently.
  const snaps = await Promise.all(
    chunks.map((ids) => getDocs(query(col, where(documentId(), 'in', ids)))),
  );
  for (const snap of snaps) {
    for (const d of snap.docs) out.set(d.id, { ...d.data(), orderId: d.id } as OrderCostProps);
  }
  return out;
}

export const fetchProfitReport = createAsyncThunk<
  ProfitReportData,
  ReportArgs,
  { rejectValue: string }
>('reports/fetchProfit', async ({ from, to }, { rejectWithValue }) => {
  try {
    // Same bounded, cancelled-excluded scan the category and product reports use.
    const orders = await scanOrdersInRange(from, to);
    if (orders.length === 0) {
      return {
        profit: 0,
        revenue: 0,
        cost: 0,
        marginPercent: 0,
        measuredOrders: 0,
        totalOrders: 0,
        capped: false,
      };
    }

    const costs = await fetchCosts(orders.map((o) => o.id));

    let revenue = 0;
    let cost = 0;
    let measuredOrders = 0;
    for (const order of orders) {
      const record = costs.get(order.id);
      // `costKnown` is false when ANY line lacked a purchase price — a partly-costed order would
      // understate its own cost, so it is not measurable either.
      if (!record || !record.costKnown) continue;
      revenue += record.totalSelling ?? 0;
      cost += record.totalCost ?? 0;
      measuredOrders += 1;
    }

    const profit = revenue - cost;
    return {
      profit,
      revenue,
      cost,
      marginPercent: revenue > 0 ? (profit / revenue) * 100 : 0,
      measuredOrders,
      totalOrders: orders.length,
      capped: orders.length >= MAX_ORDER_SCAN,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load profit report');
  }
});
