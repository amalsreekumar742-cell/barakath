/**
 * Skeleton primitives — the shapes every loading state is built from.
 *
 * WHY Tailwind rather than `react-loading-skeleton` (which is in package.json): these render inside
 * Server Components too, and the library needs a client context provider for its theme. A pulsing
 * div costs nothing, needs no provider, and keeps a skeleton usable anywhere. The library stays
 * available for the client-only screens that want its shimmer.
 *
 * WHY skeletons and never a centred spinner for content: a spinner tells the customer to wait; a
 * skeleton shaped like the real layout tells them WHAT is coming, and the page does not jump when it
 * arrives. Mandatory on every fetch (skill: Loading State Policy).
 *
 * WHY `aria-hidden` throughout: a screen reader announcing eight empty boxes is noise. The container
 * that owns the fetch should carry the `aria-busy`.
 */

/**
 * A single pulsing line of "text".
 *
 * WHY a `<span class="block">` and not a `<div>`: this stands in for TEXT, so it gets rendered
 * wherever text lives — including inside a `<p>` (e.g. `StatCard`'s value, which is a `ReactNode`).
 * A `<div>` inside a `<p>` is invalid HTML: the browser silently closes the paragraph early, so the
 * DOM it builds no longer matches the server's markup and React throws a hydration error. A `span`
 * is phrasing content and is legal in every one of those places, while `block` keeps it laying out
 * exactly as the div did.
 */
export function SkeletonText({
  width = 'w-full',
  className = '',
}: {
  width?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`block h-3 animate-pulse rounded-xs bg-border ${width} ${className}`}
    />
  );
}

/** One product card's silhouette: image, name, meta, price. */
export function SkeletonCard() {
  return (
    <div aria-hidden className="rounded-lg border border-border bg-surface p-3">
      <div className="aspect-square w-full animate-pulse rounded-md bg-border" />
      <div className="mt-3 space-y-2">
        <SkeletonText />
        <SkeletonText width="w-2/3" />
        <SkeletonText width="w-1/3" className="h-4" />
      </div>
    </div>
  );
}

/**
 * A grid of card skeletons matching the real grid's column counts.
 *
 * WHY the columns are a prop: the listing page is 4-up on desktop, search is 5-up and the wishlist
 * is 4-up. A skeleton with a different column count than the content that replaces it produces a
 * visible reflow, which is the one thing a skeleton exists to prevent.
 */
export function SkeletonGrid({
  count = 12,
  className = 'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
