import Link from 'next/link';
import type { Metadata } from 'next';
import { format } from 'date-fns';
import { ChevronRight, FileText } from 'lucide-react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { EmptyState } from '@/components/EmptyState';
import { buildMetadata } from '@/lib/seo';
import { getEnabledPolicies } from '@/lib/data/policies';

/**
 * /policies — every policy the admin has enabled (Settings › Policies), in the admin's order.
 *
 * WHY an index page at all: the admin can publish any number of policies (privacy, terms, refund,
 * shipping…), so the mobile Profile tab and the account Settings page link here once instead of
 * hard-coding a row per policy that would go stale the moment a new one is added. The desktop footer
 * lists them directly as well.
 *
 * WHY a Server Component: the list is public store content — server rendering puts every policy link in
 * the crawled HTML. The collection may legitimately be empty (before the migration from
 * `general/config` has run, or if every policy is disabled), so that case is an EmptyState, never
 * placeholder legal copy.
 */
/** Same 300s ISR window as the catalog, as a literal — see lib/data/serverFirestore.ts. */
export const revalidate = 300;

export const metadata: Metadata = buildMetadata({
  title: 'Policies',
  description: 'Barakath store policies — privacy, terms and how we handle your orders.',
  path: '/policies',
});

export default async function PoliciesPage() {
  const policies = await getEnabledPolicies();

  return (
    <main className="mx-auto w-full max-w-[820px] px-5 pb-16">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Policies' }]} />
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
        Policies
      </h1>

      {policies.length > 0 ? (
        // Same grouped-card rows as the mobile Profile menu, so following "Policies" from there lands
        // on a list that looks like a continuation of it.
        <ul className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
          {policies.map((policy, i) => {
            const updatedAt = policy.updatedAt?.toDate();
            return (
              <li key={policy.id} className={i > 0 ? 'border-t border-border' : undefined}>
                <Link
                  href={`/policies/${encodeURIComponent(policy.id)}`}
                  className="flex items-center gap-3 px-4 py-[15px] transition hover:bg-subtle"
                >
                  <FileText className="size-5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {policy.name}
                    </span>
                    {updatedAt && (
                      <span className="block text-xs text-faint">
                        Last updated {format(updatedAt, 'd MMMM yyyy')}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="size-[18px] shrink-0 text-faint" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={<FileText className="size-12" aria-hidden />}
          title="No policies published yet."
          subtitle="Check back soon."
        />
      )}
    </main>
  );
}
