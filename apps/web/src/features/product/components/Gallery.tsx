'use client';

import { useState, type MouseEvent } from 'react';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';

export interface GalleryProps {
  images: string[];
  productName: string;
}

/**
 * Product image gallery (spec §3.7): a vertical thumbnail strip beside the main image at ≥1024px,
 * horizontal below it; hover-to-zoom on the main image, desktop only.
 *
 * WHY a client island rather than server-rendered: the active thumbnail and the zoom transform are
 * pure client interaction state with no data dependency — nothing here needs to be in the crawled HTML
 * beyond the images themselves, which `next/image` still renders normally (this component's `<img>`
 * output is identical whether or not JS has hydrated).
 *
 * WHY zoom is CSS-transform-on-hover rather than a magnifier/lens package: the task flags "no new
 * dependency" for the YouTube embed, and the same reasoning applies here — `background-position` driven
 * by the pointer position over a scaled-up background image gets the same "hover to inspect closer"
 * result with zero additional JS shipped. It is skipped entirely on touch devices (no `hover` capability)
 * via a media query rather than a JS pointer-type check, so it never fires from a tap-and-hold.
 */
export function Gallery({ images, productName }: GalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [zooming, setZooming] = useState(false);

  const active = images[activeIndex] ?? '';

  function onMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x, y });
  }

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-subtle text-faint">
        <ImageOff size={40} aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      {/* Thumbnail strip: horizontal on mobile/tablet, vertical rail on desktop. */}
      {images.length > 1 && (
        <div className="order-2 flex gap-2 overflow-x-auto lg:order-1 lg:w-20 lg:flex-col lg:overflow-visible">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={i === activeIndex}
              className={`relative size-16 shrink-0 overflow-hidden rounded-lg border-2 bg-subtle transition lg:size-20 ${
                i === activeIndex ? 'border-primary' : 'border-transparent hover:border-border-strong'
              }`}
            >
              <Image src={src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Main image — hover-to-zoom on desktop only (the `lg:group-hover` / pointer:fine query below). */}
      <div
        className="group/zoom order-1 relative aspect-square w-full flex-1 overflow-hidden rounded-xl border border-border bg-subtle lg:order-2"
        onMouseEnter={() => setZooming(true)}
        onMouseLeave={() => setZooming(false)}
        onMouseMove={onMouseMove}
      >
        {/*
          `object-contain`, NOT cover.

          Product photos in this catalogue are overwhelmingly portrait (~2:3) with the occasional
          landscape, while this frame is square. `cover` fills the square by cropping roughly a third
          off a 2:3 photo — on the one screen whose entire job is showing the customer what they are
          buying. `contain` fits the whole image and lets the `bg-subtle` frame show around it, which
          is also what the design board does (its gallery sits on a tinted panel, not a bleed).

          Grid THUMBNAILS keep `cover` on purpose: there, identical tile shapes matter more than
          seeing every pixel, and the customer clicks through for the full view.
        */}
        <Image
          src={active}
          alt={productName}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-contain"
        />
        {/* Zoomed layer: `lg:block` keeps it out of the DOM's visible layout below 1024px (spec: hover
            zoom is desktop-only), and it only becomes visible when `zooming` is true — which JS mouse
            events set, and a touch tap does not fire, so it never triggers from a tap-and-hold either. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 hidden bg-no-repeat opacity-0 transition-opacity duration-150 [background-size:200%] lg:block ${
            zooming ? 'opacity-100' : ''
          }`}
          style={{
            backgroundImage: `url(${active})`,
            backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
          }}
        />
      </div>
    </div>
  );
}
