import { createAsyncThunk } from '@reduxjs/toolkit';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebaseConfig';
import { callableErrorMessage } from '../utils/callableError';

/**
 * retryRefund — re-run the Razorpay refund for a cancelled order whose refund failed at cancel time
 * (`gatewayRefundPending`). Server-side via the admin-only `processRefund` callable: it refunds the
 * gateway portion only (cancelOrder already returned any wallet money) and marks the order Refunded.
 *
 * WHY the caller refetches the order afterwards rather than this thunk patching it: the server is the
 * only writer of payment state, and a re-read shows exactly what it recorded.
 */
export const retryRefund = createAsyncThunk<{ refundId: string }, string, { rejectValue: string }>(
  'orders/retryRefund',
  async (orderId, { rejectWithValue }) => {
    try {
      const call = httpsCallable<{ orderId: string }, { success: boolean; refundId?: string }>(
        functions,
        'processRefund',
      );
      const res = await call({ orderId });
      return { refundId: res.data.refundId ?? '' };
    } catch (err) {
      return rejectWithValue(callableErrorMessage(err, 'Could not retry the refund'));
    }
  },
);
