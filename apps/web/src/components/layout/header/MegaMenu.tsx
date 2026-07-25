'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, LayoutGrid, Loader2 } from 'lucide-react';
import {
  collection,
  getDocs,
  limit,
  query,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared';
import type { SubCategoryProps } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import type { NavCategory } from '@/lib/data/catalog';

/**
 * The "Categories" mega-menu: a trigger that opens a two-pane flyout — categories on the left, the
 * hovered category's sub-categories on the right.
 *
 * WHY the categories arrive as a prop but sub-categories are fetched here on demand: the whole
 * category list is already read once by the (shop) layout on the server and is small, so it ships in
 * the initial HTML for free. Sub-categories are a separate subcollection PER category; reading every
 * one up front would be dozens of reads for a menu most visitors never open. Fetching a category's
 * children the first time it is hovered spends a read only when it is about to be seen, and caching
 * the result means hovering back and forth costs nothing.
 *
 * WHY a client component: hover, open/close and the lazy fetch are all interactions. The menu's
 * CONTENT (the category names and their links) is still crawlable because it is passed down from the
 * server-rendered layout — the interactivity is the only thing that needs the browser.
 */
export interface MegaMenuProps {
  categories: NavCategory[];
}

type SubState = SubCategoryProps[] | 'loading' | 'error';

function mapSubs(snap: QuerySnapshot<DocumentData>): SubCategoryProps[] {
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as SubCategoryProps);
}

export function MegaMenu({ categories }: MegaMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Cache keyed by category id: undefined = never fetched, 'loading'/'error'/[] = a known state.
  const [subs, setSubs] = useState<Record<string, SubState>>({});
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /** Load one category's sub-categories the first time it is focused, then keep the result. */
  async function loadSubs(categoryId: string) {
    setActiveId(categoryId);
    if (subs[categoryId] !== undefined) return; // cached (including a prior empty/error result)
    setSubs((s) => ({ ...s, [categoryId]: 'loading' }));
    try {
      const snap = await getDocs(
        query(
          collection(
            db,
            FirestoreCollections.categories,
            categoryId,
            FirestoreCollections.subCategories,
          ),
          limit(Constants.MAX_SUBCATEGORIES),
        ),
      );
      setSubs((s) => ({ ...s, [categoryId]: mapSubs(snap) }));
    } catch {
      setSubs((s) => ({ ...s, [categoryId]: 'error' }));
    }
  }

  const activeCategory = categories.find((c) => c.id === activeId) ?? null;
  const activeSubs = activeId ? subs[activeId] : undefined;

  return (
    <div ref={rootRef} className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold text-foreground hover:bg-subtle"
      >
        <LayoutGrid className="size-[18px]" aria-hidden />
        Categories
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+8px)] z-50 flex w-[640px] max-w-[80vw] overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
        >
          {/* Left: the category list. */}
          <ul className="w-56 shrink-0 border-r border-border py-2">
            {categories.length === 0 && (
              <li className="px-4 py-2 text-sm text-muted">No categories yet.</li>
            )}
            {categories.map((c) => {
              const isActive = c.id === activeId;
              return (
                <li key={c.id}>
                  <Link
                    href={`/category/${encodeURIComponent(c.name)}`}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => loadSubs(c.id)}
                    onFocus={() => loadSubs(c.id)}
                    className={`flex items-center justify-between gap-2 px-4 py-2 text-sm font-medium ${
                      isActive ? 'bg-primary-subtle text-primary' : 'text-foreground hover:bg-subtle'
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Right: the hovered category's sub-categories. */}
          <div className="min-w-0 flex-1 p-4">
            {!activeCategory ? (
              <p className="px-1 py-2 text-sm text-muted">Hover a category to see its sub-categories.</p>
            ) : (
              <>
                <Link
                  href={`/category/${encodeURIComponent(activeCategory.name)}`}
                  onClick={() => setOpen(false)}
                  className="mb-2 inline-block font-display text-sm font-extrabold text-foreground hover:text-primary"
                >
                  All {activeCategory.name}
                </Link>
                {activeSubs === 'loading' && (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Loading…
                  </div>
                )}
                {activeSubs === 'error' && (
                  <p className="py-2 text-sm text-muted">Could not load sub-categories.</p>
                )}
                {Array.isArray(activeSubs) && activeSubs.length === 0 && (
                  <p className="py-2 text-sm text-muted">No sub-categories.</p>
                )}
                {Array.isArray(activeSubs) && activeSubs.length > 0 && (
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {activeSubs.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/category/${encodeURIComponent(activeCategory.name)}?subCategory=${encodeURIComponent(s.name)}`}
                          onClick={() => setOpen(false)}
                          className="block truncate rounded-md px-2 py-1.5 text-sm text-muted hover:bg-subtle hover:text-foreground"
                        >
                          {s.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
