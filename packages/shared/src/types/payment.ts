import type { Timestamp } from 'firebase/firestore';

/**
 * PaymentProps — one payment record for an order (spec §1.9 Payments).
 *
 * WHY here (not per-app): the payment is created/verified server-side after Razorpay checkout and read
 * by the admin panel's Payments screen + tax invoice; one shared definition keeps the contract identical.
 * All money + gateway ids are written by the server (Cloud Function verifying the Razorpay signature) —
 * never trusted from a client. `method` / `status` reuse the shared PaymentMethod / PaymentStatus enums'
 * string values. Date fields use the Firestore `Timestamp` type.
 */
export interface PaymentProps {
  id: string;
  orderId: string;
  userId: string;
  userName: string;
  userPhone: string;
  amount: number;
  method: 'Razorpay' | 'Wallet' | 'Both';
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  walletAmountUsed: number;
  razorpayAmountPaid: number;
  status: 'Pending' | 'Paid' | 'Failed' | 'Refunded';
  refundId: string;
  refundAmount: number;
  refundedAt: Timestamp | null;
  gstAmount: number;
  metadata: Record<string, string>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
