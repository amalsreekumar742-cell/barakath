import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { SubAdminProps } from '@barakath/shared/types';
import keywordsBuilder from '@barakath/shared/utils/keywordsBuilder';
import { db } from '@/lib/firebaseConfig';
import type { SubAdminInput } from '../types';

/**
 * updateSubAdmin — edit an existing sub-admin (spec §1.20: name, phone, role, permissions and status are
 * editable after creation; email is NOT). Keywords are rebuilt only when the name or phone changed (email
 * can't change, so it never affects them). updatedAt is stamped server-side.
 *
 * WHY email is never written here: it is the login identity, locked after creation (spec §1.20) — the
 * form renders it read-only and it is intentionally absent from the patch. WHY pass the previous doc in:
 * it lets us diff name/phone without a re-read to decide whether to rebuild keywords, keeping it to a
 * single write.
 */
export const updateSubAdmin = createAsyncThunk<
  SubAdminProps,
  { id: string; input: SubAdminInput; previous: SubAdminProps },
  { rejectValue: string }
>('subAdmin/update', async ({ id, input, previous }, { rejectWithValue }) => {
  try {
    const fullName = input.fullName.trim();
    const phone = input.phone.trim();
    const nameOrPhoneChanged = fullName !== previous.fullName || phone !== previous.phone;

    // Email is locked, so it stays out of the keyword rebuild source (uses the existing lowercased email).
    const keywords = nameOrPhoneChanged
      ? keywordsBuilder(`${fullName} ${previous.email} ${phone}`)
      : previous.keywords;

    const patch = {
      fullName,
      phone,
      role: input.role,
      permissions: input.permissions,
      status: input.status,
      keywords,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, FirestoreCollections.subAdmins, id), patch);

    // Return the merged doc (keeping server-owned email/lastActive/createdAt from `previous`).
    return { ...previous, ...patch, id, updatedAt: Timestamp.now() } as SubAdminProps;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not update sub-admin');
  }
});
