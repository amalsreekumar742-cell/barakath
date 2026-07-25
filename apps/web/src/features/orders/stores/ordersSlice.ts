import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OrderProps, ReplacementProps } from '@barakath/shared';

/**
 * Order history and the currently-open order.
 *
 * WHY the list and the detail live in one slice: opening an order from the list should not re-read
 * a document the list already holds, and going back should not re-page the list. One slice lets the
 * detail screen seed itself from the list and only fetch when it genuinely arrived cold (a shared
 * link, a refresh).
 *
 * WHY `hasMore` is stored rather than inferred from the item count: a short page means the end, but
 * so does an empty first page — and `items.length < PAGE_SIZE` cannot tell "no orders yet" from
 * "still loading". Named state, never a null-check (web skill).
 *
 * WHY `replacements` is keyed `productId|variantId`: a replacement is raised against one LINE of an
 * order, not the order, and the same product in two sizes is two independently returnable lines.
 */
export type OrderFilter = 'all' | 'active' | 'delivered' | 'cancelled';

export interface OrdersState {
  items: OrderProps[];
  filter: OrderFilter;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  /** The open order. Null until one is selected or fetched. */
  detail: OrderProps | null;
  detailLoading: boolean;
  /** `productId|variantId` → the replacement already raised for that line. */
  replacements: Record<string, ReplacementProps>;
  /** A cancel or replacement submission is in flight — drives the button spinner. */
  submitting: boolean;
  error: string | null;
}

const initialState: OrdersState = {
  items: [],
  filter: 'all',
  loading: false,
  loadingMore: false,
  hasMore: false,
  detail: null,
  detailLoading: false,
  replacements: {},
  submitting: false,
  error: null,
};

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setOrdersFilter(state, action: PayloadAction<OrderFilter>) {
      state.filter = action.payload;
      // A different filter is a different list — keeping the old rows would show cancelled orders
      // under "Delivered" for as long as the fetch takes.
      state.items = [];
      state.hasMore = false;
    },
    setOrdersPage(
      state,
      action: PayloadAction<{ items: OrderProps[]; hasMore: boolean; append: boolean }>,
    ) {
      const { items, hasMore, append } = action.payload;
      if (append) {
        // Dedup by id: React StrictMode and a fast scroll can both dispatch the same page twice.
        const seen = new Set(state.items.map((o) => o.id));
        state.items = [...state.items, ...items.filter((o) => !seen.has(o.id))];
      } else {
        state.items = items;
      }
      state.hasMore = hasMore;
    },
    setOrdersLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setOrdersLoadingMore(state, action: PayloadAction<boolean>) {
      state.loadingMore = action.payload;
    },
    setOrderDetail(state, action: PayloadAction<OrderProps | null>) {
      state.detail = action.payload;
    },
    setOrderDetailLoading(state, action: PayloadAction<boolean>) {
      state.detailLoading = action.payload;
    },
    setOrderReplacements(state, action: PayloadAction<Record<string, ReplacementProps>>) {
      state.replacements = action.payload;
    },
    setOrdersSubmitting(state, action: PayloadAction<boolean>) {
      state.submitting = action.payload;
    },
    setOrdersError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const {
  setOrdersFilter,
  setOrdersPage,
  setOrdersLoading,
  setOrdersLoadingMore,
  setOrderDetail,
  setOrderDetailLoading,
  setOrderReplacements,
  setOrdersSubmitting,
  setOrdersError,
} = ordersSlice.actions;

export default ordersSlice.reducer;
