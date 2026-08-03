import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type {
  UserProps,
  UserAddressProps,
  WalletTransactionProps,
  AffiliateTransactionProps,
  OrderProps,
} from '@barakath/shared/types';
import { fetchCustomers } from '../api/fetchCustomers';
import { fetchCustomerCount, type CustomerCounts } from '../api/fetchCustomerCount';
import { fetchCustomerDetail } from '../api/fetchCustomerDetail';
import { fetchCustomerOrders } from '../api/fetchCustomerOrders';
import { fetchCustomerWalletTransactions } from '../api/fetchCustomerWalletTransactions';
import { fetchCustomerAffiliateTransactions } from '../api/fetchCustomerAffiliateTransactions';
import { fetchCustomerAddresses } from '../api/fetchCustomerAddresses';
import { toggleCustomerStatus } from '../api/toggleCustomerStatus';
import { addWalletMoney } from '../api/addWalletMoney';
import { setAffiliateEnabled } from '../api/setAffiliateEnabled';
import { exportCustomersCSV } from '../api/exportCustomersCSV';
import { exportCustomerTabCSV } from '../api/exportCustomerTabCSV';
import type { CustomerFilters, CustomerTab } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any -- Firestore cursors are opaque QueryDocumentSnapshots */

/**
 * customersSlice — the customer list + its filters, and the detail page's four lazily-loaded data tabs
 * (orders / wallet / affiliate / addresses) plus the block and add-wallet actions (spec §1.8).
 *
 * WHY changing a filter resets the list: the list is a cursor-paginated view of the CURRENT filters, so
 * any change clears the rows/cursor and the component refetches page one. WHY each tab keeps its own
 * items/cursor/loading: the tabs load independently on first activation (lazy) and paginate separately.
 * On block/unblock and add-wallet we patch the loaded row + detail locally so the UI stays correct
 * without a refetch.
 */
interface CustomersState {
  customers: UserProps[];
  lastVisible: any;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;

  filters: CustomerFilters;

  counts: CustomerCounts;

  customerDetail: UserProps | null;
  detailLoading: boolean;
  detailError: string | null;

  customerOrders: OrderProps[];
  ordersLastVisible: any;
  ordersHasMore: boolean;
  ordersLoading: boolean;
  ordersLoadingMore: boolean;

  walletTransactions: WalletTransactionProps[];
  walletLastVisible: any;
  walletHasMore: boolean;
  walletLoading: boolean;
  walletLoadingMore: boolean;

  affiliateTransactions: AffiliateTransactionProps[];
  affiliateLastVisible: any;
  affiliateHasMore: boolean;
  affiliateLoading: boolean;
  affiliateLoadingMore: boolean;

  addresses: UserAddressProps[];
  addressesLoading: boolean;

  toggleStatusLoading: boolean;
  addWalletLoading: boolean;
  exportLoading: boolean;
  exportTabLoading: boolean;
  affiliateToggleLoading: boolean;

  activeTab: CustomerTab;
}

const initialState: CustomersState = {
  customers: [],
  lastVisible: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  filters: { status: '', searchTerm: '' },
  counts: { total: 0, active: 0, blocked: 0 },
  customerDetail: null,
  detailLoading: false,
  detailError: null,
  customerOrders: [],
  ordersLastVisible: null,
  ordersHasMore: false,
  ordersLoading: false,
  ordersLoadingMore: false,
  walletTransactions: [],
  walletLastVisible: null,
  walletHasMore: false,
  walletLoading: false,
  walletLoadingMore: false,
  affiliateTransactions: [],
  affiliateLastVisible: null,
  affiliateHasMore: false,
  affiliateLoading: false,
  affiliateLoadingMore: false,
  addresses: [],
  addressesLoading: false,
  toggleStatusLoading: false,
  addWalletLoading: false,
  exportLoading: false,
  exportTabLoading: false,
  affiliateToggleLoading: false,
  activeTab: 'orders',
};

const resetList = (s: CustomersState) => {
  s.customers = [];
  s.lastVisible = null;
  s.hasMore = false;
};

/** Dedup helper: append only ids not already present (StrictMode / rapid scroll can double-dispatch). */
const appendDedup = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
  const seen = new Set(existing.map((x) => x.id));
  return [...existing, ...incoming.filter((x) => !seen.has(x.id))];
};

const customersSlice = createSlice({
  name: 'customers',
  initialState,
  reducers: {
    setCustomerStatusFilter(s, a: PayloadAction<string>) {
      s.filters.status = a.payload;
      resetList(s);
    },
    setCustomerSearch(s, a: PayloadAction<string>) {
      s.filters.searchTerm = a.payload;
      resetList(s);
    },
    setCustomerTab(s, a: PayloadAction<CustomerTab>) {
      s.activeTab = a.payload;
    },
    /** Clear the detail + all tab data when leaving the detail page. */
    resetCustomerDetail(s) {
      s.customerDetail = null;
      s.detailError = null;
      s.activeTab = 'orders';
      s.customerOrders = [];
      s.ordersLastVisible = null;
      s.ordersHasMore = false;
      s.walletTransactions = [];
      s.walletLastVisible = null;
      s.walletHasMore = false;
      s.affiliateTransactions = [];
      s.affiliateLastVisible = null;
      s.affiliateHasMore = false;
      s.addresses = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // --- list ---
      .addCase(fetchCustomers.pending, (s, a) => {
        if (a.meta.arg.cursor) s.loadingMore = true;
        else {
          s.loading = true;
          s.error = null;
        }
      })
      .addCase(fetchCustomers.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.loading = false;
        s.loadingMore = false;
        s.customers = isFirst ? a.payload.items : appendDedup(s.customers, a.payload.items);
        s.lastVisible = a.payload.lastVisible;
        s.hasMore = a.payload.hasMore;
      })
      .addCase(fetchCustomers.rejected, (s, a) => {
        s.loading = false;
        s.loadingMore = false;
        s.error = a.payload ?? 'Failed to load customers';
      })

      // --- header count ---
      .addCase(fetchCustomerCount.fulfilled, (s, a) => {
        s.counts = a.payload;
      })

      // --- detail ---
      .addCase(fetchCustomerDetail.pending, (s) => {
        s.detailLoading = true;
        s.detailError = null;
      })
      .addCase(fetchCustomerDetail.fulfilled, (s, a) => {
        s.detailLoading = false;
        s.customerDetail = a.payload;
      })
      .addCase(fetchCustomerDetail.rejected, (s, a) => {
        s.detailLoading = false;
        s.detailError = a.payload ?? 'Failed to load customer';
      })

      // --- orders tab ---
      .addCase(fetchCustomerOrders.pending, (s, a) => {
        if (a.meta.arg.cursor) s.ordersLoadingMore = true;
        else s.ordersLoading = true;
      })
      .addCase(fetchCustomerOrders.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.ordersLoading = false;
        s.ordersLoadingMore = false;
        s.customerOrders = isFirst ? a.payload.items : appendDedup(s.customerOrders, a.payload.items);
        s.ordersLastVisible = a.payload.lastVisible;
        s.ordersHasMore = a.payload.hasMore;
      })
      .addCase(fetchCustomerOrders.rejected, (s) => {
        s.ordersLoading = false;
        s.ordersLoadingMore = false;
      })

      // --- wallet tab ---
      .addCase(fetchCustomerWalletTransactions.pending, (s, a) => {
        if (a.meta.arg.cursor) s.walletLoadingMore = true;
        else s.walletLoading = true;
      })
      .addCase(fetchCustomerWalletTransactions.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.walletLoading = false;
        s.walletLoadingMore = false;
        s.walletTransactions = isFirst
          ? a.payload.items
          : appendDedup(s.walletTransactions, a.payload.items);
        s.walletLastVisible = a.payload.lastVisible;
        s.walletHasMore = a.payload.hasMore;
      })
      .addCase(fetchCustomerWalletTransactions.rejected, (s) => {
        s.walletLoading = false;
        s.walletLoadingMore = false;
      })

      // --- affiliate tab ---
      .addCase(fetchCustomerAffiliateTransactions.pending, (s, a) => {
        if (a.meta.arg.cursor) s.affiliateLoadingMore = true;
        else s.affiliateLoading = true;
      })
      .addCase(fetchCustomerAffiliateTransactions.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.affiliateLoading = false;
        s.affiliateLoadingMore = false;
        s.affiliateTransactions = isFirst
          ? a.payload.items
          : appendDedup(s.affiliateTransactions, a.payload.items);
        s.affiliateLastVisible = a.payload.lastVisible;
        s.affiliateHasMore = a.payload.hasMore;
      })
      .addCase(fetchCustomerAffiliateTransactions.rejected, (s) => {
        s.affiliateLoading = false;
        s.affiliateLoadingMore = false;
      })

      // --- addresses tab ---
      .addCase(fetchCustomerAddresses.pending, (s) => {
        s.addressesLoading = true;
      })
      .addCase(fetchCustomerAddresses.fulfilled, (s, a) => {
        s.addressesLoading = false;
        s.addresses = a.payload;
      })
      .addCase(fetchCustomerAddresses.rejected, (s) => {
        s.addressesLoading = false;
      })

      // --- block / unblock ---
      .addCase(toggleCustomerStatus.pending, (s) => {
        s.toggleStatusLoading = true;
      })
      .addCase(toggleCustomerStatus.fulfilled, (s, a) => {
        s.toggleStatusLoading = false;
        const { userId, status } = a.payload;
        const row = s.customers.find((c) => c.id === userId);
        if (row) row.status = status;
        if (s.customerDetail?.id === userId) s.customerDetail.status = status;
      })
      .addCase(toggleCustomerStatus.rejected, (s) => {
        s.toggleStatusLoading = false;
      })

      // --- add wallet money ---
      .addCase(addWalletMoney.pending, (s) => {
        s.addWalletLoading = true;
      })
      .addCase(addWalletMoney.fulfilled, (s, a) => {
        s.addWalletLoading = false;
        const { transaction, amount } = a.payload;
        // Prepend the new ledger row (only when the wallet tab is loaded) and bump the visible balance.
        if (s.customerDetail?.id === transaction.userId) {
          s.customerDetail.walletBalance = (s.customerDetail.walletBalance ?? 0) + amount;
        }
        s.walletTransactions = [transaction, ...s.walletTransactions];
        const row = s.customers.find((c) => c.id === transaction.userId);
        if (row) row.walletBalance = (row.walletBalance ?? 0) + amount;
      })
      .addCase(addWalletMoney.rejected, (s) => {
        s.addWalletLoading = false;
      })

      // --- affiliate marketing toggle ---
      .addCase(setAffiliateEnabled.pending, (s) => {
        s.affiliateToggleLoading = true;
      })
      .addCase(setAffiliateEnabled.fulfilled, (s, a) => {
        s.affiliateToggleLoading = false;
        const { userId, affiliateCode, affiliateEnabled } = a.payload;
        if (s.customerDetail?.id === userId) {
          s.customerDetail.affiliateEnabled = affiliateEnabled;
          if (affiliateCode) {
            s.customerDetail.affiliateCode = affiliateCode;
          }
        }
      })
      .addCase(setAffiliateEnabled.rejected, (s) => {
        s.affiliateToggleLoading = false;
      })

      // --- export ---
      .addCase(exportCustomersCSV.pending, (s) => {
        s.exportLoading = true;
      })
      .addCase(exportCustomersCSV.fulfilled, (s) => {
        s.exportLoading = false;
      })
      .addCase(exportCustomersCSV.rejected, (s) => {
        s.exportLoading = false;
      })
      .addCase(exportCustomerTabCSV.pending, (s) => {
        s.exportTabLoading = true;
      })
      .addCase(exportCustomerTabCSV.fulfilled, (s) => {
        s.exportTabLoading = false;
      })
      .addCase(exportCustomerTabCSV.rejected, (s) => {
        s.exportTabLoading = false;
      });
  },
});

export const {
  setCustomerStatusFilter,
  setCustomerSearch,
  setCustomerTab,
  resetCustomerDetail,
} = customersSlice.actions;
export default customersSlice.reducer;
