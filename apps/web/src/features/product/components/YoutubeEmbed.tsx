'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';

export interface YoutubeEmbedProps {
  /** `product.youtubeVideoLink` — any of the watch/short/embed URL shapes. */
  url: string;
}

/**
 * Ordered by specificity; the first hit wins. Host and path are matched loosely (no scheme anchor)
 * because the 11-character id is the strong signal.
 *
 * WHY `watch\?(?:[^\s]*&)?v=` rather than the `watch\?v=` this used to be: `v` is very often NOT the
 * first query parameter — `m.youtube.com/watch?app=desktop&v=ID` is what the YouTube app hands you,
 * and `?feature=shared&v=ID` is what a share sheet produces. Both failed to match, and since a null
 * id makes this component render nothing, the video silently vanished from the product page. `/live/`
 * and `/v/` were missing outright. The admin form only validates that the URL contains a YouTube
 * host, so every one of these saves happily and then disappears here.
 *
 * Kept in step with the Flutter app's `core/utils/youtube_url.dart`, which had the same gaps.
 */
const YOUTUBE_ID_PATTERNS = [
  /youtube\.com\/watch\?(?:[^\s]*&)?v=([\w-]{11})/,
  /youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/,
  /youtube\.com\/shorts\/([\w-]{11})/,
  /youtube\.com\/live\/([\w-]{11})/,
  /youtube\.com\/v\/([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/,
];

/** A bare id pasted on its own, e.g. `dQw4w9WgXcQ`. */
const BARE_YOUTUBE_ID = /^[\w-]{11}$/;

/**
 * Extract an 11-character YouTube video id from any URL shape an admin might paste. Returns null when
 * nothing matches, so the caller can skip rendering rather than embed a broken player.
 */
export function extractYoutubeId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (BARE_YOUTUBE_ID.test(trimmed)) return trimmed;

  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Click-to-embed YouTube facade — NO third-party package (`lite-youtube-embed` is not installed and
 * the task flags adding it). A static thumbnail loads instead of YouTube's ~1MB embed JS; only a click
 * swaps in the real `<iframe>`, which is the same "no third-party JS until interacted with" win a
 * lite-embed package would give, at zero added dependency weight.
 */
export function YoutubeEmbed({ url }: YoutubeEmbedProps) {
  const [playing, setPlaying] = useState(false);
  const videoId = extractYoutubeId(url);

  if (!videoId) return null;

  if (playing) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-ink">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title="Product video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label="Play product video"
      className="group relative block aspect-video w-full overflow-hidden rounded-xl bg-ink"
    >
      <Image
        src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
        alt="Product video thumbnail"
        fill
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="object-cover opacity-90 transition group-hover:opacity-100"
        unoptimized
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-white/90 shadow-lg transition group-hover:scale-105">
          <Play className="ml-1 size-7 fill-ink text-ink" aria-hidden />
        </span>
      </span>
    </button>
  );
}
