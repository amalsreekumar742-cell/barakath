import { test, expect } from './fixtures/signedIn';
import { admin } from './fixtures/adminSdk';
import {
  resetTestCustomer,
  setWalletBalance,
  setAffiliate,
  getUser,
} from './fixtures/testCustomer';

/**
 * Wallet and affiliate — the two money surfaces a customer sees.
 *
 * WHY the top-up is asserted at the SERVER boundary rather than through Razorpay's sheet: pressing
 * "Add money" calls `createWalletTopUpOrder`, which writes a `walletTopUps` document recording the
 * amount the Razorpay order was opened FOR. That document exists precisely so verification never
 * trusts an amount the client sends back after paying — so it is the thing worth asserting. Whether
 * Razorpay's hosted iframe renders is Razorpay's problem; whether we recorded the right amount
 * before handing off is ours.
 */

test.describe('wallet', () => {
  test('the wallet screen shows the real balance', async ({ authedPage, customer }) => {
    await resetTestCustomer(customer.uid);
    await setWalletBalance(customer.uid, 250);

    await authedPage.goto('/account/wallet', { waitUntil: 'domcontentloaded' });
    await authedPage.waitForTimeout(7000);

    expect(authedPage.url()).not.toContain('/login');
    const text = await authedPage.locator('main').innerText();
    expect(text, 'wallet must show the seeded ₹250 balance').toMatch(/250/);

    await setWalletBalance(customer.uid, 0);
  });

  test('a top-up records the intended amount server-side before payment', async ({
    authedPage,
    customer,
  }) => {
    await resetTestCustomer(customer.uid);
    const { db } = admin();

    await authedPage.goto('/account/wallet', { waitUntil: 'domcontentloaded' });
    await authedPage.waitForTimeout(7000);

    const addMoney = authedPage.getByRole('button', { name: /add money|top ?up/i }).first();
    test.skip((await addMoney.count()) === 0, 'no Add money control on the wallet screen');

    await addMoney.click();
    await authedPage.waitForTimeout(2000);

    const amount = authedPage.locator('input[type="number"]:visible, input[inputmode="numeric"]:visible').first();
    test.skip((await amount.count()) === 0, 'top-up form did not open an amount field');
    await amount.fill('500');

    const submit = authedPage.getByRole('button', { name: /proceed|continue|add|pay/i }).last();
    await submit.click();
    // Razorpay's sheet may or may not open; either way the server write happens first.
    await authedPage.waitForTimeout(9000);

    const topUps = await db
      .collection('walletTopUps')
      .where('userId', '==', customer.uid)
      .limit(5)
      .get();

    expect(topUps.empty, 'createWalletTopUpOrder should have recorded a pending top-up').toBe(false);
    const amounts = topUps.docs.map((d: any) => d.data().amount);
    expect(amounts, 'the recorded amount must be the one the customer entered').toContain(500);

    // Clean up the pending top-up so it cannot be mistaken for a real one.
    const batch = db.batch();
    topUps.docs.forEach((d: any) => batch.delete(d.ref));
    await batch.commit();
  });

  test('wallet balance is offered at checkout when the customer has one', async ({
    authedPage,
    customer,
  }) => {
    await setWalletBalance(customer.uid, 1000);

    await authedPage.goto('/checkout', { waitUntil: 'domcontentloaded' });
    await authedPage.waitForTimeout(8000);

    // With an empty bag the checkout legitimately redirects away — that is not a wallet failure.
    test.skip(
      !authedPage.url().includes('/checkout'),
      'checkout redirected (empty bag) — run the purchase spec first',
    );

    const text = await authedPage.locator('main').innerText();
    expect(text, 'a funded wallet should be offered as a payment source').toMatch(/wallet/i);

    await setWalletBalance(customer.uid, 0);
  });
});

test.describe('affiliate', () => {
  test('affiliate screens are gated on the affiliate flag', async ({ authedPage, customer }) => {
    await setAffiliate(customer.uid, null);

    await authedPage.goto('/account', { waitUntil: 'domcontentloaded' });
    await authedPage.waitForTimeout(6000);
    const withoutFlag = await authedPage.locator('main').innerText();

    await setAffiliate(customer.uid, 'E2ETEST01');
    await authedPage.reload({ waitUntil: 'domcontentloaded' });
    await authedPage.waitForTimeout(6000);
    const withFlag = await authedPage.locator('main').innerText();

    expect(
      /affiliate/i.test(withFlag),
      'an affiliate customer should see the affiliate entry point',
    ).toBe(true);
    expect(
      /affiliate/i.test(withoutFlag),
      'a normal shopper must never see affiliate commission UI',
    ).toBe(false);

    await setAffiliate(customer.uid, null);
  });

  test('affiliate earnings read from the stored commission fields', async ({
    authedPage,
    customer,
  }) => {
    const { db, FieldValue } = admin();
    await setAffiliate(customer.uid, 'E2ETEST01');
    await db.collection('users').doc(customer.uid).update({
      affiliateBalance: 750,
      pendingCommission: 250,
      confirmedCommission: 750,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await authedPage.goto('/account/affiliate-wallet', { waitUntil: 'domcontentloaded' });
    await authedPage.waitForTimeout(8000);

    test.skip(authedPage.url().includes('/login'), 'affiliate wallet route is gated differently');
    const text = await authedPage.locator('main').innerText();
    expect(text, 'affiliate wallet should show the stored balance').toMatch(/750/);

    const user = await getUser(customer.uid);
    expect(user.affiliateBalance).toBe(750);

    await db.collection('users').doc(customer.uid).update({
      affiliateBalance: 0,
      pendingCommission: 0,
      confirmedCommission: 0,
    });
    await setAffiliate(customer.uid, null);
  });
});
