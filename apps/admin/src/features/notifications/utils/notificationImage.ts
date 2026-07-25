import imageCompression from 'browser-image-compression';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebaseConfig';

/**
 * Notification image Storage helpers (spec §1.18 optional image; Storage path `notifications/{id}/image`).
 *
 * WHY replicated locally (not a shared helper): this feature is built in isolation and owns its own
 * crop→compress→upload flow, using the firebase/storage primitives directly. A push image is a small
 * hero graphic, so we compress hard client-side (skill "Image upload flow") — Storage then holds a
 * right-sized asset and the app/website render `<img src>` straight from the stored URL.
 */

/**
 * uploadNotificationImage — compress the cropped image, upload it to `notifications/{id}/image`, and
 * return the public download URL stored on the Firestore doc.
 *
 * WHY crop→compress→upload: the caller crops to the target ratio first so the stored asset already
 * matches, and compressing bounds the uploaded bytes (spec §1.18: image ≤ 1MB). We store the URL string
 * on the doc, not the bytes.
 */
export async function uploadNotificationImage(file: File | Blob, notificationId: string): Promise<string> {
  // browser-image-compression expects a File; wrap a Blob (the cropper emits a Blob) if needed.
  const asFile =
    file instanceof File ? file : new File([file], 'notification', { type: file.type || 'image/webp' });

  // WHY 0.5MB / 1200px cap: a push image is a modest banner, not a hero — this keeps it well under the
  // 1MB rule while staying crisp on a phone screen.
  const compressed = await imageCompression(asFile, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
  });

  const objectRef = ref(storage, `notifications/${notificationId}/image`);
  await uploadBytes(objectRef, compressed);
  return getDownloadURL(objectRef);
}

/**
 * deleteNotificationImage — best-effort removal of a notification's image object from Storage.
 *
 * WHY try/catch swallow: deleting the Firestore doc is the source of truth for the notification being
 * gone; a failed/absent Storage object (no image was ever set, already deleted) must not fail the doc
 * delete. We ignore a not-found error.
 */
export async function deleteNotificationImage(notificationId: string): Promise<void> {
  try {
    await deleteObject(ref(storage, `notifications/${notificationId}/image`));
  } catch {
    // Best-effort: object may not exist. Never let orphaned-image cleanup fail the mutation.
  }
}
