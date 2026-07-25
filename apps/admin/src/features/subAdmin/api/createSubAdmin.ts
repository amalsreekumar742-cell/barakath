import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { SubAdminProps } from '@barakath/shared/types';
import keywordsBuilder from '@barakath/shared/utils/keywordsBuilder';
import { db } from '@/lib/firebaseConfig';
import type { SubAdminInput } from '../types';
import { isSubAdminEmailTaken } from './isSubAdminEmailTaken';

/**
 * createSubAdmin — provision a new admin-panel user (spec §1.20 "Create Sub Admin (via Cloud Function)").
 *
 * ⚠️ CLIENT SCAFFOLD ONLY. This thunk writes the Firestore *profile* document so the list/edit flow can
 * be built and demoed, but it does NOT create the Firebase Auth account or set the `admin:true` custom
 * claim — both are privileged operations the client must never perform:
 *
 *   // TODO: move to Cloud Function — the real flow must, in a single trusted server call:
 *   //   1. createUser({ email, password }) on the Admin SDK (client createUserWithEmailAndPassword would
 *   //      sign the NEW user into the current admin's session — unacceptable),
 *   //   2. setCustomUserClaims(uid, { admin: true }) so Storage/Firestore rules recognise the admin,
 *   //   3. write THIS profile doc using that Auth `uid` as the document id (so profile ⇄ auth stay 1:1).
 *   // Until then the doc id is a generated Firestore id and `password` is intentionally discarded here
 *   // (never persist a password to Firestore).
 *
 * Two-step: (1) enforce email uniqueness with a single-doc query — reject with a message the form maps to
 * an inline error; (2) write the doc with email/keywords lowercased, permissions from the matrix,
 * lastActive null (never signed in yet), and createdAt/updatedAt stamped by the SERVER clock.
 */
export const createSubAdmin = createAsyncThunk<
  SubAdminProps,
  { input: SubAdminInput },
  { rejectValue: string }
>('subAdmin/create', async ({ input }, { rejectWithValue }) => {
  try {
    const email = input.email.trim().toLowerCase();
    if (await isSubAdminEmailTaken(email)) return rejectWithValue('Email already in use');

    // Keywords power the list search — built from name + email + phone (skill: precomputed keywords).
    const keywords = keywordsBuilder(`${input.fullName} ${email} ${input.phone}`);

    // WHY pre-generate the ref + store `id` in the doc: consumers read the sub-admin by its `id` field,
    // so it must be present IN the document, not only as the Firestore key. (A Cloud Function would
    // instead use the Auth uid — see the TODO above.)
    const ref = doc(collection(db, FirestoreCollections.subAdmins));
    const docData = {
      id: ref.id,
      fullName: input.fullName.trim(),
      email,
      phone: input.phone.trim(),
      role: input.role,
      permissions: input.permissions,
      status: input.status,
      lastActive: null,
      keywords,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, docData);

    // Client-side mirror for the optimistic list prepend (server holds the real timestamps).
    const now = Timestamp.now();
    return { ...docData, createdAt: now, updatedAt: now } as SubAdminProps;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not create sub-admin');
  }
});
