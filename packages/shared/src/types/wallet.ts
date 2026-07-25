import type { Timestamp } from 'firebase/firestore';
import type { WalletSource } from '../config/enums';

/**
 * WalletTransactionProps — one entry in a customer's normal wallet ledger (spec §1.8 Wallet tab).
 *
 * WHY here (not per-app): the app spends the wallet at checkout and the admin credits it ("Add money");
 * both read the same ledger, so the shape is defined once. `balanceAfter` is the running balance the
 * server computed when the entry was written — the ledger is append-only and never trusted from a
 * client. `createdAt` is a Firestore `Timestamp`.
 *
 * WHY `source: WalletSource` (imported) rather than an inline literal union: this field used to be
 * typed `'Refund' | 'Reward' | 'Top-up' | 'Purchase' | 'Admin'`, which OMITTED `'UPI top-up'` — the
 * exact string `verifyWalletTopUp` (`functions/src/wallet/verifyWalletTopUp.ts`) writes for every real
 * top-up (confirmed live, Web Batch 4 / D2). A doc read back into this type could never legitimately
 * equal `'UPI top-up'` under the old union, so any `source === 'UPI top-up'` check on the web (or a
 * future consumer) would have failed to type-check. `WalletSource` (`config/enums.ts`) is the verified,
 * single source of truth — it also keeps the deprecated, never-written `'Top-up'` for backward doc
 * compatibility while exposing the real `'UPI top-up'` value.
 */
export interface WalletTransactionProps {
  id: string;
  userId: string;
  type: 'Credit' | 'Debit';
  amount: number;
  source: WalletSource;
  description: string;
  orderId: string;
  balanceAfter: number;
  createdAt: Timestamp;
}
