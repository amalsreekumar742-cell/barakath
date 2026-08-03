import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { ProductStatus } from '@barakath/shared/config/enums';
import keywordsBuilder from '@barakath/shared/utils/keywordsBuilder';
import type { ProductProps, SpecificationProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { uploadImage } from '@/utils/imageUpload';
import { isSkuTaken } from './checkSku';
import { queueVariantCost } from './variantCosts';
import { sumStock, deriveStockStatus, deriveListFields } from '../utils/stock';
import type { VariantToSave, ImageDraft } from '../types';

export interface CreateProductInput {
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
 * Uploads the product's ordered images (new blobs) and passes through any already-uploaded urls, so the
 * stored `images` array preserves the first-image-is-hero order (spec §1.5 Images section).
 */
export async function resolveProductImages(
  productId: string,
  images: ImageDraft[],
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i]!;
    if (img.url) urls.push(img.url);
    else if (img.blob)
      urls.push(await uploadImage(img.blob, `products/${productId}/images/${i}`, 0.5, 1000));
  }
  return urls;
}

/**
 * createProduct — writes the product + its variant docs (spec §1.5).
 *
 * WHY upload images BEFORE the batch: doc ids are minted up front (needed for the storage paths), each
 * variant's images are uploaded to `products/{id}/variants/{variantId}/{index}`, then the product doc
 * and every variant doc are written atomically in one batch — so a product never persists with a
 * partial variant set. `totalStock`/`stockStatus` are derived from the variant stocks; `keywords` are
 * built from name+sku+category+sub-category for search (skill).
 */
export const createProduct = createAsyncThunk<
  ProductProps,
  CreateProductInput,
  { rejectValue: string }
>('products/create', async (input, { rejectWithValue }) => {
  try {
    if (await isSkuTaken(input.sku)) return rejectWithValue('SKU already exists');

    const productRef = doc(collection(db, FirestoreCollections.products));
    const totalStock = sumStock(input.variants.map((v) => v.stock));
    const stockStatus = deriveStockStatus(totalStock, input.lowStockThreshold);

    // Upload the product images (product-level gallery), then write the product + variant docs.
    const images = await resolveProductImages(productRef.id, input.images);
    const listFields = deriveListFields(images, input.variants);

    const batch = writeBatch(db);
    batch.set(productRef, {
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
      isNewArrival: false,
      isFlashSale: false,
      keywords: keywordsBuilder(
        `${input.name} ${input.sku} ${input.categoryName} ${input.subCategoryName}`,
      ),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    for (const v of input.variants) {
      const variantRef = doc(
        collection(db, FirestoreCollections.products, productRef.id, FirestoreCollections.variants),
      );
      batch.set(variantRef, {
        name: v.name.trim(),
        color: v.color.trim(),
        colorCode: v.colorCode,
        mrp: v.mrp,
        offerPrice: v.offerPrice,
        referralPrice: v.referralPrice,
        commission: v.commission,
        gstPercentage: v.gstPercentage,
        stock: v.stock,
        createdAt: serverTimestamp(),
      });
      // Cost rides the SAME batch, so a variant can never be saved without its purchase price.
      queueVariantCost(batch, variantRef.id, productRef.id, v.purchasePrice);
    }
    await batch.commit();

    const snap = await getDoc(productRef);
    return { ...snap.data(), id: productRef.id } as ProductProps;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not create product');
  }
});
