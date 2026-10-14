import { createAsyncThunk } from '@reduxjs/toolkit';
import { OrderStatus } from '@barakath/shared/config/enums';
import { updateOrderStatus } from './updateOrderStatus';
import { nextStatus } from '../utils/orderFlow';

export interface BulkUpdateOrderStatusInput {
  /** The selected orders — all at the same status (the list enforces same-status selection). */
  orders: { id: string; status: string }[];
  /** `advance` moves each order one step along the flow; `cancel` cancels each (Pending only). */
  action: 'advance' | 'cancel';
  cancelReason?: string;
}

export interface BulkUpdateOrderStatusResult {
  succeeded: string[];
  failed: { orderId: string; reason: string }[];
}

/**
 * bulkUpdateOrderStatus — apply one status action to many orders (spec §1.7, Orders list bulk bar).
 *
 * WHY it runs `updateOrderStatus` per order instead of writing its own batch: that thunk is the single
 * place that validates a transition (next step only, paid-only advance, cancel only at Pending) and
 * restores stock on cancel. Reusing it means a bulk action can never do anything a single update can't.
 *
 * WHY sequential, not Promise.all: a cancel restores stock by READING each variant and then writing the
 * new total. Two cancels touching the same product in parallel would both read the old stock and the
 * second write would erase the first's increment. One at a time keeps every restore exact.
 *
 * Never rejects as a whole — each order succeeds or fails on its own, and the caller reports both lists
 * (e.g. unpaid orders are skipped with the reason `updateOrderStatus` gives).
 */
export const bulkUpdateOrderStatus = createAsyncThunk<
  BulkUpdateOrderStatusResult,
  BulkUpdateOrderStatusInput
>('orders/bulkUpdateStatus', async (input, { dispatch }) => {
  const succeeded: string[] = [];
  const failed: BulkUpdateOrderStatusResult['failed'] = [];

  for (const order of input.orders) {
    const newStatus = input.action === 'cancel' ? OrderStatus.CANCELLED : nextStatus(order.status);
    if (!newStatus) {
      failed.push({ orderId: order.id, reason: `No next step from "${order.status}"` });
      continue;
    }
    try {
      await dispatch(
        updateOrderStatus({
          orderId: order.id,
          newStatus,
          ...(input.action === 'cancel' ? { cancelReason: input.cancelReason } : {}),
        }),
      ).unwrap();
      succeeded.push(order.id);
    } catch (err) {
      failed.push({
        orderId: order.id,
        reason: typeof err === 'string' ? err : 'Could not update order status',
      });
    }
  }

  return { succeeded, failed };
});
