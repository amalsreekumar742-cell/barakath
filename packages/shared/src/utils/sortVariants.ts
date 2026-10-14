/**
 * sortVariants — put a product's variants in their admin-chosen display order (`sortOrder`).
 *
 * WHY a shared helper: "the first variant" is the product's default everywhere (card price, PDP
 * pre-selection, flash-sale card), so every surface must order variants identically. Pass the list in
 * `createdAt` order (how every reader already queries it): variants that have a `sortOrder` come first by
 * that value, and legacy variants WITHOUT one keep their `createdAt` order after them — the sort is
 * stable, so nothing is dropped or shuffled for a product nobody has reordered yet.
 */
export function sortVariants<T extends { sortOrder?: number | null }>(variants: T[]): T[] {
  const rank = (v: T) => (typeof v.sortOrder === 'number' ? v.sortOrder : Number.POSITIVE_INFINITY);
  return variants
    .map((v, i) => ({ v, i }))
    .sort((a, b) => {
      const ra = rank(a.v);
      const rb = rank(b.v);
      if (ra === rb) return a.i - b.i;
      return ra < rb ? -1 : 1;
    })
    .map(({ v }) => v);
}
