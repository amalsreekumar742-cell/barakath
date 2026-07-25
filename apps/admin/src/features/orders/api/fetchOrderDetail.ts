import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { OrderProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * fetchOrderDetail — a single order document for the detail page (spec §1.7). Everything the detail
 * screen renders (items, timeline, payment, shipping) lives on the one order doc, so this is one read.
 */
export const fetchOrderDetail = createAsyncThunk<OrderProps, string, { rejectValue: string }>(
  'orders/fetchDetail',
  async (orderId, { rejectWithValue }) => {
    try {
      const snap = await getDoc(doc(db, FirestoreCollections.orders, orderId));
      if (!snap.exists()) return rejectWithValue('Order not found');
      return { ...snap.data(), id: snap.id } as OrderProps;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load order');
    }
  },
);
