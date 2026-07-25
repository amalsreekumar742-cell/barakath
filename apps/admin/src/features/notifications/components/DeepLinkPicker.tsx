import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import type { ProductProps, CategoryProps } from '@barakath/shared/types';
import { NotificationLinkType } from '@barakath/shared/config/enums';
import Icon from '@/components/icons/Icon';
import { searchNotificationProducts } from '../api/searchNotificationProducts';
import { fetchNotificationCategories } from '../api/fetchNotificationCategories';

/**
 * DeepLinkPicker — a single-select target picker for the Create Notification form's deep link (spec §1.18).
 * Renders a product search (cursor-paginated) when linkType = 'Product', or a client-filtered category
 * dropdown when linkType = 'Category'. Emits the chosen id as `linkValue`; the parent renders the chosen
 * label. Nothing is shown for linkType 'None'/'Order' (Order links are for automated notifications, not the
 * admin create form).
 *
 * WHY product search is cursor-paginated but categories load once: products are unbounded (skill mandates a
 * paged dropdown), categories are a small curated set (a single capped read + client filter is correct).
 * WHY the feature owns both reads: features must not import another feature (skill: unidirectional imports).
 */
interface DeepLinkPickerProps {
  linkType: string;
  value: string;
  onChange: (id: string, label: string) => void;
}

const DeepLinkPicker: FC<DeepLinkPickerProps> = ({ linkType, value, onChange }) => {
  if (linkType === NotificationLinkType.PRODUCT) {
    return <ProductPicker value={value} onChange={onChange} />;
  }
  if (linkType === NotificationLinkType.CATEGORY) {
    return <CategoryPicker value={value} onChange={onChange} />;
  }
  return null;
};

/** Cursor-paginated single product picker (deep link → Product). */
const ProductPicker: FC<{ value: string; onChange: (id: string, label: string) => void }> = ({
  value,
  onChange,
}) => {
  const [term, setTerm] = useState('');
  const [items, setItems] = useState<ProductProps[]>([]);
  const [cursor, setCursor] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const page = await searchNotificationProducts(term, null);
        setItems(page.items);
        setCursor(page.lastVisible);
        setHasMore(page.hasMore);
        setLabels((prev) => {
          const next = { ...prev };
          for (const p of page.items) next[p.id] = p.name;
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

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const loadMore = async () => {
    const page = await searchNotificationProducts(term, cursor);
    setItems((prev) => [...prev, ...page.items]);
    setCursor(page.lastVisible);
    setHasMore(page.hasMore);
    setLabels((prev) => {
      const next = { ...prev };
      for (const p of page.items) next[p.id] = p.name;
      return next;
    });
  };

  return (
    <div ref={boxRef} className="relative">
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3 py-2.5">
          <span className="truncate text-[14px] font-medium text-foreground">
            {labels[value] ?? 'Selected product'}
          </span>
          <button
            type="button"
            onClick={() => onChange('', '')}
            className="shrink-0 text-faint hover:text-error"
            aria-label="Clear selected product"
          >
            <Icon name="CloseLine" size={16} />
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
            placeholder="Search a product to link…"
            className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}

      {open && !value && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-lg">
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
                    onClick={() => {
                      onChange(p.id, p.name);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-subtle"
                  >
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border bg-subtle">
                      {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-foreground">{p.name}</p>
                      {p.sku && <p className="text-[12px] text-faint">{p.sku}</p>}
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

/** Single category picker (deep link → Category) — one capped read + client filter. */
const CategoryPicker: FC<{ value: string; onChange: (id: string, label: string) => void }> = ({
  value,
  onChange,
}) => {
  const [cats, setCats] = useState<CategoryProps[]>([]);
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchNotificationCategories().then(setCats).catch(() => setCats([]));
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selectedName = useMemo(() => cats.find((c) => c.id === value)?.name, [cats, value]);
  const filtered = cats.filter((c) => c.name.toLowerCase().includes(term.trim().toLowerCase()));

  return (
    <div ref={boxRef} className="relative">
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3 py-2.5">
          <span className="truncate text-[14px] font-medium text-foreground">
            {selectedName ?? 'Selected category'}
          </span>
          <button
            type="button"
            onClick={() => onChange('', '')}
            className="shrink-0 text-faint hover:text-error"
            aria-label="Clear selected category"
          >
            <Icon name="CloseLine" size={16} />
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
            placeholder="Search a category to link…"
            className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}

      {open && !value && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-lg">
          <ul className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-[13px] text-muted">No categories found</li>
            ) : (
              filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(c.id, c.name);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-subtle"
                  >
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border bg-subtle">
                      {c.image ? <img src={c.image} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <span className="truncate text-[14px] font-medium text-foreground">{c.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DeepLinkPicker;
