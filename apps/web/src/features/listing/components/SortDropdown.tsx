'use client';

import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import type { ProductSort } from '@/lib/data/products';
import { RESET_ON_FILTER_CHANGE, buildHref } from '../utils/urlParams';

/**
 * SortDropdown — "Sort: Popularity ▾" (spec 3.6 design). A NATIVE `<select>` under the hood: the sort
 * options are a small, fixed, curated set (never a growable one), which is exactly the case
 * `src/components/form/Field.tsx`'s `Select` doc-comment carves out as correct for a native element —
 * this file builds its own so the pill styling (label + chevron inline, no separate field label) can
 * match the design without fighting that component's label/error layout. No new dependency either way.
 */
export interface SortDropdownProps {
  pathname: string;
  currentParams: Record<string, string>;
  value: ProductSort;
}

const OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'popularity', label: 'Popularity' },
  { value: 'newest', label: 'Newest' },
  { value: 'priceAsc', label: 'Price: Low to High' },
  { value: 'priceDesc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
];

export function SortDropdown({ pathname, currentParams, value }: SortDropdownProps) {
  const router = useRouter();

  function onChange(next: ProductSort) {
    if (next === value) return;
    const href = buildHref(pathname, currentParams, { ...RESET_ON_FILTER_CHANGE, sort: next });
    router.push(href, { scroll: false });
  }

  return (
    <label className="relative inline-flex h-[38px] items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-[13px] font-medium text-foreground">
      <span className="text-muted">Sort:</span>
      <select
        aria-label="Sort products"
        value={value}
        onChange={(e) => onChange(e.target.value as ProductSort)}
        className="cursor-pointer appearance-none bg-transparent pr-5 text-foreground outline-none"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 size-4 text-faint" aria-hidden />
    </label>
  );
}
