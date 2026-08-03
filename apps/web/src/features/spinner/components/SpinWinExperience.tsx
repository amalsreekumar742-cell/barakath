'use client';

import { useEffect, useRef, useState } from 'react';
import { Ticket } from 'lucide-react';
import { formatValidityWindow, resolveValidityHours } from '@barakath/shared/utils/spinValidity';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonText } from '@/components/Skeleton';
import { toastError } from '@/lib/toast';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { fetchActiveCampaign } from '../api/fetchActiveCampaign';
import { fetchSpinAllowance } from '../api/fetchSpinAllowance';
import { submitSpin } from '../api/submitSpin';
import { clearSpinResult } from '../stores/spinnerSlice';
import { findSlotIndex } from '../utils/findSlotIndex';
import { SpinResultCard } from './SpinResultCard';
import { SpinWheel, SPIN_TRANSITION_MS } from './SpinWheel';

/** Full turns before the wheel settles — purely a "read as a spin" feel, mirrors
 *  `apps/app/lib/features/spinner/presentation/pages/spin_page.dart`'s identical `_fullTurns`. */
const FULL_TURNS = 5;

export interface SpinWinExperienceProps {
  /** Fired after a WIN's landing animation finishes — never on a loss, since nothing in the coupon
   *  wallet changed. The `/spin-win` route uses this to refresh the embedded `CouponWallet`; this
   *  component has no idea `CouponWallet` exists (see that route file's header comment on why the
   *  composition happens there, not here). */
  onWin?: () => void;
}

/**
 * The wheel half of spec §3.14: title, spins-remaining chip, wheel, spin button, inline result. The
 * coupon-wallet half is composed by the ROUTE, not here.
 *
 * THE SEQUENCE IS THE FEATURE, and the order is not negotiable (mirrors the Flutter spin page exactly):
 *   1. disable the button, enter the spinning state
 *   2. call `spinWheel({ campaignId })` — the server picks the outcome, never this component
 *   3. take the `slotLabel` the server returned, find its wedge (`findSlotIndex`), animate onto it
 *   4. reveal the result INLINE only once that animation finishes
 *   5. re-read spins remaining from the server (never a local decrement)
 * A rejected call never animates the wheel — that would be a spin that lies about what happened. It is
 * a toast (the callable's own human-readable message) plus a state refresh instead.
 */
export function SpinWinExperience({ onWin }: SpinWinExperienceProps) {
  const dispatch = useAppDispatch();
  const authLoading = useAppSelector((s) => s.auth.authLoading);
  const uid = useAppSelector((s) => s.auth.uid);
  const { campaign, campaignLoading, spinsRemaining, nextSpinAt, spinning, lastResult, error } = useAppSelector(
    (s) => s.spinner,
  );

  // The wheel's own rotation is pure presentation state — it must persist across renders (so a second
  // spin continues from wherever the wheel stopped, never snapping back to 12 o'clock) but has no
  // business living in Redux, since nothing else in the app reads it.
  const [rotationDeg, setRotationDeg] = useState(0);
  const [animating, setAnimating] = useState(false);
  const rotationRef = useRef(0);
  const hasRequestedCampaignRef = useRef(false);

  useEffect(() => {
    if (hasRequestedCampaignRef.current) return;
    hasRequestedCampaignRef.current = true;
    void dispatch(fetchActiveCampaign());
  }, [dispatch]);

  useEffect(() => {
    if (!campaign || !uid) return;
    void dispatch(
      fetchSpinAllowance({
        campaignId: campaign.id,
        uid,
        maxSpinsPerUser: campaign.maxSpinsPerUser,
        cooldownHours: campaign.spinCooldownHours,
      }),
    );
  }, [campaign, uid, dispatch]);

  /** Turns `FULL_TURNS` times, then lands the pointer on wedge `index` of `slotCount` — never backward,
   *  continuing from wherever the wheel last stopped. Resolves once the CSS transition has actually had
   *  time to finish, which is what gates the result card's reveal. */
  function animateToIndex(index: number, slotCount: number): Promise<void> {
    return new Promise((resolve) => {
      const sweep = 360 / slotCount;
      // Wedge `index`'s centre sits at (index + 0.5) * sweep in the UNROTATED wheel (wedge 0 starts at
      // 12 o'clock, clockwise). Rotating the wheel by `360 - centre` brings that centre back under the
      // fixed pointer at the top.
      const targetOffset = 360 - (index + 0.5) * sweep;
      const current = rotationRef.current % 360;
      let delta = targetOffset - current;
      while (delta < 0) delta += 360;
      const end = rotationRef.current + FULL_TURNS * 360 + delta;

      rotationRef.current = end;
      setAnimating(true);
      setRotationDeg(end);
      window.setTimeout(() => {
        setAnimating(false);
        resolve();
      }, SPIN_TRANSITION_MS);
    });
  }

  async function refreshAllowance() {
    if (!campaign || !uid) return;
    await dispatch(
      fetchSpinAllowance({
        campaignId: campaign.id,
        uid,
        maxSpinsPerUser: campaign.maxSpinsPerUser,
        cooldownHours: campaign.spinCooldownHours,
      }),
    );
  }

  async function handleSpin() {
    if (!campaign || campaign.slots.length === 0 || spinning || animating) return;
    dispatch(clearSpinResult());

    const action = await dispatch(submitSpin({ campaignId: campaign.id }));
    if (submitSpin.rejected.match(action)) {
      // Rejected server-side (no spins left, campaign ended, cooldown active) — no animation, just the
      // callable's own message and a re-sync so the button reflects reality.
      toastError(action.payload, 'Could not spin right now. Please try again.');
      await refreshAllowance();
      return;
    }

    const result = action.payload;
    const index = findSlotIndex(campaign.slots, result.slotLabel);
    await animateToIndex(index, campaign.slots.length);

    await refreshAllowance();
    if (result.resultType === 'Coupon') onWin?.();
  }

  if (campaignLoading || authLoading) return <SpinWinSkeleton />;

  if (!campaign) {
    return error ? (
      <EmptyState icon={<Ticket size={40} />} title="Could not load the wheel" subtitle={error} />
    ) : (
      <EmptyState
        icon={<Ticket size={40} />}
        title="No spin campaign running right now"
        subtitle="Check back soon for the next Spin & Win."
      />
    );
  }

  const outOfSpins = spinsRemaining <= 0;
  const cooldownActive = !!nextSpinAt && nextSpinAt > Date.now();
  const cooldownHoursLeft = cooldownActive ? Math.max(1, Math.ceil((nextSpinAt! - Date.now()) / 3_600_000)) : 0;
  const busy = spinning || animating;

  return (
    <div className="flex flex-col items-center">
      <div className="mt-6">
        <SpinWheel slots={campaign.slots} rotationDeg={rotationDeg} />
      </div>

      {/* Design marker 11 bakes the spins-remaining count straight into the button label ("Spin now ·
       *  N spins left") rather than a separate chip above the wheel. */}
      <div className="mt-6">
        {cooldownActive ? (
          <p className="text-center text-xs text-muted">
            Come back in {cooldownHoursLeft} {cooldownHoursLeft === 1 ? 'hour' : 'hours'} for your next spin.
          </p>
        ) : outOfSpins ? (
          <p className="text-center text-xs text-muted">You have used all your spins for this campaign.</p>
        ) : (
          <Button size="lg" loading={busy} onClick={handleSpin}>
            Spin now · {spinsRemaining} spin{spinsRemaining === 1 ? '' : 's'} left
          </Button>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-faint">
        Rewards become coupons · valid {formatValidityWindow(resolveValidityHours(campaign))}
      </p>

      {lastResult && !animating && (
        <SpinResultCard
          result={lastResult}
          spinsRemaining={spinsRemaining}
          spinning={spinning}
          onSpinAgain={handleSpin}
        />
      )}
    </div>
  );
}

function SpinWinSkeleton() {
  return (
    <div className="flex flex-col items-center" aria-busy="true">
      <SkeletonText width="w-40" className="h-7" />
      <SkeletonText width="w-24" className="mt-3 h-6 rounded-full" />
      <div className="mt-6 size-[280px] animate-pulse rounded-full bg-border" />
      <SkeletonText width="w-32" className="mt-6 h-11" />
    </div>
  );
}
