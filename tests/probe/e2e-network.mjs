/**
 * E2E with full network visibility to see what's happening on /demo navigation.
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:5173';
const EMAIL = 'admin@saome.org';
const PASSWORD = 'Qwww123123!';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
const page = await ctx.newPage();

page.on('request', (req) => {
  if (req.url().includes('/api/auth/')) {
    const headers = req.headers();
    const cookie = headers.cookie ?? '(none)';
    console.log(`>> ${req.method()} ${req.url()}`);
    console.log(`   Cookie: ${cookie.slice(0, 80)}${cookie.length > 80 ? '...' : ''}`);
  }
});
page.on('response', async (res) => {
  if (res.url().includes('/api/auth/')) {
    const arr = await res.headersArray();
    const setCookie = arr.find(h => h.name.toLowerCase() === 'set-cookie');
    console.log(`<< ${res.status()} ${res.url()}`);
    console.log(`   Set-Cookie: ${setCookie?.value?.slice(0, 80) ?? '(none)'}`);
  }
});

console.log('=== Step 1: /login ===');
await page.goto(`${URL}/login`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);

console.log('\n=== Step 2: Login ===');
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);
await page.locator('button[type="submit"]').click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);

console.log('\n=== Step 3: /demo navigation ===');
await page.goto(`${URL}/demo`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);

console.log('\n=== Step 4: Header state on /demo ===');
const menuBtn = page.getByRole('button', { name: 'Open menu' });
if (await menuBtn.count() > 0) {
  await menuBtn.click();
  await page.waitForTimeout(500);
}
console.log('mobile-logout-btn:', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link:', await page.locator('a[href="/login"]').count());

await browser.close();