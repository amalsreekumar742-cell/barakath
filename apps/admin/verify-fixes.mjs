import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3111';
const PHONE = '8590941583';
const OTP = '123456';
const SHOTS = 'C:/Users/ADMIN/AppData/Local/Temp/claude/d--Totalx-Barakath/d67e4fd6-c19e-4a4c-9218-e921e7debce8/scratchpad/shots';

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 300)));

  await page.goto(`${BASE}/login`, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.locator('#phone').fill(PHONE);
  await page.getByRole('button', { name: /send otp/i }).click();
  await page.waitForTimeout(4000);

  const body1 = await page.locator('body').innerText();
  if (/could not send|rate|try again later/i.test(body1)) {
    console.log('OTP SEND FAILED (likely still rate-limited):', body1.slice(0, 200));
    await browser.close();
    process.exit(1);
  }

  for (let i = 0; i < 6; i++) {
    await page.getByLabel(`Digit ${i + 1}`).fill(OTP[i]);
  }
  await page.getByRole('button', { name: /verify.*continue/i }).click();
  await page.waitForTimeout(9000);
  console.log('post-login URL:', page.url());

  // #7 & #12: Affiliate Wallet
  await page.goto(`${BASE}/account/affiliate-wallet`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/fix-affiliate-wallet.png`, fullPage: true });
  const awBody = await page.locator('body').innerText();
  console.log('AW: has Withdrawable earnings hero:', /Withdrawable earnings/i.test(awBody));
  console.log('AW: has Withdraw funds panel:', /Withdraw funds/i.test(awBody));

  // Test expand
  const requestBtn = page.getByRole('button', { name: /request withdrawal/i });
  if (await requestBtn.count() > 0 && !(await requestBtn.isDisabled())) {
    await requestBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/fix-affiliate-withdraw-expanded.png`, fullPage: true });
    console.log('AW: withdraw form expanded inline:', /Amount to withdraw/i.test(await page.locator('body').innerText()));
  } else {
    console.log('AW: request withdrawal button disabled or not found (likely below min balance) — skipping expand test');
  }

  // #8 & #9: Spin & Win
  await page.goto(`${BASE}/spin-win`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/fix-spin-win.png`, fullPage: true });
  const spinBody = await page.locator('body').innerText();
  console.log('Spin: page loaded, has My coupons:', /My coupons/i.test(spinBody));

  const spinBtn = page.getByRole('button', { name: /spin now/i });
  if (await spinBtn.count() > 0) {
    await spinBtn.click();
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${SHOTS}/fix-spin-result.png`, fullPage: true });
    console.log('Spin: result shown:', /You won|Better luck/i.test(await page.locator('body').innerText()));
  } else {
    console.log('Spin: no spins available to test result card');
  }

  // #10: Notifications
  await page.goto(`${BASE}/account/notifications`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/fix-notifications.png`, fullPage: true });
  console.log('Notifications: page loaded');

  console.log('errors:', errors);
  await context.close();
  await browser.close();
}

run().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
