import type { Timestamp } from 'firebase/firestore';
import type { OrderStatus } from '../config/enums';

/**
 * OrderItemProps / OrderProps — a customer order and its line items (spec §1.3, §1.7).
 *
 * WHY here (not per-app): admin, website, app and Cloud Functions all read/write the same order
 * documents; one definition keeps the contract identical. Money fields are recomputed server-side
 * (never trusted from the client). Date fields use `Timestamp` (not epoch millis).
 */
export interface OrderItemProps {
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
  /**
   * The GST rate applied to this line at checkout (18 = 18%), snapshotted from the variant so a later
   * rate change never rewrites a issued invoice. ABSENT on orders placed before per-line GST existed —
   * those carry only the order-level `gstAmount`, which is the whole-order figure at the then-global
   * rate. Treat absent as "no per-line breakdown available", not as 0%.
   */
  gstPercentage?: number;
  /** This line's share of `gstAmount`, in rupees. Absent alongside `gstPercentage`. */
  gstAmount?: number;
}

export interface OrderShippingAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
}

export interface OrderStatusTimelineEntry {
  status: string;
  timestamp: Timestamp;
  note: string;
}

export interface OrderProps {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail: string;
  items: OrderItemProps[];
  subtotal: number;
  couponDiscount: number;
  couponCode: string;
  walletAmountUsed: number;
  deliveryCharge: number;
  gstAmount: number;
  /**
   * True when `gstAmount` is CONTAINED IN the prices rather than added to them — so
   * `grandTotal = subtotal − couponDiscount + deliveryCharge`, and the invoice's taxable value is
   * `subtotal − gstAmount`.
   *
   * ABSENT on every order placed before 2026-08-04, when GST was charged on top
   * (`grandTotal = … + gstAmount`). Those invoices must keep stating what the customer actually paid,
   * so absent must be read as `false` — never defaulted to true. Use `isGstInclusive()`.
   */
  gstInclusive?: boolean;
  grandTotal: number;
  paymentMethod: 'Razorpay' | 'Wallet' | 'Both';
  paymentStatus: 'Pending' | 'Paid' | 'Failed' | 'Refunded';
  razorpayOrderId: string;
  razorpayPaymentId: string;
  status: OrderStatus;
  shippingAddress: OrderShippingAddress;
  trackingId: string;
  courierName: string;
  statusTimeline: OrderStatusTimelineEntry[];
  cancelReason: string;
  /**
   * Running total already refunded to the wallet by approved return requests against this order.
   * Server-written only (`approveReplacement`), and used as the cap so repeated partial returns can
   * never jointly refund more than `grandTotal`. Absent on orders with no approved return.
   */
  replacementRefundedTotal?: number;
  isComboOrder: boolean;
  keywords: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
