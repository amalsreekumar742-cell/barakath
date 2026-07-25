import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  doc,
  updateDoc,
  getCountFromServer,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { NotificationProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';

export interface SendNotificationResult {
  id: string;
  sentAt: Timestamp;
  recipientCount: number;
}

/**
 * sendNotificationNow — send an unsent (draft or scheduled) notification immediately (spec §1.18 row action
 * "Send now").
 *
 * WHY it recomputes recipientCount at send time: for an "All" broadcast the live user base may have grown
 * since the draft was created, so we read the current count with a server-side aggregation; for a "Specific"
 * target it is the stored id count. It flips isSent + stamps sentAt and clears isScheduled (a sent doc is no
 * longer pending).
 * WHY the FCM fan-out is a TODO, not done here: pushing to every target user's device token is a privileged,
 * server-side fan-out — the client only records that the send happened.
 * WHY return the patch fields: the slice updates the row in place (status → Sent) without a re-fetch.
 */
export const sendNotificationNow = createAsyncThunk<
  SendNotificationResult,
  NotificationProps,
  { rejectValue: string }
>('notifications/sendNow', async (notification, { rejectWithValue }) => {
  try {
    const recipientCount =
      notification.targetType === 'All'
        ? (await getCountFromServer(collection(db, FirestoreCollections.users))).data().count
        : notification.targetUserIds.length;

    await updateDoc(doc(db, FirestoreCollections.notifications, notification.id), {
      isSent: true,
      sentAt: serverTimestamp(),
      isScheduled: false,
      scheduledAt: null,
      recipientCount,
      updatedAt: serverTimestamp(),
    });

    // TODO: move to Cloud Function — dispatch the FCM push fan-out to the target audience here. The client
    // must never send pushes directly (needs the Admin SDK + every user's fcmToken).

    return { id: notification.id, sentAt: Timestamp.now(), recipientCount };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not send notification');
  }
});
