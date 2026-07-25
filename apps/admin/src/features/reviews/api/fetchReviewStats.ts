import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  getCountFromServer,
  getAggregateFromServer,
  average,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';
import type { ReviewStats } from '../types';

/**
 * fetchReviewStats — the Reviews summary section (spec §1.11): total / published / hidden counts, the
 * average rating, and the per-star (1..5) distribution.
 *
 * WHY aggregation queries (getCountFromServer / getAggregateFromServer): counts and the average are
 * computed server-side and only the single figure is transmitted — never fetch-and-total client-side
 * (skill: mandatory aggregation). `average('rating')` is null when there are no reviews, so we coalesce
 * to 0. The seven counts + the average run in parallel.
 */
export const fetchReviewStats = createAsyncThunk<ReviewStats, void, { rejectValue: string }>(
  'reviews/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const col = collection(db, FirestoreCollections.reviews);
      const byStar = (star: number) => getCountFromServer(query(col, where('rating', '==', star)));

      const [total, published, hidden, avg, s1, s2, s3, s4, s5] = await Promise.all([
        getCountFromServer(col),
        getCountFromServer(query(col, where('isPublished', '==', true))),
        getCountFromServer(query(col, where('isPublished', '==', false))),
        getAggregateFromServer(col, { avg: average('rating') }),
        byStar(1),
        byStar(2),
        byStar(3),
        byStar(4),
        byStar(5),
      ]);

      return {
        total: total.data().count,
        published: published.data().count,
        hidden: hidden.data().count,
        averageRating: avg.data().avg ?? 0,
        starCounts: {
          1: s1.data().count,
          2: s2.data().count,
          3: s3.data().count,
          4: s4.data().count,
          5: s5.data().count,
        },
      };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load review stats');
    }
  },
);
