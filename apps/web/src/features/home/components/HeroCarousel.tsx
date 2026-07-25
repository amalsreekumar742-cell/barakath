'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { HeroSlide } from '../types/heroSlide';

/** How long a slide stays up before autoplay advances, and the tick that drives it. */
const AUTOPLAY_INTERVAL_MS = 6000;

export interface HeroCarouselProps {
  slides: HeroSlide[];
}

/**
 * The home hero banner carousel (spec §3.4) — a small embla-carousel-react client island.
 *
 * WHY a client island around otherwise-server data: embla needs the DOM (drag/scroll physics,
 * resize observers) and `setInterval` for autoplay, neither of which exist during SSR. The slide data
 * itself (`slides`, with `href` already resolved) is computed server-side by `getHeroSlides` and
 * handed in as a prop, so this component never touches Firestore — it only owns presentation and
 * interaction.
 *
 * WHY it renders nothing for an empty/single-slide carousel rather than an empty shell: spec says an
 * empty banner set reserves no space at all, and a single slide needs no dots/arrows/autoplay.
 *
 * WHY autoplay is a plain `setInterval` rather than the `embla-carousel-autoplay` plugin: that plugin
 * is not an installed dependency (only `embla-carousel-react` is pre-approved for this task) and a
 * six-second `scrollNext()` tick is the entire feature — pulling in a whole plugin for one interval
 * would be the un-simple choice.
 */
export function HeroCarousel({ slides }: HeroCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  // Track the active dot from embla's own selection state — the single source of truth for "which
  // slide is showing", whether it changed via autoplay, a drag, an arrow click or a dot click.
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    onSelect();
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  // Autoplay — paused on hover (and with nothing to advance to when there is only one slide).
  const emblaApiRef = useRef(emblaApi);
  emblaApiRef.current = emblaApi;
  useEffect(() => {
    if (!emblaApi || slides.length <= 1 || isHovering) return;
    const id = setInterval(() => emblaApiRef.current?.scrollNext(), AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [emblaApi, isHovering, slides.length]);

  // No live banners → render nothing, no reserved space (spec).
  if (slides.length === 0) return null;

  return (
    <section
      aria-label="Featured banners"
      className="relative"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((slide, index) => {
            const image = (
              <div className="relative aspect-[3/1] w-full bg-subtle">
                <Image
                  src={slide.image}
                  alt={slide.title}
                  fill
                  // First slide is above the fold on every viewport — the one hero image worth
                  // priority-loading; the rest can wait for the browser's normal image scheduling.
                  priority={index === 0}
                  sizes="100vw"
                  className="object-cover"
                />
              </div>
            );
            return (
              <div className="min-w-0 flex-[0_0_100%]" key={slide.id}>
                {slide.href ? (
                  <Link href={slide.href} aria-label={slide.title} className="block">
                    {image}
                  </Link>
                ) : (
                  // A 'None'-linked or dangling-product banner is still shown — just not clickable.
                  <div aria-hidden>{image}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={scrollPrev}
            aria-label="Previous banner"
            className="absolute left-4 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 p-2 text-ink shadow-md backdrop-blur transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:flex"
          >
            <ChevronLeft size={20} strokeWidth={2.5} aria-hidden />
          </button>
          <button
            type="button"
            onClick={scrollNext}
            aria-label="Next banner"
            className="absolute right-4 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 p-2 text-ink shadow-md backdrop-blur transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:flex"
          >
            <ChevronRight size={20} strokeWidth={2.5} aria-hidden />
          </button>

          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2" role="tablist" aria-label="Banner slides">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={index === selectedIndex}
                aria-label={`Go to slide ${index + 1}`}
                onClick={() => scrollTo(index)}
                className={`h-2 rounded-full transition-all ${
                  index === selectedIndex ? 'w-6 bg-white' : 'w-2 bg-white/55 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
