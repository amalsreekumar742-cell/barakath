import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { FirestoreCollections, type ReplacementProps } from '@barakath/shared';
import { db, storage } from '@/lib/firebaseConfig';
import { nextRequestId } from '../utils/requestId';

/**
 * Request Replacement — create flow (spec 3.11/2.18; WEB_BATCH4_NOTES.md §4).
 *
 * WRITE ORDER (mirrors `apps/app/lib/features/replacement/data/datasources/
 * replacement_remote_datasource.dart` exactly, and the reasoning is identical): `firestore.rules` gives
 * `replacements/{id}` `allow update: if isAdmin()` only, so a customer gets exactly ONE write — the
 * create. The document id is therefore minted CLIENT-SIDE via `doc(collection(...))` (which allocates
 * an id without writing), photos are uploaded under that id, and the document is created once with the
 * finished URL list. A create-then-update sequence would succeed on create and then permission-deny on
 * the photo-URL update, stranding a photo-less request with no way to retry into the same document.
 */
export interface ReplacementDraft {
  orderId: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail: string;
  productId: string;
  productName: string;
  productImage: string;
  variantId: string;
  variantName: string;
  variantColor: string;
  quantity: number;
  /** One of the four spec 2.18 reason labels. */
  reason: string;
  /** "Describe the issue" — free text, min 10 characters (enforced by the form before this is called). */
  description: string;
  /** Already-compressed image files, 1–5, picked by the form. */
  photos: File[];
}

/** Max 2MB per photo (firebase/storage.rules `validImage()` — enforced server-side too), JPG/PNG/WebP. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/** What lands in the document's `reason` field: the chosen option plus the customer's own words, composed
 *  into one field — the deployed contract has no separate `description` column, and the admin detail
 *  screen already renders `reason` with `whitespace-pre-line` (i.e. it expects a multi-line blob). */
function composeReason(reason: string, description: string): string {
  const trimmed = description.trim();
  return trimmed ? `${reason}\n\n${trimmed}` : reason;
}

/**
 * Compress each photo before upload (skill: image-upload flow) — evidence photos from a phone camera
 * can be several MB; compressing client-side keeps Storage holding right-sized assets and keeps the
 * upload well under the 2MB rule instead of relying on the customer's camera settings. No crop step:
 * unlike an avatar, a damaged-product photo has no fixed target aspect ratio to crop into — cropping it
 * would just as likely cut off the defect the photo exists to show.
 */
async function compress(file: File): Promise<File> {
  try {
    return await imageCompression(file, {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: file.type,
    });
  } catch {
    // Compression is a best-effort size reduction, not a correctness requirement — the original file
    // still passes the same size/type checks the form already ran before calling this.
    return file;
  }
}

/** Uploads sequentially (not `Promise.all`) — several multi-megabyte photos on a weak connection is how
 *  concurrent uploads all time out together instead of finishing one at a time; mirrors the Flutter
 *  `StorageService`'s own documented reasoning. Path: `replacements/{requestId}/{photoIndex}`, matching
 *  `StoragePaths.replacementPrefix` exactly. */
async function uploadPhotos(requestDocId: string, photos: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    if (!photo) continue;
    const compressed = await compress(photo);
    const photoRef = ref(storage, `replacements/${requestDocId}/${i}`);
    await uploadBytes(photoRef, compressed, { contentType: compressed.type || 'image/jpeg' });
    urls.push(await getDownloadURL(photoRef));
  }
  return urls;
}

export async function submitReplacement(draft: ReplacementDraft): Promise<ReplacementProps> {
  const docRef = doc(collection(db, FirestoreCollections.replacements));
  const requestId = await nextRequestId(docRef.id);
  const photoUrls = await uploadPhotos(docRef.id, draft.photos);

  const data = {
    requestId,
    orderId: draft.orderId,
    userId: draft.userId,
    userName: draft.userName,
    userPhone: draft.userPhone,
    userEmail: draft.userEmail,
    productId: draft.productId,
    productName: draft.productName,
    productImage: draft.productImage,
    variantId: draft.variantId,
    variantName: draft.variantName,
    variantColor: draft.variantColor,
    quantity: draft.quantity,
    reason: composeReason(draft.reason, draft.description),
    photos: photoUrls,
    status: 'Pending' as const,
    adminNote: '',
    replacementOrderId: '',
    processedBy: '',
    processedByName: '',
    processedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(docRef, data);
  // Optimistic local shape for the caller (toast/redirect) — Timestamps are server-resolved but not
  // needed by anything the submit flow reads immediately after this.
  return { ...data, id: docRef.id, createdAt: data.createdAt, updatedAt: data.updatedAt } as unknown as ReplacementProps;
}
