import type { VariantOption } from '@barakath/shared/types';

/**
 * The product form's variant picker state — one unit per Settings › Variables group (Size 57 +
 * Layer 2), held as `VariantOption[]`.
 *
 * WHY a pure helper rather than logic inside the picker: the merge rules (one slot per group, kept in
 * Settings order) decide what `options` — and therefore the derived `name` label and the storefront's
 * chip rows — every new variant is saved with. They are easy to get subtly wrong and trivial to test
 * here, but not through a portal dropdown.
 *
 * Groups match case-insensitively: Settings dedupes group names that way, and the "+ New unit" form
 * accepts a free-typed group name, so "size" must land in the existing "Size" slot, not a second one.
 */

const norm = (s: string) => s.trim().toLowerCase();

/** Settings position of `group`; groups no longer in Settings sort after every known one. */
function rank(groupOrder: readonly string[], group: string): number {
  const i = groupOrder.findIndex((g) => norm(g) === norm(group));
  return i === -1 ? groupOrder.length : i;
}

/**
 * `options` with `group`'s slot set to `value` (replacing any unit already picked for that group, and
 * keeping every other group's), or CLEARED when `value` is null/blank. The result is ordered by
 * `groupOrder` — the Settings group order — because `variantLabel` reads the first option as the
 * primary, unprefixed axis ("57 · Layer 2"), so the order must not depend on which chip was clicked
 * first. The sort is stable, so groups missing from Settings keep their relative order at the end.
 */
export function setGroupOption(
  options: readonly VariantOption[],
  groupOrder: readonly string[],
  group: string,
  value: string | null,
): VariantOption[] {
  const others = options.filter((o) => norm(o.group) !== norm(group));
  // Stored under the Settings spelling, since the storefront prints `group` as the chip-row title.
  const canonical = (groupOrder.find((g) => norm(g) === norm(group)) ?? group).trim();
  const next = value?.trim() ? [...others, { group: canonical, value: value.trim() }] : others;
  return next.sort((a, b) => rank(groupOrder, a.group) - rank(groupOrder, b.group));
}

/** The unit currently picked for `group`, if any. */
export function selectedUnit(options: readonly VariantOption[], group: string): string | undefined {
  return options.find((o) => norm(o.group) === norm(group))?.value;
}

/**
 * A click on unit `value` of `group`: picks it, or — when it is already the group's pick — clears
 * the group. Clicking the selected chip again is the natural "undo" in a multi-pick list.
 */
export function toggleGroupOption(
  options: readonly VariantOption[],
  groupOrder: readonly string[],
  group: string,
  value: string,
): VariantOption[] {
  const current = selectedUnit(options, group);
  const isSame = current !== undefined && norm(current) === norm(value);
  return setGroupOption(options, groupOrder, group, isSame ? null : value);
}
