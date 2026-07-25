import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { SubAdminProps } from '@barakath/shared/types';
import { fetchSubAdmins } from '../api/fetchSubAdmins';
import { fetchSubAdminCount } from '../api/fetchSubAdminCount';
import { fetchSubAdminDetail } from '../api/fetchSubAdminDetail';
import { createSubAdmin } from '../api/createSubAdmin';
import { updateSubAdmin } from '../api/updateSubAdmin';
import { deleteSubAdmin } from '../api/deleteSubAdmin';
import { toggleSubAdminStatus } from '../api/toggleSubAdminStatus';
import { resetSubAdminPassword } from '../api/resetSubAdminPassword';
import type { SubAdminFilters, SubAdminRoleFilter, SubAdminStatusFilter } from '../types';

/**
 * subAdminSlice — list + role/status filters + search + detail + mutation state (spec §1.20).
 *
 * WHY changing a filter/search resets the list: the list is a cursor-paginated view of the CURRENT
 * filters, so any filter change clears items/cursor and the component refetches page one. Mutations patch
 * the loaded list in place (prepend on create, remove on delete, flip fields on update/toggle) so the UI
 * updates without a full re-fetch. `toggleLoading`/`deleteLoading` hold the id of the affected row for
 * per-row spinners; `resetPwLoading` holds the id of the row whose reset email is in flight.
 */
interface SubAdminState {
  subAdmins: SubAdminProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;

  filters: SubAdminFilters;
  count: number;

  detail: SubAdminProps | null;
  detailLoading: boolean;
  detailError: string | null;

  createLoading: boolean;
  updateLoading: boolean;
  deleteLoading: string | null;
  toggleLoading: string | null;
  resetPwLoading: string | null;
}

const initialState: SubAdminState = {
  subAdmins: [],
  lastVisible: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  filters: { role: 'All', status: 'All', searchTerm: '' },
  count: 0,
  detail: null,
  detailLoading: false,
  detailError: null,
  createLoading: false,
  updateLoading: false,
  deleteLoading: null,
  toggleLoading: null,
  resetPwLoading: null,
};

const resetList = (s: SubAdminState) => {
  s.subAdmins = [];
  s.lastVisible = null;
  s.hasMore = false;
};

const subAdminSlice = createSlice({
  name: 'subAdmin',
  initialState,
  reducers: {
    setSubAdminRoleFilter(s, a: PayloadAction<SubAdminRoleFilter>) {
      s.filters.role = a.payload;
      resetList(s);
    },
    setSubAdminStatusFilter(s, a: PayloadAction<SubAdminStatusFilter>) {
      s.filters.status = a.payload;
      resetList(s);
    },
    setSubAdminSearch(s, a: PayloadAction<string>) {
      s.filters.searchTerm = a.payload;
      resetList(s);
    },
    resetSubAdminDetail(s) {
      s.detail = null;
      s.detailError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // --- list ---
      .addCase(fetchSubAdmins.pending, (s, a) => {
        if (a.meta.arg.cursor) s.loadingMore = true;
        else {
          s.loading = true;
          s.error = null;
        }
      })
      .addCase(fetchSubAdmins.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.loading = false;
        s.loadingMore = false;
        // Dedup by id — StrictMode / rapid "View More" can dispatch the same page twice.
        const seen = new Set(s.subAdmins.map((x) => x.id));
        const fresh = a.payload.items.filter((x) => !seen.has(x.id));
        s.subAdmins = isFirst ? a.payload.items : [...s.subAdmins, ...fresh];
        s.lastVisible = a.payload.lastVisible;
        s.hasMore = a.payload.hasMore;
      })
      .addCase(fetchSubAdmins.rejected, (s, a) => {
        s.loading = false;
        s.loadingMore = false;
        s.error = a.payload ?? 'Failed to load sub-admins';
      })

      // --- count ---
      .addCase(fetchSubAdminCount.fulfilled, (s, a) => {
        s.count = a.payload;
      })

      // --- detail ---
      .addCase(fetchSubAdminDetail.pending, (s) => {
        s.detailLoading = true;
        s.detailError = null;
      })
      .addCase(fetchSubAdminDetail.fulfilled, (s, a) => {
        s.detailLoading = false;
        s.detail = a.payload;
      })
      .addCase(fetchSubAdminDetail.rejected, (s, a) => {
        s.detailLoading = false;
        s.detailError = a.payload ?? 'Failed to load sub-admin';
      })

      // --- create (prepend) ---
      .addCase(createSubAdmin.pending, (s) => {
        s.createLoading = true;
      })
      .addCase(createSubAdmin.fulfilled, (s, a) => {
        s.createLoading = false;
        if (!s.subAdmins.some((x) => x.id === a.payload.id)) s.subAdmins.unshift(a.payload);
        s.count += 1;
      })
      .addCase(createSubAdmin.rejected, (s) => {
        s.createLoading = false;
      })

      // --- update ---
      .addCase(updateSubAdmin.pending, (s) => {
        s.updateLoading = true;
      })
      .addCase(updateSubAdmin.fulfilled, (s, a) => {
        s.updateLoading = false;
        const i = s.subAdmins.findIndex((x) => x.id === a.payload.id);
        if (i !== -1) s.subAdmins[i] = a.payload;
        if (s.detail?.id === a.payload.id) s.detail = a.payload;
      })
      .addCase(updateSubAdmin.rejected, (s) => {
        s.updateLoading = false;
      })

      // --- delete (remove) ---
      .addCase(deleteSubAdmin.pending, (s, a) => {
        s.deleteLoading = a.meta.arg.target.id;
      })
      .addCase(deleteSubAdmin.fulfilled, (s, a) => {
        s.deleteLoading = null;
        s.subAdmins = s.subAdmins.filter((x) => x.id !== a.payload);
        s.count = Math.max(0, s.count - 1);
      })
      .addCase(deleteSubAdmin.rejected, (s) => {
        s.deleteLoading = null;
      })

      // --- toggle status ---
      .addCase(toggleSubAdminStatus.pending, (s, a) => {
        s.toggleLoading = a.meta.arg.id;
      })
      .addCase(toggleSubAdminStatus.fulfilled, (s, a) => {
        s.toggleLoading = null;
        const x = s.subAdmins.find((r) => r.id === a.payload.id);
        if (x) x.status = a.payload.status;
      })
      .addCase(toggleSubAdminStatus.rejected, (s) => {
        s.toggleLoading = null;
      })

      // --- reset password ---
      .addCase(resetSubAdminPassword.pending, (s, a) => {
        s.resetPwLoading = a.meta.arg;
      })
      .addCase(resetSubAdminPassword.fulfilled, (s) => {
        s.resetPwLoading = null;
      })
      .addCase(resetSubAdminPassword.rejected, (s) => {
        s.resetPwLoading = null;
      });
  },
});

export const {
  setSubAdminRoleFilter,
  setSubAdminStatusFilter,
  setSubAdminSearch,
  resetSubAdminDetail,
} = subAdminSlice.actions;
export default subAdminSlice.reducer;
