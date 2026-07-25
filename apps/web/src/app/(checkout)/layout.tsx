import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { getCategories, toNavCategories } from '@/lib/data/catalog';
import { getGeneralSettings } from '@/lib/data/settings';

/**
 * (checkout) — cart, order outcome, wishlist and spin. Storefront flows that belong to a PERSON.
 *
 * WHY a group of its own rather than folding these into (shop) or (account): they are not
 * indexable catalog, and they must not inherit the account sidebar that Batch 4 gives (account).
 * Route groups do not appear in the URL, so /cart stays /cart.
 *
 * WHY `noindex` on the group instead of per page: forgetting it on one page is how a cart URL with
 * a customer's items ends up in a search index. Declaring it once means a new page in this folder
 * is private by default — the safe direction to be wrong in.
 *
 * These pages still render the storefront chrome (a customer in the cart must be able to keep
 * shopping), so the layout reads the same server data (shop) does.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([getGeneralSettings(), getCategories()]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header settings={settings} categories={toNavCategories(categories)} />
      <div className="flex-1">{children}</div>
      <Footer settings={settings} />
    </div>
  );
}
