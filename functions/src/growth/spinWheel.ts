import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';
import { validateAuth } from '../utils/validateAuth';
import keywordsBuilder from '../utils/keywordsBuilder';
import { randomCode } from './service/randomCode';

/**
 * One wheel wedge (subset of SpinnerSlotProps in packages/shared we actually consume server-side).
 * Defined locally so functions/ stays free of the workspace package at runtime.
 */
interface SpinSlot {
  label: string;
  type: 'Coupon' | 'Better luck';
  discountType: 'Percentage' | 'Fixed';
  discountValue: number;
  minimumOrderAmount: number;
  maximumDiscount: number;
  probability: number;
}

interface SpinResult {
  resultType: 'Coupon' | 'Better luck';
  slotLabel: string;
  couponCode?: string;
  couponDetails?: {
    code: string;
    discountType: 'Percentage' | 'Fixed';
    discountValue: number;
    minimumOrderAmount: number;
    maximumDiscount: number;
    validUntil: number;
  };
}

/**
 * spinWheel — runs one spin of a live spinner campaign for the signed-in user and, on a win, mints a
 * single-use coupon owned by that user.
 *
 * WHY onCall: only our own app/website calls this via the Firebase client SDK — the callable protocol
 *   hands us a verified req.auth so we never trust a uid from the body.
 * WHY server-side (not the client): the outcome is money (a discount code) and rate-limited eligibility.
 *   The client must not be able to pick its own reward, bypass the per-user spin cap / cooldown, or
 *   forge a coupon — all of which a client-side implementation would allow. The weighted draw, the
 *   eligibility gate, and the coupon creation therefore run here with the Admin SDK.
 * WHY the campaign counters bump in the same batch as the history + coupon writes: totalSpins/totalWins
 *   must stay consistent with the recorded spins; a batch commits them atomically.
 *
 * Request:  { campaignId: string }
 * Response: { resultType, slotLabel, couponCode?, couponDetails? } (couponDetails.validUntil = epoch ms)
 */
export const spinWheel = onCall(async (request): Promise<SpinResult> => {
  const uid = validateAuth(request);

  const { campaignId } = (request.data ?? {}) as { campaignId?: unknown };
  if (typeof campaignId !== 'string' || campaignId.trim() === '') {
    throw new HttpsError('invalid-argument', 'campaignId is required');
  }

  const db = getFirestore();
  const campaignRef = db.collection(Collections.spinnerCampaigns).doc(campaignId);
  const campaignSnap = await campaignRef.get();
  if (!campaignSnap.exists) {
    throw new HttpsError('not-found', 'Campaign not found');
  }
  const campaign = campaignSnap.data() as {
    name?: string;
    slots?: SpinSlot[];
    maxSpinsPerUser?: number;
    spinCooldownHours?: number;
    couponValidityDays?: number;
    isActive?: boolean;
    startDate?: Timestamp;
    endDate?: Timestamp;
  };

  // --- Campaign must be live: active flag + within [startDate, endDate]. ---
  if (!campaign.isActive) {
    throw new HttpsError('failed-precondition', 'This campaign is not active');
  }
  const nowMs = Date.now();
  if (campaign.startDate && nowMs < campaign.startDate.toMillis()) {
    throw new HttpsError('failed-precondition', 'This campaign has not started yet');
  }
  if (campaign.endDate && nowMs > campaign.endDate.toMillis()) {
    throw new HttpsError('failed-precondition', 'This campaign has ended');
  }

  const slots = campaign.slots;
  if (!slots || slots.length === 0) {
    throw new HttpsError('failed-precondition', 'This campaign has no wheel slots configured');
  }

  // --- Eligibility: per-user spin cap, then cooldown since the last spin. ---
  const maxSpinsPerUser = campaign.maxSpinsPerUser ?? 1;
  const historyRef = db.collection(Collections.spinHistory);
  const userSpinsQuery = historyRef.where('campaignId', '==', campaignId).where('userId', '==', uid);

  const countSnap = await userSpinsQuery.count().get();
  const spinCount = countSnap.data().count;
  if (spinCount >= maxSpinsPerUser) {
    throw new HttpsError('failed-precondition', 'Maximum spins reached');
  }

  const cooldownHours = campaign.spinCooldownHours ?? 0;
  if (cooldownHours > 0 && spinCount > 0) {
    const lastSnap = await userSpinsQuery.orderBy('createdAt', 'desc').limit(1).get();
    const lastAt = lastSnap.docs[0]?.get('createdAt') as Timestamp | undefined;
    if (lastAt) {
      const hoursSince = (nowMs - lastAt.toMillis()) / 3_600_000;
      if (hoursSince < cooldownHours) {
        const remaining = Math.ceil(cooldownHours - hoursSince);
        throw new HttpsError('failed-precondition', `Please wait ${remaining} hours`);
      }
    }
  }

  // --- Weighted-random draw: walk the accumulated probability against a 0–100 roll. ---
  const fallbackSlot = slots[slots.length - 1];
  if (!fallbackSlot) {
    throw new HttpsError('failed-precondition', 'This campaign has no wheel slots configured');
  }
  const roll = Math.random() * 100;
  let accumulated = 0;
  let winning: SpinSlot = fallbackSlot; // last slot absorbs any rounding gap below 100
  for (const slot of slots) {
    accumulated += slot.probability;
    if (roll <= accumulated) {
      winning = slot;
      break;
    }
  }

  // Buyer identity for the history record (server-read, not client-supplied).
  const userSnap = await db.collection(Collections.users).doc(uid).get();
  const userData = userSnap.data() as { fullName?: string; phone?: string } | undefined;
  const userName = userData?.fullName ?? '';
  const userPhone = userData?.phone ?? '';

  const isWin = winning.type === 'Coupon';
  const batch = db.batch();

  let couponCode = '';
  let couponId = '';
  let couponDetails: SpinResult['couponDetails'];

  if (isWin) {
    // Mint a single-use coupon for this spin. usageLimit/perUserLimit = 1 make it effectively
    // one-per-user; the code is returned only to this caller and recorded on the spin.
    const couponRef = db.collection(Collections.coupons).doc();
    couponId = couponRef.id;
    couponCode = `SPIN-${randomCode(6)}`;
    const validityDays = campaign.couponValidityDays ?? 0;
    const days = validityDays > 0 ? validityDays : 3; // spec default: spin coupons valid 3 days
    const validFrom = Timestamp.fromMillis(nowMs);
    const validUntil = Timestamp.fromMillis(nowMs + days * 86_400_000);

    batch.set(couponRef, {
      code: couponCode,
      description: `Spin reward from ${campaign.name ?? 'campaign'}`,
      discountType: winning.discountType,
      discountValue: winning.discountValue,
      minimumOrderAmount: winning.minimumOrderAmount,
      maximumDiscount: winning.maximumDiscount,
      usageLimit: 1,
      usedCount: 0,
      perUserLimit: 1,
      validFrom,
      validUntil,
      isActive: true,
      applicableCategories: [],
      applicableProducts: [],
      applicationType: 'All',
      createdBy: uid,
      createdByName: userName,
      keywords: keywordsBuilder(couponCode),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    couponDetails = {
      code: couponCode,
      discountType: winning.discountType,
      discountValue: winning.discountValue,
      minimumOrderAmount: winning.minimumOrderAmount,
      maximumDiscount: winning.maximumDiscount,
      validUntil: validUntil.toMillis(),
    };
  }

  // Record the spin (Better luck spins are recorded too — they count toward the per-user cap).
  const historyDocRef = historyRef.doc();
  batch.set(historyDocRef, {
    campaignId,
    userId: uid,
    userName,
    userPhone,
    slotLabel: winning.label,
    resultType: winning.type,
    couponCode,
    couponId,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Counters: every spin bumps totalSpins; only a coupon win bumps totalWins.
  batch.update(campaignRef, {
    totalSpins: FieldValue.increment(1),
    ...(isWin ? { totalWins: FieldValue.increment(1) } : {}),
  });

  await batch.commit();

  if (isWin) {
    return { resultType: 'Coupon', slotLabel: winning.label, couponCode, couponDetails };
  }
  return { resultType: 'Better luck', slotLabel: winning.label };
});
