import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { OrderStatus } from '@barakath/shared/config/enums';
import { db } from '@/lib/firebaseConfig';
import type { OrderStatusCounts } from '../types';

/**
 * fetchOrderStatusCounts — the numbers on the Orders status tabs (spec §1.7): one aggregation query per
 * status plus a total.
 *
 * WHY getCountFromServer (not reading docs): the tab badges need catalogue-wide counts, not just the
 * loaded page — server-side counts are cheap and exact.
 */
export const fetchOrderStatusCounts = createAsyncThunk<OrderStatusCounts, void, { rejectValue: string }>(
  'orders/fetchStatusCounts',
  async (_, { rejectWithValue }) => {
    try {
      const orders = collection(db, FirestoreCollections.orders);
      const byStatus = (s: OrderStatus) => getCountFromServer(query(orders, where('status', '==', s)));

      const [all, pending, accepted, packed, shipped, outForDelivery, delivered, cancelled] =
        await Promise.all([
          getCountFromServer(orders),
          byStatus(OrderStatus.PENDING),
          byStatus(OrderStatus.ACCEPTED),
          byStatus(OrderStatus.PACKED),
          byStatus(OrderStatus.SHIPPED),
          byStatus(OrderStatus.OUT_FOR_DELIVERY),
          byStatus(OrderStatus.DELIVERED),
          byStatus(OrderStatus.CANCELLED),
        ]);

      return {
        all: all.data().count,
        pending: pending.data().count,
        accepted: accepted.data().count,
        packed: packed.data().count,
        shipped: shipped.data().count,
        outForDelivery: outForDelivery.data().count,
        delivered: delivered.data().count,
        cancelled: cancelled.data().count,
      };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not load order counts');
    }
  },
);
