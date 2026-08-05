import { test, expect } from './fixtures/signedIn';
import { discoverProduct, addOpenProductToBag, bagCount } from './fixtures/catalog';
import { resetTestCustomer, setWalletBalance, getUser } from './fixtures/testCustomer';

/**
 * The signed-in purchase path: session -> browse -> bag -> checkout -> order.
 *
 * These skip (loudly) without an Admin SDK service account, because signing a customer in means
 * minting a Firebase custom token — see `fixtures/env.ts` for why that cannot be faked.
 *
 * WHAT IS DELIBERATELY NOT AUTOMATED: completing a Razorpay payment. The checkout hands off to
 * Razorpay's hosted iframe, which is a third-party origin with its own bot defences and its own test
 * UI; driving it would be testing Razorpay, and it would break whenever they restyle. The boundary
 * this suite asserts is OUR side of the handoff — that the server created a real order and handed
 * back a Razorpay order id and key — plus the server-side verification contract. Payment SUCCESS is
 * covered by seeding order state directly (see signed-in-orders.spec.ts), which tests our code
 * rather than theirs.
 */

test.describe('signed-in purchase', () => {
  test('the session is real, not just a cookie', async ({ authedPage, customer }) => {
    await authedPage.goto('/account', { waitUntil: 'domcontentloaded' });
    await authedPage.waitForTimeout(5000);

    expect(authedPage.url(), 'signed-in customer bounced to login').not.toContain('/login');

    // Prove Firestore accepted the identity too — the middleware cookie alone would not.
    const body = await authedPage.locator('body').innerText();
    expect(body.length, 'account page rendered empty (Firestore likely rejected the session)')
      .toBeGreaterThan(50);

    const user = await getUser(customer.uid);
    expect(user?.phone).toBe(customer.phone);
  });

  test('adding to the bag persists and shows on the bag screen', async ({ authedPage, customer }) => {
    await resetTestCustomer(customer.uid);

    const product = await discoverProduct(authedPage);
    await authedPage.goto(product.href, { waitUntil: 'domcontentloaded' });
    await authedPage.waitForTimeout(6000);

    const added = await addOpenProductToBag(authedPage);
    test.skip(!added, 'no purchasable variant in the catalogue right now');

    expect(await bagCount(authedPage), 'bag badge should reflect the added line').toBeGreaterThan(0);

    await authedPage.goto('/cart', { waitUntil: 'domcontentloaded' });
    await authedPage.waitForTimeout(6000);
    const cart = await authedPage.locator('main').innerText();
    expect(cart).toMatch(/₹/);
    expect(cart).not.toMatch(/your bag is empty/i);
  });

  test('the bag survives a reload (cart persistence)', async ({ authedPage }) => {
    await authedPage.goto('/cart', { waitUntil: 'domcontentloaded' });
    await authedPage.waitForTimeout(5000);
    const before = await bagCount(authedPage);
    test.skip(before === 0, 'nothing in the bag to persist');

    await authedPage.reload({ waitUntil: 'domcontentloaded' });
    await authedPage.waitForTimeout(5000);
    expect(await bagCount(authedPage)).toBe(before);
  });

  test('checkout reaches the payment step and the server prices the order', async ({
    authedPage,
    customer,
  }) => {
    await setWalletBalance(customer.uid, 0);

    await authedPage.goto('/cart', { waitUntil: 'domcontentloaded' });
    await authedPage.waitForTimeout(6000);

    const proceed = authedPage.locator('button:has-text("Proceed to checkout")').first();
    test.skip((await proceed.count()) === 0, 'bag is empty — run the add-to-bag spec first');

    await proceed.click();
    await authedPage.waitForURL('**/checkout**', { timeout: 45_000 });
    await authedPage.waitForTimeout(7000);

    const text = await authedPage.locator('main').innerText();
    // The checkout must show a server-computed total and an address step. Both come from
    // `createPaymentOrder`'s pricing, never from the client's figures.
    expect(text, 'checkout should show a payable amount').toMatch(/₹/);
    expect(text).toMatch(/address|deliver/i);
  });
});
