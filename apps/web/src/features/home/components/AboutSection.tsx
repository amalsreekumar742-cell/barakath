import { MapPin } from 'lucide-react';

/**
 * The home "About us" block — who runs the store, how it grew, and every location it serves.
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
 * and "4,000 sq ft" / "16 branches" wrapped mid-value there.
 */
const HIGHLIGHTS = [
  { value: '2017', label: 'Founded' },
  { value: '4,000', label: 'Sq ft store' },
  { value: '16', label: 'Branches' },
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
            Barkath Ulama Collections, Chemmad
          </h2>

          <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-muted">
            <p>
              Barkath Ulama Collections in Chemmad, founded by Ameen Falily Barkath in 2017, is your
              destination for affordable Islamic essentials across Kerala and Karnataka. Having started
              in a modest 200 square feet, we have now expanded into a 4,000 square feet establishment
              in Chemmad.
            </p>
            <p>
              This expansive space houses our wholesale operations, the Barkath Ulama Collection
              (offering both wholesale and retail), and our exclusive Barkath Abaya Collection. We offer
              a wide range of products, including specialized scholar attire, fabrics, dhotis, thobes,
              premium perfumes, bakhoor, and complete Hajj and Umrah items across our 16 branches.
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
        </div>
      </div>
    </section>
  );
}
