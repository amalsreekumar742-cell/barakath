import { createAsyncThunk } from '@reduxjs/toolkit';
import { format } from 'date-fns';
import type { RootState } from '@/stores/store';
import { toCsv, downloadCsv } from '../utils/csv';
import type { ReportKey } from '../types';

/**
 * exportReport — build a CSV from whichever report is currently active and trigger a browser download
 * (spec §1.19 export, §1.22 "CSV format for all data exports").
 *
 * WHY it reads the already-loaded slice data (getState) instead of re-querying: the active report's rows
 * are already in memory from its fetch, so export is a pure client-side transform — no extra Firestore
 * reads. Rejects when the active report has no data yet (nothing to export).
 * WHY a type-only import of RootState (not a runtime import of the store): keeps the api layer free of a
 * runtime dependency on the composition root while still typing getState precisely.
 */

/** Produce [filenameStem, headers, rows] for the active report, or null if there's nothing to export. */
function buildExport(
  key: ReportKey,
  reports: RootState['reports'],
): { stem: string; headers: string[]; rows: (string | number)[][] } | null {
  switch (key) {
    case 'sales': {
      const d = reports.sales.data;
      if (!d || d.periods.length === 0) return null;
      return {
        stem: 'sales-report',
        // The revenue column is net of GST (see fetchSalesReport) — the header says so, and the tax
        // it excludes gets its own column so the sheet reconciles to the gross figure.
        headers: ['Period', 'Revenue (excl. GST)', 'GST collected', 'Orders', 'Avg Order Value'],
        rows: d.periods.map((p) => [
          p.label,
          p.revenue,
          p.gstCollected,
          p.orderCount,
          Math.round(p.avgOrderValue),
        ]),
      };
    }
    case 'category': {
      const d = reports.category.data;
      if (!d || d.items.length === 0) return null;
      return {
        stem: 'category-report',
        headers: ['Category', 'Revenue', 'Orders', 'Share %'],
        rows: d.items.map((c) => [c.categoryName, c.revenue, c.orderCount, c.percentage]),
      };
    }
    case 'product': {
      const d = reports.product.data;
      if (!d || d.items.length === 0) return null;
      return {
        stem: 'product-report',
        headers: ['Product', 'Revenue', 'Quantity', 'Orders'],
        rows: d.items.map((p) => [p.productName, p.revenue, p.quantity, p.orderCount]),
      };
    }
    case 'customer': {
      const d = reports.customer.data;
      if (!d || d.topCustomers.length === 0) return null;
      return {
        stem: 'customer-report',
        headers: ['Customer', 'Total Orders', 'Total Spent'],
        rows: d.topCustomers.map((c) => [c.fullName, c.totalOrders, c.totalSpent]),
      };
    }
    case 'payment': {
      const d = reports.payment.data;
      if (!d) return null;
      return {
        stem: 'payment-report',
        headers: ['Method', 'Count', 'Amount'],
        rows: d.byMethod.map((m) => [m.method, m.count, m.amount]),
      };
    }
    case 'inventory': {
      const d = reports.inventory.data;
      if (!d) return null;
      return {
        stem: 'inventory-report',
        headers: ['Product', 'SKU', 'Total Stock', 'Status'],
        rows: d.lowStockItems.map((i) => [i.productName, i.sku, i.totalStock, i.stockStatus]),
      };
    }
    case 'coupon': {
      const d = reports.coupon.data;
      if (!d || d.topCoupons.length === 0) return null;
      return {
        stem: 'coupon-report',
        headers: ['Code', 'Used', 'Usage Limit', 'Active'],
        rows: d.topCoupons.map((c) => [c.code, c.usedCount, c.usageLimit || '∞', c.isActive ? 'Yes' : 'No']),
      };
    }
    default:
      return null;
  }
}

export const exportReport = createAsyncThunk<number, void, { state: RootState; rejectValue: string }>(
  'reports/export',
  async (_, { getState, rejectWithValue }) => {
    try {
      const reports = getState().reports;
      const built = buildExport(reports.activeReport, reports);
      if (!built) return rejectWithValue('Nothing to export for this report yet');

      const csv = toCsv(built.headers, built.rows);
      downloadCsv(`${built.stem}-${format(new Date(), 'yyyy-MM-dd')}.csv`, csv);
      return built.rows.length;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not export report');
    }
  },
);
