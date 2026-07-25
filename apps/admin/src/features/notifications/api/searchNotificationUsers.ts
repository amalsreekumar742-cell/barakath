import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  documentId,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { UserProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';

/**
 * searchNotificationUsers — a standalone cursor-paginated user search for the Create Notification form's
 * "Specific users" target picker (spec §1.18 Target).
 *
 * WHY its own search (not the customers feature's list): features must not import another feature (skill:
 * unidirectional imports), so the notifications feature owns this small read. A term filters by the
 * precomputed `keywords` (name/phone/email); an empty term returns recent users. Cursor-paginated with the
 * standard 12 + View More — the users collection is an unbounded, growable pool.
 */
export async function searchNotificationUsers(
  term: string,
  cursor?: QueryDocumentSnapshot | null,
): Promise<{ items: UserProps[]; lastVisible: QueryDocumentSnapshot | null; hasMore: boolean }> {
  const t = term.trim().toLowerCase();
  const snap = await getDocs(
    query(
      collection(db, FirestoreCollections.users),
      ...(t ? [where('keywords', 'array-contains', t)] : []),
      orderBy('createdAt', 'desc'),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(Constants.PAGE_SIZE),
    ),
  );
  const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as UserProps);
  return {
    items,
    lastVisible: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: items.length === Constants.PAGE_SIZE,
  };
}

/**
 * loadNotificationUsersByIds — resolve already-selected user ids back to profiles so the form can render
 * chips with names (e.g. when duplicating/editing a target list). Firestore `in` allows up to 30 ids per
 * query, so we chunk by 30.
 */
export async function loadNotificationUsersByIds(ids: string[]): Promise<UserProps[]> {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const results = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(db, FirestoreCollections.users), where(documentId(), 'in', chunk))),
    ),
  );
  return results.flatMap((snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }) as UserProps));
}
