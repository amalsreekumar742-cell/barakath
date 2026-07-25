import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';

/**
 * Bounded-batch wishlist clear, mirroring `apps/app/lib/features/profile/data/datasources/
 * profile_remote_datasource.dart`'s `_clearWishlist` EXACTLY (WEB_BATCH4_NOTES.md §2): read up to
 * `WISHLIST_DELETE_BATCH_SIZE` docs, batch-delete them, repeat up to `WISHLIST_DELETE_MAX_BATCHES`
 * times, stop early once a page comes back short. Best-effort — a leftover wishlist entry is not
 * personal data worth failing an account deletion over (same reasoning as the Flutter source).
 */
async function clearWishlist(uid: string): Promise<void> {
  const wishlistRef = collection(db, FirestoreCollections.users, uid, FirestoreCollections.wishlist);
  try {
    for (let i = 0; i < Constants.WISHLIST_DELETE_MAX_BATCHES; i++) {
      const snap = await getDocs(query(wishlistRef, limit(Constants.WISHLIST_DELETE_BATCH_SIZE)));
      if (snap.empty) return;

      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();

      if (snap.docs.length < Constants.WISHLIST_DELETE_BATCH_SIZE) return; // short page — done
    }
  } catch {
    // Best-effort, matching Flutter's `_clearWishlist` catch-all.
  }
}

/**
 * anonymiseAccount — mirrors `apps/app`'s `ProfileRemoteDataSourceImpl.anonymiseAccount` EXACTLY,
 * field for field (WEB_BATCH4_NOTES.md §2), so the two clients leave IDENTICAL document state:
 *
 *   1. `users/{uid}` update with the anonymising fields below — MUST succeed (this call is awaited
 *      un-caught so a failure here rejects the whole `anonymiseAccount` call). This is the real
 *      anonymisation; every one of these keys is inside `firestore.rules`' `onlyOwnProfileFields()`
 *      allowlist (`fullName, email, whatsapp, profileImage, referredBy, keywords, fcmToken,
 *      updatedAt`).
 *   2. Best-effort bounded-batch wishlist clear (`clearWishlist` above) — never fails the deletion.
 *   3. Best-effort `status: 'Blocked'` — caught and swallowed. `onlyOwnProfileFields()` does NOT
 *      include `status`, so this write IS REJECTED today, on both clients: a real, pre-existing,
 *      cross-client gap (the account's PII is wiped but it is not actually blocked from signing back
 *      in), not something introduced by or fixed in this batch. Do NOT "fix" this by loosening
 *      `firestore.rules` — WEB_BATCH4_NOTES.md §2 explicitly decided against that, since patching only
 *      the web side would make the two clients diverge WORSE, not better.
 *
 * Caller is responsible for what happens after this resolves — signing out, clearing the session
 * cookie, resetting the Redux store, and redirecting home (see `DangerZone.tsx`), matching Flutter's
 * own ordering (`profile_provider.dart`'s `deleteAccount()`: anonymise fully succeeds, THEN `logout()`).
 */
export async function anonymiseAccount(uid: string): Promise<void> {
  const userRef = doc(db, FirestoreCollections.users, uid);

  // Step 1 — must succeed; a thrown error here propagates to the caller and the deletion is reported
  // as failed (nothing else in this function has run yet).
  await updateDoc(userRef, {
    fullName: '',
    email: '',
    whatsapp: '',
    profileImage: '',
    fcmToken: '',
    keywords: [],
    updatedAt: serverTimestamp(),
  });

  // Step 2 — best-effort.
  await clearWishlist(uid);

  // Step 3 — best-effort, swallowed on failure (expected to fail today; see doc comment above).
  try {
    await updateDoc(userRef, { status: 'Blocked' });
  } catch {
    // Expected: firestore.rules' onlyOwnProfileFields() does not permit `status` for a customer.
  }
}
