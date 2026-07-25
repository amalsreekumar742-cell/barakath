import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { Collections } from '../config/collections';
import { validateAdmin } from '../utils/validateAuth';
import { generateUniqueReferralCode } from './service/generateUniqueReferralCode';

/**
 * generateReferralCode — an admin allocates the affiliate program to a customer by minting a unique
 * referral code onto their user doc.
 *
 * WHY onCall + validateAdmin: only the admin "Allocate affiliate" screen calls this, and enrolling a
 *   customer as an affiliate is an admin-only action — the callable protocol supplies the verified claim.
 * WHY server-side: the code must be globally unique across all users (it's the referral lookup key), a
 *   guarantee only a server that can read across users can make; and seeding affiliateBalance is a
 *   money field the client must never write.
 *
 * Request:  { userId: string }
 * Response: { affiliateCode: string }
 */
export const generateReferralCode = onCall(
  async (request): Promise<{ affiliateCode: string }> => {
    validateAdmin(request);

    const { userId } = (request.data ?? {}) as { userId?: unknown };
    if (typeof userId !== 'string' || userId.trim() === '') {
      throw new HttpsError('invalid-argument', 'userId is required');
    }

    const db = getFirestore();
    const userRef = db.collection(Collections.users).doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User not found');
    }

    const existingCode = userSnap.get('affiliateCode') as string | undefined;
    if (existingCode) {
      throw new HttpsError('failed-precondition', 'This user already has an affiliate code');
    }

    const affiliateCode = await generateUniqueReferralCode();

    await userRef.update({
      affiliateCode,
      affiliateBalance: 0,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { affiliateCode };
  },
);
