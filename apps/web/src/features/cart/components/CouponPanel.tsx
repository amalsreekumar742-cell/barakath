'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Lock, Sparkles, Tag, X } from 'lucide-react';
import type { CouponProps } from '@barakath/shared';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SkeletonText } from '@/components/Skeleton';
import { toastError, toastSuccess } from '@/lib/toast';
import { useAppDispatch } from '@/stores/store';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import {
  getEligibleCoupons,
  validateCode,
  toAppliedCoupon,
  type EligibleCoupon,
  type LockedCoupon,
} from '@/lib/commerce/coupons';
import { formatInr } from '@/components/catalog/PriceBlock';
import type { CartItem, AppliedCoupon } from '@/types/cart';
import { applyCoupon, removeCoupon } from '../stores/cartSlice';

export interface CouponPanelProps {
  /** In-stock cart lines only — an out-of-stock line must not count toward coupon eligibility, the
   *  same exclusion `computeTotals`' input applies (see `CartSection`). */
  items: CartItem[];
  appliedCoupon: AppliedCoupon | null;
  uid: string | null;
  isAuthenticated: boolean;
}

/** A single applicable/spin-won coupon row with its Apply action. */
function CouponRow({
  coupon,
  discount,
  isSpinWon,
  isApplied,
  onApply,
}: {
  coupon: CouponProps;
  discount: number;
  isSpinWon: boolean;
  isApplied: boolean;
  onApply: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border-strong px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Tag size={13} className="shrink-0 text-primary" aria-hidden />
          <span className="truncate text-sm font-semibold text-foreground">{coupon.code}</span>
          {isSpinWon && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-strong">
              <Sparkles size={10} aria-hidden /> Spin win
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted">{coupon.description}</p>
        <p className="text-xs font-medium text-success">Save {formatInr(discount)}</p>
      </div>
      <Button
        type="button"
        variant={isApplied ? 'secondary' : 'primary'}
        size="sm"
        disabled={isApplied}
        onClick={onApply}
      >
        {isApplied ? 'Applied' : 'Apply'}
      </Button>
    </div>
  );
}

/** A locked coupon — greyed, with the unlock hint spec 2.12 requires instead of hiding it outright. */
function LockedCouponRow({ coupon, reason, isSpinWon }: LockedCoupon) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2.5 opacity-60">
      <Lock size={14} className="shrink-0 text-faint" aria-hidden />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">{coupon.code}</span>
          {isSpinWon && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              <Sparkles size={10} aria-hidden /> Spin win
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted">{coupon.description}</p>
        <p className="text-xs font-medium text-muted">{reason}</p>
      </div>
    </div>
  );
}

/**
 * Apply-coupon UI (spec 2.12): manual code entry, then the classified eligible-coupon list grouped
 * "From your spins" / "Available for you" / locked (greyed, with unlock hint). Only ONE coupon may be
 * applied at once — picking a second while one is already applied asks for confirmation first.
 *
 * WHY this renders on `/checkout` (`CheckoutSection`), not `/cart`: the design puts the full apply UI
 * on the Checkout screen's own "Apply coupon" card; `/cart`'s `CartSection` shows only a compact
 * applied/not-applied summary that links into checkout. This component is Cart-feature-owned (it
 * dispatches `cartSlice`'s `applyCoupon`/`removeCoupon`) but composed from the Checkout screen — the
 * cross-feature import (`features/checkout` → `features/cart`'s public component) is the one
 * deliberate exception `eslint.config.mjs`'s `FEATURES` zone allows, same direction as `address`.
 *
 * WHY the "From your spins" split is done by filtering `getEligibleCoupons`' own `isSpinWon` flag
 * rather than a second call to `getSpinWonCoupons`: both read the exact same `coupons` collection: one
 * fetch classifies AND groups in one pass, per WEB_BATCH3_NOTES.md §3's own suggestion ("or the
 * available/locked results filtered by isSpinWon").
 *
 * WHY applying (manual code or a listed coupon) is gated by `useRequireAuth`: `toAppliedCoupon`/
 * `validateCode`/`getEligibleCoupons` all need a real `uid` (a spin-won coupon's `createdBy` has no
 * meaning for a guest, and there is no "my coupons" without an account) — the same gate
 * `ProductExperience`'s "Add to bag" already applies for the same reason (an action that needs a uid,
 * on a page guests can otherwise browse).
 */
export function CouponPanel({ items, appliedCoupon, uid, isAuthenticated }: CouponPanelProps) {
  const dispatch = useAppDispatch();
  const { requireAuth } = useRequireAuth();

  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [available, setAvailable] = useState<EligibleCoupon[]>([]);
  const [locked, setLocked] = useState<LockedCoupon[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // Re-classify whenever the signed-in identity or the (bounded) set of in-stock lines/quantities
  // changes — both minimum-order-amount and category/product applicability depend on the cart's
  // current contents, not just its item ids.
  const itemsSignature = items
    .map((i) => `${i.productId}:${i.variantId}:${i.quantity}:${i.unitPrice}`)
    .sort()
    .join('|');

  useEffect(() => {
    if (!uid) {
      setAvailable([]);
      setLocked([]);
      return;
    }
    let cancelled = false;
    setListLoading(true);
    getEligibleCoupons(uid, items)
      .then((result) => {
        if (cancelled) return;
        setAvailable(result.available);
        setLocked(result.locked);
      })
      .catch((error) => {
        if (!cancelled) toastError(error, 'Could not load your available coupons.');
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, itemsSignature]);

  // A coupon selected to apply while a DIFFERENT one is already applied — held here until the
  // replace-confirmation dialog resolves it, per spec 2.12 "only one coupon at a time".
  const [pendingApply, setPendingApply] = useState<AppliedCoupon | null>(null);

  function commitApply(next: AppliedCoupon) {
    dispatch(applyCoupon(next));
    toastSuccess(`Coupon ${next.code} applied.`);
    setCode('');
    setValidationError(null);
  }

  function requestApply(next: AppliedCoupon) {
    if (appliedCoupon && appliedCoupon.code !== next.code) {
      setPendingApply(next);
      return;
    }
    commitApply(next);
  }

  function onApplyListed(coupon: CouponProps) {
    requireAuth(() => requestApply(toAppliedCoupon(coupon, uid!)));
  }

  function onSubmitCode(e: FormEvent) {
    e.preventDefault();
    requireAuth(async () => {
      setValidating(true);
      setValidationError(null);
      try {
        const result = await validateCode(code, uid!, items);
        if (!result.ok) {
          setValidationError(result.reason);
          return;
        }
        requestApply(toAppliedCoupon(result.coupon, uid!));
      } catch (error) {
        toastError(error, 'Could not validate that coupon right now.');
      } finally {
        setValidating(false);
      }
    });
  }

  function onRemoveApplied() {
    dispatch(removeCoupon());
    toastSuccess('Coupon removed.');
  }

  const spinAvailable = available.filter((a) => a.isSpinWon);
  const regularAvailable = available.filter((a) => !a.isSpinWon);
  const hasAnyListed = spinAvailable.length > 0 || regularAvailable.length > 0 || locked.length > 0;

  return (
    <div>
      <p className="font-display text-base font-semibold text-foreground">Apply a coupon</p>

      <form onSubmit={onSubmitCode} className="mt-3 flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter coupon code"
          aria-label="Coupon code"
          className="h-11 flex-1 rounded-md border border-border-strong bg-surface px-3 text-sm uppercase text-foreground placeholder:normal-case placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        <Button type="submit" variant="secondary" loading={validating} disabled={!code.trim()}>
          Apply
        </Button>
      </form>
      {validationError && <p className="mt-1.5 text-xs font-medium text-error">{validationError}</p>}

      {appliedCoupon && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-primary bg-primary-subtle px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <Tag size={14} className="shrink-0 text-primary" aria-hidden />
            <span className="truncate text-sm font-semibold text-foreground">{appliedCoupon.code}</span>
            {appliedCoupon.isSpinWon && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-strong">
                <Sparkles size={10} aria-hidden /> Spin win
              </span>
            )}
            <span className="truncate text-xs text-muted">{appliedCoupon.description}</span>
          </div>
          <button
            type="button"
            onClick={onRemoveApplied}
            aria-label="Remove applied coupon"
            className="shrink-0 rounded-md p-1 text-muted hover:bg-surface hover:text-error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {!isAuthenticated && (
        <p className="mt-3 text-xs text-muted">Sign in to see coupons available for your bag.</p>
      )}

      {isAuthenticated && listLoading && (
        <div className="mt-3 space-y-2" aria-busy="true">
          <SkeletonText width="w-full" className="h-10" />
          <SkeletonText width="w-full" className="h-10" />
        </div>
      )}

      {isAuthenticated && !listLoading && hasAnyListed && (
        <div className="mt-4 space-y-4">
          {spinAvailable.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                From your spins
              </p>
              <div className="space-y-2">
                {spinAvailable.map((a) => (
                  <CouponRow
                    key={a.coupon.id}
                    coupon={a.coupon}
                    discount={a.discount}
                    isSpinWon
                    isApplied={appliedCoupon?.code === a.coupon.code}
                    onApply={() => onApplyListed(a.coupon)}
                  />
                ))}
              </div>
            </div>
          )}

          {regularAvailable.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Available for you
              </p>
              <div className="space-y-2">
                {regularAvailable.map((a) => (
                  <CouponRow
                    key={a.coupon.id}
                    coupon={a.coupon}
                    discount={a.discount}
                    isSpinWon={false}
                    isApplied={appliedCoupon?.code === a.coupon.code}
                    onApply={() => onApplyListed(a.coupon)}
                  />
                ))}
              </div>
            </div>
          )}

          {locked.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Locked</p>
              <div className="space-y-2">
                {locked.map((l) => (
                  <LockedCouponRow key={l.coupon.id} {...l} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-faint" title="createPaymentOrder re-validates the coupon server-side and can still decline it (for example, a per-account usage limit this page cannot check).">
        The final discount is confirmed when you pay — a coupon shown here can still be declined at checkout.
      </p>

      <ConfirmDialog
        isOpen={pendingApply !== null}
        title="Replace applied coupon?"
        description={
          pendingApply
            ? `Only one coupon can be applied at a time. Apply ${pendingApply.code} instead of ${appliedCoupon?.code}?`
            : undefined
        }
        confirmLabel="Replace"
        onConfirm={() => {
          if (pendingApply) commitApply(pendingApply);
          setPendingApply(null);
        }}
        onClose={() => setPendingApply(null)}
      />
    </div>
  );
}
