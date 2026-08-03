import Link from 'next/link';
import Image from 'next/image';
import { Mail, MessageCircle, Phone } from 'lucide-react';
import type { GeneralSettingsProps } from '@barakath/shared';
import { Constants } from '@/config/constants';

/**
 * Footer — the storefront's four-column footer (spec 3.2), rendered on every (shop)/(checkout)/
 * (account) page from the group layout.
 *
 * WHY a Server Component (no 'use client'): it is static chrome plus a handful of external links; the
 * `settings` it needs are already read once in the group layout and handed down, so the footer never
 * fetches and its links land in the crawled HTML.
 *
 * WHY every `settings` access is optional-chained: the live `general/config` document currently has
 * NO `contactus` map (only variables/delivery/payment/updatedAt), even though the TYPE declares it.
 * The Support column therefore degrades to "coming soon" rather than rendering `undefined` — the
 * graceful-degradation rule, never fake data.
 */
export interface FooterProps {
  settings: GeneralSettingsProps | null;
}

/** A single Shop / Legal link — kept as data so the two columns render from one map each. */
interface FooterLink {
  label: string;
  href: string;
}

const SHOP_LINKS: FooterLink[] = [
  { label: 'All categories', href: '/categories' },
  { label: 'Search', href: '/search' },
  { label: 'Wishlist', href: '/wishlist' },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: 'Privacy policy', href: '/privacy-policy' },
  { label: 'Terms & conditions', href: '/terms' },
];

/**
 * `tel:` accepts a leading `+` and digits only — a space or bracket in the URI makes some
 * browsers drop the link entirely. Admins type support numbers free-form (e.g. "+91 8590 941583"),
 * so strip the formatting for the href while the visible text keeps it.
 */
const telHref = (raw: string) => raw.replace(/[^\d+]/g, '');

export function Footer({ settings }: FooterProps) {
  const contact = settings?.contactus;
  // Trim so a whitespace-only value counts as empty — the admin form can save " " for an untouched
  // field, and a blank "Call us" row is worse than no row.
  const phone = contact?.helpPhone?.trim();
  const whatsApp = contact?.helpWhatsApp?.trim();
  const email = contact?.helpEmail?.trim();
  const hasAnySupport = Boolean(phone || whatsApp || email);

  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 bg-primary-dark text-white">
      {/* `md:`/`lg:` only, never `sm:` mixed in here — see ProductRail.tsx for why mixing them
          silently breaks the cascade in this build's compiled Tailwind stylesheet. */}
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-12 md:grid-cols-2 lg:grid-cols-4">
        {/* Brand blurb */}
        <div className="max-w-xs">
          {/* `brightness-0 invert` renders the gold+cream logo as a flat white silhouette, matching the
              design's dark-footer treatment (`filter:brightness(0) invert(1)` in the mockup). */}
          <Image
            src="/logo.png"
            alt={Constants.APP_NAME}
            width={40}
            height={76}
            className="h-10 w-auto object-contain brightness-0 invert"
          />
          <p className="mt-4 text-[13px] leading-relaxed text-white/70">
            Premium multi-category commerce — perfumes, books, clothing and Islamic essentials,
            delivered with barakah.
          </p>
        </div>

        {/* Shop / quick links */}
        <nav aria-label="Shop">
          <h2 className="text-[13px] font-semibold text-white">Shop</h2>
          <ul className="mt-3 space-y-2.5 text-[13px] text-white/72">
            {SHOP_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Support — from settings.contactus, each row omitted when empty */}
        <div>
          <h2 className="text-[13px] font-semibold text-white">Support</h2>
          {hasAnySupport ? (
            <ul className="mt-3 space-y-2.5 text-[13px] text-white/72">
              {phone && (
                <li>
                  <a
                    href={`tel:${telHref(phone)}`}
                    className="inline-flex items-center gap-2 transition-colors hover:text-white"
                  >
                    <Phone className="size-4 shrink-0" aria-hidden />
                    {phone}
                  </a>
                </li>
              )}
              {whatsApp && (
                <li>
                  <a
                    href={`https://wa.me/${whatsApp.replace(/[^\d]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 transition-colors hover:text-white"
                  >
                    <MessageCircle className="size-4 shrink-0" aria-hidden />
                    WhatsApp
                  </a>
                </li>
              )}
              {email && (
                <li>
                  <a
                    href={`mailto:${email}`}
                    className="inline-flex items-center gap-2 transition-colors hover:text-white"
                  >
                    <Mail className="size-4 shrink-0" aria-hidden />
                    {email}
                  </a>
                </li>
              )}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-white/60">Support details coming soon.</p>
          )}
        </div>

        {/* Legal / company */}
        <nav aria-label="Legal">
          <h2 className="text-[13px] font-semibold text-white">Company</h2>
          <ul className="mt-3 space-y-2.5 text-[13px] text-white/72">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto w-full max-w-7xl px-5 py-5 text-[13px] text-white/60">
          © {year} {Constants.APP_NAME}
        </div>
      </div>
    </footer>
  );
}
