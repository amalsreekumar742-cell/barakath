/**
 * variantImageIndex — which product-gallery photo a variant should show, as an index into `images`, or
 * null when it has none (the gallery is then left where it is).
 *
 * WHY the same-colour fallback: a photo shows a COLOUR, while a variant is a colour × size combination.
 * The admin links the photo on one row of a colour and every other size of that colour follows, rather
 * than having to repeat the pick on each row. The variant's own link still wins, so one size can carry
 * a photo of its own.
 *
 * A link to a url that is no longer in `images` (the photo was removed from the product) is ignored.
 * The Flutter app mirrors this in `ProductDetailProvider._linkedImageIndex` — keep the two in step.
 */
export function variantImageIndex(
  variants: readonly { color: string; imageUrl?: string }[],
  selected: { color: string; imageUrl?: string },
  images: readonly string[],
): number | null {
  const indexOf = (url: string | undefined) => {
    const i = url ? images.indexOf(url) : -1;
    return i >= 0 ? i : null;
  };
  const own = indexOf(selected.imageUrl);
  if (own !== null) return own;
  for (const v of variants) {
    if (v.color !== selected.color) continue;
    const linked = indexOf(v.imageUrl);
    if (linked !== null) return linked;
  }
  return null;
}
