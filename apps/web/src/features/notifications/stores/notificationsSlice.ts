import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { NotificationProps } from '@barakath/shared';

/**
 * Broadcast and targeted notifications, plus the header's unread dot.
 *
 * WHY read state is a local id list rather than a field on the notification: a notification document
 * is shared across every recipient of a broadcast, so "read" cannot live on it — one person opening
 * it would mark it read for everyone. The ids are held per browser.
 *
 * WHY `unreadCount` is stored rather than derived from `items.length - readIds.length`: the header
 * shows the badge on every page, but the list is only fetched on the notifications page and is
 * paginated. Deriving from a page of twelve would show "12" to someone with a hundred unread.
 */
export interface NotificationsState {
  items: NotificationProps[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  /** Ids this browser has opened. */
  readIds: string[];
  /** Server-side count for the header badge — not derived from the loaded page. */
  unreadCount: number;
  error: string | null;
}

const initialState: NotificationsState = {
  items: [],
  loading: false,
  loadingMore: false,
  hasMore: false,
  readIds: [],
  unreadCount: 0,
  error: null,
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setNotificationsPage(
      state,
      action: PayloadAction<{ items: NotificationProps[]; hasMore: boolean; append: boolean }>,
    ) {
      const { items, hasMore, append } = action.payload;
      if (append) {
        const seen = new Set(state.items.map((n) => n.id));
        state.items = [...state.items, ...items.filter((n) => !seen.has(n.id))];
      } else {
        state.items = items;
      }
      state.hasMore = hasMore;
    },
    setNotificationsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setNotificationsLoadingMore(state, action: PayloadAction<boolean>) {
      state.loadingMore = action.payload;
    },
    setReadIds(state, action: PayloadAction<string[]>) {
      state.readIds = action.payload;
    },
    markRead(state, action: PayloadAction<string>) {
      if (state.readIds.includes(action.payload)) return;
      state.readIds.push(action.payload);
      state.unreadCount = Math.max(0, state.unreadCount - 1);
    },
    setUnreadCount(state, action: PayloadAction<number>) {
      state.unreadCount = Math.max(0, action.payload);
    },
    setNotificationsError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const {
  setNotificationsPage,
  setNotificationsLoading,
  setNotificationsLoadingMore,
  setReadIds,
  markRead,
  setUnreadCount,
  setNotificationsError,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;
