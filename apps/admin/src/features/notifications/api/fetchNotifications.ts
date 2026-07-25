import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { NotificationProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import type { NotificationFilters } from '../types';

export interface NotificationsPageResult {
  items: NotificationProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
}

/**
 * notificationServerConstraints — the where() clauses that run SERVER-side for the active filters
 * (spec §1.18 list: status pills + type pills + search).
 *
 * WHY the status split maps to the booleans: a notification is "Sent" once `isSent` flips true, "Scheduled"
 * while `isScheduled` is true and not yet sent (the send path clears isScheduled), and "Draft" when neither
 * is set. Querying the boolean directly keeps the list server-paginated (no client scan). Type filters on
 * the `type` field and search on the precomputed `keywords` array (skill: no client-side search scan).
 * Each combination of these equalities + the createdAt ordering needs a composite index (see the wiring
 * report / firestore.indexes.json).
 */
function notificationServerConstraints(filters: NotificationFilters): QueryConstraint[] {
  const c: QueryConstraint[] = [];
  if (filters.searchTerm.trim()) {
    c.push(where('keywords', 'array-contains', filters.searchTerm.trim().toLowerCase()));
  }
  if (filters.type !== 'All') c.push(where('type', '==', filters.type));
  if (filters.status === 'Sent') c.push(where('isSent', '==', true));
  else if (filters.status === 'Scheduled') c.push(where('isScheduled', '==', true));
  else if (filters.status === 'Draft') {
    c.push(where('isSent', '==', false));
    c.push(where('isScheduled', '==', false));
  }
  return c;
}

/**
 * fetchNotifications — one cursor-paginated page of notifications for the active filters (spec §1.18;
 * skill mandatory pagination). Newest first, PAGE_SIZE per page, `hasMore = items.length === PAGE_SIZE`.
 *
 * WHY the query lives in the thunk (not the slice): keeps Firestore access with the state that owns it.
 * WHY `startAfter(cursor)`: Firestore has no offset — this reads only the next PAGE_SIZE docs instead of
 * re-reading skipped ones (lower billing).
 */
export const fetchNotifications = createAsyncThunk<
  NotificationsPageResult,
  { filters: NotificationFilters; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('notifications/fetchPage', async ({ filters, cursor }, { rejectWithValue }) => {
  try {
    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.notifications),
        ...notificationServerConstraints(filters),
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(Constants.PAGE_SIZE),
      ),
    );
    const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as NotificationProps);
    return {
      items,
      lastVisible: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: items.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load notifications');
  }
});
