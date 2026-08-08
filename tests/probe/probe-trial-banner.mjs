/**
 * Full browser login flow + TrialBanner check.
 * Vite proxy → local wrangler (with fixed code).
 */

import { chromium } from 'playwright';

const FRONTEND = 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  let loginResp = null;
  page.on('response', (r) => {
    if (r.url().includes('/api/auth/login')) loginResp = r;
  });

  const logs = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

  try {
    // 1. Login
    console.log('→ /login...');
    await page.goto(`${FRONTEND}/login`, { timeout: 15000 });
    await page.locator('input[name="email"]').fill('eason1989213@gmail.com');
    await page.locator('input[name="password"]').fill('www123123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/app/dashboard**', { timeout: 30000 });
    console.log('✅ Dashboard:', page.url());
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle').catch(() => {});

    // 2. Print login API response
    if (loginResp) {
      const body = await loginResp.json().catch(() => null);
      console.log('\n--- /api/auth/login response ---');
      console.log('pass:', JSON.stringify(body?.pass, null, 2));
    }

    // 3. Check TrialBanner
    const banners = page.locator('[role="alert"]');
    const count = await banners.count();
    console.log(`\nTrialBanner (role=alert): ${count}`);

    if (count > 0) {
      const text = await banners.first().innerText();
      const aria = await banners.first().getAttribute('aria-label').catch(() => null);
      console.log('✅ FOUND! aria:', aria);
      console.log('   text:', text.replace(/\n/g, ' | '));
    } else {
      // Try broader search
      const trialEls = await page.locator('text=/試用|剩餘|14天|trial/i').allInnerTexts();
      console.log('❌ No TrialBanner. Trial text count:', trialEls.length);
      if (trialEls.length) trialEls.slice(0, 5).forEach(t => console.log('  -', t.slice(0, 80)));
    }

    // 4. Screenshot
    await page.screenshot({
      path: 'c:/Users/user/Desktop/SAOME-REBUILD/trial-banner-probe.png',
      fullPage: true,
    });
    console.log('📸 Screenshot saved');

    if (logs.length) {
      console.log('\n--- Console ---');
      logs.forEach(l => console.log(l));
    }

    console.log('\n⏸ Browser left open — close window to exit');
  } catch (err) {
    console.error('❌ Error:', err.message);
    await page.screenshot({
      path: 'c:/Users/user/Desktop/SAOME-REBUILD/trial-banner-error.png',
      fullPage: true,
    }).catch(() => {});
    console.log('📸 Error screenshot | URL:', page.url());
  }
}

main().catch(console.error);
