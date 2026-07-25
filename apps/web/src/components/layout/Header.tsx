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
import { MobileNav } from './header/MobileNav';

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
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-5">
        {/* Primary row */}
        <div className="flex h-16 items-center gap-3 lg:gap-5">
          <MobileNav categories={categories} />

          <Link href="/" aria-label={`${Constants.APP_NAME} home`} className="shrink-0">
            <Image src="/logo.png" alt={Constants.APP_NAME} width={40} height={76} priority className="h-9 w-auto object-contain" />
          </Link>

          <MegaMenu categories={categories} />

          {/* Inline search on tablet/desktop; a full-width row below on phones. */}
          <div className="hidden flex-1 md:block md:max-w-[460px]">
            <SearchBar categories={categories} />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <span className="hidden sm:inline-flex">
              <WishlistButton />
            </span>
            <WalletButton />
            <CartButton />
            <AccountMenu />
          </div>
        </div>

        {/* Phone search row */}
        <div className="pb-3 md:hidden">
          <SearchBar categories={categories} />
        </div>
      </div>
    </header>
  );
}
