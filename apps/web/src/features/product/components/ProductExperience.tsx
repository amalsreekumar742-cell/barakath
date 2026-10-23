'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductProps, VariantProps } from '@barakath/shared';
import { axisValues, resolveVariant } from '@barakath/shared/utils/variantOptions';
import { variantImageIndex } from '@barakath/shared/utils/variantImage';
import { resolvePrice } from '@/lib/pricing';
import { formatInr } from '@/components/catalog/PriceBlock';
import { RatingStars } from '@/components/catalog/RatingStars';
import { WishlistHeart } from '@/components/catalog/WishlistHeart';
import { FlashCountdown } from '@/components/catalog/FlashCountdown';
import { Button } from '@/components/Button';
import { StickyActionBar } from '@/components/layout/StickyActionBar';
import { useAppSelector, useAppDispatch } from '@/stores/store';
import { toastError, toastSuccess } from '@/lib/toast';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { VariantSelector } from './VariantSelector';
import { useGalleryFocus } from './GalleryFocus';

/** `ProductProps`/`VariantProps` minus their Firestore `Timestamp` fields — a `Timestamp` class instance
 *  is not a plain object, so React rejects it crossing the Server → Client boundary as a prop (the same
 *  class of bug fixed for `CategoryProps` → `NavCategory`, see `lib/data/catalog.ts`). Neither field is
 *  read anywhere in this component; `page.tsx` strips them before passing down rather than this file
 *  silently accepting (and re-triggering) the warning. */
type ClientProduct = Omit<ProductProps, 'createdAt' | 'updatedAt'>;
type ClientVariant = Omit<VariantProps, 'createdAt'>;

export interface ProductExperienceProps {
  product: ClientProduct;
  /** All variants in the admin's display order (`getVariants` sorts by `sortOrder` — index 0 is the
   *  default). Every chip row follows this order, so a reorder in the admin reorders them here. */
  variants: ClientVariant[];
  /** The live flash sale's end, as millis — null when no sale is running. See `FlashCountdown` note on
   *  why millis crosses the Server→Client boundary cleanly while a raw `Timestamp` does not. */
  activeFlashSaleEndMillis: number | null;
}

/**
 * The whole right-hand "info column" of the product detail page (spec §3.7) as ONE client island:
 * name, rating, price, the affiliate banner, variant selection, quantity, Add to Bag and the wishlist
 * heart. All state here is genuinely interactive and interdependent (picking a variant changes the
 * price AND the stock cap AND what the affiliate banner shows), so splitting it into several islands
 * would mean lifting the same `selectedVariant` state back up anyway — one client component is the
 * honest shape, not a compromise.
 *
 * WHY variant selection is a per-axis match rather than one flat list: a variant is one point in a
 * Colour × Size × Layer … grid — `color` plus its `options` (or, on a single-axis variant, its `name`
 * as the lone "Size" axis). The selection is a map of axis → value, one chip row per axis (see
 * `VariantSelector`), and it is ALWAYS a real variant's values: a tap goes through the shared
 * `resolveVariant`, then the whole selection snaps to whatever it landed on. So the highlighted chips
 * and the price/stock shown can never disagree, and the website picks the same variant for the same
 * taps as the app, which mirrors those rules.
 */
export function ProductExperience({
  product,
  variants,
  activeFlashSaleEndMillis,
}: ProductExperienceProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { requireAuth } = useRequireAuth();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const user = useAppSelector((s) => s.auth.user);
  const { focus: focusImage } = useGalleryFocus();

  // The page never renders this component when `variants` is empty (see page.tsx's guard).
  const first = variants[0]!;
  // Axis name → value, colour included (`COLOUR_AXIS`). Seeded from the default variant.
  const [selection, setSelection] = useState<Record<string, string>>(() => axisValues(first));
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  // `selection` is always some variant's own values (see `onSelectVariant`), so this is an exact match;
  // the shared resolver's fallbacks only matter if that invariant is ever broken.
  const currentVariant: ClientVariant = resolveVariant(variants, selection) ?? first;

  const resolved = resolvePrice(product, currentVariant);
  const inStock = currentVariant.stock > 0;
  // Root-state access, not a `features/cart` import — `import/no-restricted-paths` forbids the latter
  // (see `onAddToBag`'s raw-action-type note below for the same constraint).
  const alreadyInBag = useAppSelector((s) =>
    s.cart.items.some((i) => i.productId === product.id && i.variantId === currentVariant.id),
  );
  const maxQty = Math.max(1, Math.min(currentVariant.stock, 10));
  const isAffiliate = isAuthenticated && (user?.affiliateCode?.trim().length ?? 0) > 0;

  /** Picking one axis can point at a combination no variant has (Size 55 while on Layer 3, when 55
   *  only comes in Layer 2). Leaving the other axes untouched would let the highlighted chips and the
   *  shown price/stock disagree — so `resolveVariant` picks the closest real variant WITH the tapped
   *  value, and the whole selection snaps to that variant's values.
   *
   *  The galleries then slide to the variant's photo (`variantImageIndex`) — on a re-tap too, so the
   *  shopper who swiped to another colour's photo gets this one's back. */
  function onSelectVariant(axis: string, value: string) {
    const next = resolveVariant(variants, { ...selection, [axis]: value }, axis) ?? first;
    setSelection(axisValues(next));
    setQuantity(1); // a new variant has its own stock cap — start from 1 rather than carry over.
    const imageIndex = variantImageIndex(variants, next, product.images);
    if (imageIndex !== null) focusImage(product.images[imageIndex]!);
  }

  function onAddToBag() {
    requireAuth(() => {
      setAdding(true);
      try {
        const variantLabel = [currentVariant.color, currentVariant.name].filter(Boolean).join(' · ');
        // Dispatched by RAW action type, not an imported `addItem` action creator: `features/product`
        // may not import `features/cart` (`import/no-restricted-paths`). `cartSlice`'s type is stable
        // (`createSlice({ name: 'cart', ... })` always produces `'cart/addItem'`) — see
        // `features/checkout/api/checkoutThunks.ts` for the matching `cart/clearCart` case.
        dispatch({
          type: 'cart/addItem',
          payload: {
            productId: product.id,
            variantId: currentVariant.id,
            categoryId: product.categoryId,
            name: product.name,
            variantDetails: variantLabel || currentVariant.name,
            image: product.thumbnail || product.images[0] || '',
            quantity,
            // Display-only preview — the server re-prices every line at checkout (see cartSlice).
            unitPrice: resolved.displayPrice,
            mrp: resolved.mrp,
            isCombo: Boolean(product.isCombo),
            comboDeliveryCharge: product.isCombo ? product.comboDeliveryCharge : 0,
            stockAtAdd: currentVariant.stock,
          },
        });
        toastSuccess('Added to bag');
      } catch (error) {
        toastError(error, 'Could not add this to your bag.');
      } finally {
        setAdding(false);
      }
    });
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold leading-tight text-foreground md:text-3xl">
        {product.name}
      </h1>

      {product.totalReviews > 0 && (
        <a
          href="#reviews"
          className="mt-2 inline-flex items-center gap-1 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <RatingStars rating={product.averageRating} count={product.totalReviews} size={16} />
        </a>
      )}

      {/* Price — during a flash sale the offer price is HIDDEN and only the flash price + MRP show. */}
      <div className="mt-4">
        {resolved.isFlash && (
          <span className="mb-1.5 inline-block rounded-full bg-error px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
            Flash sale
          </span>
        )}
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="font-display text-3xl font-semibold text-gold-strong">
            {formatInr(resolved.displayPrice)}
          </span>
          {resolved.mrp > resolved.displayPrice && (
            <span className="text-base text-faint line-through">{formatInr(resolved.mrp)}</span>
          )}
          {resolved.discountPercent > 0 && (
            <span className="text-sm font-medium text-success">{resolved.discountPercent}% off</span>
          )}
        </div>
        {resolved.isFlash && activeFlashSaleEndMillis != null && (
          <FlashCountdown endDate={activeFlashSaleEndMillis} className="mt-2" />
        )}
      </div>

      {isAffiliate && (
        <div className="mt-4 rounded-lg border border-gold-border bg-gold-subtle px-4 py-3 text-sm">
          <p className="font-medium text-gold-strong">
            Referral price: {formatInr(currentVariant.referralPrice)} · You earn:{' '}
            {formatInr(currentVariant.commission)} per sale
          </p>
        </div>
      )}

      <VariantSelector variants={variants} selection={selection} onSelect={onSelectVariant} />

      <p className={`mt-5 text-sm font-medium ${inStock ? 'text-success' : 'text-error'}`}>
        {inStock
          ? currentVariant.stock <= product.lowStockThreshold
            ? `Only ${currentVariant.stock} left`
            : 'In stock'
          : 'Out of stock'}
      </p>

      {inStock && (
        <div className="mt-2 flex items-center gap-3">
          <div className="flex h-11 items-center rounded-md border border-border-strong">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
              className="flex h-full w-10 items-center justify-center text-lg font-medium text-foreground disabled:opacity-30"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-medium text-foreground">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              disabled={quantity >= maxQty}
              aria-label="Increase quantity"
              className="flex h-full w-10 items-center justify-center text-lg font-medium text-foreground disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Desktop: the CTA sits inline at the bottom of the buy box. */}
      <div className="mt-6 hidden items-center gap-3 lg:flex">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={adding}
          disabled={!inStock}
          onClick={alreadyInBag ? () => router.push('/cart') : onAddToBag}
        >
          {!inStock ? 'Out of stock' : alreadyInBag ? 'Go to cart' : 'Add to bag'}
        </Button>
        <WishlistHeart productId={product.id} className="shrink-0 border border-border-strong" />
      </div>

      {/*
        Mobile: the CTA is PINNED to the bottom edge, as in
        `apps/app/lib/features/products/presentation/widgets/product_detail_bottom_bar.dart` — a
        product page is long (description, specs, reviews, related), and an inline button scrolls out
        of reach the moment the customer starts reading. The label carries the price the way the app
        does, so what you are committing to is visible at the moment you commit.

        It lives inside this component rather than the page because the price, the selected variant,
        the stock state and the add handler are all state THIS component owns; `StickyActionBar` is
        `position: fixed`, so where it sits in the tree does not affect where it paints.
      */}
      <StickyActionBar
        leading={
          <WishlistHeart
            productId={product.id}
            className="size-[54px] rounded-md border border-border-strong"
          />
        }
      >
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={adding}
          disabled={!inStock}
          onClick={alreadyInBag ? () => router.push('/cart') : onAddToBag}
        >
          {!inStock
            ? 'Out of stock'
            : alreadyInBag
              ? 'Go to cart'
              : `Add to bag · ${formatInr(resolved.displayPrice * quantity)}`}
        </Button>
      </StickyActionBar>
    </div>
  );
}
