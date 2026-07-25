/**
 * PostCSS config for Tailwind CSS v4 in Next.js.
 * WHY @tailwindcss/postcss: Next.js processes global CSS through PostCSS — Tailwind v4's PostCSS
 *   plugin is the supported integration for the Next.js App Router (the Vite plugin is Vite-only).
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
