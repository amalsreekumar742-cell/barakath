'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Heart,
  LogOut,
  Menu,
  Package,
  Settings,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react';
import { Constants } from '@/config/constants';
import { useAppSelector } from '@/stores/store';
import { useLogout } from '@/hooks/useLogout';
import type { NavCategory } from '@/lib/data/catalog';

/**
 * The hamburger drawer for viewports below the desktop breakpoint (<1024px), where the mega menu and
 * the inline account menu are hidden.
 *
 * WHY a slide-in drawer rather than the shared centred Modal: navigation on a phone belongs in a
 * full-height panel anchored to the edge, not a centred dialog — the shared Modal is the right shape
 * for confirms and forms, the wrong one for a nav tree. This still borrows the Modal's manners:
 * backdrop, Escape-to-close and body-scroll-lock.
 *
 * WHY it carries the categories AND the account links: on a phone every header control collapses into
 * here, so this one panel has to stand in for the mega menu, the account dropdown and the standalone
 * icons all at once.
 */
export interface MobileNavProps {
  categories: NavCategory[];
}

export function MobileNav({ categories }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, authLoading, user } = useAppSelector((s) => s.auth);
  const logout = useLogout();

  // Lock background scroll and wire Escape while the drawer is open (matches the Modal's behaviour).
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="inline-flex size-10 items-center justify-center rounded-lg text-foreground hover:bg-subtle lg:hidden"
      >
        <Menu className="size-6" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={close}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm animate-fade-in flex-col bg-surface shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-display text-lg font-extrabold text-primary">
                {Constants.APP_NAME}
              </span>
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="inline-flex size-9 items-center justify-center rounded-lg text-foreground hover:bg-subtle"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {/* Account section */}
              {!authLoading && !isAuthenticated && (
                <Link
                  href="/login"
                  onClick={close}
                  className="mx-3 mb-2 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white"
                >
                  <UserIcon className="size-4" aria-hidden />
                  Login
                </Link>
              )}
              {isAuthenticated && (
                <div className="mb-1 px-4 py-2">
                  <p className="truncate text-sm font-extrabold text-foreground">
                    {user?.fullName?.trim() || user?.phone || 'Account'}
                  </p>
                  {user?.phone ? <p className="truncate text-xs text-muted">{user.phone}</p> : null}
                </div>
              )}

              <DrawerLink href="/account/orders" icon={<Package className="size-[18px]" />} onClick={close}>
                Orders
              </DrawerLink>
              <DrawerLink href="/account/wallet" icon={<Wallet className="size-[18px]" />} onClick={close}>
                Wallet
              </DrawerLink>
              <DrawerLink href="/wishlist" icon={<Heart className="size-[18px]" />} onClick={close}>
                Wishlist
              </DrawerLink>
              <DrawerLink href="/account/settings" icon={<Settings className="size-[18px]" />} onClick={close}>
                Settings
              </DrawerLink>

              {/* Categories */}
              <p className="px-4 pt-4 pb-1 text-[11px] font-extrabold uppercase tracking-wider text-faint">
                Shop by category
              </p>
              <ul>
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/category/${encodeURIComponent(c.name)}`}
                      onClick={close}
                      className="block px-4 py-2.5 text-sm font-medium text-foreground hover:bg-subtle"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {isAuthenticated && (
              <div className="border-t border-border p-3">
                <button
                  type="button"
                  onClick={async () => {
                    close();
                    await logout();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-error hover:bg-error-subtle"
                >
                  <LogOut className="size-[18px]" aria-hidden />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** One account row in the drawer. */
function DrawerLink({
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
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-subtle"
    >
      <span className="text-muted">{icon}</span>
      {children}
    </Link>
  );
}
