import type { Timestamp } from 'firebase/firestore';

/**
 * UserProps / UserAddressProps — a customer account and its saved delivery addresses (spec §1.8).
 *
 * WHY here (not per-app): the customer app writes these docs and the admin panel reads them; one
 * definition keeps the contract identical across both. Money fields (walletBalance, affiliateBalance,
 * totalSpent) are maintained server-side (Cloud Functions), never trusted from a client. Date fields use
 * the Firestore `Timestamp` type (not epoch millis) so they sort/range-query correctly server-side.
 */
export interface UserAddressProps {
  id: string;
  /** Home / Office / Other (spec §2.14) — what the saved-address card is titled by. Added by Web
   *  Batch 3 (C0): the Flutter app's `Address` entity always carried this field, but it was missing
   *  here. `createPaymentOrder.ts` already reads it defensively (`?? 'Home'`) for the order's
   *  embedded shipping address, so this brings the shared type in line with the real documents. */
  label: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  isDefault: boolean;
  createdAt: Timestamp;
}

export interface UserProps {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  profileImage: string;
  status: 'Active' | 'Blocked';
  walletBalance: number;
  affiliateCode: string;
  affiliateBalance: number;
  /**
   * Affiliate fields below (Web Batch 4, D4) — REAL, currently-written fields on `users/{uid}`,
   * maintained server-side with `FieldValue.increment` inside Cloud Function transactions. This type
   * was missing them even though the writers already existed:
   *   - `pendingCommission` — incremented by `functions/src/growth/processReferralCommission.ts` when a
   *     referred order is delivered (a 7-day-hold commission).
   *   - `confirmedCommission` — the LIFETIME cleared total; moved from pending by the daily
   *     `functions/src/growth/clearAffiliateCommissions.ts` job once a commission's `clearsAt` passes
   *     (`affiliateBalance` is credited in the same transaction).
   *   - `totalReferrals` — incremented by `functions/src/growth/trackReferralSignup.ts` when a referred
   *     signup links to this affiliate's code.
   *   - `affiliateEnabled` — an admin-owned per-user wallet-access toggle. No admin UI writes it today
   *     (`apps/admin`'s `allocateAffiliate` only ever sets `affiliateCode`/`affiliateBalance`) and it is
   *     absent on most documents, so it is OPTIONAL here and must be treated as `true` when missing —
   *     exactly how `apps/app`'s `User` entity defaults it (`affiliateEnabled = true`). There is no
   *     store-wide affiliate toggle anywhere in `general/config`; this per-user field is the only gate.
   * The Flutter `User` entity (`apps/app/lib/features/auth/domain/entities/user.dart`) already declares
   * and reads all four straight off this same document — this type simply catches up to it.
   */
  pendingCommission: number;
  confirmedCommission: number;
  totalReferrals: number;
  affiliateEnabled?: boolean;
  totalOrders: number;
  totalSpent: number;
  keywords: string[];
  fcmToken: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
