import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, doc, getDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { ProductStatus } from '@barakath/shared/config/enums';
import keywordsBuilder from '@barakath/shared/utils/keywordsBuilder';
import type { ProductProps, VariantProps, SpecificationProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { isSkuTaken } from './checkSku';
import { resolveProductImages } from './createProduct';
import { queueVariantCost, queueVariantCostDelete } from './variantCosts';
import { sumStock, deriveStockStatus, deriveListFields } from '../utils/stock';
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
  variants: VariantToSave[];
}

/**
 * updateProduct — update the product doc and reconcile its variant subcollection (spec §1.5).
 *
 * WHY diff-then-batch: the form hands us the desired variant set; we create the new ones (upload
 * images), update the existing ones (re-resolving their image order), and delete the removed ones
 * (doc + Storage images) — all product/variant writes in one atomic batch. `totalStock`/`stockStatus`
 * are re-derived; `keywords` rebuilt (name/sku/category may have changed). SKU uniqueness excludes self.
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
    const images = await resolveProductImages(input.id, input.images);

    const totalStock = sumStock(input.variants.map((v) => v.stock));
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
    for (const v of input.variants) {
      const ref = v.isNew ? doc(varCol) : doc(varCol, v.id);
      const base = {
        name: v.name.trim(),
        color: v.color.trim(),
        colorCode: v.colorCode,
        mrp: v.mrp,
        offerPrice: v.offerPrice,
        referralPrice: v.referralPrice,
        commission: v.commission,
        gstPercentage: v.gstPercentage,
        stock: v.stock,
      };
      if (v.isNew) batch.set(ref, { ...base, createdAt: serverTimestamp() });
      else batch.update(ref, base);
      // Cost rides the SAME batch as the variant it belongs to.
      queueVariantCost(batch, ref.id, input.id, v.purchasePrice);
    }
    for (const id of removedIds) {
      batch.delete(doc(varCol, id));
      queueVariantCostDelete(batch, id);
    }
    await batch.commit();

    const snap = await getDoc(productRef);
    const product = { ...snap.data(), id: input.id } as ProductProps;
    const finalVars = await getDocs(varCol);
    const variants = finalVars.docs.map((d) => ({ ...d.data(), id: d.id }) as VariantProps);
    return { product, variants };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not update product');
  }
});
