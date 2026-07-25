import 'server-only';

import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections, FirestoreDocs } from '@barakath/shared';
import type { GeneralSettingsProps } from '@barakath/shared';
import { serverDb } from './serverFirestore';

/**
 * The store's `general/config` document — business identity, support contacts, delivery rules,
 * payment toggles and the legal HTML.
 *
 * WHY it is safe to read here: `firestore.rules` splits the collection deliberately —
 * `general/secrets` is admin-only, every OTHER general doc is world-readable because the storefront
 * needs delivery fees, support numbers and legal text before anyone signs in. This reads `config`
 * by name, so it can never reach `secrets` even by accident.
 *
 * WHY the header and footer take this as PROPS from the layout rather than fetching it themselves:
 * one server read per page render, not one per component that happens to need the business name.
 *
 * Returns null when the document is missing so callers fall back to their own defaults rather than
 * crashing a page over store config — a storefront with no delivery fee configured should still sell.
 */
export async function getGeneralSettings(): Promise<GeneralSettingsProps | null> {
  const snap = await getDoc(
    doc(serverDb, FirestoreCollections.general, FirestoreDocs.generalConfig),
  );
  if (!snap.exists()) return null;
  // No `id` is spread in, unlike every other mapper here: `general/config` is a singleton at a known
  // path, so `GeneralSettingsProps` deliberately declares no id field and adding one would not type.
  return snap.data() as GeneralSettingsProps;
}
