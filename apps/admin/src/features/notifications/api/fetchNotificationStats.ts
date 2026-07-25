import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  getCountFromServer,
  getAggregateFromServer,
  sum,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';
import type { NotificationStats } from '../types';

/**
 * fetchNotificationStats — the four headline figures on the list (spec §1.18: Total Sent / Scheduled /
 * Drafts / Total Recipients).
 *
 * WHY aggregation queries (getCountFromServer / getAggregateFromServer, not reading docs): each figure is
 * a collection-wide count/sum computed SERVER-side, so only the single number is transmitted — billed as
 * a small fixed number of index entries scanned, not one read per document (skill: mandatory aggregation
 * for counts/sums). WHY totalRecipients uses sum('recipientCount'): a sent notification stamps how many
 * users it reached, so summing that field across sent notifications gives lifetime reach without a loop.
 * All four run in parallel (Promise.all) so the stat row resolves in one round-trip's latency.
 */
export const fetchNotificationStats = createAsyncThunk<NotificationStats, void, { rejectValue: string }>(
  'notifications/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const col = collection(db, FirestoreCollections.notifications);
      const sentQ = query(col, where('isSent', '==', true));

      const [sentSnap, scheduledSnap, draftSnap, recipientsSnap] = await Promise.all([
        getCountFromServer(sentQ),
        getCountFromServer(query(col, where('isScheduled', '==', true))),
        getCountFromServer(query(col, where('isSent', '==', false), where('isScheduled', '==', false))),
        getAggregateFromServer(sentQ, { total: sum('recipientCount') }),
      ]);

      return {
        totalSent: sentSnap.data().count,
        scheduled: scheduledSnap.data().count,
        draft: draftSnap.data().count,
        totalRecipients: recipientsSnap.data().total ?? 0,
      };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load notification stats');
    }
  },
);
