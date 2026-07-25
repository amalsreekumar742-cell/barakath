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
  isComboOrder: boolean;
  keywords: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
