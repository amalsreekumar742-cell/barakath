import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { Providers } from './providers';
import { Constants } from '@/config/constants';
import './globals.css';

/**
 * Manrope — the one brand typeface, shared with the admin panel and the Flutter app.
 *
 * WHY next/font rather than a <link> to Google Fonts: it self-hosts the files at build time, so
 * there is no third-party round-trip on first paint and no layout shift from a late swap. The
 * `variable` is bound to `--font-sans` in the body className below, which is the token every
 * Tailwind `font-sans` utility already resolves through — so this wires the whole design system's
 * typography up in one place without touching a single component.
 *
 * WHY 400-800: the design uses 400 (body), 500/600 (labels, nav), 700 (titles) and 800 (prices,
 * headings, big numbers). Loading the variable range covers all of them in one file.
 */
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-manrope',
});

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

/**
 * Viewport — the mobile app shell depends on both of these.
 *
 * WHY `viewportFit: 'cover'` specifically: `env(safe-area-inset-*)` resolves to 0 on every browser
 * unless the viewport is declared cover. Without it the fixed bottom nav renders UNDER the iPhone
 * home indicator and its right-hand tab becomes hard to hit. The safe-area padding in globals.css
 * and this flag are one mechanism in two files — changing either alone breaks it silently, and only
 * on physical hardware.
 *
 * `themeColor` matches `--color-app`, so the iOS/Android browser chrome blends into the page
 * background instead of framing it in white.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fcfcfb',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
