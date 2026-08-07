/**
 * Full E2E with cookie verification.
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:5173';
const EMAIL = 'admin@saome.org';
const PASSWORD = 'Qwww123123!';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
const page = await ctx.newPage();

// Track responses
page.on('response', async (res) => {
  if (res.url().includes('/api/auth/')) {
    const arr = await res.headersArray();
    const setCookie = arr.find(h => h.name.toLowerCase() === 'set-cookie');
    let body = '';
    try { body = (await res.text()).slice(0, 200); } catch {}
    console.log(`<< ${res.status()} ${res.url()}`);
    if (setCookie) console.log(`   Set-Cookie: ${setCookie.value.slice(0, 80)}...`);
    if (body) console.log(`   Body: ${body}`);
  }
});

console.log('=== Login ===');
await page.goto(`${URL}/login`);
await page.waitForLoadState('networkidle');
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);
await page.locator('button[type="submit"]').click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);

const cookies = await ctx.cookies();
console.log('\n=== Cookies after login ===');
for (const c of cookies) console.log(`  - ${c.name} | ${c.domain} | ${c.path} | secure:${c.secure} | samesite:${c.sameSite}`);

console.log('\n=== Navigate /demo ===');
await page.goto(`${URL}/demo`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2000);

const cookies2 = await ctx.cookies();
console.log('\n=== Cookies after /demo ===');
for (const c of cookies2) console.log(`  - ${c.name} | ${c.domain} | ${c.path}`);

console.log('\n=== Header state ===');
const menuBtn = page.getByRole('button', { name: 'Open menu' });
if (await menuBtn.count() > 0) {
  await menuBtn.click();
  await page.waitForTimeout(500);
}
console.log('mobile-logout-btn:', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link:', await page.locator('a[href="/login"]').count());

// Try /me to see if authenticated
const meResp = await page.evaluate(async () => {
  const r = await fetch('/api/auth/me', { credentials: 'include' });
  return { status: r.status, body: (await r.text()).slice(0, 200) };
});
console.log('\n=== /api/auth/me test ===');
console.log('Status:', meResp.status, 'Body:', meResp.body);

await browser.close();