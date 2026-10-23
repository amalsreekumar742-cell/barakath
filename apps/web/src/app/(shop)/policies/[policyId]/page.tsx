import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { Breadcrumb } from '@/components/Breadcrumb';
import { EmptyState } from '@/components/EmptyState';
import { PolicyContent } from '@/components/PolicyContent';
import { Constants } from '@/config/constants';
import { buildMetadata } from '@/lib/seo';
import { getPolicy } from '@/lib/data/policies';

/**
 * /policies/[policyId] — one admin-authored policy (`policies/{id}`), rendered public.
 *
 * WHY a Server Component: the policy is world-readable store content with no user-specific data, so
 * rendering it on the server puts the full legal text in the crawled HTML (SEO + works with JS off).
 *
 * WHY a disabled policy 404s rather than showing "unavailable": `getPolicy` returns null for missing,
 * disabled and rule-denied reads alike — a policy the admin has switched off must not stay reachable at
 * a guessable URL. The two legacy URLs (/privacy-policy, /terms) redirect here by their fixed ids — see
 * `redirects()` in next.config.ts.
 *
 * WHY an enabled policy with empty content shows an EmptyState: the admin can create a policy before
 * writing it. Never fake legal copy — placeholder text on a terms page would be actively misleading.
 */
/** Same 300s ISR window as the catalog, as a literal — see lib/data/serverFirestore.ts. */
export const revalidate = 300;

interface PolicyPageProps {
  params: Promise<{ policyId: string }>;
}

export async function generateMetadata({ params }: PolicyPageProps): Promise<Metadata> {
  const { policyId } = await params;
  const policy = await getPolicy(policyId);
  if (!policy) notFound();

  return buildMetadata({
    title: policy.name,
    description: `${policy.name} — ${Constants.APP_NAME}.`,
    path: `/policies/${encodeURIComponent(policy.id)}`,
  });
}

export default async function PolicyPage({ params }: PolicyPageProps) {
  const { policyId } = await params;
  // `getPolicy` is request-cached, so this is the same read `generateMetadata` already made.
  const policy = await getPolicy(policyId);
  if (!policy) notFound();

  const html = policy.content?.trim();
  const updatedAt = policy.updatedAt?.toDate();

  return (
    <main className="mx-auto w-full max-w-[820px] px-5 pb-16">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Policies', href: '/policies' },
          { label: policy.name },
        ]}
      />
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
        {policy.name}
      </h1>

      {html ? (
        <>
          {updatedAt && (
            <p className="mt-1.5 text-xs font-medium text-faint">
              Last updated {format(updatedAt, 'd MMMM yyyy')}
            </p>
          )}
          <PolicyContent html={html} />
        </>
      ) : (
        <EmptyState title="This policy hasn't been published yet." />
      )}
    </main>
  );
}
