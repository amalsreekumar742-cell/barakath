import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  doc,
  setDoc,
  getCountFromServer,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { NotificationProps } from '@barakath/shared/types';
import keywordsBuilder from '@barakath/shared/utils/keywordsBuilder';
import { db } from '@/lib/firebaseConfig';
import { uploadNotificationImage } from '../utils/notificationImage';
import type { NotificationInput } from '../types';

/**
 * createNotification — create a notification doc, optionally with an image, and either send it now or
 * schedule it (spec §1.18 Create Notification).
 *
 * WHY pre-generate the doc ref before uploading: the image is stored at `notifications/{id}/image`, so the
 * id is needed BEFORE the upload; `doc(collection(...))` mints a client-side id and we `setDoc` the doc
 * INCLUDING `id: ref.id` (stored on the doc so a stray query result never lacks it).
 *
 * WHY the send/schedule effects are computed here but FCM is NOT: writing the doc + stamping isSent/
 * recipientCount is a plain admin write the Security Rule allows. Actually dispatching the push (and firing
 * a scheduled send at `scheduledAt`) is a privileged, fan-out side effect that must run server-side — see
 * the TODOs. The client only records intent.
 *
 * recipientCount: for an "All" broadcast we read the live user count with a server-side aggregation (cheap,
 * one number); for a "Specific" target it is simply the number of chosen user ids.
 */
export const createNotification = createAsyncThunk<
  NotificationProps,
  { input: NotificationInput; imageFile?: File | Blob | null; adminId: string; adminName: string },
  { rejectValue: string }
>('notifications/create', async ({ input, imageFile, adminId, adminName }, { rejectWithValue }) => {
  try {
    const ref = doc(collection(db, FirestoreCollections.notifications));

    // Optional image: crop→compress→upload already produced a Blob; store only the URL on the doc.
    const image = imageFile ? await uploadNotificationImage(imageFile, ref.id) : '';

    const sendNow = input.sendMode === 'now';
    const scheduled = input.sendMode === 'schedule';

    // recipientCount: All → server-side count of users; Specific → the selected id count.
    // Only compute the live user count when we actually send now (a scheduled/draft count is set at send).
    let recipientCount = 0;
    if (sendNow) {
      if (input.targetType === 'All') {
        const countSnap = await getCountFromServer(collection(db, FirestoreCollections.users));
        recipientCount = countSnap.data().count;
      } else {
        recipientCount = input.targetUserIds.length;
      }
    }

    // keywords power the list search (title + body), lowercased prefix substrings via the shared builder.
    const keywords = keywordsBuilder(`${input.title} ${input.body}`);

    const docData = {
      id: ref.id,
      title: input.title.trim(),
      body: input.body.trim(),
      image,
      type: input.type,
      targetType: input.targetType,
      targetUserIds: input.targetType === 'Specific' ? input.targetUserIds : [],
      linkType: input.linkType,
      linkValue: input.linkType === 'None' ? '' : input.linkValue,
      // Scheduling / send state derived from sendMode.
      isScheduled: scheduled,
      scheduledAt: scheduled && input.scheduledAt ? Timestamp.fromDate(input.scheduledAt) : null,
      isSent: sendNow,
      sentAt: sendNow ? serverTimestamp() : null,
      sentBy: adminId,
      sentByName: adminName,
      recipientCount,
      keywords,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, docData);

    // TODO: move to Cloud Function — when sendNow, dispatch the FCM push fan-out to the target audience
    // (All → every user's fcmToken; Specific → the selected users). Never fan out pushes from the client.
    // TODO: move to Cloud Function — when scheduled, a Cloud Scheduler / scheduled function must fire the
    // send at `scheduledAt` (flip isSent, stamp sentAt + recipientCount, clear isScheduled) and push FCM.

    // Client-side mirror for optimistic list prepend (server holds the real timestamps).
    const now = Timestamp.now();
    return {
      ...docData,
      sentAt: sendNow ? now : null,
      createdAt: now,
      updatedAt: now,
    } as NotificationProps;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not create notification');
  }
});
