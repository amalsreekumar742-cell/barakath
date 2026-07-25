import 'server-only';

import type { ProductProps } from '@barakath/shared';
import { getFirstVariantByProduct } from '@/lib/data/catalog';
import { buildProductQuery } from '@/lib/data/products';
import { resolvePrice } from '@/lib/pricing';
import type { BundleItem } from '../components/AddAllButton';

/**
 * Data for the "Frequently bought together" section (spec §3.7) — kept as a plain fetch function
 * (rather than letting the section component fetch itself) so `page.tsx` can wrap the call in its own
 * try/catch and degrade this ONE section to hidden on failure without an error boundary taking down the
 * whole product page (an RSC error thrown inside a rendered child propagates to the route's `error.tsx`,
 * which would blank the entire PDP — catching here, before render, avoids that).
 *
 * WHY `buildProductQuery({ productIds })`: its `productIds` mode already fetches a bounded, caller-given
 * id set, drops anything not `Active`, and re-sorts to the requested id order — reusing it avoids a
 * second hand-rolled `documentId() in` query.
 *
 * WHY only the FIRST variant per product: the bundle adds one unit of a single variant per product
 * (mirrors the Flutter app's combo add-all); a customer wanting a specific variant clicks through.
 */
export async function getFrequentlyBoughtTogetherItems(product: ProductProps): Promise<BundleItem[]> {
  if (!product.isCombo || product.frequentlyBoughtTogether.length === 0) return [];

  const { items: bundleProducts } = await buildProductQuery({
    productIds: product.frequentlyBoughtTogether.slice(0, 10),
  });
  if (bundleProducts.length === 0) return [];

  const variantByProduct = await getFirstVariantByProduct(bundleProducts.map((p) => p.id));

  return bundleProducts
    .map((p): BundleItem | null => {
      const variant = variantByProduct[p.id];
      if (!variant) return null; // no variant found for this id — drop it rather than crash.
      const resolved = resolvePrice(p, variant);
      return {
        productId: p.id,
        variantId: variant.id,
        categoryId: p.categoryId,
        productName: p.name,
        variantName: [variant.color, variant.name].filter(Boolean).join(' · ') || variant.name,
        image: p.thumbnail || p.images[0] || '',
        offerPrice: resolved.displayPrice,
        mrp: resolved.mrp,
        isCombo: Boolean(p.isCombo),
        comboDeliveryCharge: p.isCombo ? p.comboDeliveryCharge : 0,
        stock: variant.stock,
        inStock: variant.stock > 0,
      } satisfies BundleItem;
    })
    .filter((item): item is BundleItem => item !== null);
}
