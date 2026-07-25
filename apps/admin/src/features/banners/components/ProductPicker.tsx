import { type FC, useEffect, useRef, useState } from 'react';
import type { ProductProps } from '@barakath/shared/types';
import Icon from '@/components/icons/Icon';
import { searchBannerProducts } from '../api/searchBannerProducts';

/**
 * ProductPicker — a self-contained, cursor-paginated SINGLE-select for the banner form's "Product" link
 * (spec §1.15). A debounced search over the precomputed `keywords`, results in a dropdown with a "Load
 * more" (12 per page), and the chosen product shown as a removable chip.
 *
 * WHY single-select (unlike the coupons multi-select): a banner links to exactly ONE product target, so
 * selecting replaces the current choice and closes the dropdown.
 * WHY the feature owns its own search (searchBannerProducts): features must not import another feature
 * (skill: unidirectional imports), so the banners feature can't reuse the products/coupons pickers.
 * WHY cursor pagination: products are an unbounded, growable pool — the skill mandates a cursor-paged
 * dropdown with View More, never a native <select> or a single unbounded read.
 */
interface ProductPickerProps {
  /** Selected product id (linkValue), or '' when none. */
  value: string;
  /** Selected product name label (linkProductName), so the chip reads nicely even before a search. */
  valueName: string;
  onChange: (id: string, name: string) => void;
}

const productThumb = (p: ProductProps): string | undefined => p.images?.[0];

const ProductPicker: FC<ProductPickerProps> = ({ value, valueName, onChange }) => {
  const [term, setTerm] = useState('');
  const [items, setItems] = useState<ProductProps[]>([]);
  const [cursor, setCursor] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search (300ms) whenever the term changes while open.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const page = await searchBannerProducts(term, null);
        setItems(page.items);
        setCursor(page.lastVisible);
        setHasMore(page.hasMore);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [term, open]);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const loadMore = async () => {
    const page = await searchBannerProducts(term, cursor);
    setItems((prev) => [...prev, ...page.items]);
    setCursor(page.lastVisible);
    setHasMore(page.hasMore);
  };

  const pick = (p: ProductProps) => {
    onChange(p.id, p.name);
    setOpen(false);
    setTerm('');
  };
  const clear = () => onChange('', '');

  return (
    <div ref={boxRef} className="relative">
      {/* Chosen product chip (single) */}
      {value ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-subtle py-1.5 pl-2 pr-2.5 text-[13px]">
            <span className="max-w-[220px] truncate font-medium text-foreground">{valueName || value}</span>
            <button
              type="button"
              onClick={clear}
              className="text-faint hover:text-error"
              aria-label="Remove product"
            >
              <Icon name="CloseLine" size={14} />
            </button>
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-[13px] font-semibold text-primary hover:underline"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="SearchLine" size={16} />
          </span>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Search products by name or SKU…"
            className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-lg">
          {value && (
            <div className="border-b border-border p-2">
              <input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search products…"
                className="w-full rounded-md border border-border-strong px-2.5 py-1.5 text-[13px] outline-none focus:border-primary"
              />
            </div>
          )}
          <ul className="max-h-72 overflow-y-auto py-1">
            {loading ? (
              <li className="px-3 py-3 text-[13px] text-muted">Searching…</li>
            ) : items.length === 0 ? (
              <li className="px-3 py-3 text-[13px] text-muted">No products found</li>
            ) : (
              items.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pick(p)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-subtle"
                  >
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border bg-subtle">
                      {productThumb(p) ? (
                        <img src={productThumb(p)} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-foreground">{p.name}</p>
                      {p.sku && <p className="text-[12px] text-faint">{p.sku}</p>}
                    </div>
                    {p.id === value && <Icon name="CheckLine" size={16} className="shrink-0 text-primary" />}
                  </button>
                </li>
              ))
            )}
          </ul>
          {hasMore && !loading && (
            <button
              type="button"
              onClick={loadMore}
              className="w-full border-t border-border py-2 text-[13px] font-semibold text-primary hover:bg-subtle"
            >
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductPicker;
