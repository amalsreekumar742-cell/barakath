import { type FC, type ReactNode, useEffect, useState } from 'react';
import { StockStatus } from '@barakath/shared/config/enums';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { setFilters, clearFilters } from '../stores/productsSlice';
import { loadSubCategories } from '../api/loadSubCategories';

/**
 * ProductsFilter — the collapsible filter panel (spec §1.5 Filters Panel). Category / stock-status /
 * product-status are pill buttons; sub-category pills appear once a single category is selected; price
 * is a Min/Max pair. Any change dispatches a filter update (the slice resets the list and the page
 * refetches). Category is single-select here because the Firestore list query filters on one
 * `categoryId` (and the sub-category filter only makes sense for one category).
 */
const Pill: FC<{ active: boolean; onClick: () => void; children: ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-pill border px-3 py-1.5 text-[13px] font-medium transition-colors ${
      active
        ? 'border-primary bg-primary-subtle text-primary'
        : 'border-border-strong text-muted hover:bg-subtle'
    }`}
  >
    {children}
  </button>
);

const ProductsFilter: FC = () => {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((s) => s.products.filters);
  const categories = useAppSelector((s) => s.products.filterCategories);

  const [subOptions, setSubOptions] = useState<{ id: string; name: string }[]>([]);
  const [priceMin, setPriceMin] = useState(filters.priceMin?.toString() ?? '');
  const [priceMax, setPriceMax] = useState(filters.priceMax?.toString() ?? '');

  // Load sub-categories when a single category is selected.
  useEffect(() => {
    if (!filters.categoryId) {
      setSubOptions([]);
      return;
    }
    void loadSubCategories(filters.categoryId).then((subs) =>
      setSubOptions(subs.map((s) => ({ id: s.id, name: s.name }))),
    );
  }, [filters.categoryId]);

  const applyPrice = () =>
    dispatch(
      setFilters({
        priceMin: priceMin ? Number(priceMin) : undefined,
        priceMax: priceMax ? Number(priceMax) : undefined,
      }),
    );

  return (
    <div className="mb-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-faint">Filters</h3>
        <button
          type="button"
          onClick={() => {
            dispatch(clearFilters());
            setPriceMin('');
            setPriceMax('');
          }}
          className="text-[13px] font-semibold text-primary hover:underline"
        >
          Clear all
        </button>
      </div>

      {/* Category */}
      <FilterGroup label="Category">
        <Pill active={!filters.categoryId} onClick={() => dispatch(setFilters({ categoryId: undefined, subCategoryId: undefined }))}>
          All
        </Pill>
        {categories.map((c) => (
          <Pill
            key={c.id}
            active={filters.categoryId === c.id}
            onClick={() => dispatch(setFilters({ categoryId: c.id, subCategoryId: undefined }))}
          >
            {c.name}
          </Pill>
        ))}
      </FilterGroup>

      {/* Sub-category (only when a category is selected) */}
      {filters.categoryId && subOptions.length > 0 && (
        <FilterGroup label="Sub-category">
          <Pill active={!filters.subCategoryId} onClick={() => dispatch(setFilters({ subCategoryId: undefined }))}>
            All
          </Pill>
          {subOptions.map((s) => (
            <Pill key={s.id} active={filters.subCategoryId === s.id} onClick={() => dispatch(setFilters({ subCategoryId: s.id }))}>
              {s.name}
            </Pill>
          ))}
        </FilterGroup>
      )}

      {/* Stock status */}
      <FilterGroup label="Stock status">
        <Pill active={!filters.stockStatus} onClick={() => dispatch(setFilters({ stockStatus: undefined }))}>
          All
        </Pill>
        {Object.values(StockStatus).map((s) => (
          <Pill key={s} active={filters.stockStatus === s} onClick={() => dispatch(setFilters({ stockStatus: s }))}>
            {s}
          </Pill>
        ))}
      </FilterGroup>

      {/* Product status */}
      <FilterGroup label="Product status">
        <Pill active={!filters.productStatus} onClick={() => dispatch(setFilters({ productStatus: undefined }))}>
          All
        </Pill>
        {(['Active', 'Archived'] as const).map((s) => (
          <Pill key={s} active={filters.productStatus === s} onClick={() => dispatch(setFilters({ productStatus: s }))}>
            {s}
          </Pill>
        ))}
      </FilterGroup>

      {/* Price range */}
      <FilterGroup label="Price range (₹)">
        <input
          type="number"
          value={priceMin}
          onChange={(e) => setPriceMin(e.target.value)}
          onBlur={applyPrice}
          placeholder="Min"
          className="w-24 rounded-md border border-border-strong px-2.5 py-1.5 text-[13px] outline-none focus:border-primary"
        />
        <span className="text-faint">–</span>
        <input
          type="number"
          value={priceMax}
          onChange={(e) => setPriceMax(e.target.value)}
          onBlur={applyPrice}
          placeholder="Max"
          className="w-24 rounded-md border border-border-strong px-2.5 py-1.5 text-[13px] outline-none focus:border-primary"
        />
      </FilterGroup>
    </div>
  );
};

const FilterGroup: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className="mt-3">
    <p className="mb-1.5 text-[12px] font-semibold text-muted">{label}</p>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);

export default ProductsFilter;
