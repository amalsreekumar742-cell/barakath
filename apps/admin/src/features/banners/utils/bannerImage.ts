import imageCompression from 'browser-image-compression';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebaseConfig';

/**
 * Banner image Storage helpers (spec §1.15 image; §4.22 path `banners/{bannerId}/image`).
 *
 * WHY replicated locally (not the shared `@/utils/imageUpload`): this feature is built in isolation and
 * owns its own upload logic — the crop→compress→upload flow is small and self-contained here, using the
 * firebase/storage primitives directly. Banners are wide hero images (16:9), so we keep a higher pixel
 * cap than a thumbnail while still compressing so Storage holds a right-sized asset and pages load fast.
 */

/**
 * uploadBannerImage — compress the cropped image, upload it to `banners/{bannerId}/image`, and return the
 * public download URL that gets stored on the Firestore doc.
 *
 * WHY crop→compress→upload (skill "Image upload flow"): the caller crops to 16:9 first so the stored asset
 * already matches the banner aspect ratio; compressing client-side keeps the uploaded bytes small. We store
 * the URL string on the doc (not the bytes), so the list can render `<img src>` directly.
 */
export async function uploadBannerImage(file: File | Blob, bannerId: string): Promise<string> {
  // browser-image-compression expects a File; wrap a Blob (the cropper emits a Blob) if needed.
  const asFile =
    file instanceof File ? file : new File([file], 'banner', { type: file.type || 'image/webp' });

  // WHY 1600px cap: banners render full-width hero art (App 1080×608, Website 1920×640) — a smaller cap
  // would visibly soften them, so we allow more pixels than a thumbnail while still bounding the size.
  const compressed = await imageCompression(asFile, {
    maxSizeMB: 0.6,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
  });

  const objectRef = ref(storage, `banners/${bannerId}/image`);
  await uploadBytes(objectRef, compressed);
  return getDownloadURL(objectRef);
}

/**
 * deleteBannerImage — remove a banner's image object from Storage.
 *
 * WHY try/catch swallow (caller wraps this): deleting the Firestore doc is the source of truth for the
 * banner being gone; a failed/absent Storage object (already deleted, never existed) must not block or
 * fail the doc delete/replace. We best-effort clean up the bytes and ignore a not-found error.
 */
export async function deleteBannerImage(bannerId: string): Promise<void> {
  try {
    await deleteObject(ref(storage, `banners/${bannerId}/image`));
  } catch {
    // Best-effort: object may already be gone. Never let orphaned-image cleanup fail the mutation.
  }
}
