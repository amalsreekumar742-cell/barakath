import type { Timestamp } from 'firebase/firestore';

/**
 * Affiliate ledger + withdrawal types (spec §1.8 Affiliate wallet tab, §1.14 Affiliate Program).
 *
 * WHY here (not per-app): affiliate commissions are earned in the app flow, cleared/held server-side,
 * and reviewed/paid from the admin panel — one shared contract keeps them in sync. `balanceAfter` and
 * `status`/`clearsAt` are set by the server (referral rewards clear after a hold window); the client
 * never writes them. Date fields use the Firestore `Timestamp` type.
 */
export interface AffiliateTransactionProps {
  id: string;
  userId: string;
  type: 'Credit' | 'Debit';
  amount: number;
  source: 'Referral' | 'Withdrawal' | 'Admin' | 'Reversal';
  description: string;
  referredUserId: string;
  referredUserName: string;
  orderId: string;
  balanceAfter: number;
  status: 'Cleared' | 'Pending' | 'Withdrawn';
  clearsAt: Timestamp | null;
  createdAt: Timestamp;
}

export interface AffiliateWithdrawalProps {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  rejectionReason: string;
  processedBy: string;
  processedAt: Timestamp | null;
  createdAt: Timestamp;
}

/**
 * BankAccountProps — a saved affiliate payout account, `users/{uid}/bankAccounts/{id}` (spec §2.22,
 * §4.9). Max 2 per affiliate, enforced client-side (`firestore.rules` cannot count sibling documents —
 * see that file's own comment on `match /bankAccounts/{accountId}`). `bankName`/`bankBranch` are
 * resolved from the IFSC lookup, never typed by the customer.
 */
export interface BankAccountProps {
  id: string;
  accountHolderName: string;
  /** Stored in full; render only a masked "••1234" form, never the raw value. */
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  bankBranch: string;
  createdAt: Timestamp;
}
