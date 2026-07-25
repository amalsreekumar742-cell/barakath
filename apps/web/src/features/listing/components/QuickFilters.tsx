'use client';

import { useRouter } from 'next/navigation';
import type { QuickFilterValue } from '../types/listing';
import { RESET_ON_FILTER_CHANGE, buildHref } from '../utils/urlParams';

/**
 * QuickFilters — the "All | In Stock | On Sale" chip row above the grid (spec 3.6 design).
 *
 * WHY a single-select group rather than two independent toggles: the design (`Barakath Website
 * Prototype.dc.html`, "grid + sort" section) renders these as one Chip row with exactly one chip solid
 * at a time ("All" solid, the rest outline) — a segmented control, not two checkboxes. Selecting
 * "In Stock" therefore also clears `sale`, and vice versa; "All" clears both. The two params
 * (`stock`/`sale`) stay independent in the URL grammar per the prompt, this control just never writes
 * to both at once.
 *
 * WHY "On Sale" means flash-sale only: spec 3.6 — `sale=onSale` maps straight to
 * `buildProductQuery({ saleFilter: 'onSale' })`, which is `isFlashSale == true`, never "any discount".
 */
export interface QuickFiltersProps {
  pathname: string;
  currentParams: Record<string, string>;
  active: QuickFilterValue;
}

const OPTIONS: { value: QuickFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'inStock', label: 'In Stock' },
  { value: 'onSale', label: 'On Sale' },
];

export function QuickFilters({ pathname, currentParams, active }: QuickFiltersProps) {
  const router = useRouter();

  function select(value: QuickFilterValue) {
    if (value === active) return;
    const href = buildHref(pathname, currentParams, {
      ...RESET_ON_FILTER_CHANGE,
      stock: value === 'inStock' ? 'inStock' : null,
      sale: value === 'onSale' ? 'onSale' : null,
    });
    router.push(href, { scroll: false });
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Quick filters">
      {OPTIONS.map((opt) => {
        const isActive = opt.value === active;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => select(opt.value)}
            aria-pressed={isActive}
            className={`inline-flex h-[30px] items-center rounded-full px-3.5 text-[13px] font-bold transition ${
              isActive
                ? 'bg-primary text-white'
                : 'border border-border-strong bg-surface text-foreground hover:bg-subtle'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
