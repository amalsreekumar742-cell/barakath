import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { OrderStatus, PaymentStatus, ReplacementStatus } from '@barakath/shared/config/enums';
import { keywordsBuilder } from '@barakath/shared';
import type { OrderItemProps, OrderProps, ReplacementProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

export interface ApproveReplacementInput {
  replacementId: string;
  adminNote: string;
  adminId: string;
  adminName: string;
}

/**
 * approveReplacement — approve a Pending request and spawn a free replacement order (spec §1.10).
 *
 * WHAT: in ONE atomic batch it (1) marks the replacement Approved with the admin's note + processor,
 * (2) creates a brand-new `orders` doc built from the ORIGINAL order — the replaced line item(s), same
 * shipping address and payment method, but zeroed money (a free replacement: grandTotal/subtotal/GST/
 * delivery all 0) and a fresh Pending status timeline — and (3) stamps the new order's id back onto the
 * replacement so the detail page can link to it.
 *
 * WHY match items by productId+variantId (fallback: all items): the request names one variant to
 * replace, so the new order should contain just that line; if the exact line can't be found (order
 * edited/migrated) we fall back to copying every item rather than shipping an empty order.
 * WHY Timestamp.now() inside statusTimeline (not serverTimestamp): Firestore forbids the serverTimestamp
 * sentinel inside an array element, so the entry stamps client time; the doc's createdAt/updatedAt use
 * serverTimestamp as usual.
 *
 * TODO: move to Cloud Function for atomicity and to send FCM notification
 */
export const approveReplacement = createAsyncThunk<
  ReplacementProps,
  ApproveReplacementInput,
  { rejectValue: string }
>('replacement/approve', async (input, { rejectWithValue }) => {
  try {
    const replRef = doc(db, FirestoreCollections.replacements, input.replacementId);
    const replSnap = await getDoc(replRef);
    if (!replSnap.exists()) return rejectWithValue('Replacement request not found');
    const replacement = { ...replSnap.data(), id: replSnap.id } as ReplacementProps;

    if (replacement.status !== ReplacementStatus.PENDING)
      return rejectWithValue('Only a pending request can be approved');

    // The new order is built from the original order (shipping address, payment method, line items).
    const orderSnap = await getDoc(doc(db, FirestoreCollections.orders, replacement.orderId));
    if (!orderSnap.exists())
      return rejectWithValue('Original order not found — cannot create a replacement order');
    const order = { ...orderSnap.data(), id: orderSnap.id } as OrderProps;

    // Pick the replaced line(s): match by productId + variantId; fall back to all items if none match.
    const matched = order.items.filter(
      (it) => it.productId === replacement.productId && it.variantId === replacement.variantId,
    );
    const sourceItems = matched.length > 0 ? matched : order.items;
    // Zero each line's money (free replacement) while keeping product/variant identity + the requested qty.
    const items: OrderItemProps[] = sourceItems.map((it) => ({
      ...it,
      quantity: matched.length > 0 ? replacement.quantity : it.quantity,
      subtotal: 0,
    }));

    const batch = writeBatch(db);
    const newOrderRef = doc(collection(db, FirestoreCollections.orders));

    // (1) Resolve the replacement request → Approved.
    batch.update(replRef, {
      status: ReplacementStatus.APPROVED,
      adminNote: input.adminNote,
      processedBy: input.adminId,
      processedByName: input.adminName,
      processedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // (2) Create the free replacement order (zeroed money, fresh Pending timeline).
    const newOrder: Omit<OrderProps, 'id'> = {
      userId: replacement.userId,
      userName: replacement.userName,
      userPhone: replacement.userPhone,
      userEmail: replacement.userEmail,
      items,
      subtotal: 0,
      couponDiscount: 0,
      couponCode: '',
      walletAmountUsed: 0,
      deliveryCharge: 0,
      gstAmount: 0,
      grandTotal: 0,
      paymentMethod: order.paymentMethod,
      paymentStatus: PaymentStatus.PAID,
      razorpayOrderId: '',
      razorpayPaymentId: '',
      status: OrderStatus.PENDING,
      shippingAddress: order.shippingAddress,
      trackingId: '',
      courierName: '',
      statusTimeline: [
        {
          status: OrderStatus.PENDING,
          timestamp: Timestamp.now(),
          note: `Replacement for order #${replacement.orderId}`,
        },
      ],
      cancelReason: '',
      isComboOrder: false,
      keywords: keywordsBuilder(`${replacement.userName} ${replacement.userPhone}`),
      createdAt: serverTimestamp() as unknown as OrderProps['createdAt'],
      updatedAt: serverTimestamp() as unknown as OrderProps['updatedAt'],
    };
    batch.set(newOrderRef, newOrder);

    // (3) Link the new order back onto the replacement doc.
    batch.update(replRef, { replacementOrderId: newOrderRef.id });

    await batch.commit();

    // Re-read so the caller/slice gets server-resolved timestamps + the new status/link.
    const updated = await getDoc(replRef);
    return { ...updated.data(), id: updated.id } as ReplacementProps;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not approve the replacement');
  }
});
