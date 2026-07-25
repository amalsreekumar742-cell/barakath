'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';

export interface YoutubeEmbedProps {
  /** `product.youtubeVideoLink` — any of the watch/short/embed URL shapes. */
  url: string;
}

/**
 * Extract an 11-character YouTube video id from any common URL shape
 * (`watch?v=`, `youtu.be/`, `shorts/`, already-`embed/`). Returns null when nothing matches, so the
 * caller can skip rendering rather than embed a broken player.
 */
function extractYoutubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  return match?.[1] ?? null;
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
