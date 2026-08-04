import Link from 'next/link';
import Image from 'next/image';
import type { GeneralSettingsProps } from '@barakath/shared';
import { Constants } from '@/config/constants';
import type { NavCategory } from '@/lib/data/catalog';
import { SearchBar } from './header/SearchBar';
import { MegaMenu } from './header/MegaMenu';
import { AccountMenu } from './header/AccountMenu';
import { CartButton } from './header/CartButton';
import { WishlistButton } from './header/WishlistButton';
import { WalletButton } from './header/WalletButton';

/**
 * The sticky storefront header (spec 3.1).
 *
 * WHY it stays a Server Component: the header is on every indexable page, and its category links are
 * exactly the navigation search engines follow. Rendering the shell on the server keeps that nav in
 * the crawled HTML. Only the parts that genuinely need the browser — the search box, the account
 * menu, the cart/wishlist badges, the mobile drawer, the mega-menu flyout — are `'use client'`
 * islands imported here; the frame around them is server HTML.
 *
 * WHY `settings` is accepted but not read: `general/config` carries no business-name or logo field
 * (not in `GeneralSettingsProps`, not in the live document). The brand mark is the same static
 * `logo.png` lockup `apps/admin`'s sidebar and `apps/app`'s splash use (`public/logo.png` here — no
 * per-tenant logo exists to fetch). The prop stays on the contract because the layout already fetches
 * settings for the footer and a later logo/name field would land here without changing the layout.
 *
 * WHY the reads are NOT done here: `settings` and `categories` are fetched once by the (shop) layout
 * and passed down, so the header never re-reads them per page and never has to become a client
 * component to fetch its own nav.
 */
export interface HeaderProps {
  settings: GeneralSettingsProps | null;
  categories: NavCategory[];
}

export function Header({ categories }: HeaderProps) {
  return (
    // Desktop only. Below 1024px the site adopts the Flutter app's model, where there is no global
    // header at all — each screen owns its top area (a greeting bar on home, a circular back button
    // and title on pushed screens, nothing on listing and search). Keeping this bar on a phone cost
    // ~116px of permanently sticky height and duplicated navigation the bottom tab bar now provides.
    // It stays in the DOM rather than being conditionally rendered so its category links remain in
    // the server HTML for crawlers under mobile-first indexing.
    <header className="sticky top-0 z-40 hidden border-b border-border bg-surface lg:block">
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-5">
        <div className="flex h-16 items-center gap-3 lg:gap-5">
          <Link href="/" aria-label={`${Constants.APP_NAME} home`} className="shrink-0">
            <Image src="/logo.png" alt={Constants.APP_NAME} width={40} height={76} priority className="h-9 w-auto object-contain" />
          </Link>

          <MegaMenu categories={categories} />

          <div className="flex-1 md:max-w-[460px]">
            <SearchBar categories={categories} />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <WishlistButton />
            <WalletButton />
            <CartButton />
            <AccountMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
