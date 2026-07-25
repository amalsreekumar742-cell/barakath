import type { ReactNode } from 'react';
import { ProductGrid } from '@/components/catalog/ProductGrid';

/**
 * The "horizontally scrollable strip on mobile, 4-up grid on desktop" body shared by every home
 * product rail (flash sale, new arrivals), so the two scroll/reflow identically.
 *
 * WHY it takes pre-built card elements as `children` rather than a `products` array: it renders
 * through `ProductGrid`'s `children` escape hatch (`@/components/catalog/ProductGrid` explicitly
 * supports this — "pass children to lay out arbitrary tiles in the same grid"). The flash rail's
 * cards need a resolved variant per product (`FlashProductCard`), which `ProductGrid`'s `products`
 * shortcut has no way to express; funnelling both rails through the same children-based wrapper keeps
 * one column/scroll definition instead of two.
 *
 * WHY the scrollbar is hidden cross-browser: a visible horizontal scrollbar under a promo rail reads
 * as a broken layout on a touch device where the scroll affordance is the swipe itself, not a bar.
 *
 * WHY the grid breakpoints are `md`/`lg`/`xl` and never `sm`: this build's compiled Tailwind
 * stylesheet does not emit `@media` blocks in ascending breakpoint-value order (verified in the
 * built CSS — `sm`'s block lands AFTER `lg`'s), so a `sm:` utility can silently outrank a `lg:`/`xl:`
 * utility of equal specificity even on a desktop viewport. This rail used to switch to a grid at
 * `sm` and jump straight to 4 columns at `lg`, which meant `sm:grid-cols-2` kept beating
 * `lg:grid-cols-4` and every card rendered roughly half the container wide all the way up to a
 * 1440px screen. Sticking to the same `md`/`lg`/`xl` ladder `PRODUCT_GRID_CLASS` already uses
 * sidesteps the ordering bug entirely rather than depending on cascade order to fix it.
 */
export function ProductRail({ children }: { children: ReactNode }) {
  return (
    <ProductGrid
      className={[
        'flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1',
        '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'md:grid md:snap-none md:grid-cols-3 md:overflow-visible md:pb-0 lg:grid-cols-4 xl:grid-cols-5',
      ].join(' ')}
    >
      {children}
    </ProductGrid>
  );
}
