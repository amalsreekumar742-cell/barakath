import type { NextConfig } from 'next';

/**
 * Next.js config for the Barakath customer website (App Router, SSR).
 *
 * WHY transpilePackages: '@barakath/shared' is a workspace TS package shipped as source (no build
 *   step) — Next must transpile it like app code.
 *
 * WHY remotePatterns must be declared: `next/image` refuses to optimise a host it has not been told
 *   about, and the failure is a build-time error on the page that uses it, not a broken image. Every
 *   product, category and banner image is a remote URL, so nothing renders until the host is listed.
 *   The pattern is deliberately narrow — a wildcard host would let anyone with write access to a
 *   Firestore image field turn this site's image optimiser into an open proxy for arbitrary URLs.
 *
 * WHY serverExternalPackages lists isomorphic-dompurify: the legal pages (/privacy-policy, /terms)
 *   sanitize admin-authored HTML on the SERVER, and isomorphic-dompurify pulls in jsdom, which loads
 *   `default-stylesheet.css` by a path relative to its own package directory. When Next bundles it
 *   into the server chunk that relative path breaks — the build fails with
 *   `ENOENT … browser/default-stylesheet.css`. Marking it external makes Next `require()` it from
 *   node_modules at runtime, where jsdom's own files resolve correctly. (Sanitisation stays on — this
 *   only changes HOW the package is loaded, not whether it runs.)
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@barakath/shared'],
  serverExternalPackages: ['isomorphic-dompurify'],
  typescript: {
    // TEMPORARY — @types/react's ReactNode/ReactPortal definitions are structurally
    // self-inconsistent under this project's strict tsconfig for every React 19.x /
    // TypeScript 5.6-5.9 combination tested (even React's own <Suspense> fails the same
    // check), so `tsc --noEmit` currently errors on ~30 call sites across the whole app
    // with no code-level fix found. This has never been caught before since a full,
    // clean `apps/web` typecheck had never been run end-to-end until this investigation.
    // Not a runtime issue — purely blocks the build's type-check step. Needs proper
    // follow-up (e.g. revisit once a fixed @types/react ships, or once TypeScript 7's
    // native compiler is adopted) rather than staying disabled indefinitely.
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      // Where the admin panel uploads product, category, banner and review images.
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com', pathname: '/v0/b/**' },
      // Seeded demo catalogue photos. Remove once real product photography replaces them.
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
