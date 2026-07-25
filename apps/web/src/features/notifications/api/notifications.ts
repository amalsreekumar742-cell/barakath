import {
  collection,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { FirestoreCollections, type NotificationProps } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';

/**
 * Two source queries merged client-side into one feed by `useNotificationsFeed` — the deployed
 * `notifications` collection (verified against `packages/shared/src/types/notification.ts` and
 * `firebase/firestore.rules`' `match /notifications/{notificationId}` block) is NOT the spec 3.18 /
 * 4.18 shape this screen's brief assumed. There is no `type: 'admin' | 'user'` field, no `customerId`,
 * and no `audience` field — the real fields are `targetType: 'All' | 'Specific'` +
 * `targetUserIds: string[]`. A broadcast (`targetType == 'All'`) and a message addressed to this
 * customer (`targetUserIds array-contains uid`) are two different queries because Firestore cannot OR
 * across two different fields in one query; the rule itself documents this same split
 * ("the app queries targetType == 'All', and targetUserIds array-contains uid").
 *
 * `audience` filtering ("All users" / "Order updates" / "Active 30d") from the brief is skipped
 * entirely for the same reason — no `audience` field exists on the deployed document to filter by.
 *
 * WHY `isSent == true` on both: a scheduled notification (`isScheduled: true`) is written to
 * Firestore immediately with `isSent: false` and only flips to `true` when a scheduled Cloud Function
 * later dispatches it (see `apps/admin/src/features/notifications/api/createNotification.ts`'s own
 * TODO). The security rule doesn't gate reads on this (an admin can read/edit a draft), so without
 * this filter a customer would see a notification the admin hasn't actually sent yet.
 */
export function broadcastNotificationsQuery() {
  return query(
    collection(db, FirestoreCollections.notifications),
    where('targetType', '==', 'All'),
    where('isSent', '==', true),
    orderBy('createdAt', 'desc'),
  );
}

export function personalNotificationsQuery(uid: string) {
  return query(
    collection(db, FirestoreCollections.notifications),
    where('targetUserIds', 'array-contains', uid),
    where('isSent', '==', true),
    orderBy('createdAt', 'desc'),
  );
}

/** Maps one Firestore doc to the shared `NotificationProps` type — never expose raw `DocumentData`. */
export function mapNotification(doc: QueryDocumentSnapshot<DocumentData>): NotificationProps {
  return { ...(doc.data() as Omit<NotificationProps, 'id'>), id: doc.id };
}
