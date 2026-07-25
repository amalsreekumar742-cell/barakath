import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { getCategories, toNavCategories } from '@/lib/data/catalog';
import { getGeneralSettings } from '@/lib/data/settings';
import { AccountSidebar } from '@/features/account/components/AccountSidebar';

/**
 * (account) — everything under /account. Signed-in, per-user, never indexed.
 *
 * WHY the sidebar lives HERE and not in a nested layout: only `account/` sits inside this route
 * group (`(checkout)` owns cart/wishlist/spin-win, `(shop)` owns the catalog), so this layout already
 * scopes exactly to /account/* — a second nested layout one level down would add a file with no
 * routes it doesn't already cover. Batch 4 (D0) fills in the two-column shell the group's own comment
 * originally deferred.
 *
 * WHY `noindex` at the group level: see (checkout). Order history and wallet balances must never be
 * crawlable, and a rule that a new page has to remember is a rule that will eventually be forgotten.
 *
 * WHY no auth check here: `src/middleware.ts` already rejects a signed-out visitor before this
 * layout renders. Duplicating the check would mean two places to keep in step, and the middleware
 * is the one that can redirect without a flash of protected content.
 *
 * WHY the two-column split lives in THIS file rather than inside `AccountSidebar`: the sidebar
 * component owns its own two responsive renderings (desktop `<aside>`, mobile tab strip — see that
 * file), but the grid that reserves a fixed-width column for it at >=1024px is layout-shell concern,
 * not the sidebar's own. `AccountSidebar` stays draggable into a different shell layout unchanged.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([getGeneralSettings(), getCategories()]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header settings={settings} categories={toNavCategories(categories)} />
      <div className="mx-auto w-full max-w-7xl flex-1 px-5 py-6">
        <div className="lg:grid lg:grid-cols-[260px_1fr] lg:items-start lg:gap-8">
          <AccountSidebar />
          <div className="mt-4 min-w-0 lg:mt-0">{children}</div>
        </div>
      </div>
      <Footer settings={settings} />
    </div>
  );
}
