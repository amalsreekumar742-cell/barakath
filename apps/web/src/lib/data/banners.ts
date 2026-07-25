import 'server-only';

import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared';
import type { BannerProps } from '@barakath/shared';
import { serverDb } from './serverFirestore';

/**
 * banners — the single-doc banner read `/banner/[bannerId]` needs.
 *
 * WHY its own file rather than folded into `catalog.ts`: `catalog.ts`'s `getBanners()` reads the
 * LIST for a placement (home rail, mega menu strip). A direct-URL banner page needs exactly one doc
 * by id — a `getDoc`, not a `query` — which is a different shape worth keeping separate rather than
 * bolting a second read pattern onto the list function.
 */

/** One banner by id, or null when the doc does not exist. */
export async function getBannerById(bannerId: string): Promise<BannerProps | null> {
  const snap = await getDoc(doc(serverDb, FirestoreCollections.banners, bannerId));
  if (!snap.exists()) return null;
  return { ...snap.data(), id: snap.id } as BannerProps;
}

/**
 * Whether a banner is currently reachable by direct URL.
 *
 * WHY this gate exists at all: a draft/inactive banner, or one outside its optional schedule window,
 * must 404 rather than render at a guessable `/banner/{id}` URL (spec 1.15) — the admin's "Active"
 * toggle and date window are the only things standing between a paused campaign and a live page.
 */
export function isBannerLive(banner: BannerProps): boolean {
  if (!banner.isActive) return false;
  const now = Date.now();
  if (banner.startDate && banner.startDate.toMillis() > now) return false;
  if (banner.endDate && banner.endDate.toMillis() < now) return false;
  return true;
}
