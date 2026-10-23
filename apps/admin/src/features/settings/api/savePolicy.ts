import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  doc,
  getCountFromServer,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { POLICY_LIST_LIMIT } from '@barakath/shared/config/policies';
import type { PolicyStatus } from '@barakath/shared/config/enums';
import type { RootState } from '@/stores/store';
import { db } from '@/lib/firebaseConfig';

export interface SavePolicyInput {
  /** `null` creates a new policy; an id edits that one. */
  id: string | null;
  name: string;
  /** Sanitised by the readers (DOMPurify on the website, a script-disabled WebView in the app). */
  content: string;
  status: PolicyStatus;
  order: number;
}

/**
 * savePolicy — add or edit one policy (Settings › Policies editor). Resolves the saved doc's id.
 *
 * Create: counts the collection first and refuses past POLICY_LIST_LIMIT, then writes an auto-id doc
 * whose `id` field mirrors the doc id (the shared PolicyProps contract), with server timestamps.
 * Edit: `updateDoc` of the editable fields only — `createdAt` and `id` are never rewritten, which the
 * rules also enforce.
 *
 * WHY the cap is checked here: Security Rules can't count documents. `getCountFromServer` is an
 * aggregation (billed as one read), not a fetch of every policy. Two admins racing past the cap could
 * still land one extra — acceptable for a soft UI limit; the list read stays bounded either way.
 *
 * WHY `updateDoc` (not `setDoc` + merge) for edits: it fails with not-found if the policy no longer
 * exists, instead of silently resurrecting a half-document that would fail the rules' shape check.
 *
 * WHY `updatedBy` from the current admin: the rules require a changed `updatedBy` to equal the caller's
 * uid, and `currentAdmin.admin.id` IS that uid (the `subAdmins/{uid}` doc id).
 */
export const savePolicy = createAsyncThunk<
  { id: string },
  SavePolicyInput,
  { state: RootState; rejectValue: string }
>('settings/savePolicy', async (input, { getState, rejectWithValue }) => {
  const updatedBy = getState().currentAdmin.admin?.id;
  if (!updatedBy) return rejectWithValue('Not signed in');

  const fields = {
    name: input.name.trim(),
    content: input.content,
    status: input.status,
    order: input.order,
  };

  try {
    const policies = collection(db, FirestoreCollections.policies);

    if (!input.id) {
      const count = (await getCountFromServer(policies)).data().count;
      if (count >= POLICY_LIST_LIMIT) {
        return rejectWithValue(`You can have at most ${POLICY_LIST_LIMIT} policies.`);
      }
      const ref = doc(policies);
      await setDoc(ref, {
        id: ref.id,
        ...fields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy,
      });
      return { id: ref.id };
    }

    await updateDoc(doc(policies, input.id), {
      ...fields,
      updatedAt: serverTimestamp(),
      updatedBy,
    });
    return { id: input.id };
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'not-found') return rejectWithValue('That policy no longer exists.');
    return rejectWithValue(err instanceof Error ? err.message : 'Could not save the policy');
  }
});
