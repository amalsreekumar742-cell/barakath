import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';
import { validateAdmin } from '../utils/validateAuth';
import { sendFCMToUser } from '../utils/sendFCM';

/** Line item shape we copy from the original order (subset of OrderItemProps in packages/shared). */
interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  variantId: string;
  variantName: string;
  variantColor: string;
  mrp: number;
  offerPrice: number;
  quantity: number;
  subtotal: number;
}

/**
 * approveReplacement — an admin approves a pending replacement request; we create a zero-value
 * replacement order for the customer and link it back onto the request.
 *
 * WHY onCall + validateAdmin: only the admin panel (our own SDK client) calls this, and only an admin
 *   may resolve a request — the callable protocol gives us the verified admin claim for free.
 * WHY server-side: creating an order, flipping a customer-visible status, and pushing an FCM are
 *   privileged cross-user writes the Admin SDK must perform; a customer must never mint their own
 *   free replacement order.
 * WHY a batch: the request update and the new order must land together — a half-applied approval
 *   (order without the link back, or vice versa) would strand the replacement.
 *
 * Request:  { replacementId: string, adminNote?: string }
 * Response: { success: true, replacementOrderId: string }
 */
export const approveReplacement = onCall(
  async (request): Promise<{ success: true; replacementOrderId: string }> => {
    const adminUid = validateAdmin(request);

    const { replacementId, adminNote } = (request.data ?? {}) as {
      replacementId?: unknown;
      adminNote?: unknown;
    };
    if (typeof replacementId !== 'string' || replacementId.trim() === '') {
      throw new HttpsError('invalid-argument', 'replacementId is required');
    }
    const note = typeof adminNote === 'string' ? adminNote : '';

    const db = getFirestore();
    const replacementRef = db.collection(Collections.replacements).doc(replacementId);
    const replacementSnap = await replacementRef.get();
    if (!replacementSnap.exists) {
      throw new HttpsError('not-found', 'Replacement request not found');
    }
    const replacement = replacementSnap.data() as {
      orderId?: string;
      userId?: string;
      variantId?: string;
      quantity?: number;
      status?: string;
    };

    if (replacement.status !== 'Pending') {
      throw new HttpsError('failed-precondition', 'Only pending requests can be approved');
    }

    const originalOrderId = replacement.orderId ?? '';
    const orderSnap = originalOrderId
      ? await db.collection(Collections.orders).doc(originalOrderId).get()
      : null;
    if (!orderSnap || !orderSnap.exists) {
      throw new HttpsError('not-found', 'Original order not found');
    }
    const originalOrder = orderSnap.data() as {
      userId?: string;
      userName?: string;
      userPhone?: string;
      userEmail?: string;
      items?: OrderItem[];
      paymentMethod?: string;
      shippingAddress?: Record<string, unknown>;
      isComboOrder?: boolean;
      keywords?: string[];
    };

    // Copy the replaced line item from the original order (preserves its product/variant/pricing
    // detail); fall back to the whole basket if we can't match the variant.
    const originalItems = originalOrder.items ?? [];
    const matchedItem = originalItems.find((it) => it.variantId === replacement.variantId);
    const replacementItems: OrderItem[] = matchedItem
      ? [{ ...matchedItem, quantity: replacement.quantity ?? matchedItem.quantity }]
      : originalItems;

    const now = Timestamp.now();
    const newOrderRef = db.collection(Collections.orders).doc();
    const batch = db.batch();

    // A replacement order is free: grandTotal 0, no delivery charge, already "Paid".
    batch.set(newOrderRef, {
      userId: originalOrder.userId ?? '',
      userName: originalOrder.userName ?? '',
      userPhone: originalOrder.userPhone ?? '',
      userEmail: originalOrder.userEmail ?? '',
      items: replacementItems,
      subtotal: 0,
      couponDiscount: 0,
      couponCode: '',
      walletAmountUsed: 0,
      deliveryCharge: 0,
      gstAmount: 0,
      grandTotal: 0,
      paymentMethod: originalOrder.paymentMethod ?? 'Razorpay',
      paymentStatus: 'Paid',
      razorpayOrderId: '',
      razorpayPaymentId: '',
      status: 'Pending',
      shippingAddress: originalOrder.shippingAddress ?? {},
      trackingId: '',
      courierName: '',
      statusTimeline: [
        {
          status: 'Pending',
          // A Timestamp (not serverTimestamp) — FieldValue sentinels are illegal inside an array.
          timestamp: now,
          note: `Replacement for order #${originalOrderId}`,
        },
      ],
      cancelReason: '',
      isComboOrder: originalOrder.isComboOrder ?? false,
      keywords: originalOrder.keywords ?? [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    batch.update(replacementRef, {
      status: 'Approved',
      adminNote: note,
      replacementOrderId: newOrderRef.id,
      processedBy: adminUid,
      processedByName: (request.auth?.token.name as string | undefined) ?? '',
      processedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // Best-effort push; never let a notification failure undo the approval (already committed).
    const customerId = originalOrder.userId ?? replacement.userId ?? '';
    if (customerId) {
      await sendFCMToUser(
        customerId,
        'Replacement approved',
        'Your replacement request has been approved. A new order has been created.',
        { type: 'Replacement', replacementId, orderId: newOrderRef.id },
      );
    }

    return { success: true, replacementOrderId: newOrderRef.id };
  },
);
