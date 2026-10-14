import type { VariantOption } from '../types/product';

/**
 * Multi-axis variants (Colour × Size × Layer …) — the shared rules for labelling a variant and for picking
 * one from chip selections. The website uses these directly and the Flutter app mirrors them in
 * `features/products/domain/entities/variant_options.dart`, so a shopper tapping the same chips gets the
 * same variant on both surfaces.
 *
 * Axes are keyed by name: `COLOUR_AXIS` for the colour, and each option's `group` for the rest. A legacy
 * variant (no `options`) has exactly one non-colour axis, `LEGACY_AXIS`, whose value is its `name`.
 */

/** Selection key of the colour axis. Settings groups are units (Size, Layer…), never colours. */
export const COLOUR_AXIS = 'Colour';

/** The axis a single-axis variant's `name` belongs to — what the storefronts always labelled it. */
export const LEGACY_AXIS = 'Size';

/** The fields these helpers read; satisfied by `VariantProps` and the storefront's client-side variant. */
export interface VariantAxesSource {
  name: string;
  color: string;
  stock: number;
  options?: VariantOption[] | null;
}

/**
 * The display label for a set of options — first value bare, the rest prefixed with their group:
 * `[Size 57, Layer 2]` → `"57 · Layer 2"`. The first axis is the primary one (Size), which shoppers
 * already read without a prefix; a second axis needs its name or "57 · 2" is ambiguous.
 */
export function variantLabel(options: VariantOption[]): string {
  return options
    .filter((o) => o.value.trim())
    .map((o, i) => (i === 0 ? o.value.trim() : `${o.group.trim()} ${o.value.trim()}`))
    .join(' · ');
}

/** The non-colour axes of one variant, in order. A legacy variant's `name` is its single "Size" axis. */
export function variantAxes(v: Pick<VariantAxesSource, 'name' | 'options'>): VariantOption[] {
  return v.options && v.options.length > 0 ? v.options : [{ group: LEGACY_AXIS, value: v.name }];
}

/** Every axis value of a variant, colour included, keyed by axis name. */
export function axisValues(v: VariantAxesSource): Record<string, string> {
  const out: Record<string, string> = { [COLOUR_AXIS]: v.color };
  for (const o of variantAxes(v)) out[o.group] = o.value;
  return out;
}

/**
 * The non-colour chip rows for a product: each axis with its distinct values, both in first-seen order
 * across `variants` (pass them already sorted by `sortOrder`, so the admin's order drives the chips).
 */
export function variantAxisList(variants: VariantAxesSource[]): { axis: string; values: string[] }[] {
  const rows = new Map<string, string[]>();
  for (const v of variants) {
    for (const o of variantAxes(v)) {
      const values = rows.get(o.group) ?? [];
      if (!values.includes(o.value)) values.push(o.value);
      rows.set(o.group, values);
    }
  }
  return [...rows].map(([axis, values]) => ({ axis, values }));
}

/** How many of `selection`'s axes (other than `skip`) the variant matches. Missing axes read as ''. */
function matchCount(values: Record<string, string>, selection: Record<string, string>, skip?: string): number {
  let n = 0;
  for (const [axis, value] of Object.entries(selection)) {
    if (axis !== skip && (values[axis] ?? '') === value) n++;
  }
  return n;
}

/**
 * The variant the current chip selection points at.
 *
 * 1. Exact match on every selected axis.
 * 2. Otherwise — a chip on `changedAxis` was just tapped and that combination doesn't exist — the variant
 *    WITH the tapped value that keeps the most other selections, preferring in-stock, then the earliest
 *    (admin order). So tapping Size 55 while on Layer 3 lands on 55 · Layer 2 if 55 has no Layer 3.
 * 3. Otherwise the best partial match overall, then the first variant.
 *
 * Returns undefined only for an empty list.
 */
export function resolveVariant<T extends VariantAxesSource>(
  variants: T[],
  selection: Record<string, string>,
  changedAxis?: string,
): T | undefined {
  if (variants.length === 0) return undefined;
  const scored = variants.map((v, index) => ({ v, index, values: axisValues(v) }));

  const exact = scored.find((s) => matchCount(s.values, selection) === Object.keys(selection).length);
  if (exact) return exact.v;

  const pool =
    changedAxis !== undefined
      ? scored.filter((s) => (s.values[changedAxis] ?? '') === selection[changedAxis])
      : scored;
  const candidates = pool.length > 0 ? pool : scored;

  const best = [...candidates].sort((a, b) => {
    const stockA = a.v.stock > 0 ? 1 : 0;
    const stockB = b.v.stock > 0 ? 1 : 0;
    if (stockA !== stockB) return stockB - stockA;
    const scoreA = matchCount(a.values, selection, changedAxis);
    const scoreB = matchCount(b.values, selection, changedAxis);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.index - b.index;
  })[0];
  return best?.v ?? variants[0];
}

/**
 * Whether tapping `value` on `axis` would land on an in-stock variant that keeps every OTHER current
 * selection — drives the greyed-out chip state. A greyed chip stays tappable; `resolveVariant` then
 * moves the other axes to a combination that exists.
 */
export function isComboAvailable(
  variants: VariantAxesSource[],
  selection: Record<string, string>,
  axis: string,
  value: string,
): boolean {
  const others = Object.keys(selection).filter((a) => a !== axis).length;
  return variants.some((v) => {
    if (v.stock <= 0) return false;
    const values = axisValues(v);
    return (values[axis] ?? '') === value && matchCount(values, selection, axis) === others;
  });
}
