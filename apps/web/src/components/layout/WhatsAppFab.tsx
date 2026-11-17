'use client';

import { usePathname } from 'next/navigation';
import { Constants } from '@/config/constants';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { isMobileNavVisible } from './mobileNavRoutes';

/**
 * The floating "Chat on WhatsApp" button, pinned to the bottom-right corner of every storefront page.
 *
 * WHY a client component: its mobile offset depends on whether this route shows the bottom tab bar,
 * and that answer comes from `usePathname` + `isMobileNavVisible` — the one rule the nav and
 * `StickyActionBar` already share, so the three pieces of bottom chrome can never disagree. The
 * actual offsets live in globals.css (`.whatsapp-fab`); this only flags which case applies.
 *
 * WHY z-40: above page content and level with the header/sticky CTA (which it never overlaps — the
 * CSS offsets it clear of them), but under the z-50 tab bar and header dropdowns and under every
 * Modal/Sheet (z-[999]), so an open menu or dialog is never covered by it.
 *
 * The glyph is the shared `WhatsAppIcon` (WhatsApp's own logo mark — see that file for why not lucide).
 */
export function WhatsAppFab() {
  const pathname = usePathname();
  const withNav = isMobileNavVisible(pathname);

  return (
    <a
      href={`https://wa.me/${Constants.WHATSAPP_NUMBER}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with us on WhatsApp, ${Constants.WHATSAPP_DISPLAY}`}
      title="Chat with us on WhatsApp"
      data-with-nav={withNav ? '' : undefined}
      className="whatsapp-fab fixed z-40 inline-flex size-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-lg transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-whatsapp active:scale-95"
    >
      <WhatsAppIcon className="size-7" />
    </a>
  );
}
