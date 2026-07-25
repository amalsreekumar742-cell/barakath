'use client';

import { useCallback, useEffect, useState } from 'react';
import { Constants } from '@/config/constants';

/**
 * The visitor's recent search terms, persisted in localStorage.
 *
 * WHY localStorage and NOT a Redux slice: recent searches are a private, device-local convenience
 * that never needs to reach the server, another tab in real time, or any other feature. The task
 * bars a new slice for search, and this is exactly the kind of state that belongs next to the
 * component — a hook over `localStorage` keeps it out of the global store entirely.
 *
 * WHY the reads/writes are guarded and wrapped in try/catch: `localStorage` does not exist during
 * SSR (the header is server-rendered first) and throws in private-mode Safari when the quota is
 * zero. A search box that crashes because history could not be saved is a worse outcome than simply
 * not remembering the last query, so every access degrades to "no history".
 *
 * WHY newest-first with a cap and de-dup: a history list that shows the same term twice, oldest
 * first, is noise. Re-searching a term moves it to the top; the list is trimmed to
 * `MAX_RECENT_SEARCHES` so it can never grow without bound.
 */
export interface UseRecentSearches {
  recent: string[];
  add: (term: string) => void;
  remove: (term: string) => void;
  clear: () => void;
}

function read(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(Constants.STORAGE_KEY_RECENT_SEARCHES);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // Defensive: a hand-edited or corrupted value must not crash render.
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function write(list: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(Constants.STORAGE_KEY_RECENT_SEARCHES, JSON.stringify(list));
  } catch {
    // Storage full or unavailable — history is best-effort, so swallow.
  }
}

export function useRecentSearches(): UseRecentSearches {
  // Starts empty on both server and client so the first client render matches the server HTML
  // (no hydration mismatch); the effect below fills it in from storage right after mount.
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(read());
  }, []);

  const persist = useCallback((next: string[]) => {
    setRecent(next);
    write(next);
  }, []);

  const add = useCallback(
    (term: string) => {
      const cleaned = term.trim();
      if (!cleaned) return;
      persist(
        [cleaned, ...read().filter((t) => t.toLowerCase() !== cleaned.toLowerCase())].slice(
          0,
          Constants.MAX_RECENT_SEARCHES,
        ),
      );
    },
    [persist],
  );

  const remove = useCallback(
    (term: string) => {
      persist(read().filter((t) => t.toLowerCase() !== term.toLowerCase()));
    },
    [persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  return { recent, add, remove, clear };
}
