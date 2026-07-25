'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import { Checkbox, RadioGroup } from '@/components/form/Field';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import type { SubCategoryFacet } from '@/lib/data/products';
import { PriceRangeSlider } from './PriceRangeSlider';
import { RESET_ON_FILTER_CHANGE, buildHref, buildSubParam } from '../utils/urlParams';

const RATING_OPTIONS = [4, 3, 2, 1];

export interface FilterSidebarSelection {
  subCategoryNames: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
}

export interface FilterSidebarProps {
  pathname: string;
  currentParams: Record<string, string>;
  /** Hidden entirely on `/category/all` — there is no single category to scope sub-categories to. */
  showSubCategory: boolean;
  subCategoryFacets: SubCategoryFacet[];
  priceBounds: { min: number; max: number } | null;
  selected: FilterSidebarSelection;
  /** For the mobile drawer's result-count footer. */
  resultCount: number;
}

/**
 * FilterSidebar — sub-category checkboxes (with counts), a dual-handle price range, a rating filter
 * and "Clear all" (spec 3.6 design: three stacked cards in a 250px rail). Does NOT exist as a shared
 * component before this task (see the Batch 2 prompt's correction) — built here, next to its only
 * caller, the category page.
 *
 * WHY one component for both the persistent desktop rail AND the mobile drawer rather than two: the
 * filter CONTROLS (checkboxes/slider/radio) are identical in both places; only the chrome around them
 * differs (a plain card rail at ≥1024px vs a "Filters" trigger + slide-over below it). Rendering the
 * same `<FilterBody>` twice (desktop always-visible, mobile inside the shared `Modal`) keeps that one
 * true and avoids two controls drifting out of sync.
 *
 * WHY every control commits immediately (no local "Apply" step) except the price slider: checkboxes
 * and the rating radio are discrete, low-cost re-navigations: with a growable sub-category list Firestore
 * uses in the `subCategoryName` equality/`in` filter, hovering-then-forgetting an "Apply" button is a
 * worse UX than an instant filter — and it matches `QuickFilters`/`SortDropdown`'s instant-commit model.
 * The price slider is the one exception (see `PriceRangeSlider`'s own doc comment: a drag fires many
 * events, so it stages locally and commits on release/debounce).
 */
export function FilterSidebar({
  pathname,
  currentParams,
  showSubCategory,
  subCategoryFacets,
  priceBounds,
  selected,
  resultCount,
}: FilterSidebarProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  function go(edits: Parameters<typeof buildHref>[2]) {
    router.push(buildHref(pathname, currentParams, { ...RESET_ON_FILTER_CHANGE, ...edits }), {
      scroll: false,
    });
  }

  function toggleSubCategory(name: string, checked: boolean) {
    const next = checked
      ? [...selected.subCategoryNames, name]
      : selected.subCategoryNames.filter((n) => n !== name);
    go({ sub: buildSubParam(next) });
  }

  function onPriceCommit(range: { min: number; max: number }) {
    // A committed range matching the full bounds is "no filter" — clearing it keeps the URL clean.
    const isFullRange = priceBounds && range.min <= priceBounds.min && range.max >= priceBounds.max;
    go({
      minPrice: isFullRange ? null : String(range.min),
      maxPrice: isFullRange ? null : String(range.max),
    });
  }

  function onRatingChange(next: string) {
    const asNumber = Number(next);
    // Selecting the already-active rating clears it — the only way to turn this filter back off
    // without "Clear all", since a native radio group otherwise cannot be un-selected.
    go({ rating: asNumber === selected.minRating ? null : next });
  }

  const hasAnyFilter =
    selected.subCategoryNames.length > 0 ||
    selected.minPrice != null ||
    selected.maxPrice != null ||
    selected.minRating != null;

  function clearAll() {
    router.push(pathname, { scroll: false });
    setMobileOpen(false);
  }

  const body = (
    <div className="flex flex-col gap-6">
      {showSubCategory && subCategoryFacets.length > 0 && (
        <FilterCard title="Category">
          <div className="flex flex-col gap-3">
            {subCategoryFacets.map((facet) => (
              <Checkbox
                key={facet.name}
                label={facet.name}
                trailing={`(${facet.count})`}
                checked={selected.subCategoryNames.includes(facet.name)}
                onChange={(e) => toggleSubCategory(facet.name, e.target.checked)}
              />
            ))}
          </div>
        </FilterCard>
      )}

      {priceBounds && priceBounds.min < priceBounds.max && (
        <FilterCard title="Price range">
          <PriceRangeSlider
            bounds={priceBounds}
            value={{
              min: selected.minPrice ?? priceBounds.min,
              max: selected.maxPrice ?? priceBounds.max,
            }}
            onCommit={onPriceCommit}
          />
        </FilterCard>
      )}

      <FilterCard title="Rating">
        <RadioGroup
          name="minRating"
          value={selected.minRating != null ? String(selected.minRating) : null}
          onChange={onRatingChange}
          options={RATING_OPTIONS.map((r) => ({ value: String(r), label: `${r}★ & up` }))}
        />
      </FilterCard>

      {hasAnyFilter && (
        <button
          type="button"
          onClick={clearAll}
          className="self-start text-[13px] font-medium text-primary hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Persistent rail — 1024px and up. */}
      <aside className="hidden w-[250px] shrink-0 lg:block" aria-label="Filters">
        {body}
      </aside>

      {/* Trigger + slide-over — below 1024px. */}
      <div className="mb-4 lg:hidden">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          iconLeft={<SlidersHorizontal className="size-4" aria-hidden />}
          onClick={() => setMobileOpen(true)}
        >
          Filters{hasAnyFilter ? ` · ${selected.subCategoryNames.length + (selected.minRating ? 1 : 0) + (selected.minPrice != null || selected.maxPrice != null ? 1 : 0)}` : ''}
        </Button>
      </div>

      <Modal isOpen={mobileOpen} onClose={() => setMobileOpen(false)} maxWidth="max-w-sm" labelledBy="filter-drawer-title">
        <div className="flex max-h-[85vh] flex-col overflow-hidden rounded-2xl bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 id="filter-drawer-title" className="font-display text-base font-semibold text-foreground">
              Filters
            </h2>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close filters"
              className="rounded-full p-1.5 text-muted hover:bg-subtle"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">{body}</div>
          <div className="border-t border-border px-5 py-4">
            <Button type="button" fullWidth onClick={() => setMobileOpen(false)}>
              Show {resultCount} result{resultCount === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function FilterCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 font-display text-[15px] font-semibold text-foreground">{title}</div>
      {children}
    </div>
  );
}
