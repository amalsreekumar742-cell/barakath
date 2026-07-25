import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { NotificationProps } from '@barakath/shared/types';
import { fetchNotifications } from '../api/fetchNotifications';
import { fetchNotificationStats } from '../api/fetchNotificationStats';
import { createNotification } from '../api/createNotification';
import { deleteNotification } from '../api/deleteNotification';
import { sendNotificationNow } from '../api/sendNotificationNow';
import { duplicateNotification } from '../api/duplicateNotification';
import type {
  NotificationFilters,
  NotificationStats,
  NotificationStatusFilter,
  NotificationTypeFilter,
} from '../types';

/**
 * notificationsSlice — list + status/type pills + search + stats + mutation state (spec §1.18).
 *
 * WHY changing a filter resets the list: the list is a cursor-paginated view of the CURRENT filters, so any
 * filter change clears items/cursor and the component refetches page one. Mutations patch the loaded list in
 * place — create/duplicate prepend, delete removes, send flips status in place — so the UI updates without a
 * full re-fetch. `sendLoading`/`deleteLoading` hold the id of the row acting for per-row spinners.
 */
interface NotificationsState {
  notifications: NotificationProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;

  filters: NotificationFilters;

  stats: NotificationStats;
  statsLoading: boolean;

  createLoading: boolean;
  deleteLoading: string | null;
  sendLoading: string | null;
  duplicateLoading: string | null;
}

const initialState: NotificationsState = {
  notifications: [],
  lastVisible: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
  filters: { status: 'All', type: 'All', searchTerm: '' },
  stats: { totalSent: 0, scheduled: 0, draft: 0, totalRecipients: 0 },
  statsLoading: false,
  createLoading: false,
  deleteLoading: null,
  sendLoading: null,
  duplicateLoading: null,
};

const resetList = (s: NotificationsState) => {
  s.notifications = [];
  s.lastVisible = null;
  s.hasMore = false;
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setNotificationStatusFilter(s, a: PayloadAction<NotificationStatusFilter>) {
      s.filters.status = a.payload;
      resetList(s);
    },
    setNotificationTypeFilter(s, a: PayloadAction<NotificationTypeFilter>) {
      s.filters.type = a.payload;
      resetList(s);
    },
    setNotificationSearch(s, a: PayloadAction<string>) {
      s.filters.searchTerm = a.payload;
      resetList(s);
    },
  },
  extraReducers: (builder) => {
    builder
      // --- list ---
      .addCase(fetchNotifications.pending, (s, a) => {
        if (a.meta.arg.cursor) s.loadingMore = true;
        else {
          s.loading = true;
          s.error = null;
        }
      })
      .addCase(fetchNotifications.fulfilled, (s, a) => {
        const isFirst = !a.meta.arg.cursor;
        s.loading = false;
        s.loadingMore = false;
        // Dedup by id — StrictMode / rapid "View More" can dispatch the same page twice.
        const seen = new Set(s.notifications.map((n) => n.id));
        const fresh = a.payload.items.filter((n) => !seen.has(n.id));
        s.notifications = isFirst ? a.payload.items : [...s.notifications, ...fresh];
        s.lastVisible = a.payload.lastVisible;
        s.hasMore = a.payload.hasMore;
      })
      .addCase(fetchNotifications.rejected, (s, a) => {
        s.loading = false;
        s.loadingMore = false;
        s.error = a.payload ?? 'Failed to load notifications';
      })

      // --- stats ---
      .addCase(fetchNotificationStats.pending, (s) => {
        s.statsLoading = true;
      })
      .addCase(fetchNotificationStats.fulfilled, (s, a) => {
        s.statsLoading = false;
        s.stats = a.payload;
      })
      .addCase(fetchNotificationStats.rejected, (s) => {
        s.statsLoading = false;
      })

      // --- create (prepend) ---
      .addCase(createNotification.pending, (s) => {
        s.createLoading = true;
      })
      .addCase(createNotification.fulfilled, (s, a) => {
        s.createLoading = false;
        if (!s.notifications.some((n) => n.id === a.payload.id)) s.notifications.unshift(a.payload);
        // Keep the stat row roughly in sync without a re-fetch.
        if (a.payload.isSent) {
          s.stats.totalSent += 1;
          s.stats.totalRecipients += a.payload.recipientCount;
        } else if (a.payload.isScheduled) s.stats.scheduled += 1;
        else s.stats.draft += 1;
      })
      .addCase(createNotification.rejected, (s) => {
        s.createLoading = false;
      })

      // --- delete (remove) ---
      .addCase(deleteNotification.pending, (s, a) => {
        s.deleteLoading = a.meta.arg.id;
      })
      .addCase(deleteNotification.fulfilled, (s, a) => {
        s.deleteLoading = null;
        const removed = s.notifications.find((n) => n.id === a.payload);
        s.notifications = s.notifications.filter((n) => n.id !== a.payload);
        // Only drafts/scheduled can be deleted, so decrement the matching stat.
        if (removed) {
          if (removed.isScheduled) s.stats.scheduled = Math.max(0, s.stats.scheduled - 1);
          else s.stats.draft = Math.max(0, s.stats.draft - 1);
        }
      })
      .addCase(deleteNotification.rejected, (s) => {
        s.deleteLoading = null;
      })

      // --- send now (patch in place) ---
      .addCase(sendNotificationNow.pending, (s, a) => {
        s.sendLoading = a.meta.arg.id;
      })
      .addCase(sendNotificationNow.fulfilled, (s, a) => {
        s.sendLoading = null;
        const n = s.notifications.find((x) => x.id === a.payload.id);
        if (n) {
          // Reflect the send stat transition (was scheduled or draft → now sent).
          if (n.isScheduled) s.stats.scheduled = Math.max(0, s.stats.scheduled - 1);
          else s.stats.draft = Math.max(0, s.stats.draft - 1);
          s.stats.totalSent += 1;
          s.stats.totalRecipients += a.payload.recipientCount;
          n.isSent = true;
          n.sentAt = a.payload.sentAt;
          n.isScheduled = false;
          n.scheduledAt = null;
          n.recipientCount = a.payload.recipientCount;
        }
      })
      .addCase(sendNotificationNow.rejected, (s) => {
        s.sendLoading = null;
      })

      // --- duplicate (prepend as draft) ---
      .addCase(duplicateNotification.pending, (s, a) => {
        s.duplicateLoading = a.meta.arg.source.id;
      })
      .addCase(duplicateNotification.fulfilled, (s, a) => {
        s.duplicateLoading = null;
        if (!s.notifications.some((n) => n.id === a.payload.id)) s.notifications.unshift(a.payload);
        s.stats.draft += 1;
      })
      .addCase(duplicateNotification.rejected, (s) => {
        s.duplicateLoading = null;
      });
  },
});

export const { setNotificationStatusFilter, setNotificationTypeFilter, setNotificationSearch } =
  notificationsSlice.actions;
export default notificationsSlice.reducer;
