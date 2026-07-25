import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';

/**
 * isSubAdminEmailTaken — true if another sub-admin already uses `email` (spec §1.20: email is the login
 * identity and must be unique). WHY a standalone function (not a thunk): it is called both from the
 * form's on-blur feedback and from createSubAdmin, and its result is a plain boolean that never lives in
 * the slice. Emails are stored lowercased, so we lowercase before comparing.
 *
 * WHY a single-field equality query with limit(1): uniqueness only needs to know if ANY doc has the
 * email — one match is enough and needs no composite index (single-field equality is auto-indexed).
 *
 * NOTE: this is a client-side convenience check only. The authoritative uniqueness guarantee comes from
 * Firebase Auth (one account per email) enforced in the Cloud Function that provisions the account.
 */
export async function isSubAdminEmailTaken(email: string): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(db, FirestoreCollections.subAdmins),
      where('email', '==', email.trim().toLowerCase()),
      limit(1),
    ),
  );
  return !snap.empty;
}
