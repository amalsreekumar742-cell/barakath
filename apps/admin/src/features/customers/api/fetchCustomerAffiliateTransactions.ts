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
import type { AffiliateTransactionProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';

export interface AffiliateTxnResult {
  items: AffiliateTransactionProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
}

/**
 * fetchCustomerAffiliateTransactions — one cursor-paginated page of a customer's affiliate ledger (spec
 * §1.8 Affiliate wallet tab). Newest first, filtered by `userId`. Needs a (userId ASC, createdAt DESC)
 * composite index.
 */
export const fetchCustomerAffiliateTransactions = createAsyncThunk<
  AffiliateTxnResult,
  { userId: string; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('customers/fetchAffiliateTxns', async ({ userId, cursor }, { rejectWithValue }) => {
  try {
    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.affiliateTransactions),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(Constants.PAGE_SIZE),
      ),
    );
    const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as AffiliateTransactionProps);
    return {
      items,
      lastVisible: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: items.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load affiliate history');
  }
});
