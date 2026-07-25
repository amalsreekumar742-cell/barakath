import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared';
import type { UserAddressProps } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import type { AddressFormValues } from '../utils/addressSchema';

/**
 * CRUD over `users/{uid}/addresses` — a DIRECT client read/write, not a Cloud Function. Per the react-
 * nextjs skill's trust boundary ("low-risk, self-owned, non-financial writes... may write directly if
 * Security Rules fully constrain them") and confirmed against `firestore.rules`
 * (`match /addresses/{addressId} { allow write: if isOwner(userId); }`) and the Flutter app's own
 * `AddressRemoteDataSourceImpl`, which does the same — no Cloud Function exists for this and none is
 * needed.
 *
 * WHY plain async functions, not `createAsyncThunk`s: this "feature" is components + api only, by
 * design (this batch's brief §6) — there is no `features/address` Redux slice, because the address
 * list is only ever needed locally by whichever screen is showing it (checkout, `/account/addresses`)
 * and both belong to LATER sessions (C2, C5) who will decide how their own slice/local state wants to
 * hold it. `features/address/hooks/useAddresses.ts` wraps these in local component state for exactly
 * that "just give me the data" case without requiring a global store registration this session
 * shouldn't be making on C2/C5's behalf.
 */

function addressesRef(uid: string) {
  return collection(db, FirestoreCollections.users, uid, FirestoreCollections.addresses);
}

/** Newest-first, bounded (`Constants.MAX_ADDRESSES`) — mirrors the Flutter datasource's own cap. */
export async function listAddresses(uid: string): Promise<UserAddressProps[]> {
  const snap = await getDocs(
    query(addressesRef(uid), orderBy('createdAt', 'desc'), limit(Constants.MAX_ADDRESSES)),
  );
  return snap.docs.map((d) => ({ ...(d.data() as Omit<UserAddressProps, 'id'>), id: d.id }));
}

/**
 * Create a new address. The FIRST address a customer ever adds is always the default (spec §2.14),
 * overriding whatever the form's own toggle said; for every later address the form's `isDefault`
 * choice is honoured. When a new address becomes default, every other current default is cleared in
 * the SAME batch as the create — mirrors `AddressRemoteDataSourceImpl.addAddress`'s batch so a crash
 * mid-write can never leave two addresses both claiming to be the default.
 */
export async function createAddress(uid: string, values: AddressFormValues): Promise<UserAddressProps> {
  const ref = doc(addressesRef(uid));
  const existingSnap = await getDocs(query(addressesRef(uid), limit(1)));
  const isFirst = existingSnap.empty;
  const isDefault = isFirst || Boolean(values.isDefault);

  const data = {
    label: values.label,
    fullName: values.fullName,
    // Kept with the country code so the delivery contact stays dialable, matching the Flutter app's
    // stored shape ("+91 9502148890").
    phone: `${Constants.DEFAULT_COUNTRY_CODE} ${values.phone}`,
    addressLine1: values.addressLine1,
    addressLine2: values.addressLine2 ?? '',
    city: values.city,
    state: values.state,
    pincode: values.pincode,
    landmark: values.landmark ?? '',
    isDefault,
  };

  const batch = writeBatch(db);
  if (isDefault && !isFirst) {
    const currentDefaults = await getDocs(query(addressesRef(uid), where('isDefault', '==', true)));
    currentDefaults.docs.forEach((d) => batch.update(d.ref, { isDefault: false }));
  }
  batch.set(ref, { ...data, createdAt: serverTimestamp() });
  await batch.commit();

  // `serverTimestamp()` resolves asynchronously server-side; return a client-clock stand-in so the
  // caller can render the new card immediately without a second read. `listAddresses`'s next call
  // will replace it with the real value.
  return { ...data, id: ref.id, createdAt: Timestamp.now() };
}

/**
 * Delete an address; if it was the default, promote the next OLDEST remaining address to default
 * (spec §2.14 — ascending by `createdAt`, not the newest). Wrapped in a `runTransaction` (unlike the
 * Flutter app's plain delete-then-query, which has a narrow window between the two calls) so two
 * rapid deletes from the same customer — e.g. a double-click — can never both read "I was the last
 * default" and leave zero defaults, or both try to promote the same next address.
 *
 * WHY the candidate lookup happens OUTSIDE the transaction: this workspace's pinned
 * `firebase` version (11.1.0 / `@firebase/firestore` 4.8.0) types `Transaction.get()` as accepting
 * only a `DocumentReference`, not a `Query` — a later SDK adds that overload, but upgrading is outside
 * this batch's scope. The transaction still re-reads the SPECIFIC candidate document BY REFERENCE
 * before writing to it, so a candidate id that went stale between the lookup and the transaction
 * (a genuine race with another concurrent delete) safely falls through to a no-op promotion rather
 * than acting on a document whose state it never actually verified — the "no two rapid deletes leave
 * zero defaults" guarantee comes from that re-read + Firestore's normal optimistic-concurrency retry
 * on the transaction, not from the initial candidate query being real-time-consistent.
 */
export async function deleteAddressAndPromote(uid: string, addressId: string): Promise<void> {
  const ref = doc(addressesRef(uid), addressId);
  const candidatesSnap = await getDocs(query(addressesRef(uid), orderBy('createdAt', 'asc'), limit(2)));
  const candidate = candidatesSnap.docs.find((d) => d.id !== addressId) ?? null;
  const candidateRef = candidate ? doc(addressesRef(uid), candidate.id) : null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const wasDefault = Boolean(snap.data().isDefault);

    // All reads before any write — Firestore transactions require it.
    const candidateSnap = wasDefault && candidateRef ? await tx.get(candidateRef) : null;

    tx.delete(ref);
    if (candidateSnap?.exists() && !candidateSnap.data().isDefault) {
      tx.update(candidateRef!, { isDefault: true });
    }
  });
}
