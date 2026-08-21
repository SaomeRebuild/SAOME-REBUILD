/**
 * Full card builder flow: create → select type → Step1 → fill Step2 → trigger PUT
 */
import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs: Array<{ url: string; method: string; status: number; body: string }> = [];
  // Use localhost:5173 because that's what the browser sees (Vite proxy)
  page.on('response', async (r) => {
    const url = r.url();
    if (url.includes('localhost:5173/api/cards/') || url.includes('127.0.0.1:8787/api/cards/')) {
      let body = '';
      try { body = await r.text(); } catch { body = '(empty)'; }
      logs.push({ url, method: r.request().method(), status: r.status(), body });
    }
  });

  page.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error') console.log('[CONSOLE ERROR]', text.substring(0, 300));
    if (text.includes('[handleNext]') || text.includes('[onSave]') || text.includes('[CardBuilderEditor]')) {
      console.log('[DEBUG]', text.substring(0, 200));
    }
  });

  // 1. Login
  console.log('1. Login...');
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'eason1989213@gmail.com');
  await page.fill('input[type="password"]', 'www123123');
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes('login'), { timeout: 10000 });

  // 2. Go to card builder library
  await page.goto('http://localhost:5173/app/dashboard/card-builder');
  await page.waitForTimeout(500);

  // 3. Click 從頭建置
  console.log('2. Clicking 從頭建置...');
  await page.locator('button', { hasText: '從頭建置' }).click();
  await page.waitForURL(/card-builder\?id=/, { timeout: 10000 });

  // 4. Wait for Step 1
  await page.waitForTimeout(2000);

  // 5. Select a card type
  console.log('3. Selecting card type...');
  await page.locator('button[aria-pressed]').first().click();
  await page.waitForTimeout(300);

  // 6. Step 1 → 2
  console.log('4. Step 1 → 2...');
  await page.locator('button', { hasText: /下一步/ }).last().click();
  await page.waitForTimeout(1000);

  // 7. Fill Step 2 fields
  console.log('5. Filling Step 2 fields...');
  await page.locator('#storeName').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#storeName').fill('kkk');
  await page.locator('#issuerName').fill('pppp');
  await page.waitForTimeout(500);

  // 8. Step 2 → 3 — triggers PUT
  console.log('6. Step 2 → 3 (PUT should fire)...');
  await page.locator('button', { hasText: /下一步/ }).last().click();
  await page.waitForTimeout(3000);

  // Report
  console.log('\n=== Backend API Calls ===');
  for (const l of logs) {
    const shortUrl = l.url.replace('http://localhost:5173', '').replace('http://127.0.0.1:8787', '');
    console.log(`\n${l.method} ${l.status} ${shortUrl}`);
    if (l.body && l.body !== '(empty)') {
      console.log('  Body:', l.body.substring(0, 500));
    }
  }
  if (logs.length === 0) console.log('No /api/cards/* calls captured!');

  await browser.close();
}

main().catch(console.error);
