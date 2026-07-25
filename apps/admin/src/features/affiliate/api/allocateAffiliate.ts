import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { UserProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/** Alphabet for the random suffix: unambiguous uppercase letters + digits (spec §1.14 code format). */
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_PREFIX = 'BAR';
const CODE_RANDOM_LEN = 6;

/** Generate a "BAR" + 6 random A–Z0–9 referral code (e.g. "BAR7KQ2ZP"). */
function generateCode(): string {
  let suffix = '';
  for (let i = 0; i < CODE_RANDOM_LEN; i++) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `${CODE_PREFIX}${suffix}`;
}

/**
 * allocateAffiliate — turn an existing customer into an affiliate by assigning a unique referral code
 * (spec §1.14 Allocate Affiliate). Steps:
 *  1. Re-read the user and refuse if they already hold an `affiliateCode` (allocation is one-time).
 *  2. Generate a "BAR"+6 code and verify uniqueness with a `where('affiliateCode','==',code)` probe;
 *     retry a few times on the astronomically unlikely collision.
 *  3. Set `affiliateCode`, initialise `affiliateBalance` to 0, and stamp `updatedAt`.
 *
 * TODO: move to Cloud Function — code allocation should be server-owned so uniqueness is enforced under
 * a transaction (two admins allocating concurrently could both pass the probe and mint the same code).
 * The client probe is best-effort; a Cloud Function using a transaction (or a reserved-codes doc) should
 * own this. Kept client-side per this build's scope, with the guard + probe as a pragmatic safeguard.
 *
 * Returns the updated user so the slice can prepend the new affiliate row and toast the code.
 */
export const allocateAffiliate = createAsyncThunk<
  { user: UserProps; code: string },
  { userId: string },
  { rejectValue: string }
>('affiliate/allocate', async ({ userId }, { rejectWithValue }) => {
  try {
    const userRef = doc(db, FirestoreCollections.users, userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return rejectWithValue('Customer not found');
    const user = { ...snap.data(), id: snap.id } as UserProps;
    if ((user.affiliateCode ?? '') !== '') {
      return rejectWithValue('This customer is already an affiliate');
    }

    // Find a code not already held by another user (best-effort uniqueness; see TODO above).
    let code = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateCode();
      const existing = await getDocs(
        query(
          collection(db, FirestoreCollections.users),
          where('affiliateCode', '==', candidate),
          limit(1),
        ),
      );
      if (existing.empty) {
        code = candidate;
        break;
      }
    }
    if (!code) return rejectWithValue('Could not generate a unique code — please try again');

    await updateDoc(userRef, {
      affiliateCode: code,
      affiliateBalance: 0,
      updatedAt: serverTimestamp(),
    });

    // Return an optimistic user object carrying the new code so the list updates without a refetch.
    return { user: { ...user, affiliateCode: code, affiliateBalance: 0 }, code };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not allocate affiliate code');
  }
});
