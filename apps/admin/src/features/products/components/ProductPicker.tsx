import { type FC, useEffect, useRef, useState } from 'react';
import type { ProductProps } from '@barakath/shared/types';
import Icon from '@/components/icons/Icon';
import { formatINR } from '@/utils/format';
import { searchProducts } from '../api/searchProducts';
import type { FBTItem } from '../types';

/**
 * ProductPicker — reusable product search/select (spec §1.5 reusable picker; used by Frequently Bought
 * Together, and later Flash Sale / New Arrivals / Banner). Debounced search over the `keywords` field,
 * cursor-paginated results with "Load more" inside the dropdown; clicking a result calls `onSelect`.
 *
 * WHY its own search (searchProducts) instead of the list slice: picking must not disturb the main
 * Products list. `excludeIds` hides already-picked products and self.
 */
interface ProductPickerProps {
  onSelect: (item: FBTItem) => void;
  excludeIds: string[];
}

const ProductPicker: FC<ProductPickerProps> = ({ onSelect, excludeIds }) => {
  const [term, setTerm] = useState('');
  const [items, setItems] = useState<ProductProps[]>([]);
  const [cursor, setCursor] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search (300ms) whenever the term changes.
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const page = await searchProducts(term, null);
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
  }, [term]);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const loadMore = async () => {
    const page = await searchProducts(term, cursor);
    setItems((prev) => [...prev, ...page.items]);
    setCursor(page.lastVisible);
    setHasMore(page.hasMore);
  };

  const visible = items.filter((p) => !excludeIds.includes(p.id));
  const priceLabel = (p: ProductProps) =>
    p.minPrice === p.maxPrice ? formatINR(p.minPrice) : `${formatINR(p.minPrice)} – ${formatINR(p.maxPrice)}`;

  return (
    <div ref={boxRef} className="relative">
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

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-lg">
          <ul className="max-h-72 overflow-y-auto py-1">
            {loading ? (
              <li className="px-3 py-3 text-[13px] text-muted">Searching…</li>
            ) : visible.length === 0 ? (
              <li className="px-3 py-3 text-[13px] text-muted">No products found</li>
            ) : (
              visible.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelect({ id: p.id, name: p.name, image: p.thumbnail })}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-subtle"
                  >
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border bg-subtle">
                      {p.thumbnail ? (
                        <img src={p.thumbnail} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-foreground">{p.name}</p>
                      <p className="text-[12px] text-faint">
                        {p.sku} · {priceLabel(p)}
                      </p>
                    </div>
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
