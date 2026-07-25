import type { FC } from 'react';
import Icon from '@/components/icons/Icon';

/**
 * Small presentational helpers shared by the review screens — an initials-fallback avatar and a
 * read-only star-rating row — so the list cards and the response modal render them identically.
 * (Pattern copied locally per feature convention; not imported across features.)
 */

/** Derive up-to-2-letter initials from a name for the avatar fallback. */
const initials = (name: string): string =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

/**
 * Avatar — circular profile image with an initials fallback (design: warm-neutral circle). Used at 40px
 * in the review card header via the `size` prop.
 */
export const Avatar: FC<{ src?: string; name: string; size?: number }> = ({ src, name, size = 40 }) => {
  const dim = { width: size, height: size };
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={dim}
        className="shrink-0 rounded-full border border-border object-cover"
      />
    );
  }
  return (
    <span
      style={dim}
      className="flex shrink-0 items-center justify-center rounded-full bg-primary-subtle font-bold text-primary"
    >
      <span style={{ fontSize: Math.round(size * 0.36) }}>{initials(name)}</span>
    </span>
  );
};

/**
 * Stars — a read-only 1..5 star row (filled = gold, empty = faint) for a review's rating (spec §1.11).
 * WHY a small local component: the same star row appears on every card, the summary average and the
 * response modal — one component keeps them pixel-identical.
 */
export const Stars: FC<{ rating: number; size?: number }> = ({ rating, size = 15 }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Icon
        key={n}
        name="StarLine"
        size={size}
        className={n <= rating ? 'text-gold-strong' : 'text-faint'}
      />
    ))}
  </span>
);

/** "Verified Purchase" badge — shown when a review is tied to a real delivered order (spec §1.11). */
export const VerifiedBadge: FC = () => (
  <span className="inline-flex items-center gap-1 rounded-sm bg-success-subtle px-2 py-0.5 text-[11px] font-bold text-success">
    <Icon name="CheckLine" size={12} />
    Verified Purchase
  </span>
);

/** Published (green) / Hidden (neutral) status pill for a review card. */
export const ReviewStatusBadge: FC<{ isPublished: boolean }> = ({ isPublished }) => (
  <span
    className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-bold ${
      isPublished ? 'bg-success-subtle text-success' : 'bg-subtle text-muted'
    }`}
  >
    {isPublished ? 'Published' : 'Hidden'}
  </span>
);
