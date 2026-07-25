/**
 * urlParams — turns the current flattened searchParams + a set of edits into the next href. Shared by
 * every client filter control (`QuickFilters`, `SortDropdown`, `FilterSidebar`, `CategoryPagination`)
 * so the URL grammar (which keys reset which other keys) is defined once, not once per control.
 */

/** `null` deletes the key; a string sets it. Keys not mentioned are carried over unchanged. */
export type ParamEdits = Record<string, string | null>;

/**
 * `?sub=` value: each name is `encodeURIComponent`-ed (handles spaces) then comma-joined — the comma
 * stays a literal separator because `encodeURIComponent` never encodes it. Mirrors `filters.ts`'s
 * `parseSubParam`, which is the exact inverse.
 */
export function buildSubParam(names: string[]): string | null {
  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.map(encodeURIComponent).join(',') : null;
}

/**
 * Any filter/sort change invalidates the cursor pair (`after`/`before` point at a document in the OLD
 * result set) and the page label — every control that changes a filter or the sort must clear these
 * three keys, or Next/Prev would silently page a stale query. Pagination itself is the only control
 * that is allowed to set them.
 */
export const RESET_ON_FILTER_CHANGE: ParamEdits = { after: null, before: null, page: null };

/**
 * Apply `edits` over `current` and return the resulting `pathname?query` string (or bare `pathname`
 * when nothing remains). WHY a plain string rather than a `URLSearchParams` object: `router.push`
 * takes a string, and building it here means every caller does one `router.push(buildHref(...))`.
 */
export function buildHref(pathname: string, current: Record<string, string>, edits: ParamEdits): string {
  const next: Record<string, string> = { ...current };
  for (const [key, value] of Object.entries(edits)) {
    if (value === null) delete next[key];
    else next[key] = value;
  }
  const qs = new URLSearchParams(next).toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
