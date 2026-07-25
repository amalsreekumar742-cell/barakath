/**
 * Variant display helpers (design §08 Inventory). One place so the list, the CSV export and the
 * Adjust Stock page derive the SKU and the "Color · Size" label identically.
 */

/** Variant-specific SKU: productSku joined with the variant's color + name (design "PERF-001-GR-M"). */
export function variantSku(productSku: string, color: string, name: string): string {
  return [productSku, color, name].map((s) => s?.trim()).filter(Boolean).join('-');
}

/** "Color · Size" label, or "—" when the variant has neither (design shows "—"). */
export function variantLabel(color: string, name: string): string {
  return [color?.trim(), name?.trim()].filter(Boolean).join(' · ') || '—';
}
