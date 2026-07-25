import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { PaymentProps } from '@barakath/shared/types';
import { fetchPayments } from '../api/fetchPayments';
import { fetchPaymentStats } from '../api/fetchPaymentStats';
import { fetchPaymentDetail } from '../api/fetchPaymentDetail';
import { exportPaymentsCSV } from '../api/exportPaymentsCSV';
import type { PaymentFilters, PaymentStats } from '../types';
import type { PaymentDetailResult } from '../api/fetchPaymentDetail';

/* eslint-disable @typescript-eslint/no-explicit-any -- Firestore cursors are opaque QueryDocumentSnapshots */

/**
 * paymentsSlice — the payment list + filters, the summary-card stats, and the open payment detail (spec
 * §1.9).
 *
 * WHY changing a filter resets the list: the list is a cursor-paginated view of the CURRENT filters, so
 * any change clears rows/cursor and the component refetches page one. The stats are a separate
 * aggregation load, unaffected by the visible page.
 */
interface PaymentsState {
  payments: PaymentProps[];
  lastVisible: any;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;

  filters: PaymentFilters;

  stats: PaymentStats | null;
  statsLoading: boolean;

  paymentDetail: PaymentDetailResult | null;
  detailLoading: boolean;
  detailError: string | null;

  exportLoading: boolean;
}

const initialState: PaymentsState = {
  payments: [],
  lastVisible: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  filters: { status: '', method: '', searchTerm: '', dateFrom: null, dateTo: null },
  stats: null,
  statsLoading: false,
  paymentDetail: null,
  detailLoading: false,
  detailError: null,
  exportLoading: false,
};

const resetList = (s: PaymentsState) => {
  s.payments = [];
  s.lastVisible = null;
  s.hasMore = false;
};

const paymentsSlice = createSlice({
  name: 'payments',
  initialState,
  reducers: {
    setPaymentStatusFilter(s, a: PayloadAction<string>) {
      s.filters.status = a.payload;
      resetList(s);
    },
    setPaymentMethodFilter(s, a: PayloadAction<string>) {
      s.filters.method = a.payload;
      resetList(s);
    },
    setPaymentSearch(s, a: PayloadAction<string>) {
      s.filters.searchTerm = a.payload;
      resetList(s);
    },
    setPaymentDateRange(
      s,
      a: PayloadAction<{ dateFrom: PaymentFilters['dateFrom']; dateTo: PaymentFilters['dateTo'] }>,
    ) {
      s.filters.dateFrom = a.payload.dateFrom;
      s.filters.dateTo = a.payload.dateTo;
      resetList(s);
    },
    resetPaymentDetail(s) {
      s.paymentDetail = null;
      s.detailError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // --- list ---
      .addCase(fetchPayments.pending, (s, a) => {
        if (a.meta.arg.cursor) s.loadingMore = true;
        else {
          s.loading = true;
          s.error = null;
        }
      })
      .addCase(fetchPayments.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.loading = false;
        s.loadingMore = false;
        const seen = new Set(s.payments.map((p) => p.id));
        const fresh = a.payload.items.filter((p) => !seen.has(p.id));
        s.payments = isFirst ? a.payload.items : [...s.payments, ...fresh];
        s.lastVisible = a.payload.lastVisible;
        s.hasMore = a.payload.hasMore;
      })
      .addCase(fetchPayments.rejected, (s, a) => {
        s.loading = false;
        s.loadingMore = false;
        s.error = a.payload ?? 'Failed to load payments';
      })

      // --- stats ---
      .addCase(fetchPaymentStats.pending, (s) => {
        s.statsLoading = true;
      })
      .addCase(fetchPaymentStats.fulfilled, (s, a) => {
        s.statsLoading = false;
        s.stats = a.payload;
      })
      .addCase(fetchPaymentStats.rejected, (s) => {
        s.statsLoading = false;
      })

      // --- detail ---
      .addCase(fetchPaymentDetail.pending, (s) => {
        s.detailLoading = true;
        s.detailError = null;
      })
      .addCase(fetchPaymentDetail.fulfilled, (s, a) => {
        s.detailLoading = false;
        s.paymentDetail = a.payload;
      })
      .addCase(fetchPaymentDetail.rejected, (s, a) => {
        s.detailLoading = false;
        s.detailError = a.payload ?? 'Failed to load payment';
      })

      // --- export ---
      .addCase(exportPaymentsCSV.pending, (s) => {
        s.exportLoading = true;
      })
      .addCase(exportPaymentsCSV.fulfilled, (s) => {
        s.exportLoading = false;
      })
      .addCase(exportPaymentsCSV.rejected, (s) => {
        s.exportLoading = false;
      });
  },
});

export const {
  setPaymentStatusFilter,
  setPaymentMethodFilter,
  setPaymentSearch,
  setPaymentDateRange,
  resetPaymentDetail,
} = paymentsSlice.actions;
export default paymentsSlice.reducer;
