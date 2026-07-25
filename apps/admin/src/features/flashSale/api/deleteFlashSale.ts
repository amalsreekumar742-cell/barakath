import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, getDoc, writeBatch, deleteField } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { FlashSaleProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

/**
 * deleteFlashSale — hard-delete a flash sale AND revert its pricing effects (spec §1.16 / §1.22:
 * confirmation dialog + toast handled in the component).
 *
 * WHY a batch that also touches the product: the sale imprinted `isFlashSale: true` on the product and a
 * `flashSalePrice` on every variant. Deleting only the sale doc would strand those, leaving the product
 * showing a flash price with no sale behind it. So we read the doc for its variant list, then batch:
 * clear the product flag, deleteField() each variant's flashSalePrice, and delete the sale doc.
 * WHY it returns the id: the slice removes the row from the list in place without a re-fetch.
 */
export const deleteFlashSale = createAsyncThunk<string, string, { rejectValue: string }>(
  'flashSale/delete',
  async (flashSaleId, { rejectWithValue }) => {
    try {
      const snap = await getDoc(doc(db, FirestoreCollections.flashSales, flashSaleId));
      if (!snap.exists()) return flashSaleId; // already gone — treat as success
      const fs = { ...snap.data(), id: snap.id } as FlashSaleProps;

      const batch = writeBatch(db);
      // Revert each product's flag + strip every variant's flash price (prices auto-revert, spec §1.16).
      for (const p of fs.products) {
        batch.update(doc(db, FirestoreCollections.products, p.productId), { isFlashSale: false });
        for (const v of p.variantPrices) {
          batch.update(
            doc(db, FirestoreCollections.products, p.productId, FirestoreCollections.variants, v.variantId),
            { flashSalePrice: deleteField() },
          );
        }
      }
      batch.delete(doc(db, FirestoreCollections.flashSales, flashSaleId));
      await batch.commit();

      return flashSaleId;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Could not delete flash sale');
    }
  },
);
