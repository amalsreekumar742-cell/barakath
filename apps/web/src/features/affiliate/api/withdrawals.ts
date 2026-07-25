import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections, keywordsBuilder } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';
import type { BankAccountProps } from '@barakath/shared';

/**
 * Files a payout request — the ONE legitimate client-side financial write in the whole project
 * (WEB_BATCH4_NOTES.md §9). No `createWithdrawalRequest` Cloud Function exists; `firestore.rules`
 * carries the whole invariant on `create` instead of trusting the UI:
 *   - `userId == request.auth.uid`
 *   - `status == 'Pending'`
 *   - `amount is number && amount >= 10000 && amount <=` the CALLER'S OWN `affiliateBalance` read
 *     server-side from `users/{uid}` — so a tampered client cannot request more than it has earned.
 *   - `rejectionReason == ''` and `processedBy == ''`.
 * This function must therefore write EXACTLY those five fields with those exact values, plus whatever
 * descriptive fields the rule doesn't constrain (bank snapshot, `keywords`, timestamps) for the admin
 * panel to display — mirrors `AffiliateWithdrawalModel.toCreateMap()`'s field list one-for-one. The
 * processing fee is a display-only constant (`Constants.AFFILIATE_PROCESSING_FEE`, always ₹0 today) —
 * Flutter's own model never persists it either, so it isn't written here, keeping both clients'
 * documents byte-for-byte identical rather than the web carrying two fields the app doesn't.
 *
 * The client NEVER writes `affiliateBalance` — admin deducts it on approval (`approveWithdrawal.ts`).
 */
export async function createWithdrawal(params: {
  uid: string;
  userName: string;
  userPhone: string;
  amount: number;
  account: BankAccountProps;
}): Promise<void> {
  const { uid, userName, userPhone, amount, account } = params;

  await addDoc(collection(db, FirestoreCollections.affiliateWithdrawals), {
    userId: uid,
    userName,
    userPhone,
    amount,
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    ifscCode: account.ifscCode,
    accountHolderName: account.accountHolderName,
    status: 'Pending',
    rejectionReason: '',
    processedBy: '',
    processedAt: null,
    keywords: keywordsBuilder(`${userName} ${userPhone}`),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
