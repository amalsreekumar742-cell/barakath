import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, doc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { StockStatus } from '@barakath/shared/config/enums';
import type { VariantProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { sumStock, deriveStockStatus } from '@/features/products/utils/stock';
import type { StockEdit } from '../types';

export interface AdjustStockBatchInput {
  edits: StockEdit[];
  reason: string;
  note: string;
  adjustedBy: string;
  adjustedByName: string;
}

export interface AdjustStockBatchResult {
  /** Per-product denormalized totals after the batch, for patching the list in place. */
  products: { productId: string; totalStock: number; stockStatus: StockStatus }[];
  /** Each changed variant's new stock, for patching the affected rows. */
  changed: { productId: string; variantId: string; newStock: number }[];
}

/**
 * adjustStockBatch — apply manual stock changes to MANY variants (across products) in ONE atomic batch
 * (spec §1.6 "Multiple SKUs adjusted in one batch"). For each affected product it reads the full variant
 * set, re-derives `totalStock`/`stockStatus` with the edited stocks swapped in, updates every changed
 * variant, writes one `stockAdjustments` audit doc per change (with reason + note), and updates the
 * product totals — all committed together. Stock is clamped ≥ 0 (cannot go negative). A required reason
 * applies to the whole batch; unchanged variants are ignored.
 */
export const adjustStockBatch = createAsyncThunk<
  AdjustStockBatchResult,
  AdjustStockBatchInput,
  { rejectValue: string }
>('inventory/adjustStockBatch', async (input, { rejectWithValue }) => {
  try {
    if (!input.reason.trim()) return rejectWithValue('Reason is required');
    const edits = input.edits
      .map((e) => ({ ...e, newStock: Math.max(0, Math.round(e.newStock)) }))
      .filter((e) => e.newStock !== e.previousStock);
    if (edits.length === 0) return rejectWithValue('No stock changes to save');

    // Group edits by product so each product's total is recomputed once.
    const byProduct = new Map<string, StockEdit[]>();
    for (const e of edits) {
      if (!byProduct.has(e.productId)) byProduct.set(e.productId, []);
      byProduct.get(e.productId)!.push(e);
    }

    const batch = writeBatch(db);
    const products: AdjustStockBatchResult['products'] = [];
    const changed: AdjustStockBatchResult['changed'] = [];

    for (const [productId, productEdits] of byProduct) {
      const varCol = collection(
        db,
        FirestoreCollections.products,
        productId,
        FirestoreCollections.variants,
      );
      const varSnap = await getDocs(varCol);
      const editMap = new Map(productEdits.map((e) => [e.variantId, e.newStock]));

      const totalStock = sumStock(
        varSnap.docs.map((d) => {
          const v = d.data() as VariantProps;
          return editMap.has(d.id) ? editMap.get(d.id)! : v.stock;
        }),
      );
      const threshold = productEdits[0]!.lowStockThreshold;
      const stockStatus = deriveStockStatus(totalStock, threshold);

      for (const e of productEdits) {
        batch.update(doc(varCol, e.variantId), { stock: e.newStock });
        batch.set(doc(collection(db, FirestoreCollections.stockAdjustments)), {
          productId: e.productId,
          productName: e.productName,
          variantId: e.variantId,
          variantName: e.variantName,
          previousStock: e.previousStock,
          newStock: e.newStock,
          adjustment: e.newStock - e.previousStock,
          reason: input.reason.trim(),
          note: input.note.trim(),
          adjustedBy: input.adjustedBy,
          adjustedByName: input.adjustedByName,
          createdAt: serverTimestamp(),
        });
        changed.push({ productId, variantId: e.variantId, newStock: e.newStock });
      }
      batch.update(doc(db, FirestoreCollections.products, productId), {
        totalStock,
        stockStatus,
        updatedAt: serverTimestamp(),
      });
      products.push({ productId, totalStock, stockStatus });
    }

    await batch.commit();
    return { products, changed };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not adjust stock');
  }
});
