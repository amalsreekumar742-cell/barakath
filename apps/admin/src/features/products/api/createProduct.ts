import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { ProductStatus } from '@barakath/shared/config/enums';
import keywordsBuilder from '@barakath/shared/utils/keywordsBuilder';
import type { ProductProps, SpecificationProps, VariantOption } from '@barakath/shared/types';
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
 *
 * `urlById` maps each draft's local id to its final url — a variant's photo link is held as that id
 * until now, because a photo added in this session had no url before the upload.
 */
export async function resolveProductImages(
  productId: string,
  images: ImageDraft[],
): Promise<{ urls: string[]; urlById: Map<string, string> }> {
  const urls: string[] = [];
  const urlById = new Map<string, string>();
  for (let i = 0; i < images.length; i++) {
    const img = images[i]!;
    const url = img.url
      ? img.url
      : img.blob
        ? await uploadImage(img.blob, `products/${productId}/images/${i}`, 0.5, 1000)
        : null;
    if (!url) continue;
    urls.push(url);
    urlById.set(img.id, url);
  }
  return { urls, urlById };
}

/**
 * The variant's photo link (`imageUrl`) as resolved for this save, or null when it has none — never
 * picked, or its photo was removed from the gallery before saving. Create omits the field on null;
 * update deletes it, so an unlinked photo really unlinks.
 */
export function variantImageUrl(v: Pick<VariantToSave, 'imageId'>, urlById: Map<string, string>): string | null {
  return (v.imageId && urlById.get(v.imageId)) || null;
}

/**
 * The variant doc's `options` field, spread into the write — or nothing.
 *
 * WHY omitted rather than written empty/undefined: Firestore rejects `undefined`, and `options` must
 * stay ABSENT on single-axis legacy variants (readers fold "absent" into the legacy Size axis via
 * `variantAxes`). An existing variant's options are written back unchanged — its colour and variant
 * are read-only in the form — so this never strips or rewrites one.
 */
export function variantOptionsField(v: Pick<VariantToSave, 'options'>): { options?: VariantOption[] } {
  if (!v.options?.length) return {};
  return { options: v.options.map((o) => ({ group: o.group.trim(), value: o.value.trim() })) };
}

/**
 * createProduct — writes the product + its variant docs (spec §1.5).
 *
 * WHY upload images BEFORE the batch: the product id is minted up front (needed for the storage paths),
 * the gallery is uploaded to `products/{id}/images/{index}`, then the product doc and every variant doc
 * are written atomically in one batch — so a product never persists with a partial variant set. `totalStock`/`stockStatus` are derived from the variant stocks; `keywords` are
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
    const { urls: images, urlById } = await resolveProductImages(productRef.id, input.images);
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
      /**
       * Seeded to 0 — NOT left absent.
       *
       * `ProductProps` declares both as required, and the storefront ORDERS BY them: "Popularity"
       * sorts on `totalReviews desc` and "Rating" on `averageRating desc`. Firestore silently omits
       * any document that LACKS the orderBy field, so a product created without these two vanishes
       * from those two listings entirely — while the header's `getCountFromServer` (which has no
       * orderBy) still counts it. That is exactly the "N products but only N-1 shown" mismatch, and
       * it is invisible under the other three sorts.
       *
       * A review write recomputes these; until the first review lands they must still EXIST as 0.
       * 0 means "unrated", never "rated zero" — the UI gates stars on `totalReviews > 0`.
       */
      averageRating: 0,
      totalReviews: 0,
      keywords: keywordsBuilder(
        `${input.name} ${input.sku} ${input.categoryName} ${input.subCategoryName}`,
      ),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    for (const [index, v] of input.variants.entries()) {
      const variantRef = doc(
        collection(db, FirestoreCollections.products, productRef.id, FirestoreCollections.variants),
      );
      const imageUrl = variantImageUrl(v, urlById);
      batch.set(variantRef, {
        // The label every name-only surface prints (cart, invoice, inventory); derived from
        // `options` by the form for multi-axis rows.
        name: v.name.trim(),
        ...variantOptionsField(v),
        color: v.color.trim(),
        colorCode: v.colorCode,
        ...(imageUrl ? { imageUrl } : {}),
        mrp: v.mrp,
        offerPrice: v.offerPrice,
        referralPrice: v.referralPrice,
        commission: v.commission,
        gstPercentage: v.gstPercentage,
        stock: v.stock,
        // The form's row order IS the display order. Written explicitly rather than left to
        // `createdAt`: every variant in one batch gets the same server timestamp, so createdAt alone
        // cannot order them.
        sortOrder: index,
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
