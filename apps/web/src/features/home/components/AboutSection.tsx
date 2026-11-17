import { Mail, MapPin, Phone } from 'lucide-react';
import { Constants } from '@/config/constants';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';

/**
 * The home "About us" block — who runs the store, how it grew, every location it serves, and how to
 * reach it.
 *
 * WHY a static Server Component: this is the business's own fixed copy (no `general/config` field
 * carries it), so there is nothing to fetch, and rendering it on the server keeps the story and the
 * place names in the crawled HTML — the branch towns are exactly what a local search matches on.
 *
 * WHY `id="about"`: the footer's "About us" link targets `/#about`, so the section is reachable from
 * every page on desktop without a separate route.
 */

/**
 * Headline facts, taken from the story copy below — keep the two in step if either changes.
 * WHY bare numbers with the unit in the label: three tiles share ~80px of text width each on a phone,
 * and "4,000 sq ft" / "17 branches" wrapped mid-value there.
 */
const HIGHLIGHTS = [
  { value: '2016', label: 'Founded' },
  { value: '4,000', label: 'Sq ft store' },
  { value: '17', label: 'Branches' },
] as const;

/** In the order the business lists them, Chemmad (the flagship) first. */
const LOCATIONS = [
  'Chemmad',
  'Knowledge City',
  'Calicut',
  'Mangalore',
  'Thaliparamba',
  'Valanchery',
  'Muleria',
  'Kondotty',
  'Nadapuram',
  'Palakkad',
  'Edakkara',
  'Pallimukku-Kollam',
  'Mannarkkad',
  'Perinthalmanna',
  'Matool',
  'Mattannur',
  'Kasargod',
] as const;

export function AboutSection() {
  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      // `scroll-mt-*` keeps the heading clear of the sticky header when arriving via `/#about`.
      className="mx-auto w-full max-w-7xl scroll-mt-24 px-4 py-10 lg:px-5"
    >
      {/* `md:`/`lg:` only, never `sm:` — see the cascade note in globals.css. */}
      <div className="grid gap-8 rounded-2xl border border-border bg-surface p-6 shadow-sm md:p-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-strong">About us</p>
          <h2
            id="about-heading"
            className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground md:text-[28px]"
          >
            Barakath Ulama Collection, Chemmad
          </h2>

          <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-muted">
            <p>
              Barakath Ulama Collection in Chemmad, founded by Ameen Falily Barakath on 17 October 2016,
              is your destination for affordable Islamic essentials across Kerala and Karnataka. Having
              started in a modest 200 square feet, we have now expanded into a 4,000 square feet
              establishment in Chemmad.
            </p>
            <p>
              This expansive space houses our wholesale operations, the Barakath Ulama Collection
              (offering both wholesale and retail), and our exclusive Barakath Abaya Collection. We offer
              a wide range of products, including specialized scholar attire, fabrics, dhotis, thobes,
              premium perfumes, bakhoor, and complete Hajj and Umrah items across our 17 branches.
            </p>
          </div>

          <dl className="mt-6 grid grid-cols-3 gap-3">
            {HIGHLIGHTS.map((item) => (
              <div key={item.label} className="flex flex-col rounded-xl bg-gold-subtle px-3 py-3 md:px-4">
                <dt className="mt-1 text-[11px] font-medium text-muted md:text-xs">{item.label}</dt>
                {/* <dd> stays after <dt> in the DOM for valid markup; `order-first` shows the number on top. */}
                <dd className="order-first text-xl font-extrabold tracking-tight text-gold-strong md:text-2xl">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Locations we serve</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {LOCATIONS.map((place) => (
              <li
                key={place}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-subtle px-3 py-1.5 text-[13px] font-medium text-foreground"
              >
                <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden />
                {place}
              </li>
            ))}
          </ul>

          {/* Contact — each number takes calls and WhatsApp, so each row offers both. */}
          <h3 className="mt-8 text-sm font-semibold text-foreground">Contact us</h3>
          <ul className="mt-3 space-y-2">
            {Constants.CONTACT_PHONES.map((line) => (
              <li
                key={line.digits}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-subtle px-4 py-3"
              >
                {/* No `min-w-0`: the number keeps its full width, so on a narrow phone the row wraps
                    and the buttons drop below it instead of sliding over the digits. */}
                <span className="flex-1 whitespace-nowrap text-[15px] font-semibold text-foreground">
                  {line.display}
                </span>
                <span className="flex gap-2">
                  <a
                    href={`tel:+${line.digits}`}
                    aria-label={`Call ${line.display}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Phone className="size-3.5 shrink-0 text-primary" aria-hidden />
                    Call
                  </a>
                  <a
                    href={`https://wa.me/${line.digits}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`WhatsApp ${line.display}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-semibold text-foreground transition-colors hover:border-whatsapp hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <WhatsAppIcon className="size-3.5 shrink-0 text-whatsapp" />
                    WhatsApp
                  </a>
                </span>
              </li>
            ))}
            <li>
              <a
                href={`mailto:${Constants.CONTACT_EMAIL}`}
                className="flex items-center gap-2.5 rounded-xl bg-subtle px-4 py-3 text-[15px] font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Mail className="size-4 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 break-all">{Constants.CONTACT_EMAIL}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
