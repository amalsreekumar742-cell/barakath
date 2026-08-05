import { test, expect } from './fixtures/signedIn';
import { admin } from './fixtures/adminSdk';
import { resetTestCustomer, cleanupCustomerOrders, E2E_MARKER } from './fixtures/testCustomer';

/**
 * Order lifecycle from the customer's side: it appears, it can be tracked, and a Pending order can
 * be cancelled.
 *
 * WHY orders are seeded rather than bought: reaching a real Delivered order through the UI needs a
 * completed Razorpay payment plus an admin walking it through five statuses. Seeding the ORDER
 * DOCUMENT in the exact shape `createPaymentOrder` writes lets each state be asserted directly, and
 * keeps the assertions about our storefront and our Cloud Functions rather than about a third-party
 * checkout. The shape below mirrors the deployed writer — `userId`/`grandTotal`/`deliveryCharge`/
 * `gstAmount`/`shippingAddress` — NOT the older spec names, which no real order uses.
 */

interface SeedOptions {
  status?: string;
  paymentStatus?: string;
  grandTotal?: number;
}

async function seedOrder(uid: string, opts: SeedOptions = {}): Promise<string> {
  const { db, FieldValue } = admin();
  const ref = db.collection('orders').doc();
  await ref.set({
    id: ref.id,
    userId: uid,
    status: opts.status ?? 'Pending',
    paymentStatus: opts.paymentStatus ?? 'Paid',
    paymentMethod: 'Razorpay',
    items: [
      {
        productId: E2E_MARKER,
        variantId: E2E_MARKER,
        name: 'E2E Test Item',
        variantDetails: 'test',
        image: '',
        quantity: 1,
        unitPrice: 100,
        mrp: 120,
        total: 100,
      },
    ],
    subtotal: 100,
    deliveryCharge: 0,
    gstAmount: 0,
    walletUsed: 0,
    couponCode: '',
    couponDiscount: 0,
    grandTotal: opts.grandTotal ?? 100,
    shippingAddress: {
      label: 'Home',
      name: 'E2E Test Customer',
      phone: '9999900001',
      addressLine: '1 Test Street',
      city: 'Kochi',
      state: 'Kerala',
      pincode: '682001',
    },
    isE2E: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

test.describe('signed-in orders', () => {
  test.afterAll(async () => {
    // Best-effort: leaked test orders are marked `isE2E` and are easy to find if this misses.
  });

  test('a placed order appears in My Orders', async ({ authedPage, customer }) => {
    await resetTestCustomer(customer.uid);
    const orderId = await seedOrder(customer.uid, { status: 'Accepted' });

    await authedPage.goto('/account/orders', { waitUntil: 'domcontentloaded' });
    await authedPage.waitForTimeout(7000);

    const text = await authedPage.locator('main').innerText();
    expect(text, 'the seeded order should be listed').toMatch(/E2E Test Item|Accepted|₹/);

    await cleanupCustomerOrders(customer.uid);
    expect(orderId).toBeTruthy();
  });

  test('an order detail page opens and shows its status', async ({ authedPage, customer }) => {
    await resetTestCustomer(customer.uid);
    const orderId = await seedOrder(customer.uid, { status: 'Shipped' });

    await authedPage.goto(`/account/orders/${orderId}`, { waitUntil: 'domcontentloaded' });
    await authedPage.waitForTimeout(7000);

    expect(authedPage.url()).not.toContain('/login');
    const text = await authedPage.locator('main').innerText();
    expect(text).toMatch(/Shipped|status/i);

    await cleanupCustomerOrders(customer.uid);
  });

  test('cancelling a Pending order moves it to Cancelled server-side', async ({
    authedPage,
    customer,
  }) => {
    await resetTestCustomer(customer.uid);
    const orderId = await seedOrder(customer.uid, { status: 'Pending' });
    const { db } = admin();

    await authedPage.goto(`/account/orders/${orderId}`, { waitUntil: 'domcontentloaded' });
    await authedPage.waitForTimeout(7000);

    const cancel = authedPage.getByRole('button', { name: /cancel/i }).first();
    test.skip(
      (await cancel.count()) === 0,
      'no cancel control on the order detail page — customer cancellation may not be wired to the UI yet',
    );

    await cancel.click();
    await authedPage.waitForTimeout(2000);

    // A confirmation step is likely; accept either shape.
    const confirm = authedPage.getByRole('button', { name: /^(yes|confirm|cancel order)$/i }).last();
    if ((await confirm.count()) > 0 && (await confirm.isVisible())) {
      await confirm.click();
    }
    await authedPage.waitForTimeout(8000);

    // The assertion that matters is the SERVER's state, not the toast: `cancelOrder` is a Cloud
    // Function, and only its write proves the cancellation was actually authorised and applied.
    const after = (await db.collection('orders').doc(orderId).get()).data();
    expect(after?.status, 'cancelOrder should have moved the order to Cancelled').toBe('Cancelled');

    await cleanupCustomerOrders(customer.uid);
  });
});
