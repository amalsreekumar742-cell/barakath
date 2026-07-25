'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  LogOut,
  Package,
  Settings,
  User as UserIcon,
  Wallet,
  Heart,
  ChevronDown,
} from 'lucide-react';
import { useAppSelector } from '@/stores/store';
import { useLogout } from '@/hooks/useLogout';

/**
 * The account control at the far right of the header.
 *
 * WHY it branches on auth state rather than always rendering a menu: a signed-out visitor has no
 * account to open — the useful control for them is a single "Login" link (spec 3.3, guests browse
 * freely). Once signed in it becomes a name + a dropdown to the account areas.
 *
 * WHY `authLoading` renders a neutral placeholder and not "Login": on a cold load nobody yet knows
 * whether a session exists (see authSlice). Rendering "Login" first and flipping to the name a beat
 * later is the exact flash of the wrong state the auth slice was designed to avoid — so while it is
 * unknown, show an inert pill of the same size and let it resolve into the real control.
 *
 * WHY logout goes through W2's `useLogout` hook: signing out is more than clearing Redux — it must
 * also clear the session cookie the middleware reads (via a route handler) and sign the Web SDK out.
 * That cross-cutting sequence is owned in one hook so no menu re-implements half of it.
 */
export function AccountMenu() {
  const { isAuthenticated, authLoading, user } = useAppSelector((s) => s.auth);
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
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

  // Unknown session — an inert, correctly-sized placeholder so the header does not jump on resolve.
  if (authLoading) {
    return <div aria-hidden className="h-10 w-10 animate-pulse rounded-lg bg-subtle sm:w-24" />;
  }

  if (!isAuthenticated) {
    return (
      <Link
        href="/login"
        className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold text-foreground hover:bg-subtle"
      >
        <UserIcon className="size-[22px] sm:size-[18px]" aria-hidden />
        <span className="hidden sm:inline">Login</span>
      </Link>
    );
  }

  const displayName = user?.fullName?.trim() || user?.phone || 'Account';
  const firstName = displayName.split(' ')[0];

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      // The tree unmounts on sign-out, but reset defensively in case logout rejects.
      setLoggingOut(false);
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-foreground hover:bg-subtle"
      >
        <UserIcon className="size-[22px] sm:size-[18px]" aria-hidden />
        <span className="hidden max-w-[10ch] truncate sm:inline">{firstName}</span>
        <ChevronDown className="hidden size-4 text-faint sm:inline" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 overflow-hidden rounded-2xl border border-border bg-surface py-1 shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-extrabold text-foreground">{displayName}</p>
            {user?.phone ? <p className="truncate text-xs text-muted">{user.phone}</p> : null}
          </div>
          <MenuLink href="/account/orders" icon={<Package className="size-4" />} onClick={() => setOpen(false)}>
            Orders
          </MenuLink>
          <MenuLink href="/account/wallet" icon={<Wallet className="size-4" />} onClick={() => setOpen(false)}>
            Wallet
          </MenuLink>
          <MenuLink href="/wishlist" icon={<Heart className="size-4" />} onClick={() => setOpen(false)}>
            Wishlist
          </MenuLink>
          <MenuLink href="/account/settings" icon={<Settings className="size-4" />} onClick={() => setOpen(false)}>
            Settings
          </MenuLink>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-error hover:bg-error-subtle disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogOut className="size-4" aria-hidden />
            {loggingOut ? 'Logging out…' : 'Logout'}
          </button>
        </div>
      )}
    </div>
  );
}

/** One row of the account dropdown — icon + label, closes the menu on navigate. */
function MenuLink({
  href,
  icon,
  onClick,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-subtle"
    >
      <span className="text-muted">{icon}</span>
      {children}
    </Link>
  );
}
