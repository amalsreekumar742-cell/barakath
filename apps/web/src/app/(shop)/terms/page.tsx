import type { Metadata } from 'next';
import { format } from 'date-fns';
import DOMPurify from 'isomorphic-dompurify';
import { Breadcrumb } from '@/components/Breadcrumb';
import { EmptyState } from '@/components/EmptyState';
import { getGeneralSettings } from '@/lib/data/settings';

/**
 * Terms & conditions (spec 3.19) — the admin-authored HTML from `general/config.terms`, rendered public.
 *
 * WHY a Server Component: the terms are world-readable store config with no user-specific data, so
 * server rendering puts the full legal text in the crawled HTML (SEO + works with JS off).
 *
 * WHY the HTML is sanitized before render: `termsAndConditions` is authored in the admin's React Quill
 * editor and stored as raw HTML. Admin-authored is not trusted-at-render — this page is public, so
 * isomorphic-dompurify strips any executable payload and leaves only safe formatting markup.
 *
 * WHY graceful degradation instead of mock text: the live document has no `terms` map yet, so an
 * empty/missing value shows an EmptyState rather than fake legal copy, which would mislead.
 */
export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: "The terms that govern your use of Barakath's platform, orders and rewards.",
};

export default async function Page() {
  const settings = await getGeneralSettings();
  const rawHtml = settings?.terms?.termsAndConditions?.trim();
  const updatedAt = settings?.terms?.termsUpdatedAt;

  return (
    <main className="mx-auto w-full max-w-[820px] px-5 pb-16">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Terms & conditions' }]} />
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
        Terms &amp; conditions
      </h1>

      {rawHtml ? (
        <>
          {updatedAt && (
            <p className="mt-1.5 text-xs font-medium text-faint">
              Last updated {format(updatedAt.toDate(), 'd MMMM yyyy')}
            </p>
          )}
          <div
            className="mt-6 text-sm leading-7 text-muted [&_a]:text-primary [&_a]:underline [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-extrabold [&_h3]:text-foreground [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
            // Safe: rawHtml is run through DOMPurify.sanitize immediately above render, stripping any
            // script/handler payload an admin account could have stored.
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rawHtml) }}
          />
        </>
      ) : (
        <EmptyState title="These terms haven't been published yet." />
      )}
    </main>
  );
}
