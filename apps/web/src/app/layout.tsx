import type { Metadata } from 'next';
import { Providers } from './providers';
import { Constants } from '@/config/constants';
import './globals.css';

/**
 * Root layout — wraps every route in every group.
 *
 * WHY it holds no Header or Footer: the four route groups want different chrome (the storefront has
 * both, /login has neither, the account area gets a sidebar in Batch 4). Each group layout composes
 * its own. See src/app/README.md.
 *
 * WHY Providers here: Redux and the toast container are client-only context that must be mounted
 * exactly once. Keeping that island at the root — and small — lets every page inside it stay a
 * Server Component, which is what the catalog's SEO depends on.
 */
export const metadata: Metadata = {
  /**
   * `%s` is filled by each page's own title; `default` covers routes that set none.
   * WHY a template rather than repeating the brand per page: 26 pages each hand-writing
   * "… | Barakath" is 26 chances to spell it differently.
   */
  title: {
    default: `${Constants.APP_NAME} — Perfumes, Books, Clothing & Islamic Essentials`,
    template: `%s | ${Constants.APP_NAME}`,
  },
  description:
    'Shop premium perfumes, books, clothing and Islamic essentials at Barakath. ' +
    'Fast delivery across India.',
  applicationName: Constants.APP_NAME,
  icons: {
    icon: '/logo.png',
  },
  openGraph: {
    type: 'website',
    siteName: Constants.APP_NAME,
    locale: 'en_IN',
  },
  /**
   * WHY metadataBase: without it Next cannot resolve a relative og:image into the absolute URL that
   * WhatsApp and Twitter require, and link previews silently lose their image. Left undefined when
   * the site URL is not configured, which downgrades previews rather than failing the build.
   */
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
