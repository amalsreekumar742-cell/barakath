/**
 * ComingSoon — the placeholder every route ships with until its batch builds it.
 *
 * WHY a real component rather than inline markup per page: 26 placeholder pages that each
 * hand-roll their own markup are 26 files to find and delete later. One component means a
 * later session can grep a single import to see exactly which routes are still unbuilt.
 *
 * WHY placeholders at all: every link in the header, footer and mega menu has to resolve now,
 * or the four parallel Batch 1 sessions all trip over each other's 404s.
 */
export function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center px-5 text-center">
      <p className="text-xs font-semibold tracking-[0.18em] text-gold-strong uppercase">
        Barakath
      </p>
      <h1 className="mt-3 font-display text-2xl font-extrabold text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted">{note ?? 'This page is coming soon.'}</p>
    </main>
  );
}
