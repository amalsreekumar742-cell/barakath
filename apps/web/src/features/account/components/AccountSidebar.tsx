'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  HandCoins,
  Heart,
  LogOut,
  MapPin,
  Package,
  Settings,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useAppSelector } from '@/stores/store';
import { LogoutDialog } from './LogoutDialog';

/**
 * The account navigation (spec 3.10) — a persistent sidebar at >=1024px, a horizontal scrolling tab
 * strip below it. One shared `NAV_ITEMS` list drives both renderings so they can never drift apart.
 *
 * WHY "Affiliate Wallet" is filtered here rather than passed a boolean prop: the brief describes the
 * gate as `users/{uid}.isAffiliate === true`, but `UserProps` (packages/shared/src/types/user.ts) has
 * no `isAffiliate` field at all — only `affiliateCode: string`. The Flutter app's own entity defines
 * `isAffiliate => affiliateCode.trim().isNotEmpty` (`apps/app/lib/features/auth/domain/entities/
 * user.dart`) and every other surface (the spinner audience gate, the profile affiliate banner) keys
 * off that same non-empty check — so this sidebar matches it instead of a field that doesn't exist.
 *
 * WHY the profile block reads `s.auth.user` directly: `AuthListener` already keeps `users/{uid}` live
 * in Redux (an admin credit or a profile edit elsewhere updates it with no refetch) — a second fetch
 * here would just be a slower, stale copy of state the app already has.
 *
 * WHY `profileImage`, not `profilePhoto`: same reasoning as the affiliate gate — `UserProps` and the
 * real anonymise-on-delete write (WEB_BATCH4_NOTES.md §2) both use `profileImage`. `profilePhoto` (the
 * brief's field name, taken from spec §4.9) does not exist on the deployed document.
 */
interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Rendered only when the signed-in user is an affiliate (non-empty `affiliateCode`). */
  affiliateOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/account/orders', label: 'My Orders', icon: Package },
  { href: '/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/wallet', label: 'Wallet', icon: Wallet },
  { href: '/account/affiliate-wallet', label: 'Affiliate Wallet', icon: HandCoins, affiliateOnly: true },
  { href: '/account/addresses', label: 'Saved Addresses', icon: MapPin },
  { href: '/account/notifications', label: 'Notifications', icon: Bell },
  { href: '/account/settings', label: 'Settings', icon: Settings },
];

/** The current route "owns" a nav item if it matches exactly or sits under it (e.g. an order detail
 *  page still highlights "My Orders", `/account/wallet/coupons` still highlights "Wallet"). */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountSidebar() {
  const pathname = usePathname();
  const user = useAppSelector((s) => s.auth.user);
  const authLoading = useAppSelector((s) => s.auth.authLoading);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const isAffiliate = Boolean(user?.affiliateCode?.trim());
  const items = NAV_ITEMS.filter((item) => !item.affiliateOnly || isAffiliate);

  const displayName = user?.fullName?.trim() || user?.phone || 'My account';
  const initial = (user?.fullName?.trim()?.[0] ?? user?.phone?.[0] ?? 'B').toUpperCase();

  return (
    <>
      {/* Desktop / tablet-large: persistent left sidebar. */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-2xl border border-border bg-surface p-4">
          <ProfileBlock
            loading={authLoading}
            displayName={displayName}
            phone={user?.phone}
            profileImage={user?.profileImage}
            initial={initial}
          />

          <nav className="mt-4 flex flex-col gap-1">
            {items.map((item) => (
              <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-error hover:bg-error-subtle"
            >
              <LogOut size={18} aria-hidden />
              Logout
            </button>
          </nav>
        </div>
      </aside>

      {/*
        There is deliberately NO mobile rendering.

        This component used to also emit a compact profile row plus a horizontal scrolling pill strip
        below 1024px. That existed because a phone had no other way to move between account sections.
        It now duplicates the app shell: Wallet and Profile are bottom-nav tabs, and every remaining
        destination (orders, wishlist, addresses, notifications, settings, affiliate wallet, logout)
        is a row on the Profile screen — `features/account/components/ProfileScreen.tsx`, which mirrors
        `apps/app/lib/features/profile/presentation/pages/profile_page.dart`.

        Keeping both meant every account page opened with a redundant identity card and a strip of
        chips restating the navigation already pinned to the bottom of the screen. The Flutter app has
        no such strip, and neither should the mobile web.
      */}

      <LogoutDialog isOpen={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
        active ? 'bg-primary-subtle text-primary' : 'text-foreground hover:bg-subtle'
      }`}
    >
      <item.icon size={18} aria-hidden />
      {item.label}
    </Link>
  );
}

function ProfileBlock({
  loading,
  displayName,
  phone,
  profileImage,
  initial,
}: {
  loading: boolean;
  displayName: string;
  phone?: string;
  profileImage?: string;
  initial: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 border-b border-border pb-4" aria-busy="true">
        <div className="size-12 animate-pulse rounded-full bg-subtle" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 animate-pulse rounded-xs bg-subtle" />
          <div className="h-2.5 w-16 animate-pulse rounded-xs bg-subtle" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-border pb-4">
      <Avatar profileImage={profileImage} initial={initial} size={48} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
        {phone && <p className="truncate text-xs text-muted">{phone}</p>}
      </div>
    </div>
  );
}

/**
 * `users/{uid}.profileImage` when present, else initials on a coloured background — the website has
 * no profile-photo upload of its own (spec §3.19 omits it entirely; a photo can only ever arrive here
 * via the app), so this is deliberately display-only.
 */
function Avatar({ profileImage, initial, size }: { profileImage?: string; initial: string; size: number }) {
  if (profileImage) {
    // A user-supplied external Storage URL — the Next.js Image optimizer would need every possible
    // Storage host allow-listed for one small avatar, so a plain <img> is the pragmatic choice here.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profileImage}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark font-display font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initial}
    </div>
  );
}
