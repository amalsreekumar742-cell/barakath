import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { endOfDay, startOfYear } from 'date-fns';
import { fetchSalesReport } from '../api/fetchSalesReport';
import { fetchProfitReport } from '../api/fetchProfitReport';
import { fetchCategoryReport } from '../api/fetchCategoryReport';
import { fetchProductReport } from '../api/fetchProductReport';
import { fetchCustomerReport } from '../api/fetchCustomerReport';
import { fetchPaymentReport } from '../api/fetchPaymentReport';
import { fetchInventoryReport } from '../api/fetchInventoryReport';
import { fetchCouponReport } from '../api/fetchCouponReport';
import { exportReport } from '../api/exportReport';
import type {
  ReportKey,
  GroupBy,
  DateRange,
  ReportSection,
  SalesReportData,
  ProfitReportData,
  CategoryReportData,
  ProductReportData,
  CustomerReportData,
  PaymentReportData,
  InventoryReportData,
  CouponReportData,
} from '../types';

/**
 * reportsSlice — owns the shared date range + Sales grouping and each of the seven reports' async
 * sections (spec §1.19).
 *
 * WHY dates as epoch millis (not Timestamp): Redux state must stay serializable — the thunks convert to
 * Timestamp at the query edge. WHY one section per report (not a single global loading flag): each tab
 * loads/fails independently and shows its own skeleton/retry (skill: explicit named loading|error|data).
 * A date-range or grouping change re-fetches only the ACTIVE report — the ReportsPage effect owns that.
 */

interface ReportsState {
  dateRange: DateRange;
  groupBy: GroupBy;
  activeReport: ReportKey;
  exportLoading: boolean;
  sales: ReportSection<SalesReportData | null>;
  /**
   * Loaded independently of `sales`: profit needs a bounded order scan plus a cost join, revenue needs
   * only aggregation queries. Sharing a section would make the fast card wait for the slow one.
   */
  profit: ReportSection<ProfitReportData | null>;
  category: ReportSection<CategoryReportData | null>;
  product: ReportSection<ProductReportData | null>;
  customer: ReportSection<CustomerReportData | null>;
  payment: ReportSection<PaymentReportData | null>;
  inventory: ReportSection<InventoryReportData | null>;
  coupon: ReportSection<CouponReportData | null>;
}

const section = <T>(data: T): ReportSection<T> => ({ data, loading: false, error: null });

/** Default window: this year to date, grouped by month — feeds the overview's "Revenue by month" bars. */
const now = new Date();
const initialState: ReportsState = {
  dateRange: {
    from: startOfYear(now).getTime(),
    to: endOfDay(now).getTime(),
  },
  groupBy: 'month',
  activeReport: 'sales',
  exportLoading: false,
  sales: section(null),
  profit: section(null),
  category: section(null),
  product: section(null),
  customer: section(null),
  payment: section(null),
  inventory: section(null),
  coupon: section(null),
};

const reportsSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    setDateRange(state, action: PayloadAction<DateRange>) {
      state.dateRange = action.payload;
    },
    setGroupBy(state, action: PayloadAction<GroupBy>) {
      state.groupBy = action.payload;
    },
    setActiveReport(state, action: PayloadAction<ReportKey>) {
      state.activeReport = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // --- sales ---
      .addCase(fetchSalesReport.pending, (s) => {
        s.sales.loading = true;
        s.sales.error = null;
      })
      .addCase(fetchSalesReport.fulfilled, (s, a) => {
        s.sales.loading = false;
        s.sales.data = a.payload;
      })
      .addCase(fetchSalesReport.rejected, (s, a) => {
        s.sales.loading = false;
        s.sales.error = a.payload ?? 'Failed to load sales report';
      })
      // --- profit ---
      .addCase(fetchProfitReport.pending, (s) => {
        s.profit.loading = true;
        s.profit.error = null;
      })
      .addCase(fetchProfitReport.fulfilled, (s, a) => {
        s.profit.loading = false;
        s.profit.data = a.payload;
      })
      .addCase(fetchProfitReport.rejected, (s, a) => {
        s.profit.loading = false;
        s.profit.error = a.payload ?? 'Failed to load profit report';
      })
      // --- category ---
      .addCase(fetchCategoryReport.pending, (s) => {
        s.category.loading = true;
        s.category.error = null;
      })
      .addCase(fetchCategoryReport.fulfilled, (s, a) => {
        s.category.loading = false;
        s.category.data = a.payload;
      })
      .addCase(fetchCategoryReport.rejected, (s, a) => {
        s.category.loading = false;
        s.category.error = a.payload ?? 'Failed to load category report';
      })
      // --- product ---
      .addCase(fetchProductReport.pending, (s) => {
        s.product.loading = true;
        s.product.error = null;
      })
      .addCase(fetchProductReport.fulfilled, (s, a) => {
        s.product.loading = false;
        s.product.data = a.payload;
      })
      .addCase(fetchProductReport.rejected, (s, a) => {
        s.product.loading = false;
        s.product.error = a.payload ?? 'Failed to load product report';
      })
      // --- customer ---
      .addCase(fetchCustomerReport.pending, (s) => {
        s.customer.loading = true;
        s.customer.error = null;
      })
      .addCase(fetchCustomerReport.fulfilled, (s, a) => {
        s.customer.loading = false;
        s.customer.data = a.payload;
      })
      .addCase(fetchCustomerReport.rejected, (s, a) => {
        s.customer.loading = false;
        s.customer.error = a.payload ?? 'Failed to load customer report';
      })
      // --- payment ---
      .addCase(fetchPaymentReport.pending, (s) => {
        s.payment.loading = true;
        s.payment.error = null;
      })
      .addCase(fetchPaymentReport.fulfilled, (s, a) => {
        s.payment.loading = false;
        s.payment.data = a.payload;
      })
      .addCase(fetchPaymentReport.rejected, (s, a) => {
        s.payment.loading = false;
        s.payment.error = a.payload ?? 'Failed to load payment report';
      })
      // --- inventory ---
      .addCase(fetchInventoryReport.pending, (s) => {
        s.inventory.loading = true;
        s.inventory.error = null;
      })
      .addCase(fetchInventoryReport.fulfilled, (s, a) => {
        s.inventory.loading = false;
        s.inventory.data = a.payload;
      })
      .addCase(fetchInventoryReport.rejected, (s, a) => {
        s.inventory.loading = false;
        s.inventory.error = a.payload ?? 'Failed to load inventory report';
      })
      // --- coupon ---
      .addCase(fetchCouponReport.pending, (s) => {
        s.coupon.loading = true;
        s.coupon.error = null;
      })
      .addCase(fetchCouponReport.fulfilled, (s, a) => {
        s.coupon.loading = false;
        s.coupon.data = a.payload;
      })
      .addCase(fetchCouponReport.rejected, (s, a) => {
        s.coupon.loading = false;
        s.coupon.error = a.payload ?? 'Failed to load coupon report';
      })
      // --- export (loading flag only; success/failure surfaced via toast in the UI) ---
      .addCase(exportReport.pending, (s) => {
        s.exportLoading = true;
      })
      .addCase(exportReport.fulfilled, (s) => {
        s.exportLoading = false;
      })
      .addCase(exportReport.rejected, (s) => {
        s.exportLoading = false;
      });
  },
});

export const { setDateRange, setGroupBy, setActiveReport } = reportsSlice.actions;
export default reportsSlice.reducer;
