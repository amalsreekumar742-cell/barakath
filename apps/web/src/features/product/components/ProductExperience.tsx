'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductProps, VariantProps } from '@barakath/shared';
import { resolvePrice } from '@/lib/pricing';
import { formatInr } from '@/components/catalog/PriceBlock';
import { RatingStars } from '@/components/catalog/RatingStars';
import { WishlistHeart } from '@/components/catalog/WishlistHeart';
import { FlashCountdown } from '@/components/catalog/FlashCountdown';
import { Button } from '@/components/Button';
import { useAppSelector, useAppDispatch } from '@/stores/store';
import { toastError, toastSuccess } from '@/lib/toast';
import { useRequireAuth } from '@/hooks/useRequireAuth';

/** `ProductProps`/`VariantProps` minus their Firestore `Timestamp` fields — a `Timestamp` class instance
 *  is not a plain object, so React rejects it crossing the Server → Client boundary as a prop (the same
 *  class of bug fixed for `CategoryProps` → `NavCategory`, see `lib/data/catalog.ts`). Neither field is
 *  read anywhere in this component; `page.tsx` strips them before passing down rather than this file
 *  silently accepting (and re-triggering) the warning. */
type ClientProduct = Omit<ProductProps, 'createdAt' | 'updatedAt'>;
type ClientVariant = Omit<VariantProps, 'createdAt'>;

export interface ProductExperienceProps {
  product: ClientProduct;
  /** All variants, oldest-created first (matches `getVariants`'s ordering — index 0 is the default). */
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
 * WHY variant selection is a two-dimensional match (color × name) rather than one flat list: a
 * `VariantProps` carries both `color`/`colorCode` and `name` (the admin's size/label field) on the SAME
 * document — there is no separate "option group" schema. Showing a color row and a size row only when
 * more than one distinct value exists, then resolving the pair back to the one matching variant, is the
 * closest honest reading of that shape; a combination the catalogue never created is treated the same
 * as an out-of-stock one — greyed and unselectable, per spec, rather than silently falling back.
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

  // The page never renders this component when `variants` is empty (see page.tsx's guard).
  const first = variants[0]!;
  const [selectedColor, setSelectedColor] = useState(first.color);
  const [selectedName, setSelectedName] = useState(first.name);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  const colors = useMemo(
    () => Array.from(new Map(variants.map((v) => [v.color, v.colorCode])).entries()),
    [variants],
  );
  const names = useMemo(() => Array.from(new Set(variants.map((v) => v.name))), [variants]);

  // The variant matching the current (color, name) pair, or the closest honest fallback.
  const currentVariant: ClientVariant =
    variants.find((v) => v.color === selectedColor && v.name === selectedName) ??
    variants.find((v) => v.color === selectedColor) ??
    variants.find((v) => v.name === selectedName) ??
    first;

  const resolved = resolvePrice(product, currentVariant);
  const inStock = currentVariant.stock > 0;
  // Root-state access, not a `features/cart` import — `import/no-restricted-paths` forbids the latter
  // (see `onAddToBag`'s raw-action-type note below for the same constraint).
  const alreadyInBag = useAppSelector((s) =>
    s.cart.items.some((i) => i.productId === product.id && i.variantId === currentVariant.id),
  );
  const maxQty = Math.max(1, Math.min(currentVariant.stock, 10));
  const isAffiliate = isAuthenticated && (user?.affiliateCode?.trim().length ?? 0) > 0;

  /** Whether picking `color`/`name` (holding the other axis at its current value) lands on real stock. */
  function comboInStock(axis: 'color' | 'name', value: string): boolean {
    const match =
      axis === 'color'
        ? variants.find((v) => v.color === value && v.name === selectedName) ??
          variants.find((v) => v.color === value)
        : variants.find((v) => v.name === value && v.color === selectedColor) ??
          variants.find((v) => v.name === value);
    return Boolean(match && match.stock > 0);
  }

  function onSelectVariantAxis(axis: 'color' | 'name', value: string) {
    if (axis === 'color') setSelectedColor(value);
    else setSelectedName(value);
    setQuantity(1); // a new variant has its own stock cap — start from 1 rather than carry over.
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
      <h1 className="font-display text-2xl font-extrabold leading-tight text-foreground md:text-3xl">
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
          <span className="font-display text-3xl font-extrabold text-gold-strong">
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

      {colors.length > 1 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Color</p>
          <div className="mt-2 flex flex-wrap gap-2.5">
            {colors.map(([color, colorCode]) => {
              const disabled = !comboInStock('color', color);
              const selected = color === selectedColor;
              return (
                <button
                  key={color}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectVariantAxis('color', color)}
                  aria-pressed={selected}
                  aria-label={color}
                  title={disabled ? `${color} — out of stock` : color}
                  className={`relative size-9 rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-35 ${
                    selected ? 'border-primary' : 'border-border-strong'
                  }`}
                  style={{ backgroundColor: colorCode || '#ccc' }}
                />
              );
            })}
          </div>
        </div>
      )}

      {names.length > 1 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Size</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {names.map((name) => {
              const disabled = !comboInStock('name', name);
              const selected = name === selectedName;
              return (
                <button
                  key={name}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectVariantAxis('name', name)}
                  aria-pressed={selected}
                  className={`h-10 rounded-md border px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-35 disabled:line-through ${
                    selected
                      ? 'border-primary bg-primary-subtle text-primary'
                      : 'border-border-strong text-foreground hover:bg-subtle'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

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

      <div className="mt-6 flex items-center gap-3">
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
    </div>
  );
}
