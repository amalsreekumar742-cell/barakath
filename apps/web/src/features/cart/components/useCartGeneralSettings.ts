'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections, FirestoreDocs } from '@barakath/shared';
import type { GeneralSettingsProps } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';

/**
 * useCartGeneralSettings — a CLIENT-side read of `general/config`, for `computeTotals`' delivery/GST/
 * wallet-toggle inputs.
 *
 * WHY this can't just call `getGeneralSettings()` from `@/lib/data/settings` (which the C1 brief
 * points at): that function starts with `import 'server-only'` — Next.js fails the BUILD if a
 * `"use client"` file imports it (confirmed by reading the file; see its own header comment). Nothing
 * about `general/config` needs to be server-only for reading (`firestore.rules` makes the whole
 * document public — the same rule `getGeneralSettings()` itself relies on), so this hook re-reads the
 * exact same document with the client SDK instead of forking the server helper's logic.
 * `features/product/hooks/useMoreReviews.ts` documents the identical situation (a server-only data
 * function with a client-side twin) for the same underlying reason.
 *
 * WHY not a second copy inside `src/lib/data` or a shared hook: this session's ownership for this
 * parallel batch is scoped to `features/cart/components/**` — adding a cross-cutting shared file is
 * out of scope here (and would risk colliding with a sibling session touching the same file). A
 * bounded single-document client read is a perfectly ordinary thing to colocate with the one feature
 * that currently needs it.
 */
export function useCartGeneralSettings(): { generalSettings: GeneralSettingsProps | null; loading: boolean } {
  const [generalSettings, setGeneralSettings] = useState<GeneralSettingsProps | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, FirestoreCollections.general, FirestoreDocs.generalConfig))
      .then((snap) => {
        if (cancelled) return;
        setGeneralSettings(snap.exists() ? (snap.data() as GeneralSettingsProps) : null);
      })
      .catch(() => {
        // Fail soft: `computeTotals` already treats `generalSettings: null` as "delivery/GST/wallet
        // all read as off" (see its own doc comment) rather than crashing the bag over a config read.
        if (!cancelled) setGeneralSettings(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { generalSettings, loading };
}
