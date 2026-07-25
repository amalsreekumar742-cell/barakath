/**
 * Run one home-page section's data fetch, swallowing a failure into a fallback value instead of
 * letting it reject the page's `Promise.all`.
 *
 * WHY per-section isolation matters here specifically: the home page fans out FIVE independent
 * Firestore reads (hero banners, categories, flash sale, new arrivals) in one `Promise.all`. Without
 * this, a single failing read (a transient Firestore hiccup, a bad document) would reject the whole
 * `Promise.all` and blank the entire page — including the three sections that fetched fine. Wrapping
 * each section's promise means one section quietly disappears (its component already renders null for
 * an empty/falsy fallback) while the rest of the page renders normally.
 *
 * WHY logged via `console.error` rather than thrown further: this runs in a Server Component during
 * SSR/ISR — there is no error boundary above it that should trip for a partial, recoverable failure.
 * Next's server console is where an operator would look for "why is the flash sale rail missing".
 */
export async function safeSection<T>(promise: Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    console.error(`[home] ${label} failed, section will be skipped:`, error);
    return fallback;
  }
}
