import { Star } from 'lucide-react';

export interface RatingStarsProps {
  /** Average rating, 0–5. Fractional values render a partial final star. */
  rating: number;
  /** Review count. When provided it is shown after the stars ("· 512"). */
  count?: number;
  /** Star size in px (default 14). */
  size?: number;
  className?: string;
}

/**
 * Five gold stars filled to `rating`, with a true fractional (e.g. half) final star.
 *
 * WHY the caller decides visibility, not this component: `averageRating` is 0 when a product has no
 * reviews yet — 0 means "unrated", not "rated zero". Rendering five empty stars for an unrated
 * product would read as a bad score. The rule (from `ProductProps`) is to show a rating off
 * `totalReviews > 0`, so the caller gates this; this component always draws what it is given.
 *
 * WHY the two-layer clip rather than a per-star half icon: lucide has no half-star glyph. Painting a
 * full row of outline stars and overlaying a gold-filled copy clipped to `rating/5` width gives any
 * fraction (4.3, 4.7, …) for free and stays a single, exact source of the star shape.
 */
export function RatingStars({ rating, count, size = 14, className = '' }: RatingStarsProps) {
  const clamped = Math.max(0, Math.min(5, rating));
  const fillWidth = `${(clamped / 5) * 100}%`;
  const stars = Array.from({ length: 5 }, (_, i) => i);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative inline-flex" aria-hidden>
        {/* Empty row (outline) sets the footprint. */}
        <span className="flex text-border-strong">
          {stars.map((i) => (
            <Star key={i} width={size} height={size} strokeWidth={1.75} />
          ))}
        </span>
        {/* Gold-filled row clipped to the score's width. */}
        <span
          className="absolute inset-0 flex overflow-hidden text-gold"
          style={{ width: fillWidth }}
        >
          {stars.map((i) => (
            <Star key={i} width={size} height={size} strokeWidth={1.75} className="shrink-0 fill-current" />
          ))}
        </span>
      </span>
      {count != null && (
        <span className="text-xs font-semibold text-muted">
          {clamped.toFixed(1)} · {count}
        </span>
      )}
    </span>
  );
}
