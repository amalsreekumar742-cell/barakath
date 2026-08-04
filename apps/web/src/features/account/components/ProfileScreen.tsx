'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Bell,
  ChevronRight,
  FileText,
  HandCoins,
  Heart,
  LifeBuoy,
  LogOut,
  MapPin,
  Package,
  Settings,
  Shield,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useAppSelector } from '@/stores/store';
import { LogoutDialog } from './LogoutDialog';

/**
 * The Profile screen — the bottom nav's fifth tab, mirroring
 * `apps/app/lib/features/profile/presentation/pages/profile_page.dart`.
 *
 * Layout follows the app: an avatar/name header, then grouped menu cards with hairline dividers,
 * then a red log-out row.
 *
 * WHY the legal links are here rather than only in the footer: the site footer is desktop-only now
 * (the Flutter app has no footer, and keeping one under a bottom tab bar reads as dead space), so
 * privacy policy and terms would otherwise be unreachable on a phone. The app puts them under
 * Profile for the same reason, so this is the arrangement customers of both surfaces already know.
 *
 * WHY the affiliate entry is gated on a non-empty `affiliateCode`: `UserProps` has no `isAffiliate`
 * field — the Flutter entity derives it as `affiliateCode.trim().isNotEmpty`, and `AccountSidebar`
 * already uses that same check. Keeping the two identical means the affiliate wallet appears in both
 * places or neither.
 */

interface MenuLink {
  href: string;
  label: string;
  icon: LucideIcon;
  affiliateOnly?: boolean;
}

const PRIMARY_LINKS: MenuLink[] = [
  { href: '/account/orders', label: 'My orders', icon: Package },
  { href: '/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/account/wallet', label: 'Wallet', icon: Wallet },
  { href: '/account/affiliate-wallet', label: 'Affiliate wallet', icon: HandCoins, affiliateOnly: true },
  { href: '/account/addresses', label: 'Saved addresses', icon: MapPin },
  { href: '/spin-win', label: 'Spin & Win', icon: Sparkles },
];

const SECONDARY_LINKS: MenuLink[] = [
  { href: '/account/notifications', label: 'Notifications', icon: Bell },
  { href: '/account/settings', label: 'Settings', icon: Settings },
  { href: '/privacy-policy', label: 'Privacy policy', icon: Shield },
  { href: '/terms', label: 'Terms & conditions', icon: FileText },
];

function MenuCard({ links }: { links: MenuLink[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {links.map((link, i) => {
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-3 px-4 py-[15px] transition hover:bg-subtle ${
              i > 0 ? 'border-t border-border' : ''
            }`}
          >
            <Icon className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
              {link.label}
            </span>
            <ChevronRight className="size-[18px] shrink-0 text-faint" aria-hidden />
          </Link>
        );
      })}
    </div>
  );
}

export function ProfileScreen() {
  const user = useAppSelector((s) => s.auth.user);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const isAffiliate = Boolean(user?.affiliateCode?.trim());
  const primary = PRIMARY_LINKS.filter((l) => !l.affiliateOnly || isAffiliate);

  const displayName = user?.fullName?.trim() || 'My account';
  const subtitle = user?.email?.trim() || user?.phone || '';
  const initial = (user?.fullName?.trim()?.[0] ?? user?.phone?.[0] ?? 'B').toUpperCase();

  return (
    <div className="space-y-4">
      {/* Header — 64px avatar, name, contact line, edit link. */}
      <div className="flex items-center gap-3.5">
        <span className="relative inline-flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary-dark">
          {user?.profileImage ? (
            <Image src={user.profileImage} alt="" fill sizes="64px" className="object-cover" />
          ) : (
            <span className="text-2xl font-extrabold text-white">{initial}</span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold tracking-[-0.4px] text-foreground">
            {displayName}
          </h1>
          {subtitle && <p className="truncate text-[13px] text-muted">{subtitle}</p>}
        </div>

        <Link
          href="/account/settings"
          className="shrink-0 rounded-md px-3 py-2 text-[13px] font-bold text-primary transition hover:bg-primary-subtle"
        >
          Edit
        </Link>
      </div>

      <MenuCard links={primary} />
      <MenuCard links={SECONDARY_LINKS} />

      {/* Help sits on its own because it is an outbound mailto, not an in-app route. */}
      <a
        href="mailto:support@barakath.in"
        className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-[15px] transition hover:bg-subtle"
      >
        <LifeBuoy className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          Help &amp; support
        </span>
        <ChevronRight className="size-[18px] shrink-0 text-faint" aria-hidden />
      </a>

      <button
        type="button"
        onClick={() => setLogoutOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-error transition hover:bg-error-subtle"
      >
        <LogOut className="size-5" aria-hidden />
        Log out
      </button>

      <LogoutDialog isOpen={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </div>
  );
}
