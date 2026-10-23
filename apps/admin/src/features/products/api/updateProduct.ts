import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, deleteField, doc, getDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { ProductStatus } from '@barakath/shared/config/enums';
import keywordsBuilder from '@barakath/shared/utils/keywordsBuilder';
import { sortVariants } from '@barakath/shared/utils/sortVariants';
import type { ProductProps, VariantProps, SpecificationProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { isSkuTaken } from './checkSku';
import { resolveProductImages, variantImageUrl, variantOptionsField } from './createProduct';
import { queueVariantCost, queueVariantCostDelete } from './variantCosts';
import { deriveStockStatus, deriveListFields } from '../utils/stock';
import { planVariantStock } from '../utils/planVariantStock';
import type { VariantToSave, ImageDraft } from '../types';

export interface UpdateProductInput {
  id: string;
  name: string;
  sku: string;
  description: string;
  categoryId: string;
  categoryName: string;
  subCategoryId: string;
  subCategoryName: string;
  images: ImageDraft[];
  specifications: SpecificationProps[];
  youtubeVideoLink: string;
  isCombo: boolean;
  comboDeliveryCharge: number;
  replacementAvailable: boolean;
  lowStockThreshold: number;
  frequentlyBoughtTogether: string[];
  status: ProductStatus;
  /** Desired variant set, in display order (index → `sortOrder`). */
  variants: VariantToSave[];
  /** The admin saving — stamped on the `stockAdjustments` audit doc of every stock they changed. */
  adjustedBy: string;
  adjustedByName: string;
}

/**
 * updateProduct — update the product doc and reconcile its variant subcollection (spec §1.5).
 *
 * WHY diff-then-batch: the form hands us the desired variant set; we create the new ones, update the
 * existing ones IN PLACE (same doc id, so saved carts and flash sales that reference the variant keep
 * working after a price edit), and delete the removed ones — all product/variant writes in one atomic
 * batch. `totalStock`/`stockStatus` are re-derived; `keywords` rebuilt (name/sku/category may have
 * changed). SKU uniqueness excludes self.
 *
 * Stock is the exception to "write what the form says": see `planVariantStock` — an existing
 * variant's stock is written (and audited, in this same batch) only if the admin changed it.
 */
export const updateProduct = createAsyncThunk<
  { product: ProductProps; variants: VariantProps[] },
  UpdateProductInput,
  { rejectValue: string }
>('products/update', async (input, { rejectWithValue }) => {
  try {
    if (await isSkuTaken(input.sku, input.id)) return rejectWithValue('SKU already exists');

    const productRef = doc(db, FirestoreCollections.products, input.id);
    const varCol = collection(
      db,
      FirestoreCollections.products,
      input.id,
      FirestoreCollections.variants,
    );

    const existingSnap = await getDocs(varCol);
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));
    const desiredExistingIds = new Set(input.variants.filter((v) => !v.isNew).map((v) => v.id));
    const removedIds = [...existingIds].filter((id) => !desiredExistingIds.has(id));

    // Upload the product images (new blobs) / keep existing urls, in order.
    const { urls: images, urlById } = await resolveProductImages(input.id, input.images);

    // Live stock from the read above, not the form's load-time copy — orders keep decrementing it.
    const liveStock = new Map<string, number>();
    for (const d of existingSnap.docs) {
      const s = (d.data() as Partial<VariantProps>).stock;
      liveStock.set(d.id, typeof s === 'number' && Number.isFinite(s) ? s : 0);
    }
    const stockPlan = planVariantStock(input.variants, liveStock);
    const totalStock = stockPlan.totalStock;
    const stockStatus = deriveStockStatus(totalStock, input.lowStockThreshold);
    const listFields = deriveListFields(images, input.variants);

    const batch = writeBatch(db);
    batch.update(productRef, {
      name: input.name.trim(),
      sku: input.sku.trim(),
      description: input.description,
      categoryId: input.categoryId,
      categoryName: input.categoryName,
      subCategoryId: input.subCategoryId,
      subCategoryName: input.subCategoryName,
      images,
      specifications: input.specifications,
      youtubeVideoLink: input.youtubeVideoLink,
      isCombo: input.isCombo,
      comboDeliveryCharge: input.isCombo ? input.comboDeliveryCharge : 0,
      replacementAvailable: input.replacementAvailable,
      lowStockThreshold: input.lowStockThreshold,
      frequentlyBoughtTogether: input.isCombo ? input.frequentlyBoughtTogether : [],
      status: input.status,
      stockStatus,
      totalStock,
      thumbnail: listFields.thumbnail,
      minPrice: listFields.minPrice,
      maxPrice: listFields.maxPrice,
      keywords: keywordsBuilder(
        `${input.name} ${input.sku} ${input.categoryName} ${input.subCategoryName}`,
      ),
      updatedAt: serverTimestamp(),
    });
    for (const [index, v] of input.variants.entries()) {
      const ref = v.isNew ? doc(varCol) : doc(varCol, v.id);
      const imageUrl = variantImageUrl(v, urlById);
      const base = {
        name: v.name.trim(),
        // Present only when the row carries options; a legacy variant's update simply never touches
        // the field, so it stays single-axis.
        ...variantOptionsField(v),
        color: v.color.trim(),
        colorCode: v.colorCode,
        mrp: v.mrp,
        offerPrice: v.offerPrice,
        referralPrice: v.referralPrice,
        commission: v.commission,
        gstPercentage: v.gstPercentage,
        // Rewritten for EVERY variant, not just moved ones: positions are relative, so one move
        // shifts its neighbours, and legacy variants without a sortOrder get one on first save.
        sortOrder: index,
      };
      const stock = stockPlan.writeStock.get(v.id);
      if (v.isNew) {
        batch.set(ref, { ...base, ...(imageUrl ? { imageUrl } : {}), stock: v.stock, createdAt: serverTimestamp() });
      } else {
        // Deleted rather than left behind when the link was cleared or its photo removed — a stale url
        // would keep pointing the storefront at a photo the admin took away.
        const update = { ...base, imageUrl: imageUrl ?? deleteField() };
        batch.update(ref, stock === undefined ? update : { ...update, stock });
      }
      // Cost rides the SAME batch as the variant it belongs to.
      queueVariantCost(batch, ref.id, input.id, v.purchasePrice);
    }
    // Audit every stock the admin changed here, exactly as Inventory › Adjust stock does — a stock
    // change made from the product form must not be the one kind that leaves no trail.
    const byId = new Map(input.variants.map((v) => [v.id, v]));
    for (const c of stockPlan.changes) {
      batch.set(doc(collection(db, FirestoreCollections.stockAdjustments)), {
        productId: input.id,
        productName: input.name.trim(),
        variantId: c.variantId,
        // The variant's name (its display label, e.g. "57" or "57 · Layer 2") — the same value
        // Inventory writes into this field.
        variantName: byId.get(c.variantId)?.name.trim() ?? '',
        previousStock: c.previousStock,
        newStock: c.newStock,
        adjustment: c.newStock - c.previousStock,
        reason: 'Product edit',
        note: 'Edited from the product form',
        adjustedBy: input.adjustedBy,
        adjustedByName: input.adjustedByName,
        createdAt: serverTimestamp(),
      });
    }
    for (const id of removedIds) {
      batch.delete(doc(varCol, id));
      queueVariantCostDelete(batch, id);
    }
    await batch.commit();

    const snap = await getDoc(productRef);
    const product = { ...snap.data(), id: input.id } as ProductProps;
    const finalVars = await getDocs(varCol);
    // Unordered read, so sort — this becomes `productDetail`, which the form hydrates from.
    const variants = sortVariants(
      finalVars.docs.map((d) => ({ ...d.data(), id: d.id }) as VariantProps),
    );
    return { product, variants };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not update product');
  }
});
