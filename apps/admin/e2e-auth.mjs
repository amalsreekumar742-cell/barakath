import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3111';
const PHONE = '8590941583';
const OTP = '123456';
const SHOTS = 'C:/Users/ADMIN/AppData/Local/Temp/claude/d--Totalx-Barakath/d67e4fd6-c19e-4a4c-9218-e921e7debce8/scratchpad/shots';

function log(...args) { console.log(...args); }

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[${page.url()}] ${msg.text().slice(0, 250)}`); });
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror ${page.url()}] ${err.message.slice(0, 250)}`));

  log('=== LOGIN ===');
  await page.goto(`${BASE}/login`, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.locator('#phone').fill(PHONE);
  await page.getByRole('button', { name: /send otp/i }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/auth-1-otp-step.png` });

  for (let i = 0; i < 6; i++) {
    await page.getByLabel(`Digit ${i + 1}`).fill(OTP[i]);
  }
  await page.getByRole('button', { name: /verify.*continue/i }).click();
  await page.waitForTimeout(3000);
  log('after verify URL:', page.url());
  await page.screenshot({ path: `${SHOTS}/auth-2-after-verify.png` });

  // Might land on a profile-completion step for a new/incomplete account, or straight to home.
  const bodyText1 = await page.locator('body').innerText();
  if (/profile|display name|whatsapp/i.test(bodyText1) && page.url().includes('/login')) {
    log('Profile step detected, attempting Skip');
    const skipBtn = page.getByRole('button', { name: /skip/i });
    if (await skipBtn.count() > 0) {
      await skipBtn.click();
      await page.waitForTimeout(2000);
    }
  }
  log('post-login URL:', page.url());
  await page.screenshot({ path: `${SHOTS}/auth-3-post-login.png` });

  const cookies = await context.cookies();
  log('session cookie present:', cookies.some((c) => c.name === 'barakath_session'));

  // ============= WISHLIST =============
  log('=== WISHLIST ===');
  await page.goto(`${BASE}/category/all`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const heart = page.locator('button[aria-label="Add to wishlist"]').first();
  const heartCount = await heart.count();
  log('wishlist heart found on listing:', heartCount);
  if (heartCount > 0) {
    await heart.click();
    await page.waitForTimeout(1500);
  }
  await page.goto(`${BASE}/wishlist`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/auth-4-wishlist.png`, fullPage: true });
  const wishlistBody = await page.locator('body').innerText();
  log('wishlist page has "empty":', /empty/i.test(wishlistBody));

  // ============= ADDRESSES =============
  log('=== ADDRESSES ===');
  await page.goto(`${BASE}/account/addresses`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/auth-5-addresses-before.png`, fullPage: true });
  const addBtn = page.getByRole('button', { name: /add.*address/i }).first();
  const addBtnCount = await addBtn.count();
  log('add address button found:', addBtnCount);
  if (addBtnCount > 0) {
    await addBtn.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/auth-6-address-form.png`, fullPage: true });
    // Fill the form best-effort by label/placeholder heuristics
    const fillIfPresent = async (labelRegex, value) => {
      const loc = page.getByLabel(labelRegex).first();
      if (await loc.count() > 0) { await loc.fill(value); return true; }
      return false;
    };
    await fillIfPresent(/full name|name/i, 'Test Customer');
    await fillIfPresent(/phone/i, '9876543210');
    await fillIfPresent(/flat|building|address line ?1/i, '221B Test Lane');
    await fillIfPresent(/area|address line ?2|landmark/i, 'Near Test Signal');
    await fillIfPresent(/city/i, 'Kochi');
    await fillIfPresent(/pincode|pin code/i, '682001');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/auth-7-address-form-filled.png`, fullPage: true });
    const saveBtn = page.getByRole('button', { name: /save|add address|submit/i }).last();
    if (await saveBtn.count() > 0) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
    }
  }
  await page.screenshot({ path: `${SHOTS}/auth-8-addresses-after.png`, fullPage: true });

  // ============= CART + CHECKOUT =============
  log('=== ADD TO CART ===');
  await page.goto(`${BASE}/category/all`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const productHref = await page.locator('a[href^="/product/"]').first().getAttribute('href');
  log('product:', productHref);
  await page.goto(`${BASE}${productHref}`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const addToBagBtn = page.getByRole('button', { name: /add to bag/i }).first();
  if (await addToBagBtn.count() > 0) {
    await addToBagBtn.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: `${SHOTS}/auth-9-after-add-to-bag.png` });

  await page.goto(`${BASE}/cart`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/auth-10-cart.png`, fullPage: true });
  const cartBody = await page.locator('body').innerText();
  log('cart shows subtotal:', /subtotal/i.test(cartBody));
  log('cart shows place order:', /place order/i.test(cartBody));

  log(JSON.stringify({ consoleErrors }, null, 2));
  await context.close();
  await browser.close();
}

run().catch((e) => { console.error('FATAL', e); process.exit(1); });
