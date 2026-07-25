import { collection, query, where, documentId, getDocs } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { ProductProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import type { FBTItem } from '../types';

/**
 * loadProductsByIds — resolve a small id list to display cards (name + thumbnail) for Frequently Bought
 * Together on the edit page (spec §1.5). WHY `where(documentId(), 'in', ids)`: one read for up to 10
 * ids (FBT is capped at 10), instead of one read per id.
 */
export async function loadProductsByIds(ids: string[]): Promise<FBTItem[]> {
  if (!ids.length) return [];
  const snap = await getDocs(
    query(
      collection(db, FirestoreCollections.products),
      where(documentId(), 'in', ids.slice(0, 10)),
    ),
  );
  return snap.docs.map((d) => {
    const p = d.data() as ProductProps;
    return { id: d.id, name: p.name, image: p.thumbnail };
  });
}
