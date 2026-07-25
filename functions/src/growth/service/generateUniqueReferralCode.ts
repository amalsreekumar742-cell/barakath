import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { Collections } from '../../config/collections';
import { randomCode } from './randomCode';

/**
 * generateUniqueReferralCode — produce a "BAR" + 6-char code that no existing user already holds.
 *
 * WHY server-side + a uniqueness loop: an affiliate code is a lookup key (trackReferralSignup finds
 *   the referrer by `affiliateCode == code`), so a collision would silently mis-attribute commissions.
 *   The client can't run this — it can't read across all users' docs (rules deny it) and can't be
 *   trusted to guarantee uniqueness. We re-query per candidate and only return once it's free.
 * WHY bounded retries: over a 32-symbol alphabet a 6-char collision is astronomically unlikely, so
 *   10 attempts is a generous ceiling; exhausting it means something is wrong (fail closed, not loop).
 */
export async function generateUniqueReferralCode(): Promise<string> {
  const db = getFirestore();
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `BAR${randomCode(6)}`;
    const existing = await db
      .collection(Collections.users)
      .where('affiliateCode', '==', code)
      .limit(1)
      .get();
    if (existing.empty) return code;
  }
  throw new HttpsError('internal', 'Could not generate a unique referral code, please retry');
}
