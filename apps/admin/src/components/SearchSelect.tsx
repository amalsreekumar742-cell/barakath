import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './icons/Icon';

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * SearchSelect — a custom (non-native) single-select dropdown with a search box (skill: growable option
 * pools use a custom dropdown, not a native <select>). For bounded, curated sets (categories,
 * sub-categories) the caller loads all options once via a capped read and this filters them client-side.
 *
 * WHY not native <select>: it can't host a search box or match the design; and the skill mandates a
 * custom dropdown here. Closes on outside-click / Escape; keyboard focus starts in the search field.
 */
interface SearchSelectProps {
  options: SelectOption[];
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyText?: string;
  /**
   * Hides the in-dropdown search box. For a short fixed list (a sort order, a two-way toggle) the
   * search field is noise the user has to look past — the skill's "custom dropdown, not native
   * <select>" rule is about the control, not about forcing a search box onto three options.
   */
  searchable?: boolean;
}

const SearchSelect: FC<SearchSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled,
  loading,
  emptyText = 'No options',
  searchable = true,
}) => {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(term.trim().toLowerCase())),
    [options, term],
  );

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

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3 py-2.5 text-left text-[14px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
      >
        <span className={selected ? 'text-foreground' : 'text-faint'}>
          {loading ? 'Loading…' : (selected?.label ?? placeholder)}
        </span>
        <Icon name="ArrowDownLine" size={16} className="shrink-0 text-faint" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-lg">
          {searchable && (
            <div className="border-b border-border p-2">
              <input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-md border border-border-strong px-2.5 py-1.5 text-[13px] outline-none focus:border-primary"
              />
            </div>
          )}
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[13px] text-muted">{emptyText}</li>
            ) : (
              filtered.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                      setTerm('');
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-[14px] hover:bg-subtle ${
                      o.value === value ? 'font-semibold text-primary' : 'text-foreground'
                    }`}
                  >
                    {o.label}
                    {o.value === value && <Icon name="CheckLine" size={16} />}
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

export default SearchSelect;
