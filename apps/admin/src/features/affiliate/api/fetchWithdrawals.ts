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
import type { AffiliateWithdrawalProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';

export interface WithdrawalsResult {
  items: AffiliateWithdrawalProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
}

/**
 * fetchWithdrawals — one cursor-paginated page of affiliate withdrawal requests for the Withdrawals tab
 * (spec §1.14; skill: mandatory pagination). An optional `status` filter constrains server-side; newest
 * requests first. The `status ASC + createdAt DESC` filtered form needs a composite index.
 */
export const fetchWithdrawals = createAsyncThunk<
  WithdrawalsResult,
  { status?: string; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('affiliate/fetchWithdrawals', async ({ status, cursor }, { rejectWithValue }) => {
  try {
    const constraints: QueryConstraint[] = [];
    if (status) constraints.push(where('status', '==', status));
    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.affiliateWithdrawals),
        ...constraints,
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(Constants.PAGE_SIZE),
      ),
    );
    const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as AffiliateWithdrawalProps);
    return {
      items,
      lastVisible: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: items.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load withdrawals');
  }
});
