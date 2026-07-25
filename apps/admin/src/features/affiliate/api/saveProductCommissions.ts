import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { AffiliateProductCommission } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * saveProductCommissions — persist edited per-variant affiliate commissions (spec §1.14 Commissions
 * tab). Each entry writes its fixed ₹ amount to the variant doc's `commission` field at
 * `products/{productId}/variants/{variantId}`.
 *
 * WHY one writeBatch: all changed variants are committed atomically, so a mid-save failure never leaves
 * some variants updated and others not — the admin sees a clean all-or-nothing save (skill: batch
 * related writes). Only the CHANGED rows are passed in by the component (dirty tracking), so the batch
 * stays small.
 *
 * NOTE on the field name: the affiliate commission per variant IS the variant's existing `commission`
 * field (VariantProps.commission — spec §1.5 "Fixed ₹, must be < Referral price"); no new field is
 * introduced. The customer app / Cloud Functions award this amount on a referred sale of the variant.
 *
 * Returns the saved commissions so the slice can reconcile the loaded rows' baseline (clear dirty).
 */
export const saveProductCommissions = createAsyncThunk<
  AffiliateProductCommission[],
  { commissions: AffiliateProductCommission[] },
  { rejectValue: string }
>('affiliate/saveCommissions', async ({ commissions }, { rejectWithValue }) => {
  try {
    if (commissions.length === 0) return [];
    const batch = writeBatch(db);
    for (const c of commissions) {
      const variantRef = doc(
        db,
        FirestoreCollections.products,
        c.productId,
        FirestoreCollections.variants,
        c.variantId,
      );
      batch.update(variantRef, { commission: c.commission });
      // Touch the parent product's updatedAt so downstream denormalization/caches see the change.
      batch.update(doc(db, FirestoreCollections.products, c.productId), {
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return commissions;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not save commissions');
  }
});
