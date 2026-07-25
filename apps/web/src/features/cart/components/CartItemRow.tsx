'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ImageOff, Minus, Plus, Trash2 } from 'lucide-react';
import type { CartItem } from '@/types/cart';
import { formatInr } from '@/components/catalog/PriceBlock';
import { Constants } from '@/config/constants';

export interface CartItemRowProps {
  item: CartItem;
  /** Live stock for this line, or `undefined` while the re-validation read is still in flight (spec
   *  2.11: stock is a snapshot at add-time, re-checked live when the bag mounts — see `useLiveStock`). */
  liveStock: number | undefined;
  onQuantityChange: (quantity: number) => void;
  onRequestRemove: () => void;
}

/**
 * One bag line — thumbnail, name, variant, quantity ±, unit/MRP price, line total, remove.
 *
 * WHY the stepper clamps only to `[1, min(CART_MAX_QTY, liveStock)]` here rather than reusing
 * `stockAtAdd`: once live stock is known it is the more honest ceiling — `cartSlice.updateQuantity`
 * still clamps against `stockAtAdd` too (its own snapshot), so the tighter of the two limits always
 * wins, which is the safe direction to be wrong in.
 *
 * WHY out-of-stock rendering greys the row instead of removing it: spec 2.11 — "Out of stock items
 * greyed with message (not auto-removed)". The customer decides whether to remove or wait for restock.
 */
export function CartItemRow({ item, liveStock, onQuantityChange, onRequestRemove }: CartItemRowProps) {
  const isOutOfStock = liveStock === 0;
  const stepCap = Math.max(1, Math.min(Constants.CART_MAX_QTY, liveStock ?? Constants.CART_MAX_QTY));
  const lineTotal = item.unitPrice * item.quantity;

  return (
    <div
      className={`flex gap-4 border-b border-border py-4 last:border-b-0 ${isOutOfStock ? 'opacity-60' : ''}`}
    >
      <Link
        href={`/product/${item.productId}`}
        className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {item.image ? (
          <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-faint" aria-hidden>
            <ImageOff size={20} />
          </div>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/product/${item.productId}`}
              className="line-clamp-2 text-sm font-medium text-foreground hover:underline"
            >
              {item.name}
            </Link>
            {item.variantDetails && (
              <p className="mt-0.5 text-xs text-muted">{item.variantDetails}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onRequestRemove}
            aria-label={`Remove ${item.name} from bag`}
            className="shrink-0 rounded-md p-1.5 text-faint transition hover:bg-subtle hover:text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {isOutOfStock ? (
          <p className="mt-2 text-xs font-medium text-error">
            Out of stock — remove this item or check back later.
          </p>
        ) : (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex h-9 items-center rounded-md border border-border-strong">
              <button
                type="button"
                onClick={() => onQuantityChange(Math.max(1, item.quantity - 1))}
                disabled={item.quantity <= 1}
                aria-label="Decrease quantity"
                className="flex h-full w-8 items-center justify-center text-foreground disabled:opacity-30"
              >
                <Minus size={14} />
              </button>
              <span className="w-7 text-center text-sm font-medium text-foreground">{item.quantity}</span>
              <button
                type="button"
                onClick={() => onQuantityChange(Math.min(stepCap, item.quantity + 1))}
                disabled={item.quantity >= stepCap}
                aria-label="Increase quantity"
                className="flex h-full w-8 items-center justify-center text-foreground disabled:opacity-30"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="text-right">
              <div className="flex items-baseline justify-end gap-1.5">
                <span className="text-sm font-semibold text-gold-strong">{formatInr(lineTotal)}</span>
                {item.mrp > item.unitPrice && (
                  <span className="text-xs text-faint line-through">
                    {formatInr(item.mrp * item.quantity)}
                  </span>
                )}
              </div>
              {item.quantity > 1 && (
                <p className="text-[11px] text-muted">{formatInr(item.unitPrice)} each</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
