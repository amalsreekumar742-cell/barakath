import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getCountFromServer,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { BannerProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { uploadBannerImage } from '../utils/bannerImage';
import type { BannerInput } from '../types';

/**
 * createBanner — create a banner doc with its image (spec §1.15 Add Banner).
 *
 * WHY pre-generate the doc ref before writing: the image is stored at `banners/{bannerId}/image` (spec
 * §4.22), so we need the id BEFORE uploading. `doc(collection(...))` mints a client-side id; we upload the
 * image to that path, then `setDoc` writes the doc INCLUDING `id: ref.id` (the id is stored on the doc so
 * a stray query result never lacks it).
 * WHY `position = count + 1`: new banners append to the end of the manual order — a server-side count
 * aggregation gives the next slot cheaply (no full read) and keeps positions dense/monotonic.
 * WHY a direct client write (not a Cloud Function): banners are admin-only, non-financial content fully
 * constrained by the admin Security Rule — the skill permits direct writes here.
 */
export const createBanner = createAsyncThunk<
  BannerProps,
  { input: BannerInput; imageFile: File | Blob; adminId: string; adminName: string },
  { rejectValue: string }
>('banners/create', async ({ input, imageFile, adminId, adminName }, { rejectWithValue }) => {
  try {
    const bannerRef = doc(collection(db, FirestoreCollections.banners));
    const image = await uploadBannerImage(imageFile, bannerRef.id);

    // Next position = current banner count + 1 (append to the end of the manual order).
    const countSnap = await getCountFromServer(collection(db, FirestoreCollections.banners));
    const position = countSnap.data().count + 1;

    await setDoc(bannerRef, {
      id: bannerRef.id,
      title: input.title.trim(),
      image,
      linkType: input.linkType,
      linkValue: input.linkValue,
      linkProductName: input.linkProductName,
      linkCategoryName: input.linkCategoryName,
      placement: input.placement,
      position,
      isActive: input.isActive,
      startDate: input.startDate ? Timestamp.fromDate(input.startDate) : null,
      endDate: input.endDate ? Timestamp.fromDate(input.endDate) : null,
      createdBy: adminId,
      createdByName: adminName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const snap = await getDoc(bannerRef);
    return { ...snap.data(), id: bannerRef.id } as BannerProps;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not create banner');
  }
});
