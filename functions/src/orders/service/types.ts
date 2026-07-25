/**
 * Feature-local types for the order/payment core. Kept here (NOT imported from packages/shared) because
 * Cloud Functions can't import the workspace package at runtime; the shapes mirror the shared domain
 * types (OrderProps, PaymentProps, VariantProps, CouponProps) so documents stay contract-compatible.
 */

/** One cart line as sent by the client — ids + quantity only; NEVER prices (recomputed server-side). */
export interface CartItemInput {
  productId: string;
  variantId: string;
  quantity: number;
}

/** A cart line resolved server-side against the product + variant docs the server read itself. */
export interface ResolvedItem {
  productId: string;
  productName: string;
  productImage: string;
  categoryId: string;
  isCombo: boolean;
  comboDeliveryCharge: number;
  variantId: string;
  variantName: string;
  variantColor: string;
  mrp: number;
  offerPrice: number;
  quantity: number;
  /** offerPrice × quantity (line subtotal). */
  subtotal: number;
}

/** Delivery + tax slice of the general/config document, read server-side for checkout math. */
export interface DeliveryTaxConfig {
  standardDeliveryFee: number;
  freeDeliveryThreshold: number;
  gstPercentage: number;
}

/** Razorpay credentials read from general/config (keys + webhook signing secret). */
export interface RazorpaySecrets {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

/** The fully-computed money breakdown for an order. All amounts in rupees, rounded to 2 decimals. */
export interface OrderTotals {
  subtotal: number;
  couponDiscount: number;
  deliveryCharge: number;
  gstAmount: number;
  /** Full order value = subtotal − couponDiscount + deliveryCharge + gstAmount. */
  grandTotal: number;
  walletAmountUsed: number;
  /** Amount to collect via Razorpay = grandTotal − walletAmountUsed (≥ 0). */
  razorpayAmount: number;
}
