import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { OrderProps, ReplacementProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import type { ReplacementDetailBundle } from '../types';

/**
 * fetchReplacementDetail — a single replacement request plus the ORIGINAL order it references (spec
 * §1.10). The detail page shows the request alongside a link/summary of the source order, so we read
 * both in one thunk. The order read is best-effort: if it was since deleted we return `order: null` and
 * the detail page still renders the request (WHY: a missing order must not blank the whole screen).
 */
export const fetchReplacementDetail = createAsyncThunk<
  ReplacementDetailBundle,
  string,
  { rejectValue: string }
>('replacement/fetchDetail', async (replacementId, { rejectWithValue }) => {
  try {
    const snap = await getDoc(doc(db, FirestoreCollections.replacements, replacementId));
    if (!snap.exists()) return rejectWithValue('Replacement request not found');
    const replacement = { ...snap.data(), id: snap.id } as ReplacementProps;

    let order: OrderProps | null = null;
    if (replacement.orderId) {
      const orderSnap = await getDoc(doc(db, FirestoreCollections.orders, replacement.orderId));
      if (orderSnap.exists()) order = { ...orderSnap.data(), id: orderSnap.id } as OrderProps;
    }

    return { replacement, order };
  } catch (err) {
    return rejectWithValue(
      err instanceof Error ? err.message : 'Could not load the replacement request',
    );
  }
});
