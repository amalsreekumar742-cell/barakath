import type { Metadata } from 'next';
import { format } from 'date-fns';
import DOMPurify from 'isomorphic-dompurify';
import { Breadcrumb } from '@/components/Breadcrumb';
import { EmptyState } from '@/components/EmptyState';
import { getGeneralSettings } from '@/lib/data/settings';

/**
 * Privacy policy (spec 3.19) — the admin-authored HTML from `general/config.privacy`, rendered public.
 *
 * WHY a Server Component: the policy is world-readable store config with no user-specific data, so
 * rendering it on the server puts the full legal text in the crawled HTML (SEO + it works with JS off).
 *
 * WHY the HTML is sanitized before render: `privacyPolicy` is authored in the admin's React Quill
 * editor and stored as raw HTML. It is admin-authored, but "admin-authored" is not "trusted at render"
 * — a compromised or careless admin account could store a <script>/onerror payload, and this page is
 * public. isomorphic-dompurify strips anything executable, leaving only safe formatting markup.
 *
 * WHY graceful degradation instead of mock text: the live document has no `privacy` map yet, so an
 * empty/missing policy shows an EmptyState rather than the design's placeholder prose — never fake
 * legal copy, which would be actively misleading.
 */
export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Barakath collects, uses and protects your personal information.',
};

export default async function Page() {
  const settings = await getGeneralSettings();
  const rawHtml = settings?.privacy?.privacyPolicy?.trim();
  const updatedAt = settings?.privacy?.privacyPolicyUpdatedAt;

  return (
    <main className="mx-auto w-full max-w-[820px] px-5 pb-16">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Privacy policy' }]} />
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
        Privacy policy
      </h1>

      {rawHtml ? (
        <>
          {updatedAt && (
            <p className="mt-1.5 text-xs font-medium text-faint">
              Last updated {format(updatedAt.toDate(), 'd MMMM yyyy')}
            </p>
          )}
          <div
            className="mt-6 text-sm leading-7 text-muted [&_a]:text-primary [&_a]:underline [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
            // Safe: rawHtml is run through DOMPurify.sanitize immediately above render, stripping any
            // script/handler payload an admin account could have stored.
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rawHtml) }}
          />
        </>
      ) : (
        <EmptyState title="This policy hasn't been published yet." />
      )}
    </main>
  );
}
