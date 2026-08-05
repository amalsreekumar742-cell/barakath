'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import { ImageOff, Play } from 'lucide-react';
import { CircleBackButton } from '@/components/CircleBackButton';
import { WishlistHeart } from '@/components/catalog/WishlistHeart';
import { extractYoutubeId } from './YoutubeEmbed';

/**
 * The product gallery as the Flutter app draws it
 * (`apps/app/lib/features/products/presentation/widgets/product_detail_gallery.dart`).
 *
 * Differences from the desktop `Gallery` this replaces below 1024px:
 *  - FULL-BLEED square media, edge to edge on `bg-subtle` — no card, border or rounded corner.
 *  - Swipeable pages with an expanding dot indicator, instead of a static image.
 *  - The product VIDEO rides along as the LAST page rather than sitting in its own block below the
 *    gallery, which is the arrangement the app uses and shoppers know from large marketplaces.
 *  - Floating circular back / wishlist actions over the media, since there is no header on mobile.
 *  - A 50px thumbnail strip under the carousel, kept in sync with the swipe in both directions.
 *
 * WHY `object-contain` where the app uses `BoxFit.cover`: this catalogue's product photos are mostly
 * portrait (~2:3) and `cover` crops roughly a third off them — the complaint that started this work.
 * `contain` shows the whole product against the tinted frame. It is a deliberate, isolated departure
 * from the app; switching the two class names below restores exact parity if that is preferred.
 *
 * WHY embla rather than a scroll-snap div: the dot indicator and the thumbnail strip both need to
 * know and SET the active page, and embla is already a dependency (the home hero uses it).
 */
export interface MobileGalleryProps {
  images: string[];
  productName: string;
  productId: string;
  /** `product.youtubeVideoLink` — becomes the final page when it parses. */
  videoUrl?: string;
  /** Shows the red SALE badge, as the app does for a flash-sale product. */
  onSale?: boolean;
}

export function MobileGallery({
  images,
  productName,
  productId,
  videoUrl,
  onSale = false,
}: MobileGalleryProps) {
  const videoId = useMemo(() => (videoUrl ? extractYoutubeId(videoUrl) : null), [videoUrl]);
  // Memoised so the pause-on-swipe effect below does not re-subscribe on every render.
  const pages = useMemo(
    () => (videoId ? [...images, '__video__'] : images),
    [images, videoId],
  );

  const [emblaRef, embla] = useEmblaCarousel({ loop: false, align: 'start' });
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setSelected(embla.selectedScrollSnap());
    embla.on('select', onSelect);
    onSelect();
    return () => {
      embla.off('select', onSelect);
    };
  }, [embla]);

  // Swiping away from the video page stops playback — matches the app pausing its controller.
  useEffect(() => {
    if (videoId && pages[selected] !== '__video__') setPlaying(false);
  }, [selected, pages, videoId]);

  const goTo = useCallback((i: number) => embla?.scrollTo(i), [embla]);

  if (pages.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-subtle text-faint lg:hidden">
        <ImageOff size={40} aria-hidden />
      </div>
    );
  }

  return (
    <div className="lg:hidden">
      <div className="relative">
        <div className="overflow-hidden bg-subtle" ref={emblaRef}>
          <div className="flex">
            {pages.map((src, i) =>
              src === '__video__' ? (
                <div key="video" className="relative aspect-square min-w-0 flex-[0_0_100%] bg-ink">
                  {playing ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                      title="Product video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="size-full"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPlaying(true)}
                      aria-label="Play product video"
                      className="group relative block size-full"
                    >
                      <Image
                        src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                        alt="Product video thumbnail"
                        fill
                        sizes="100vw"
                        className="object-cover opacity-90"
                        unoptimized
                      />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex size-16 items-center justify-center rounded-full bg-white/90 shadow-lg">
                          <Play className="ml-1 size-7 fill-ink text-ink" aria-hidden />
                        </span>
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                <div key={src + i} className="relative aspect-square min-w-0 flex-[0_0_100%]">
                  <Image
                    src={src}
                    alt={i === 0 ? productName : ''}
                    fill
                    priority={i === 0}
                    sizes="100vw"
                    className="object-contain"
                  />
                </div>
              ),
            )}
          </div>
        </div>

        {/* Floating chrome. The gallery is the top of the screen — there is no header to go back from. */}
        <div className="absolute left-3 top-3 z-10">
          <CircleBackButton href="/" tone="onImage" />
        </div>
        <div className="absolute right-3 top-3 z-10">
          <WishlistHeart productId={productId} className="size-[42px] shadow-sm" />
        </div>

        {onSale && (
          <span className="absolute left-3 top-[62px] z-10 rounded-md bg-error px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white">
            Sale
          </span>
        )}

        {pages.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5" aria-hidden>
            {pages.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === selected ? 'w-6 bg-primary' : 'w-1.5 bg-border-strong'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {pages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {pages.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={src === '__video__' ? 'View product video' : `View image ${i + 1}`}
              aria-current={i === selected}
              className={`relative size-[50px] shrink-0 overflow-hidden rounded-[10px] bg-subtle ${
                i === selected ? 'border-[1.6px] border-ink' : 'border border-border'
              }`}
            >
              {src === '__video__' ? (
                <>
                  <Image
                    src={`https://i.ytimg.com/vi/${videoId}/default.jpg`}
                    alt=""
                    fill
                    sizes="50px"
                    className="object-cover"
                    unoptimized
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/35">
                    <Play className="size-4 fill-white text-white" aria-hidden />
                  </span>
                </>
              ) : (
                <Image src={src} alt="" fill sizes="50px" className="object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
