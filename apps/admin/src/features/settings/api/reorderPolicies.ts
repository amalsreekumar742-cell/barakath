import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, writeBatch } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { db } from '@/lib/firebaseConfig';
import type { PolicyOrderChange } from '../utils/policyOrder';

/**
 * reorderPolicies — commit one ▲/▼ move. `changes` comes from `policyMoveChanges` (at most two docs).
 * Resolves the same changes so the slice can patch the list in place without a refetch.
 *
 * WHY one writeBatch: a swap touches two docs; committed separately, a failure between them would leave
 * both policies on the same `order` (or the list half-swapped). The batch is atomic — both or neither.
 *
 * WHY only `order` is written (no `updatedAt`/`updatedBy`): moving a policy in the footer is not an edit
 * of the policy. `updatedAt` is what customers read as the page's "last updated" date, so it must not
 * jump because an admin re-sorted the list. The rules allow an update that leaves `updatedBy` untouched.
 */
export const reorderPolicies = createAsyncThunk<
  PolicyOrderChange[],
  PolicyOrderChange[],
  { rejectValue: string }
>('settings/reorderPolicies', async (changes, { rejectWithValue }) => {
  if (changes.length === 0) return changes;
  try {
    const batch = writeBatch(db);
    for (const c of changes) {
      batch.update(doc(db, FirestoreCollections.policies, c.id), { order: c.to });
    }
    await batch.commit();
    return changes;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not reorder the policies');
  }
});
