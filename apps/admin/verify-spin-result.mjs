import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3111';
const PHONE = '8590941583';
const OTP = '123456';
const SHOTS = 'C:/Users/ADMIN/AppData/Local/Temp/claude/d--Totalx-Barakath/d67e4fd6-c19e-4a4c-9218-e921e7debce8/scratchpad/shots';

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.locator('#phone').fill(PHONE);
  await page.getByRole('button', { name: /send otp/i }).click();
  await page.waitForTimeout(4000);
  for (let i = 0; i < 6; i++) await page.getByLabel(`Digit ${i + 1}`).fill(OTP[i]);
  await page.getByRole('button', { name: /verify.*continue/i }).click();
  await page.waitForTimeout(9000);

  await page.goto(`${BASE}/spin-win`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  const spinBtn = page.getByRole('button', { name: /spin now/i });
  if (await spinBtn.count() > 0) {
    await spinBtn.click();
    // Wait generously for the wheel animation + result reveal.
    await page.waitForTimeout(12000);
    await page.screenshot({ path: `${SHOTS}/fix-spin-result-2.png`, fullPage: true });
    console.log('done');
  } else {
    console.log('no spin available');
  }

  await context.close();
  await browser.close();
}

run().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
