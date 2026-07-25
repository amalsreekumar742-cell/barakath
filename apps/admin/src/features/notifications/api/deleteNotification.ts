import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, deleteDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { NotificationProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { deleteNotificationImage } from '../utils/notificationImage';

/**
 * deleteNotification — hard-delete a notification doc and its Storage image (spec §1.18 / §1.22: hard
 * deletes throughout, confirmed with a dialog + toast in the component).
 *
 * WHY guard on `!isSent`: a sent notification is a permanent audit record of a push already delivered to
 * users — deleting it would erase reach history, so the spec only allows deleting drafts/scheduled ones.
 * The component also gates the action, but re-checking here keeps the rule at the data edge (defence in
 * depth) rather than trusting the UI alone.
 * WHY return the id: the slice removes the row in place without a re-fetch, keeping pagination intact.
 */
export const deleteNotification = createAsyncThunk<
  string,
  NotificationProps,
  { rejectValue: string }
>('notifications/delete', async (notification, { rejectWithValue }) => {
  try {
    if (notification.isSent) return rejectWithValue('Sent notifications cannot be deleted');
    await deleteDoc(doc(db, FirestoreCollections.notifications, notification.id));
    // Best-effort image cleanup — never let an orphaned/absent object fail the delete.
    await deleteNotificationImage(notification.id);
    return notification.id;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not delete notification');
  }
});
