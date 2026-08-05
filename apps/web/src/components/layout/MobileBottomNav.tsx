'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { House, LayoutGrid, ShoppingBag, Wallet, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { setLoginSheetOpen } from '@/stores/uiSlice';
import { isMobileNavVisible } from './mobileNavRoutes';

/**
 * The mobile bottom tab bar — the spine of the app-like mobile experience.
 *
 * Mirrors `apps/app/lib/features/home/presentation/pages/app_shell.dart`: the same five tabs in the
 * same order, gold active state, grey inactive, and a red bag badge.
 *
 * WHY the tabs match the Flutter app exactly rather than being re-picked for the web: a customer who
 * uses both surfaces should not have to relearn where the bag lives. The app is the reference
 * implementation of this product's navigation.
 *
 * WHY it is visible on more routes than the app's own nav is: in Flutter only the five tab roots sit
 * inside the shell — listing, search and product detail are pushed screens with no bar. That works
 * because you always ARRIVE in an app via a tab. On the web those same pages are the most common
 * ENTRY points (a search result, a shared link), and a visitor landing there with no navigation is
 * stranded. So the bar shows everywhere except sign-in and the linear payment flow — see HIDDEN_ON.
 */

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Guests get the login sheet instead of navigating — matches the app's tab guard. */
  requiresAuth?: boolean;
  /** Additional path prefixes that should light this tab up. */
  alsoActiveFor?: string[];
}

const TABS: Tab[] = [
  { href: '/', label: 'Home', icon: House },
  { href: '/categories', label: 'Category', icon: LayoutGrid, alsoActiveFor: ['/category'] },
  { href: '/cart', label: 'Bag', icon: ShoppingBag },
  { href: '/account/wallet', label: 'Wallet', icon: Wallet, requiresAuth: true },
  {
    href: '/account',
    label: 'Profile',
    icon: User,
    requiresAuth: true,
    // Every other account screen is reached from Profile, so it stays lit while you are in there.
    alsoActiveFor: ['/account/orders', '/account/addresses', '/account/settings', '/account/notifications', '/account/affiliate-wallet'],
  },
];

function isActive(pathname: string, tab: Tab): boolean {
  if (tab.href === '/') return pathname === '/';
  if (pathname === tab.href || pathname.startsWith(`${tab.href}/`)) {
    // `/account` must not swallow `/account/wallet`, which is its own tab.
    if (tab.href === '/account') {
      return !pathname.startsWith('/account/wallet');
    }
    return true;
  }
  return tab.alsoActiveFor?.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? false;
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const authLoading = useAppSelector((s) => s.auth.authLoading);

  /*
   * The auth-gated tabs (Wallet, Profile) have THREE states, not two.
   *
   * `authLoading` starts true with `isAuthenticated` false, so for a few hundred milliseconds after
   * every load we genuinely do not know who this is. Guessing is wrong either way: guess "guest" and
   * a signed-in customer is told to log in; guess "signed in" and a real guest gets bounced to
   * /login by middleware instead of the gentler sheet.
   *
   * So a tap during that window is DEFERRED rather than guessed — `pendingHref` records where the
   * customer wanted to go, and the effect below acts on it the moment auth resolves. Sub-second in
   * practice, and correct in both directions instead of intermittently wrong in one.
   */
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingHref || authLoading) return;
    if (isAuthenticated) router.push(pendingHref);
    else dispatch(setLoginSheetOpen(true));
    setPendingHref(null);
  }, [pendingHref, authLoading, isAuthenticated, router, dispatch]);

  /*
   * The bag count is read from a localStorage-persisted slice, so the server always renders 0 while
   * a returning visitor's browser may already hold items. Gating on a `useEffect`-set flag — rather
   * than the slice's own `isHydrating` — is the pattern `CartButton.tsx` arrived at after a live
   * hydration mismatch: React guarantees an effect runs only AFTER the hydration commit, whereas
   * `isHydrating` races redux-persist's async REHYDRATE against React's diff. Keep the two in step.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const rawCount = useAppSelector((s) => s.cart.items.reduce((sum, line) => sum + line.quantity, 0));
  const bagCount = mounted ? rawCount : 0;

  if (!isMobileNavVisible(pathname)) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-nav lg:hidden"
    >
      <ul className="flex h-[60px] items-stretch">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab);
          const Icon = tab.icon;
          const showBadge = tab.href === '/cart' && bagCount > 0;

          const inner = (
            <>
              <span className="relative inline-flex">
                {/*
                  The Flutter app swaps an outlined glyph for a filled one on the active tab
                  (`home_outlined` -> `home`). Lucide ships no filled counterparts, and forcing it
                  with `fill-current` turns an outline icon into a solid blob — the house in
                  particular collapses into an unreadable shape. Weight plus colour carries the same
                  signal legibly, so the active tab thickens its stroke instead of filling.
                */}
                <Icon className="size-[22px]" strokeWidth={active ? 2.5 : 1.75} aria-hidden />
                {showBadge && (
                  <span
                    aria-hidden
                    className="absolute -right-2 -top-1.5 min-w-[18px] rounded-full border-[1.5px] border-surface bg-error px-[5px] py-px text-center text-[10px] font-extrabold leading-[13px] text-white"
                  >
                    {bagCount > 99 ? '99+' : bagCount}
                  </span>
                )}
              </span>
              <span
                className={`text-[11px] tracking-[0.11px] ${active ? 'font-bold' : 'font-medium'}`}
              >
                {tab.label}
              </span>
            </>
          );

          const className = `flex h-full w-full flex-col items-center justify-center gap-1 transition-colors ${
            active ? 'text-gold-strong' : 'text-faint'
          }`;

          return (
            <li key={tab.href} className="flex-1">
              {tab.requiresAuth && !isAuthenticated ? (
                // Not (yet) known to be signed in. Prompt rather than navigate — a middleware
                // redirect to `/login?next=` yanks the page out from under a browsing visitor. If
                // auth is still resolving, defer the decision instead of guessing (see above).
                <button
                  type="button"
                  className={className}
                  onClick={() =>
                    authLoading ? setPendingHref(tab.href) : dispatch(setLoginSheetOpen(true))
                  }
                >
                  {inner}
                </button>
              ) : (
                <Link
                  href={tab.href}
                  className={className}
                  aria-current={active ? 'page' : undefined}
                  aria-label={
                    showBadge ? `${tab.label}, ${bagCount} item${bagCount === 1 ? '' : 's'}` : undefined
                  }
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
