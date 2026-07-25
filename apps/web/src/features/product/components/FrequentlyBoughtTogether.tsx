import Image from 'next/image';
import { formatInr } from '@/components/catalog/PriceBlock';
import { AddAllButton, type BundleItem } from './AddAllButton';

/**
 * Frequently bought together (spec §3.7) — ONLY rendered by the page when `product.isCombo === true`
 * and `getFrequentlyBoughtTogetherItems` returned at least one item. Purely presentational: the page
 * fetches and shapes `items` (see `data/getFrequentlyBoughtTogetherItems.ts`) so a fetch failure can be
 * caught once, at the page level, and degrade to "section hidden" instead of an error boundary.
 */
export function FrequentlyBoughtTogether({ items }: { items: BundleItem[] }) {
  if (items.length === 0) return null;

  const bundleTotal = items.reduce((sum, item) => (item.inStock ? sum + item.offerPrice : sum), 0);

  return (
    <section>
      <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
        Frequently bought together
      </h2>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {items.map((item) => (
          <div
            key={item.productId}
            className={`relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-subtle ${
              item.inStock ? '' : 'opacity-40'
            }`}
          >
            {item.image && (
              <Image src={item.image} alt={item.productName} fill sizes="80px" className="object-cover" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-subtle p-4">
        <p className="text-sm font-medium text-foreground">
          Bundle total:{' '}
          <span className="font-display text-lg font-semibold text-gold-strong">
            {formatInr(bundleTotal)}
          </span>
        </p>
        <AddAllButton items={items} />
      </div>
    </section>
  );
}
