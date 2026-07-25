/**
 * The little count bubble on the cart and wishlist icons.
 *
 * WHY its own component: two icons render the exact same badge, and the design pins one style — a
 * gold-strong pill, white text, top-right — for both. One component keeps them identical and keeps
 * the "hide at zero, cap at 99+" rule in a single place.
 *
 * WHY it renders nothing at zero rather than a "0": an empty cart should read as no badge at all,
 * not a zero the eye still has to process.
 *
 * WHY it caps at 99+: a three-digit badge overflows the icon and breaks the header's alignment; a
 * real bag never needs to show more precisely than "lots".
 */
export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-gold-strong px-1 text-center text-[10px] font-semibold leading-[18px] text-white"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
