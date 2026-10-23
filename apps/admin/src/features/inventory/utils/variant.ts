import type { VariantOption } from '@barakath/shared/types';

/**
 * Variant display helpers (design §08 Inventory). One place so the list, the CSV export and the
 * Adjust Stock page derive the SKU and the "Color · Size" label identically.
 */

/**
 * Variant-specific SKU: productSku joined with the variant's color + name (design "PERF-001-GR-M").
 *
 * A multi-axis variant passes its `options`, and the SKU then takes their VALUES instead of the name
 * ("CP-047-White-57-2", not "CP-047-White-57 · Layer 2"): the name is a display label with spaces,
 * dots and group words in it, none of which belong in a code that gets typed, scanned and exported.
 * Without options (every single-axis variant) it is unchanged, so existing SKUs don't shift.
 */
export function variantSku(
  productSku: string,
  color: string,
  name: string,
  options?: VariantOption[] | null,
): string {
  const axes = options?.length ? options.map((o) => o.value) : [name];
  return [productSku, color, ...axes].map((s) => s?.trim()).filter(Boolean).join('-');
}

/** "Color · Size" label, or "—" when the variant has neither (design shows "—"). */
export function variantLabel(color: string, name: string): string {
  return [color?.trim(), name?.trim()].filter(Boolean).join(' · ') || '—';
}
