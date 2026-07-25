import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import type { CategoryProps } from '@barakath/shared/types';
import Icon from '@/components/icons/Icon';
import { fetchCouponCategories } from '../api/fetchCouponCategories';

/**
 * CategoryMultiSelect — a self-contained multi-select for the coupon form's "Specific categories"
 * restriction (spec §1.12). Selected ids show as removable chips; a searchable dropdown lists the rest.
 *
 * WHY a bounded single read (not cursor pagination): categories are a small curated set (skill: a tiny,
 * bounded, curated pool may load once via a capped read) — fetchCouponCategories caps at 50 and this
 * filters client-side. WHY a custom dropdown, not a native <select>: native selects can't render chips,
 * a search box, or multi-select the way the design needs (skill: growable pools use a custom dropdown).
 */
interface CategoryMultiSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
}

const CategoryMultiSelect: FC<CategoryMultiSelectProps> = ({ value, onChange }) => {
  const [categories, setCategories] = useState<CategoryProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  // Load the (bounded) category set once on mount so both the dropdown and the chip labels can resolve.
  useEffect(() => {
    let alive = true;
    fetchCouponCategories()
      .then((cats) => alive && setCategories(cats))
      .catch(() => alive && setCategories([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = useMemo(
    () => categories.filter((c) => value.includes(c.id)),
    [categories, value],
  );
  const options = useMemo(
    () =>
      categories.filter(
        (c) => !value.includes(c.id) && c.name.toLowerCase().includes(term.trim().toLowerCase()),
      ),
    [categories, value, term],
  );

  const add = (id: string) => onChange([...value, id]);
  const remove = (id: string) => onChange(value.filter((v) => v !== id));

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3 py-2.5 text-left text-[14px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        <span className="text-faint">
          {loading ? 'Loading categories…' : 'Select categories…'}
        </span>
        <Icon name="ArrowDownLine" size={16} className="shrink-0 text-faint" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-lg">
          <div className="border-b border-border p-2">
            <input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search categories…"
              className="w-full rounded-md border border-border-strong px-2.5 py-1.5 text-[13px] outline-none focus:border-primary"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {options.length === 0 ? (
              <li className="px-3 py-2 text-[13px] text-muted">
                {loading ? 'Loading…' : 'No categories'}
              </li>
            ) : (
              options.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      add(c.id);
                      setTerm('');
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-[14px] text-foreground hover:bg-subtle"
                  >
                    {c.name}
                    <Icon name="AddLine" size={16} className="text-faint" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-subtle py-1 pl-3 pr-1.5 text-[13px] font-medium text-foreground"
            >
              {c.name}
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="text-faint hover:text-error"
                aria-label={`Remove ${c.name}`}
              >
                <Icon name="CloseLine" size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryMultiSelect;
