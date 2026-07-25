import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';
import { validateAdmin } from '../utils/validateAuth';
import { generateUniqueReferralCode } from './service/generateUniqueReferralCode';

/**
 * setAffiliateEnabled — admin flips a customer's `affiliateEnabled` flag from the Customer detail page's
 * "Affiliate marketing" toggle. `affiliateEnabled` only gates wallet/withdraw access (spec: a customer can
 * be an affiliate with wallet access switched off) — it is independent of having an `affiliateCode`.
 *
 * WHY the two cases: turning the toggle ON for a customer with no `affiliateCode` yet also enrolls them
 *   (mints a code) in the same call, since the UI has no separate "allocate" step for this entry point.
 *   Turning it ON/OFF for an existing affiliate is a plain flag flip — their code/balance are untouched.
 * WHY onCall + validateAdmin: only an admin may enrol/gate a customer's affiliate access.
 * WHY server-side code generation: `affiliateCode` is a global lookup key (trackReferralSignup finds the
 *   referrer by equality match) — uniqueness can only be guaranteed server-side (mirrors generateReferralCode).
 *
 * Request:  { userId: string, enabled: boolean }
 * Response: { affiliateCode: string | null, affiliateEnabled: boolean }
 */
export const setAffiliateEnabled = onCall(
  async (request): Promise<{ affiliateCode: string | null; affiliateEnabled: boolean }> => {
    validateAdmin(request);

    const { userId, enabled } = (request.data ?? {}) as { userId?: unknown; enabled?: unknown };
    if (typeof userId !== 'string' || userId.trim() === '') {
      throw new HttpsError('invalid-argument', 'userId is required');
    }
    if (typeof enabled !== 'boolean') {
      throw new HttpsError('invalid-argument', 'enabled must be a boolean');
    }

    const db = getFirestore();
    const userRef = db.collection(Collections.users).doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User not found');
    }

    const existingCode = userSnap.get('affiliateCode') as string | undefined;

    if (enabled && !existingCode) {
      const affiliateCode = await generateUniqueReferralCode();
      await userRef.update({
        affiliateCode,
        affiliateBalance: 0,
        affiliateEnabled: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { affiliateCode, affiliateEnabled: true };
    }

    await userRef.update({ affiliateEnabled: enabled, updatedAt: FieldValue.serverTimestamp() });
    return { affiliateCode: existingCode ?? null, affiliateEnabled: enabled };
  },
);
