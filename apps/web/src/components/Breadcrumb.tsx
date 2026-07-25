import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

/**
 * The breadcrumb trail (spec 3.24) — on nearly every page below the header.
 *
 * WHY it also emits JSON-LD `BreadcrumbList`: this is a catalog site whose category and product
 * pages are the ones that need to rank. Google renders a breadcrumb trail in the result instead of
 * a bare URL when the structured data is present, which is free click-through on exactly the pages
 * that matter. The visible markup alone does not qualify.
 *
 * WHY the last crumb is not a link: it is the page you are on. Making it clickable produces a link
 * to itself, which screen readers announce and search engines treat as a self-referencing loop.
 *
 * WHY this is a Server Component (no 'use client'): it is static markup, and keeping it on the
 * server means the trail — and its JSON-LD — are in the crawled HTML.
 */
export interface Crumb {
  label: string;
  /** Omitted on the final crumb, which is the current page. */
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${siteUrl}${item.href}` } : {}),
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className="py-3">
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="size-3.5 text-faint" aria-hidden />}
              {isLast || !item.href ? (
                <span className="font-bold text-foreground" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="hover:text-primary hover:underline">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <script
        type="application/ld+json"
        // Safe: every value is our own label/href, never user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </nav>
  );
}
