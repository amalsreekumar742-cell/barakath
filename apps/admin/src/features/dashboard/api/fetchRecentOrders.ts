import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { OrderProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import type { RecentOrder } from '../types';

/**
 * fetchRecentOrders — the 5 most recent orders for the dashboard mini table (spec §1.3).
 *
 * WHY a bounded getDocs with limit(5) (not pagination): this is a fixed small preview, not a browsable
 * list — a single capped read is correct and cheap (skill: never read a collection without a limit).
 * The full order list lives on the Orders screen.
 */
export const fetchRecentOrders = createAsyncThunk<RecentOrder[], void, { rejectValue: string }>(
  'dashboard/fetchRecentOrders',
  async (_, { rejectWithValue }) => {
    try {
      const snap = await getDocs(
        query(
          collection(db, FirestoreCollections.orders),
          orderBy('createdAt', 'desc'),
          limit(5),
        ),
      );
      return snap.docs.map((d) => {
        const o = { ...d.data(), id: d.id } as OrderProps;
        return {
          id: o.id,
          userName: o.userName,
          status: o.status,
          grandTotal: o.grandTotal,
          createdAt: o.createdAt,
        };
      });
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load recent orders');
    }
  },
);
