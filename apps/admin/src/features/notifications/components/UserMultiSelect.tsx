import { type FC, useEffect, useRef, useState } from 'react';
import type { UserProps } from '@barakath/shared/types';
import Icon from '@/components/icons/Icon';
import { searchNotificationUsers, loadNotificationUsersByIds } from '../api/searchNotificationUsers';

/** A lightweight user reference kept for chip labels (name + phone). */
export interface PickedUser {
  id: string;
  name: string;
  phone?: string;
}

/**
 * UserMultiSelect — a self-contained, cursor-paginated multi-select for the Create Notification form's
 * "Specific users" target (spec §1.18 Target). A debounced search over the precomputed `keywords`, results
 * in a dropdown with a "Load more" (12 per page), and selected users shown as removable chips.
 *
 * WHY cursor pagination: users are an unbounded, growable pool, so the skill mandates a cursor-paged
 * dropdown with View More — never a native <select> or an unbounded read.
 * WHY the feature owns its own search (searchNotificationUsers): features must not import another feature
 * (skill: unidirectional imports), so the notifications feature can't reuse the customers feature's list.
 */
interface UserMultiSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
  /** Seeds chip labels for users already selected (e.g. hydrating a duplicated target list). */
  initialItems?: PickedUser[];
}

const UserMultiSelect: FC<UserMultiSelectProps> = ({ value, onChange, initialItems = [] }) => {
  const [term, setTerm] = useState('');
  const [items, setItems] = useState<UserProps[]>([]);
  const [cursor, setCursor] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any -- Firestore cursor
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<Record<string, PickedUser>>(() =>
    Object.fromEntries(initialItems.map((u) => [u.id, u])),
  );
  const boxRef = useRef<HTMLDivElement>(null);

  const learn = (users: UserProps[]) =>
    setLabels((prev) => {
      const next = { ...prev };
      for (const u of users) next[u.id] = { id: u.id, name: u.fullName, phone: u.phone };
      return next;
    });

  // Resolve any preselected ids we don't yet have labels for (e.g. duplicated target list).
  useEffect(() => {
    const missing = value.filter((id) => !labels[id]);
    if (missing.length === 0) return;
    void loadNotificationUsersByIds(missing).then(learn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Debounced search (300ms) whenever the term changes.
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const page = await searchNotificationUsers(term, null);
        setItems(page.items);
        setCursor(page.lastVisible);
        setHasMore(page.hasMore);
        learn(page.items);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const page = await searchNotificationUsers(term, cursor);
    setItems((prev) => [...prev, ...page.items]);
    setCursor(page.lastVisible);
    setHasMore(page.hasMore);
    learn(page.items);
  };

  const add = (u: UserProps) => {
    if (!value.includes(u.id)) onChange([...value, u.id]);
    setOpen(false);
    setTerm('');
  };
  const remove = (id: string) => onChange(value.filter((v) => v !== id));

  const visible = items.filter((u) => !value.includes(u.id));

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
          placeholder="Search users by name, phone or email…"
          className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-lg">
          <ul className="max-h-72 overflow-y-auto py-1">
            {loading ? (
              <li className="px-3 py-3 text-[13px] text-muted">Searching…</li>
            ) : visible.length === 0 ? (
              <li className="px-3 py-3 text-[13px] text-muted">No users found</li>
            ) : (
              visible.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => add(u)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-subtle"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
                      <Icon name="User1Line" size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-foreground">
                        {u.fullName || 'Unnamed'}
                      </p>
                      {u.phone && <p className="text-[12px] text-faint">{u.phone}</p>}
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
            const u = labels[id];
            return (
              <span
                key={id}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-subtle py-1 pl-2 pr-2 text-[13px]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-subtle text-primary">
                  <Icon name="User1Line" size={12} />
                </span>
                <span className="max-w-[160px] truncate font-medium text-foreground">{u?.name ?? id}</span>
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="text-faint hover:text-error"
                  aria-label="Remove user"
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

export default UserMultiSelect;
