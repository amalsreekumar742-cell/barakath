import { admin } from './adminSdk';

/**
 * The dedicated E2E customer: created once, reused across runs, and never a real person.
 *
 * WHY a fixed phone number rather than a fresh customer per run: `verifyOTP` keys customers by phone
 * and creates the Firebase Auth account itself, so a random phone per run would leave a trail of
 * orphaned Auth users and `users/` documents in the production project. One stable identity that
 * each spec RESETS to a known state is both cleaner and closer to how a returning customer behaves.
 *
 * The number is deliberately in the +91 99999 range, which is not allocated to real subscribers, so
 * a stray SMS from a misconfigured run cannot reach anyone.
 */
export const TEST_PHONE_E164 = process.env.E2E_CUSTOMER_PHONE || '+919999900001';
export const TEST_NAME = 'E2E Test Customer';

/** Marks every document this suite creates, so cleanup can find them and a human can recognise them. */
export const E2E_MARKER = 'e2e-storefront';

export interface TestCustomer {
  uid: string;
  phone: string;
}

/**
 * Ensure the test customer exists in both Firebase Auth and `users/`, and return its uid.
 *
 * Mirrors the shape `verifyOTP` writes for a brand-new customer — every field it sets, with the same
 * types. If those two drift, the storefront will read a customer document that production could
 * never have produced and the tests stop meaning anything, so this is written as a deliberate mirror
 * rather than a minimal subset.
 */
export async function ensureTestCustomer(): Promise<TestCustomer> {
  const { auth, db, FieldValue } = admin();

  let uid: string;
  try {
    const existing = await auth.getUserByPhoneNumber(TEST_PHONE_E164);
    uid = existing.uid;
  } catch {
    const created = await auth.createUser({ phoneNumber: TEST_PHONE_E164 });
    uid = created.uid;
  }

  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      id: uid,
      fullName: TEST_NAME,
      email: '',
      phone: TEST_PHONE_E164,
      profileImage: '',
      status: 'Active',
      walletBalance: 0,
      affiliateCode: '',
      affiliateBalance: 0,
      affiliateEnabled: false,
      pendingCommission: 0,
      confirmedCommission: 0,
      totalReferrals: 0,
      totalOrders: 0,
      totalSpent: 0,
      keywords: [TEST_PHONE_E164],
      fcmToken: '',
      isE2E: true, // never set by production code — the flag that makes cleanup safe
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return { uid, phone: TEST_PHONE_E164 };
}

/**
 * Mint a custom token — the same artefact `verifyOTP` hands the browser after a successful OTP.
 * This is the one thing in the suite that genuinely cannot be done without a service account, and
 * the reason signed-in specs skip when none is configured.
 */
export async function mintCustomToken(uid: string): Promise<string> {
  const { auth } = admin();
  return auth.createCustomToken(uid);
}

/** Put the customer's wallet at an exact balance so a wallet-payment assertion is deterministic. */
export async function setWalletBalance(uid: string, amount: number): Promise<void> {
  const { db, FieldValue } = admin();
  await db.collection('users').doc(uid).update({
    walletBalance: amount,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function getUser(uid: string): Promise<any> {
  const { db } = admin();
  return (await db.collection('users').doc(uid).get()).data();
}

/** Enable affiliate mode with a known code, for the affiliate-earnings spec. */
export async function setAffiliate(uid: string, code: string | null): Promise<void> {
  const { db, FieldValue } = admin();
  await db
    .collection('users')
    .doc(uid)
    .update({
      affiliateCode: code ?? '',
      affiliateEnabled: code !== null,
      updatedAt: FieldValue.serverTimestamp(),
    });
}

/**
 * Remove orders/drafts this suite created. Deliberately narrow: it only deletes documents belonging
 * to the test uid, and never touches catalogue or settings data.
 *
 * WHY cleanup is best-effort and never fails a test: a leaked test order is untidy, but a teardown
 * that throws turns a passing suite red and hides the real result. Leaks are visible via `isE2E`.
 */
export async function cleanupCustomerOrders(uid: string): Promise<number> {
  const { db } = admin();
  let removed = 0;
  for (const collection of ['orders', 'orderDrafts', 'walletTopUps']) {
    try {
      const snap = await db.collection(collection).where('userId', '==', uid).limit(50).get();
      const batch = db.batch();
      snap.docs.forEach((d: any) => {
        batch.delete(d.ref);
        removed += 1;
      });
      if (!snap.empty) await batch.commit();
    } catch {
      // ignore — see the note above
    }
  }
  return removed;
}

/** Reset the customer to a clean, known state before a spec that depends on one. */
export async function resetTestCustomer(uid: string): Promise<void> {
  await setWalletBalance(uid, 0);
  await setAffiliate(uid, null);
  await cleanupCustomerOrders(uid);
}
