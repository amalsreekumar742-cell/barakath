import type { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileSearchPill } from './MobileSearchPill';
import { LoginSheet } from './LoginSheet';
import { getCategories, toNavCategories } from '@/lib/data/catalog';
import { getGeneralSettings } from '@/lib/data/settings';

/**
 * The storefront chrome, shared by the (shop), (checkout) and (account) route groups.
 *
 * WHY it exists: those three layouts were three copies of the same structure — the same
 * `Promise.all([getGeneralSettings(), getCategories()])`, the same Header/flex-1/Footer column. Any
 * change to the shell had to be made three times, and the mobile bottom nav would have been a fourth
 * and fifth thing to keep in step. One component means a route group opts into the whole shell,
 * mobile chrome included, by rendering it.
 *
 * WHY it stays a Server Component: it does the settings and category reads, and the header's
 * category links are exactly the navigation crawlers follow. Only the genuinely interactive pieces
 * inside it — the bottom nav, the login sheet — are client islands.
 *
 * WHY `has-mobile-nav` goes on the content wrapper rather than each page: the fixed nav bar covers
 * the bottom 60px of the viewport, and a page that forgets to account for it hides its own last row.
 * That failure is invisible on a desktop monitor, so it must not be something a page has to remember.
 * The class is a no-op above 1024px (see the media query in globals.css).
 */
export interface StorefrontShellProps {
  children: ReactNode;
  /**
   * Wraps `children` in the standard max-width container. Off by default because (shop) and
   * (checkout) pages set their own widths per screen; (account) uses it for the sidebar grid.
   */
  contentClassName?: string;
  /**
   * Shows the mobile logo + search pill above the content. On for the shopping surfaces; off for
   * (account), where the app equivalents are titled screens with no search.
   */
  mobileSearch?: boolean;
}

export async function StorefrontShell({
  children,
  contentClassName,
  mobileSearch = false,
}: StorefrontShellProps) {
  const [settings, categories] = await Promise.all([getGeneralSettings(), getCategories()]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header settings={settings} categories={toNavCategories(categories)} />
      {mobileSearch && <MobileSearchPill />}

      <div className={`has-mobile-nav flex-1 ${contentClassName ?? ''}`}>{children}</div>

      <Footer settings={settings} />

      {/* Mobile-only chrome. Both render nothing above 1024px. */}
      <MobileBottomNav />
      <LoginSheet />
    </div>
  );
}
