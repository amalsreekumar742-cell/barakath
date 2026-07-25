import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc, writeBatch, deleteField, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { FlashSaleProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * toggleFlashSaleActive — flip a flash sale's `isActive` flag from the list (spec §1.16 On/Off toggle),
 * keeping the product + variant pricing in sync with the flag.
 *
 * WHY a batch (not a single-field update like coupons): the flash flag drives real pricing on the
 * product. Deactivating must also clear `isFlashSale` and strip each variant's flashSalePrice (prices
 * revert, spec §1.16); activating restores the flag and re-applies each variant's snapshotted
 * flashSalePrice from `variantPrices`. updatedAt is server-stamped.
 * WHY it returns {flashSaleId, isActive}: the slice patches just that row's flag in place — no re-fetch.
 */
export const toggleFlashSaleActive = createAsyncThunk<
  { flashSaleId: string; isActive: boolean },
  { flashSaleId: string; isActive: boolean },
  { rejectValue: string }
>('flashSale/toggleActive', async ({ flashSaleId, isActive }, { rejectWithValue }) => {
  try {
    const snap = await getDoc(doc(db, FirestoreCollections.flashSales, flashSaleId));
    if (!snap.exists()) return rejectWithValue('Flash sale not found');
    const fs = { ...snap.data(), id: snap.id } as FlashSaleProps;

    const batch = writeBatch(db);
    batch.update(doc(db, FirestoreCollections.flashSales, flashSaleId), {
      isActive,
      updatedAt: serverTimestamp(),
    });
    // Keep every product's flag + variant prices consistent with the new flag.
    for (const p of fs.products) {
      batch.update(doc(db, FirestoreCollections.products, p.productId), { isFlashSale: isActive });
      for (const v of p.variantPrices) {
        batch.update(
          doc(db, FirestoreCollections.products, p.productId, FirestoreCollections.variants, v.variantId),
          { flashSalePrice: isActive ? v.flashSalePrice : deleteField() },
        );
      }
    }
    await batch.commit();

    return { flashSaleId, isActive };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not update flash sale');
  }
});
