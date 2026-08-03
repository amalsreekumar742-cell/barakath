'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { formatInr } from '@/components/catalog/PriceBlock';
import { AddAllButton, type BundleItem } from './AddAllButton';

/** The product being viewed — the card's first row, for context. */
export interface CurrentProductRow {
  name: string;
  image: string;
  offerPrice: number;
  mrp: number;
}

export interface FrequentlyBoughtTogetherProps {
  items: BundleItem[];
  currentProduct: CurrentProductRow;
}

/**
 * Frequently bought together (spec §3.7) — ONLY rendered by the page when `product.isCombo === true`
 * and `getFrequentlyBoughtTogetherItems` returned at least one item.
 *
 * One bordered card, a row per product: the one being viewed first, then each partner, each tickable,
 * with a single CTA that adds everything ticked. This replaced a bare strip of 80px thumbnails above a
 * "Bundle total" line, which named nothing and priced nothing — a customer could not tell what the
 * bundle contained, and "Add all to bag" was all-or-nothing. Matches the Flutter app's card.
 *
 * WHY the first row has no tick box, unlike the app's: the customer's chosen variant lives in
 * `ProductExperience`'s client state, which this sibling section cannot see. Ticking this row would
 * add the DEFAULT variant and silently contradict a variant they had picked. The row is shown for
 * context; the page's own Add to bag button is what adds this product, with the right variant.
 */
export function FrequentlyBoughtTogether({ items, currentProduct }: FrequentlyBoughtTogetherProps) {
  /**
   * The ids the customer has UNticked — everything starts ticked, since the section exists to sell the
   * set. Storing the exceptions (rather than the selection) means a row that disappears takes its
   * state with it and a row that appears is ticked, with nothing to reconcile.
   */
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set());

  if (items.length === 0) return null;

  const isTicked = (productId: string) => !unticked.has(productId);
  const selected = items.filter((item) => isTicked(item.productId));

  function toggle(productId: string) {
    setUnticked((current) => {
      const next = new Set(current);
      if (!next.delete(productId)) next.add(productId);
      return next;
    });
  }

  return (
    <section>
      <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
        Frequently bought together
      </h2>

      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <BundleRow
          name={currentProduct.name}
          image={currentProduct.image}
          offerPrice={currentProduct.offerPrice}
          mrp={currentProduct.mrp}
          isCurrentProduct
        />

        {items.map((item) => (
          <BundleRow
            key={item.productId}
            name={item.productName}
            variantName={item.variantName}
            image={item.image}
            offerPrice={item.offerPrice}
            mrp={item.mrp}
            href={`/product/${item.productId}`}
            inStock={item.inStock}
            ticked={isTicked(item.productId)}
            onToggle={() => toggle(item.productId)}
          />
        ))}

        <div className="border-t border-border bg-surface p-3.5">
          <AddAllButton
            items={selected}
            label={
              selected.length === 0
                ? 'Select items to add'
                : `Add ${selected.length} item${selected.length === 1 ? '' : 's'} to cart`
            }
          />
        </div>
      </div>
    </section>
  );
}

interface BundleRowProps {
  name: string;
  variantName?: string;
  image: string;
  offerPrice: number;
  mrp: number;
  href?: string;
  inStock?: boolean;
  isCurrentProduct?: boolean;
  ticked?: boolean;
  onToggle?: () => void;
}

function BundleRow({
  name,
  variantName,
  image,
  offerPrice,
  mrp,
  href,
  inStock = true,
  isCurrentProduct = false,
  ticked = false,
  onToggle,
}: BundleRowProps) {
  return (
    <div
      className={`flex items-center gap-3 p-3.5 ${isCurrentProduct ? 'bg-subtle' : 'border-t border-border bg-surface'} ${
        inStock ? '' : 'opacity-50'
      }`}
    >
      <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-subtle">
        {image && <Image src={image} alt="" fill sizes="64px" className="object-cover" />}
      </div>

      <div className="min-w-0 flex-1">
        {isCurrentProduct ? (
          <p className="truncate text-[13px] text-muted">
            {name} · <span className="font-semibold text-foreground">This product</span>
          </p>
        ) : (
          <PartnerName href={href} name={name} variantName={variantName} />
        )}

        <p className="mt-0.5 flex items-baseline gap-2">
          <span className="font-display text-[15px] font-semibold text-foreground">
            {formatInr(offerPrice)}
          </span>
          {mrp > offerPrice && (
            <span className="text-xs text-muted line-through">{formatInr(mrp)}</span>
          )}
          {!inStock && <span className="text-xs font-medium text-error">Out of stock</span>}
        </p>
      </div>

      {/* The viewed product is shown as included but not togglable — see the section's doc comment. */}
      {isCurrentProduct ? (
        <span className="grid size-[26px] shrink-0 place-items-center rounded-md bg-primary text-white">
          <Check className="size-4" aria-hidden />
        </span>
      ) : (
        <button
          type="button"
          role="checkbox"
          aria-checked={ticked}
          aria-label={`Include ${name} in the bundle`}
          onClick={onToggle}
          className={`grid size-[26px] shrink-0 place-items-center rounded-md border-[1.5px] transition-colors ${
            ticked ? 'border-primary bg-primary text-white' : 'border-border-strong bg-surface'
          }`}
        >
          {ticked && <Check className="size-4" aria-hidden />}
        </button>
      )}
    </div>
  );
}

/** The partner product's name, linking through to its own page. */
function PartnerName({ href, name, variantName }: { href?: string; name: string; variantName?: string }) {
  const label = (
    <>
      <span className="font-medium text-foreground">{name}</span>
      {variantName && <span className="text-muted"> · {variantName}</span>}
    </>
  );

  if (!href) return <p className="truncate text-[13px]">{label}</p>;

  return (
    <a href={href} className="block truncate text-[13px] hover:underline">
      {label}
    </a>
  );
}
