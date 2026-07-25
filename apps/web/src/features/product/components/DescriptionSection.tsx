import DOMPurify from 'isomorphic-dompurify';

/**
 * Product description (spec §3.7). Reuses W2's exact sanitize-then-render pattern
 * (`src/app/(shop)/privacy-policy/page.tsx`) rather than a second sanitizer: `product.description` is
 * admin-authored but, like the legal pages, "admin-authored" is not "trusted at render" on a public
 * page — isomorphic-dompurify strips anything executable and leaves safe formatting markup. Works
 * identically whether the admin wrote rich HTML or plain text (plain text has no tags to strip).
 */
export function DescriptionSection({ description }: { description: string }) {
  const trimmed = description?.trim();
  if (!trimmed) return null;

  return (
    <section>
      <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
        Description
      </h2>
      <div
        className="mt-4 text-sm leading-7 text-muted [&_a]:text-primary [&_a]:underline [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
        // Safe: `trimmed` is run through DOMPurify.sanitize immediately above render — same pattern as
        // the privacy-policy / terms pages.
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(trimmed) }}
      />
    </section>
  );
}
