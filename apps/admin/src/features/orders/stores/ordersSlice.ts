import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { OrderProps } from '@barakath/shared/types';
import { OrderStatus } from '@barakath/shared/config/enums';
import { fetchOrders } from '../api/fetchOrders';
import { fetchOrderDetail } from '../api/fetchOrderDetail';
import { fetchOrderStatusCounts } from '../api/fetchOrderStatusCounts';
import { updateOrderStatus } from '../api/updateOrderStatus';
import { exportOrdersCSV } from '../api/exportOrdersCSV';
import type { OrderFilters, OrderStatusCounts } from '../types';

/**
 * ordersSlice — list + status tabs + detail + status-update state (spec §1.7).
 *
 * WHY changing the status tab / filters resets the list: the list is a cursor-paginated view of the
 * CURRENT filters, so any change clears orders/cursor and the component refetches page one. On a
 * successful status update we patch the order in the list AND the open detail, and shift the tab counts
 * (−1 from the old status, +1 to the new) so the badges stay correct without a full re-count.
 */
interface OrdersState {
  orders: OrderProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;

  filters: OrderFilters;

  statusCounts: OrderStatusCounts;
  statusCountsLoading: boolean;

  orderDetail: OrderProps | null;
  detailLoading: boolean;
  detailError: string | null;

  updateStatusLoading: boolean;
  exportLoading: boolean;
}

const initialState: OrdersState = {
  orders: [],
  lastVisible: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  filters: { status: '', searchTerm: '', dateFrom: null, dateTo: null },
  statusCounts: {
    all: 0,
    pending: 0,
    accepted: 0,
    packed: 0,
    shipped: 0,
    outForDelivery: 0,
    delivered: 0,
    cancelled: 0,
  },
  statusCountsLoading: false,
  orderDetail: null,
  detailLoading: false,
  detailError: null,
  updateStatusLoading: false,
  exportLoading: false,
};

const resetList = (s: OrdersState) => {
  s.orders = [];
  s.lastVisible = null;
  s.hasMore = false;
};

/** Map an OrderStatus string to its key in the counts object. */
const COUNT_KEY: Record<string, keyof OrderStatusCounts> = {
  [OrderStatus.PENDING]: 'pending',
  [OrderStatus.ACCEPTED]: 'accepted',
  [OrderStatus.PACKED]: 'packed',
  [OrderStatus.SHIPPED]: 'shipped',
  [OrderStatus.OUT_FOR_DELIVERY]: 'outForDelivery',
  [OrderStatus.DELIVERED]: 'delivered',
  [OrderStatus.CANCELLED]: 'cancelled',
};

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setStatusFilter(s, a: PayloadAction<string>) {
      s.filters.status = a.payload;
      resetList(s);
    },
    setOrderSearch(s, a: PayloadAction<string>) {
      s.filters.searchTerm = a.payload;
      resetList(s);
    },
    setOrderDateRange(s, a: PayloadAction<{ dateFrom: OrderFilters['dateFrom']; dateTo: OrderFilters['dateTo'] }>) {
      s.filters.dateFrom = a.payload.dateFrom;
      s.filters.dateTo = a.payload.dateTo;
      resetList(s);
    },
    resetOrderDetail(s) {
      s.orderDetail = null;
      s.detailError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // --- list ---
      .addCase(fetchOrders.pending, (s, a) => {
        if (a.meta.arg.cursor) s.loadingMore = true;
        else {
          s.loading = true;
          s.error = null;
        }
      })
      .addCase(fetchOrders.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.loading = false;
        s.loadingMore = false;
        const seen = new Set(s.orders.map((o) => o.id));
        const fresh = a.payload.items.filter((o) => !seen.has(o.id));
        s.orders = isFirst ? a.payload.items : [...s.orders, ...fresh];
        s.lastVisible = a.payload.lastVisible;
        s.hasMore = a.payload.hasMore;
      })
      .addCase(fetchOrders.rejected, (s, a) => {
        s.loading = false;
        s.loadingMore = false;
        s.error = a.payload ?? 'Failed to load orders';
      })

      // --- status counts ---
      .addCase(fetchOrderStatusCounts.pending, (s) => {
        s.statusCountsLoading = true;
      })
      .addCase(fetchOrderStatusCounts.fulfilled, (s, a) => {
        s.statusCountsLoading = false;
        s.statusCounts = a.payload;
      })
      .addCase(fetchOrderStatusCounts.rejected, (s) => {
        s.statusCountsLoading = false;
      })

      // --- detail ---
      .addCase(fetchOrderDetail.pending, (s) => {
        s.detailLoading = true;
        s.detailError = null;
      })
      .addCase(fetchOrderDetail.fulfilled, (s, a) => {
        s.detailLoading = false;
        s.orderDetail = a.payload;
      })
      .addCase(fetchOrderDetail.rejected, (s, a) => {
        s.detailLoading = false;
        s.detailError = a.payload ?? 'Failed to load order';
      })

      // --- update status ---
      .addCase(updateOrderStatus.pending, (s) => {
        s.updateStatusLoading = true;
      })
      .addCase(updateOrderStatus.fulfilled, (s, a) => {
        s.updateStatusLoading = false;
        const { order, previousStatus } = a.payload;
        const i = s.orders.findIndex((o) => o.id === order.id);
        if (i !== -1) s.orders[i] = order;
        if (s.orderDetail?.id === order.id) s.orderDetail = order;
        // Shift the tab counts: −1 old status, +1 new status (total unchanged).
        if (previousStatus !== order.status) {
          const from = COUNT_KEY[previousStatus];
          const to = COUNT_KEY[order.status];
          if (from) s.statusCounts[from] = Math.max(0, s.statusCounts[from] - 1);
          if (to) s.statusCounts[to] += 1;
        }
      })
      .addCase(updateOrderStatus.rejected, (s) => {
        s.updateStatusLoading = false;
      })

      // --- export ---
      .addCase(exportOrdersCSV.pending, (s) => {
        s.exportLoading = true;
      })
      .addCase(exportOrdersCSV.fulfilled, (s) => {
        s.exportLoading = false;
      })
      .addCase(exportOrdersCSV.rejected, (s) => {
        s.exportLoading = false;
      });
  },
});

export const { setStatusFilter, setOrderSearch, setOrderDateRange, resetOrderDetail } =
  ordersSlice.actions;
export default ordersSlice.reducer;
