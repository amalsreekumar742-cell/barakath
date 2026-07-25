import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { BannerProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { uploadBannerImage, deleteBannerImage } from '../utils/bannerImage';
import type { BannerInput } from '../types';

/**
 * updateBanner — edit an existing banner (spec §1.15 click card to edit).
 *
 * WHY the image is optional here: on Edit the admin may keep the current image (imageFile == null) — we
 * then leave `image` untouched. If a NEW image is supplied we re-upload to the same path and best-effort
 * delete the previous object first. Since the Storage path is deterministic (`banners/{id}/image`), a new
 * upload overwrites the same object; we still call deleteBannerImage (try/catch inside) to stay explicit
 * and to cover a future path change — it never fails the update.
 * WHY `position` is never written here: order is owned by reorderBanners; an edit must not disturb it.
 * `updatedAt` is server-stamped. WHY pass `previous` in: we return the merged banner so the slice patches
 * the row in place without a re-read.
 */
export const updateBanner = createAsyncThunk<
  BannerProps,
  {
    bannerId: string;
    input: BannerInput;
    previous: BannerProps;
    imageFile: File | Blob | null;
    adminId: string;
    adminName: string;
  },
  { rejectValue: string }
>('banners/update', async ({ bannerId, input, previous, imageFile, adminId, adminName }, { rejectWithValue }) => {
  try {
    let image = previous.image;
    if (imageFile) {
      // Replace the old object, then upload the new one to the same deterministic path.
      await deleteBannerImage(bannerId);
      image = await uploadBannerImage(imageFile, bannerId);
    }

    const startDate = input.startDate ? Timestamp.fromDate(input.startDate) : null;
    const endDate = input.endDate ? Timestamp.fromDate(input.endDate) : null;

    const patch = {
      title: input.title.trim(),
      image,
      linkType: input.linkType,
      linkValue: input.linkValue,
      linkProductName: input.linkProductName,
      linkCategoryName: input.linkCategoryName,
      placement: input.placement,
      isActive: input.isActive,
      startDate,
      endDate,
      createdBy: adminId,
      createdByName: adminName,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, FirestoreCollections.banners, bannerId), patch);

    // Merge over `previous` so server-owned position/createdAt survive; stamp a client updatedAt for the UI.
    return { ...previous, ...patch, id: bannerId, updatedAt: Timestamp.now() } as BannerProps;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not update banner');
  }
});
