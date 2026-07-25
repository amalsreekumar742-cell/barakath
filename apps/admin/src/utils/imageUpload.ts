import imageCompression from 'browser-image-compression';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebaseConfig';

/**
 * Uploads an image to Firebase Cloud Storage after compression.
 *
 * WHY crop→compress→upload (skill "Image upload flow"): the caller crops first (react-advanced-cropper)
 *   so the stored asset already matches the target aspect ratio; we then compress client-side so Storage
 *   holds right-sized assets and pages load fast — never upload a raw multi-MB picked file.
 * WHY return the download URL: Firestore docs store the URL string (not the bytes), so the caller writes
 *   `image: url` on the doc.
 *
 * @param file - The cropped image file/blob to upload.
 * @param storagePath - Full destination path in Cloud Storage (e.g. 'categories/{id}/image').
 * @param maxSizeMB - Target max size after compression (default 0.5 MB).
 * @param maxWidthOrHeight - Max pixel dimension after compression (default 800).
 * @returns The public download URL of the uploaded image.
 */
export async function uploadImage(
  file: File | Blob,
  storagePath: string,
  maxSizeMB = 0.5,
  maxWidthOrHeight = 800,
): Promise<string> {
  // browser-image-compression expects a File; wrap a Blob if needed.
  const asFile =
    file instanceof File ? file : new File([file], 'image', { type: file.type || 'image/webp' });

  const compressed = await imageCompression(asFile, {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,
  });

  const objectRef = ref(storage, storagePath);
  await uploadBytes(objectRef, compressed);
  return getDownloadURL(objectRef);
}
