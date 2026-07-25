import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { NotificationProps } from '@barakath/shared/types';
import keywordsBuilder from '@barakath/shared/utils/keywordsBuilder';
import { db } from '@/lib/firebaseConfig';

/**
 * duplicateNotification — copy an existing notification as a fresh unsent DRAFT titled "Copy of …"
 * (spec §1.18 row action "Duplicate").
 *
 * WHY a draft (isSent/isScheduled false, recipientCount 0, cleared sentAt/scheduledAt): duplicating is a
 * template shortcut — the admin tweaks the copy and sends it later, so it must not inherit the original's
 * sent/scheduled state or reach figures.
 * WHY the image URL is copied as-is (not re-uploaded): the stored public URL is immutable and shared;
 * pointing the copy at the same object is correct and cheap. If the copy is later edited with a new image
 * it gets its own object; deleting the copy only best-effort-deletes `notifications/{copyId}/image`, which
 * won't exist, so the original's object is never touched.
 * WHY new keywords include the new title: the "Copy of" prefix should be searchable too.
 */
export const duplicateNotification = createAsyncThunk<
  NotificationProps,
  { source: NotificationProps; adminId: string; adminName: string },
  { rejectValue: string }
>('notifications/duplicate', async ({ source, adminId, adminName }, { rejectWithValue }) => {
  try {
    const ref = doc(collection(db, FirestoreCollections.notifications));
    const title = `Copy of ${source.title}`;
    const keywords = keywordsBuilder(`${title} ${source.body}`);

    const docData = {
      id: ref.id,
      title,
      body: source.body,
      image: source.image,
      type: source.type,
      targetType: source.targetType,
      targetUserIds: source.targetUserIds,
      linkType: source.linkType,
      linkValue: source.linkValue,
      isScheduled: false,
      scheduledAt: null,
      isSent: false,
      sentAt: null,
      sentBy: adminId,
      sentByName: adminName,
      recipientCount: 0,
      keywords,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, docData);

    const now = Timestamp.now();
    return { ...docData, createdAt: now, updatedAt: now } as NotificationProps;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not duplicate notification');
  }
});
