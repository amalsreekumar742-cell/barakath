import { type FC, useEffect, useRef, useState } from 'react';
import type { ProductProps } from '@barakath/shared/types';
import Icon from '@/components/icons/Icon';
import { searchCouponProducts } from '../api/searchCouponProducts';

/** A lightweight product reference kept for chip labels (name + thumbnail). */
export interface PickedProduct {
  id: string;
  name: string;
  thumbnail?: string;
}

/**
 * ProductMultiSelect — a self-contained, cursor-paginated multi-select for the coupon form's "Specific
 * products" restriction (spec §1.12). A debounced search over the precomputed `keywords`, results in a
 * dropdown with a "Load more" (12 per page), and selected products shown as removable chips.
 *
 * WHY cursor pagination here (unlike categories): products are an unbounded, growable pool, so the skill
 * mandates a cursor-paged dropdown with View More — never a native <select> or a single unbounded read.
 * WHY the feature owns its own search (searchCouponProducts): features must not import another feature
 * (skill: unidirectional imports), so the coupons feature can't reuse the products feature's picker.
 */
interface ProductMultiSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
  /** Seeds chip labels for products already selected on the Edit page. */
  initialItems?: PickedProduct[];
}

const ProductMultiSelect: FC<ProductMultiSelectProps> = ({ value, onChange, initialItems = [] }) => {
  const [term, setTerm] = useState('');
  const [items, setItems] = useState<ProductProps[]>([]);
  const [cursor, setCursor] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  // id -> label reference, learned from initialItems + every search result so chips can always resolve.
  const [labels, setLabels] = useState<Record<string, PickedProduct>>(() =>
    Object.fromEntries(initialItems.map((p) => [p.id, p])),
  );
  const boxRef = useRef<HTMLDivElement>(null);

  // Merge newly-arrived initialItems (Edit hydration resolves names asynchronously).
  useEffect(() => {
    if (initialItems.length === 0) return;
    setLabels((prev) => {
      const next = { ...prev };
      for (const p of initialItems) next[p.id] = p;
      return next;
    });
  }, [initialItems]);

  // Debounced search (300ms) whenever the term changes.
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const page = await searchCouponProducts(term, null);
        setItems(page.items);
        setCursor(page.lastVisible);
        setHasMore(page.hasMore);
        setLabels((prev) => {
          const next = { ...prev };
          for (const p of page.items) next[p.id] = { id: p.id, name: p.name, thumbnail: p.thumbnail };
          return next;
        });
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
    const page = await searchCouponProducts(term, cursor);
    setItems((prev) => [...prev, ...page.items]);
    setCursor(page.lastVisible);
    setHasMore(page.hasMore);
    setLabels((prev) => {
      const next = { ...prev };
      for (const p of page.items) next[p.id] = { id: p.id, name: p.name, thumbnail: p.thumbnail };
      return next;
    });
  };

  const add = (p: ProductProps) => {
    if (!value.includes(p.id)) onChange([...value, p.id]);
    setOpen(false);
    setTerm('');
  };
  const remove = (id: string) => onChange(value.filter((v) => v !== id));

  const visible = items.filter((p) => !value.includes(p.id));

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
                    onClick={() => add(p)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-subtle"
                  >
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border bg-subtle">
                      {p.thumbnail ? (
                        <img src={p.thumbnail} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-foreground">{p.name}</p>
                      {p.sku && <p className="text-[12px] text-faint">{p.sku}</p>}
                    </div>
                    <Icon name="AddLine" size={16} className="shrink-0 text-faint" />
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

      {/* Selected chips */}
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((id) => {
            const p = labels[id];
            return (
              <span
                key={id}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-subtle py-1 pl-1.5 pr-2 text-[13px]"
              >
                <span className="h-7 w-7 overflow-hidden rounded-md border border-border bg-surface">
                  {p?.thumbnail ? <img src={p.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
                </span>
                <span className="max-w-[160px] truncate font-medium text-foreground">
                  {p?.name ?? id}
                </span>
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="text-faint hover:text-error"
                  aria-label="Remove product"
                >
                  <Icon name="CloseLine" size={14} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductMultiSelect;
