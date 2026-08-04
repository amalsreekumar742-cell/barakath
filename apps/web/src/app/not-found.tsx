import Link from 'next/link';
import Image from 'next/image';
import { SearchX } from 'lucide-react';
import { Constants } from '@/config/constants';

/**
 * The 404 screen.
 *
 * WHY it exists: Next's built-in not-found page sits OUTSIDE every route group, so it inherits only
 * the root layout — no header, no footer, and (once the mobile nav moved into the group shells) no
 * navigation at all. A phone visitor who mistyped a URL or followed a stale link landed on a bare
 * "page could not be found" with no way back into the site.
 *
 * WHY it does NOT render `StorefrontShell`: the shell awaits `getGeneralSettings()` and
 * `getCategories()`. The root not-found renders for every unmatched request and is also what Next
 * builds as the `/_not-found` route, so putting two Firestore reads behind it makes the cheapest
 * possible response one of the most expensive — and a data error inside the component that HANDLES
 * errors is a bad failure mode (it wedged the dev server when first tried this way). A 404 needs a
 * brand mark and a way out, both of which are static.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-app">
      <div className="flex items-center gap-3 px-4 pt-3">
        <Link
          href="/"
          aria-label={`${Constants.APP_NAME} home`}
          className="-mx-2 inline-flex h-11 items-center px-2"
        >
          <Image
            src="/logo.png"
            alt={Constants.APP_NAME}
            width={40}
            height={76}
            className="h-8 w-auto object-contain"
          />
        </Link>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <span
          className="mb-5 inline-flex size-[88px] items-center justify-center rounded-full bg-subtle text-muted"
          aria-hidden
        >
          <SearchX className="size-10" />
        </span>

        <h1 className="text-xl font-extrabold tracking-[-0.4px] text-foreground">Page not found</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The page you are looking for doesn&apos;t exist or may have moved.
        </p>

        <div className="mt-7 flex w-full flex-col gap-2.5">
          <Link
            href="/"
            className="inline-flex h-[52px] w-full items-center justify-center rounded-md bg-gold text-base font-medium text-ink transition hover:bg-gold-strong hover:text-white lg:h-12"
          >
            Back to home
          </Link>
          <Link
            href="/categories"
            className="inline-flex h-[52px] w-full items-center justify-center rounded-md border border-border-strong bg-surface text-base font-medium text-foreground transition hover:bg-subtle lg:h-12"
          >
            Browse categories
          </Link>
        </div>
      </div>
    </div>
  );
}
