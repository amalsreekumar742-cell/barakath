import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { OrderStatus, PaymentStatus } from '@barakath/shared/config/enums';
import type { OrderProps, VariantProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { sumStock, deriveStockStatus } from '@/features/products/utils/stock';
import { nextStatus, canCancel } from '../utils/orderFlow';

export interface UpdateOrderStatusInput {
  orderId: string;
  newStatus: string;
  note?: string;
  trackingId?: string;
  courierName?: string;
  cancelReason?: string;
}

export interface UpdateOrderStatusResult {
  order: OrderProps;
  previousStatus: string;
}

/**
 * updateOrderStatus — advance an order along its flow, or cancel it (spec §1.7).
 *
 * WHY the transition is validated here (server-trust boundary, skill): the UI only ever offers the
 * single next step, but the thunk still re-checks that `newStatus` is exactly `nextStatus(current)` —
 * or, for a cancel, that the order is still Pending — so no out-of-order write can slip through. Shipped
 * requires tracking + courier; Cancel requires a reason. On cancel we also refund-mark a paid order and
 * RESTORE stock (increment each item's variant + re-derive the product totals), all in one atomic batch
 * so status, timeline, refund flag and stock never diverge.
 *
 * WHY a client `Timestamp.now()` in the timeline (not serverTimestamp): Firestore forbids the
 * serverTimestamp sentinel inside an array element, so each timeline entry stamps the client time.
 */
export const updateOrderStatus = createAsyncThunk<
  UpdateOrderStatusResult,
  UpdateOrderStatusInput,
  { rejectValue: string }
>('orders/updateStatus', async (input, { rejectWithValue }) => {
  try {
    const orderRef = doc(db, FirestoreCollections.orders, input.orderId);
    const snap = await getDoc(orderRef);
    if (!snap.exists()) return rejectWithValue('Order not found');
    const order = { ...snap.data(), id: snap.id } as OrderProps;
    const current = order.status;

    const isCancel = input.newStatus === OrderStatus.CANCELLED;

    // --- Validate the transition ---
    if (isCancel) {
      if (!canCancel(current)) return rejectWithValue('Order can only be cancelled while Pending');
      if (!input.cancelReason?.trim()) return rejectWithValue('Cancel reason is required');
    } else {
      if (input.newStatus !== nextStatus(current))
        return rejectWithValue(`Cannot move from "${current}" to "${input.newStatus}"`);
      if (input.newStatus === OrderStatus.SHIPPED && (!input.trackingId?.trim() || !input.courierName?.trim()))
        return rejectWithValue('Tracking ID and courier name are required to ship');
    }

    // --- Pre-read everything needed for a stock restore (cancel only), before the batch ---
    type ProductRestore = {
      productId: string;
      totalStock: number;
      stockStatus: ReturnType<typeof deriveStockStatus>;
      variantDeltas: { variantId: string; newStock: number }[];
    };
    const restores: ProductRestore[] = [];
    if (isCancel) {
      const byProduct = new Map<string, Map<string, number>>();
      for (const it of order.items) {
        if (!byProduct.has(it.productId)) byProduct.set(it.productId, new Map());
        const m = byProduct.get(it.productId)!;
        m.set(it.variantId, (m.get(it.variantId) ?? 0) + it.quantity);
      }
      for (const [productId, additions] of byProduct) {
        const pRef = doc(db, FirestoreCollections.products, productId);
        const pSnap = await getDoc(pRef);
        if (!pSnap.exists()) continue; // product deleted — skip its restore
        const threshold = (pSnap.data().lowStockThreshold as number) ?? 0;
        const varCol = collection(db, FirestoreCollections.products, productId, FirestoreCollections.variants);
        const varSnap = await getDocs(varCol);
        const variantDeltas: { variantId: string; newStock: number }[] = [];
        const stocks = varSnap.docs.map((d) => {
          const v = d.data() as VariantProps;
          const add = additions.get(d.id) ?? 0;
          const newStock = v.stock + add;
          if (add > 0) variantDeltas.push({ variantId: d.id, newStock });
          return newStock;
        });
        const totalStock = sumStock(stocks);
        restores.push({
          productId,
          totalStock,
          stockStatus: deriveStockStatus(totalStock, threshold),
          variantDeltas,
        });
      }
    }

    // --- Build the atomic batch ---
    const batch = writeBatch(db);
    const timelineEntry = {
      status: input.newStatus,
      timestamp: Timestamp.now(),
      note: input.note ?? '',
    };
    const orderUpdate: Record<string, unknown> = {
      status: input.newStatus,
      statusTimeline: [...(order.statusTimeline ?? []), timelineEntry],
      updatedAt: serverTimestamp(),
    };
    if (input.newStatus === OrderStatus.SHIPPED) {
      orderUpdate.trackingId = input.trackingId!.trim();
      orderUpdate.courierName = input.courierName!.trim();
    }
    if (isCancel) {
      orderUpdate.cancelReason = input.cancelReason!.trim();
      if (order.paymentStatus === PaymentStatus.PAID)
        orderUpdate.paymentStatus = PaymentStatus.REFUNDED;
    }
    batch.update(orderRef, orderUpdate);

    for (const r of restores) {
      for (const d of r.variantDeltas) {
        batch.update(
          doc(db, FirestoreCollections.products, r.productId, FirestoreCollections.variants, d.variantId),
          { stock: d.newStock },
        );
      }
      batch.update(doc(db, FirestoreCollections.products, r.productId), {
        totalStock: r.totalStock,
        stockStatus: r.stockStatus,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    const updated = await getDoc(orderRef);
    return { order: { ...updated.data(), id: updated.id } as OrderProps, previousStatus: current };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not update order status');
  }
});
