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
import type { SpinHistoryProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';

export interface SpinHistoryPageResult {
  items: SpinHistoryProps[];
  lastVisible: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  hasMore: boolean;
}

/**
 * fetchCampaignSpinHistory — one cursor-paginated page of a campaign's spin records (spec F13 Spin History
 * section). Filtered to the campaign, newest first, PAGE_SIZE per page (skill: mandatory pagination).
 * WHY a plain where + orderBy: spinHistory is written by the customer app; the admin only reads it here,
 * so a bounded getDocs page per "View More" click keeps billing minimal (needs the campaignId+createdAt
 * composite index).
 */
export const fetchCampaignSpinHistory = createAsyncThunk<
  SpinHistoryPageResult,
  { campaignId: string; cursor?: QueryDocumentSnapshot | null },
  { rejectValue: string }
>('spinnerCampaigns/fetchSpinHistory', async ({ campaignId, cursor }, { rejectWithValue }) => {
  try {
    const snap = await getDocs(
      query(
        collection(db, FirestoreCollections.spinHistory),
        where('campaignId', '==', campaignId),
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(Constants.PAGE_SIZE),
      ),
    );
    const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as SpinHistoryProps);
    return {
      items,
      lastVisible: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: items.length === Constants.PAGE_SIZE,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load spin history');
  }
});
