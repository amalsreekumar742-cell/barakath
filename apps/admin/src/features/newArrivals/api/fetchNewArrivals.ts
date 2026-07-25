import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { ProductProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';

export interface NewArrivalsPageResult {
  items: ProductProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
}

/**
 * fetchNewArrivals — one cursor-paginated page of products flagged `isNewArrival` (spec §1.17).
 *
 * WHY no separate collection: New Arrivals is a curated view over existing products, managed by a boolean
 * flag on the product doc (spec §1.17). So the list is simply products where isNewArrival == true, newest
 * first by updatedAt (the flag is set with a fresh updatedAt, so the most recently added surfaces first).
 * Standard cursor pagination — PAGE_SIZE per page, hasMore = items.length === PAGE_SIZE.
 */
export const fetchNewArrivals = createAsyncThunk<
  NewArrivalsPageResult,
  { cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('newArrivals/fetchPage', async ({ cursor }, { rejectWithValue }) => {
  try {
    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.products),
        where('isNewArrival', '==', true),
        orderBy('updatedAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(Constants.PAGE_SIZE),
      ),
    );
    const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ProductProps);
    return {
      items,
      lastVisible: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: items.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load new arrivals');
  }
});
