import { SectionHeader } from '@/components/catalog/SectionHeader';
import { FlashCountdown } from '@/components/catalog/FlashCountdown';
import type { HomeFlashSale } from '../api/getHomeFlashSale';
import { ProductRail } from './ProductRail';
import { FlashProductCard } from '@/components/catalog/FlashProductCard';

export interface FlashSaleSectionProps {
  flashSale: HomeFlashSale | null;
}

/**
 * The home "Flash sale" rail (spec §3.4 / §1.16) — only renders while a sale is genuinely live.
 * `getHomeFlashSale` already returns null whenever `getActiveFlashSale()` is null OR there turned out
 * to be nothing priceable to show, so this component's only job is composing what it was handed.
 */
export function FlashSaleSection({ flashSale }: FlashSaleSectionProps) {
  if (!flashSale) return null;
  const { sale, items } = flashSale;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 lg:px-5">
      <SectionHeader
        title={sale.name}
        trailing={<FlashCountdown endDate={sale.endDate.toMillis()} />}
        actionHref="/category/all?sale=onSale"
        actionLabel="See all"
      />
      <div className="mt-5">
        <ProductRail>
          {items.map(({ product, variant }) => (
            <div key={product.id} className="w-40 shrink-0 snap-start sm:w-auto">
              <FlashProductCard product={product} variant={variant} />
            </div>
          ))}
        </ProductRail>
      </div>
    </section>
  );
}
