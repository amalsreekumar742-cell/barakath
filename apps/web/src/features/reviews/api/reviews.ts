import { collection, doc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { FirestoreCollections, keywordsBuilder, type ReviewProps } from '@barakath/shared';
import { db, storage } from '@/lib/firebaseConfig';

/**
 * Write a review — create flow (spec §1.11, §2.24; mirrors `apps/app/lib/features/reviews/data/
 * datasources/review_remote_datasource.dart` field-for-field). The customer website had no write path
 * for `reviews` at all before this — only `ReviewsSection`/`useMoreReviews` reading them.
 *
 * WRITE ORDER: `firestore.rules`'s `reviews/{reviewId}` only allows `update` by an admin (isPublished/
 * adminResponse/updatedAt), so a customer gets exactly ONE write — the create, same reasoning
 * `features/orders/api/replacements.ts` documents for itself. The doc id is minted CLIENT-SIDE via
 * `doc(collection(...))`, photos upload under that id, then the document is created once complete —
 * a create-then-update sequence would permission-deny the photo-URL update and strand a photo-less
 * review with no way to retry into the same document.
 */
export interface ReviewDraft {
  orderId: string;
  userId: string;
  userName: string;
  userImage: string;
  productId: string;
  productName: string;
  productImage: string;
  variantId: string;
  variantName: string;
  /** 1–5, enforced by the form before this is called (also enforced server-side by the create rule). */
  rating: number;
  /** Optional — the design's "Review title" field. `ReviewProps.title` supports it even though the
   *  Flutter app always writes '' (it has no title field); web uses it when the customer fills it in. */
  title: string;
  comment: string;
  /** Already-compressed image files, 0–3, picked by the form. */
  photos: File[];
}

/** Max 2MB per photo (`firebase/storage.rules`'s `validImage()` — enforced server-side too), JPG/PNG/WebP. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
/** Matches the Flutter app's `ReviewsProvider.maxPhotos` — the real product limit, not the return-flow's. */
export const MAX_REVIEW_PHOTOS = 3;

/**
 * "One review per product per order" (spec §2.24) — `firestore.rules` cannot query for a sibling
 * document, so this is checked client-side, same as `apps/app`'s `HasExistingReview` use-case and for
 * the identical reason. `isPublished == true` is included in the query itself (not just implied by the
 * rule) because a `list` query whose security rule reads `resource.data.isPublished` must be provably
 * constrained to matching docs or Firestore denies the whole query. Called from the review page on load
 * AND again immediately before submit, so a review already filed from another tab/device is caught.
 */
export async function hasExistingReview(userId: string, productId: string, orderId: string): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(db, FirestoreCollections.reviews),
      where('userId', '==', userId),
      where('productId', '==', productId),
      where('orderId', '==', orderId),
      where('isPublished', '==', true),
      limit(1),
    ),
  );
  return !snap.empty;
}

/** Compress each photo before upload — mirrors `features/orders/api/replacements.ts`'s `compress`
 *  exactly (same rationale: right-size a phone-camera photo, best-effort only). */
async function compress(file: File): Promise<File> {
  try {
    return await imageCompression(file, {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: file.type,
    });
  } catch {
    return file;
  }
}

/** Uploads sequentially (not `Promise.all`) — same reasoning as `replacements.ts`'s `uploadPhotos`.
 *  Path: `reviews/{reviewId}/{photoIndex}`, matching Flutter's `StoragePaths.reviewPhoto` and
 *  `firebase/storage.rules`'s `match /reviews/{reviewId}/{fileName}` exactly. */
async function uploadPhotos(reviewId: string, photos: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    if (!photo) continue;
    const compressed = await compress(photo);
    const photoRef = ref(storage, `reviews/${reviewId}/${i}`);
    await uploadBytes(photoRef, compressed, { contentType: compressed.type || 'image/jpeg' });
    urls.push(await getDownloadURL(photoRef));
  }
  return urls;
}

export async function submitReview(draft: ReviewDraft): Promise<ReviewProps> {
  const docRef = doc(collection(db, FirestoreCollections.reviews));
  const photoUrls = await uploadPhotos(docRef.id, draft.photos);

  const data = {
    userId: draft.userId,
    userName: draft.userName,
    userImage: draft.userImage,
    productId: draft.productId,
    productName: draft.productName,
    productImage: draft.productImage,
    variantId: draft.variantId,
    variantName: draft.variantName,
    orderId: draft.orderId,
    rating: draft.rating,
    title: draft.title.trim(),
    comment: draft.comment.trim(),
    photos: photoUrls,
    // Auto-published (spec §2.24) — the create rule requires this to be true. Always a genuine
    // purchase: this flow is only reachable from a Delivered order's own item.
    isPublished: true,
    isVerifiedPurchase: true,
    adminResponse: '',
    keywords: keywordsBuilder(`${draft.productName} ${draft.comment}`),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(docRef, data);
  return { ...data, id: docRef.id } as unknown as ReviewProps;
}
