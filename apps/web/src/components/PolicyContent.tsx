import DOMPurify from 'isomorphic-dompurify';

/**
 * PolicyContent — renders one policy's admin-authored rich-text HTML (`policies/{id}.content`).
 *
 * WHY the HTML is sanitized before render: the content is authored in the admin's React Quill editor and
 * stored as raw HTML. It is admin-authored, but "admin-authored" is not "trusted at render" — a
 * compromised or careless admin account could store a <script>/onerror payload, and policy pages are
 * public. isomorphic-dompurify strips anything executable, leaving only safe formatting markup.
 *
 * WHY a Server Component: sanitising on the server keeps jsdom out of the browser bundle and puts the
 * full legal text in the crawled HTML (see `serverExternalPackages` in next.config.ts for how
 * isomorphic-dompurify is loaded there).
 *
 * WHY the styling is arbitrary-variant selectors (`[&_h2]:…`) rather than a typography plugin: Quill
 * emits bare h2/h3/p/ul/ol/a with no classes, and these few rules are all it needs to read like the rest
 * of the storefront — not worth a plugin for one block.
 */
export interface PolicyContentProps {
  /** Raw (unsanitized) HTML. */
  html: string;
}

export function PolicyContent({ html }: PolicyContentProps) {
  return (
    <div
      className="mt-6 text-sm leading-7 text-muted [&_a]:text-primary [&_a]:underline [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
      // Safe: `html` is run through DOMPurify.sanitize right here, stripping any script/handler payload
      // an admin account could have stored.
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  );
}
