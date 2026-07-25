import { type FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { ProductProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { formatINR } from '@/utils/format';
import { addNewArrival } from '../api/addNewArrival';
import { searchNewArrivalProducts } from '../api/searchNewArrivalProducts';

/**
 * AddNewArrivalsPage — route /new-arrivals/add (spec §1.17, prototype "New Arrivals › Add"). A searchable
 * multi-select checklist of existing products (already-flagged products are excluded by the search); the
 * header's "Add N products" flags each selected product `isNewArrival` and returns to the list. WHY a full
 * page (not a modal): the prototype renders this as its own screen.
 */
const AddNewArrivalsPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const addLoading = useAppSelector((s) => s.newArrivals.addLoading);

  const [term, setTerm] = useState('');
  const [items, setItems] = useState<ProductProps[]>([]);
  const [cursor, setCursor] = useState<QueryCursor>(null);
  const [hasMore, setHasMore] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, ProductProps>>({});

  const selectedCount = Object.keys(selected).length;

  // Debounced product search (300ms). searchNewArrivalProducts excludes already-flagged products.
  useEffect(() => {
    setListLoading(true);
    const t = setTimeout(async () => {
      try {
        const page = await searchNewArrivalProducts(term, null);
        setItems(page.items);
        setCursor(page.lastVisible);
        setHasMore(page.hasMore);
      } catch {
        setItems([]);
      } finally {
        setListLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const loadMore = async () => {
    const page = await searchNewArrivalProducts(term, cursor);
    setItems((prev) => [...prev, ...page.items]);
    setCursor(page.lastVisible);
    setHasMore(page.hasMore);
  };

  const toggle = (p: ProductProps) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[p.id]) delete next[p.id];
      else next[p.id] = p;
      return next;
    });
  };

  const cancel = () => {
    if (selectedCount > 0 && !window.confirm('Discard your selection?')) return;
    navigate('/new-arrivals');
  };

  const submit = async () => {
    const chosen = Object.values(selected);
    if (chosen.length === 0) return;
    let ok = 0;
    for (const p of chosen) {
      const res = await dispatch(addNewArrival(p.id));
      if (addNewArrival.fulfilled.match(res)) ok += 1;
    }
    if (ok > 0) {
      toast.success(ok === 1 ? 'Added to New Arrivals' : `${ok} products added to New Arrivals`);
      navigate('/new-arrivals');
    } else {
      toast.error('Could not add products');
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/new-arrivals')}
            className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-foreground"
          >
            <Icon name="ArrowLeftLine" size={15} /> New Arrivals
          </button>
          <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">
            Add products to New Arrivals
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={cancel}
            disabled={addLoading}
            className="rounded-md border border-border-strong px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={addLoading || selectedCount === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {addLoading && <Icon name="Loader4Line" size={16} className="animate-spin" />}
            {selectedCount > 0 ? `Add ${selectedCount} product${selectedCount === 1 ? '' : 's'}` : 'Add products'}
          </button>
        </div>
      </div>

      {/* Search + checklist */}
      <div className="max-w-[640px]">
        <div className="relative mb-4 max-w-[280px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="SearchLine" size={16} />
          </span>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-md border border-border-strong bg-surface py-2 pl-9 pr-3 text-[13px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex flex-col gap-2.5">
          {listLoading ? (
            <p className="py-6 text-center text-[13px] text-muted">Searching…</p>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted">No products found</p>
          ) : (
            items.map((p) => {
              const checked = !!selected[p.id];
              const price = p.minPrice === p.maxPrice ? formatINR(p.minPrice) : `${formatINR(p.minPrice)}+`;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p)}
                  className={`flex items-center gap-3 rounded-[10px] border px-3.5 py-3 text-left transition-colors ${
                    checked ? 'border-primary bg-primary-subtle/40' : 'border-border hover:border-border-strong'
                  }`}
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-subtle">
                    {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-foreground">{p.name}</p>
                    <p className="truncate text-[11px] text-muted">
                      {p.categoryName || '—'} · {price}
                    </p>
                  </div>
                  <span
                    className={`inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 ${
                      checked ? 'border-primary bg-primary text-white' : 'border-border-strong bg-surface'
                    }`}
                  >
                    {checked && <Icon name="CheckLine" size={14} />}
                  </span>
                </button>
              );
            })
          )}
          {hasMore && !listLoading && (
            <button
              type="button"
              onClick={loadMore}
              className="mt-1 rounded-md border border-border-strong py-2 text-[13px] font-semibold text-foreground hover:bg-subtle"
            >
              Load more
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firestore cursor snapshot
type QueryCursor = any;

export default AddNewArrivalsPage;
