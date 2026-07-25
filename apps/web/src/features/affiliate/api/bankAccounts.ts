import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared';
import type { BankAccountProps } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';

/**
 * CRUD over `users/{uid}/bankAccounts` — a DIRECT client read/write, not a Cloud Function.
 *
 * WHY direct writes are acceptable here (the react-nextjs skill's trust boundary): `firestore.rules`
 * fully constrains this sub-collection to its owner (`match /bankAccounts/{accountId} { allow read: if
 * isAdmin() || isOwner(userId); allow create, update, delete: if isOwner(userId); }`) and it carries no
 * money of its own — it is a payout DESTINATION, not a balance. The rule's own comment notes the "max 2"
 * cap is a UI invariant, not a security boundary (a rule cannot count sibling documents), so the
 * duplicate/cap checks below are best-effort the same way `apps/app`'s
 * `AffiliateRemoteDataSourceImpl.addBankAccount` documents its own check as being.
 *
 * Mirrors `apps/address/api/addresses.ts`'s shape (plain async functions, no Redux slice — this list is
 * only ever needed locally by whichever affiliate screen is showing it).
 */

function bankAccountsRef(uid: string) {
  return collection(db, FirestoreCollections.users, uid, FirestoreCollections.bankAccounts);
}

/** Oldest-first, bounded at the 2-account cap (a defensive limit, not real pagination — nobody has
 *  more than 2 by design). */
export async function listBankAccounts(uid: string): Promise<BankAccountProps[]> {
  const snap = await getDocs(
    query(bankAccountsRef(uid), orderBy('createdAt', 'asc'), limit(Constants.AFFILIATE_MAX_BANK_ACCOUNTS)),
  );
  return snap.docs.map((d) => ({ ...(d.data() as Omit<BankAccountProps, 'id'>), id: d.id }));
}

export interface NewBankAccount {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  bankBranch: string;
}

/**
 * Saves a payout account after re-checking the CURRENT server-side count and duplicate account number —
 * re-reading rather than trusting whatever list the caller's screen already holds, because a second tab
 * or device could have saved the 2nd account since that list was fetched (same reasoning as the Flutter
 * datasource this mirrors).
 */
export async function addBankAccount(uid: string, values: NewBankAccount): Promise<BankAccountProps> {
  const existing = await getDocs(bankAccountsRef(uid));
  if (existing.size >= Constants.AFFILIATE_MAX_BANK_ACCOUNTS) {
    throw new Error(
      `You can save up to ${Constants.AFFILIATE_MAX_BANK_ACCOUNTS} bank accounts. Delete one to add another.`,
    );
  }
  const duplicate = existing.docs.some(
    (d) => String(d.data().accountNumber ?? '').trim() === values.accountNumber.trim(),
  );
  if (duplicate) throw new Error('This bank account is already saved.');

  const ref = doc(bankAccountsRef(uid));
  const data = {
    accountHolderName: values.accountHolderName.trim(),
    accountNumber: values.accountNumber.trim(),
    ifscCode: values.ifscCode.trim().toUpperCase(),
    bankName: values.bankName.trim(),
    bankBranch: values.bankBranch.trim(),
  };
  await setDoc(ref, { ...data, createdAt: serverTimestamp() });
  // `serverTimestamp()` resolves asynchronously; stand in with the client clock so the new card can
  // render immediately (same pattern as `createAddress`) — the next `listBankAccounts` replaces it.
  return { ...data, id: ref.id, createdAt: Timestamp.now() };
}

export async function deleteBankAccount(uid: string, accountId: string): Promise<void> {
  await deleteDoc(doc(bankAccountsRef(uid), accountId));
}
