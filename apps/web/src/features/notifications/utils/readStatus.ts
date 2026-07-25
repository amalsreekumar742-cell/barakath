import { Constants } from '@/config/constants';

/**
 * Read-status for notifications is a purely local, device-scoped convenience (spec 3.18: "Read status
 * via localStorage" — mirrors the Flutter app's SharedPreferences). NO Firestore write happens
 * anywhere in this file. WHY it can't live on the document: a broadcast (`targetType == 'All'`) is one
 * shared doc read by every recipient — one person opening it would mark it read for everyone if "read"
 * were a field on it.
 *
 * WHY every function guards `typeof window`: this module is imported by client components that can
 * still be evaluated during SSR/prerender before hydration, where `localStorage` does not exist.
 */
function readIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(Constants.STORAGE_KEY_READ_NOTIFICATIONS);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    // Corrupt/blocked storage — treat as "nothing read yet" rather than throwing into a render path.
    return [];
  }
}

function writeIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(Constants.STORAGE_KEY_READ_NOTIFICATIONS, JSON.stringify(ids));
  } catch {
    // Storage full/disabled (private browsing) — read state just doesn't persist; not worth a toast.
  }
}

/** All ids this browser has opened. Exposed so a page can seed its own React state on mount — reading
 *  `localStorage` directly in render would break server rendering and desync from re-renders. */
export function getReadIds(): string[] {
  return readIds();
}

export function isRead(id: string): boolean {
  return readIds().includes(id);
}

export function markRead(id: string): void {
  const ids = readIds();
  if (ids.includes(id)) return;
  writeIds([...ids, id]);
}

export function markAllRead(ids: string[]): void {
  const existing = new Set(readIds());
  for (const id of ids) existing.add(id);
  writeIds(Array.from(existing));
}
