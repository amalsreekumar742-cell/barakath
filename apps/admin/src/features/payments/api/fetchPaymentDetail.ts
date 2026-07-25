import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { PaymentProps, OrderProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

export interface PaymentDetailResult {
  payment: PaymentProps;
  order: OrderProps | null;
}

/**
 * fetchPaymentDetail — a payment plus its associated order (spec §1.9 detail dialog + tax invoice).
 *
 * WHY also fetch the order: the detail modal shows the order status/items/grand total, and the tax
 * invoice needs the full line items + shipping address — all of which live on the order doc, not the
 * payment. The order is fetched after the payment (its `orderId` is the key); a missing order degrades
 * gracefully to `null` rather than failing the whole view.
 */
export const fetchPaymentDetail = createAsyncThunk<
  PaymentDetailResult,
  string,
  { rejectValue: string }
>('payments/fetchDetail', async (paymentId, { rejectWithValue }) => {
  try {
    const paySnap = await getDoc(doc(db, FirestoreCollections.payments, paymentId));
    if (!paySnap.exists()) return rejectWithValue('Payment not found');
    const payment = { ...paySnap.data(), id: paySnap.id } as PaymentProps;

    let order: OrderProps | null = null;
    if (payment.orderId) {
      const orderSnap = await getDoc(doc(db, FirestoreCollections.orders, payment.orderId));
      if (orderSnap.exists()) order = { ...orderSnap.data(), id: orderSnap.id } as OrderProps;
    }

    return { payment, order };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load payment');
  }
});
