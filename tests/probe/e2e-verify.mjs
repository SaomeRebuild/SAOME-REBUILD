/**
 * Final E2E verification — session persistence after Bug-7 fix.
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:5173';
const EMAIL = 'admin@saome.org';
const PASSWORD = 'Qwww123123!';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
const page = await ctx.newPage();

page.on('pageerror', (err) => console.log('[pageerror]', err.message));

console.log('=== Step 1: Load /login ===');
await page.goto(`${URL}/login`);
await page.waitForLoadState('networkidle');

console.log('=== Step 2: Submit login ===');
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);

const loginRespP = page.waitForResponse(r => r.url().endsWith('/api/auth/login'));
await page.locator('button[type="submit"]').click();
const loginResp = await loginRespP;
console.log('login status:', loginResp.status());

// Use headersArray to see Set-Cookie
const arr = await loginResp.headersArray();
const setCookieHdr = arr.find(h => h.name.toLowerCase() === 'set-cookie');
console.log('Set-Cookie raw:', setCookieHdr?.value ?? '(none)');

await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);

console.log('\n=== Step 3: After login, /admin/dashboard ===');
console.log('mobile-logout-btn:', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link:', await page.locator('a[href="/login"]').count());

const cookies = await ctx.cookies();
console.log('\n=== Browser cookies after login ===');
console.log('count:', cookies.length);
for (const c of cookies) console.log('  -', c.name, '|', c.domain, '|', c.path, '|', 'Secure:', c.secure, '|', 'SameSite:', c.sameSite);

console.log('\n=== Step 4: Navigate to /demo (CRITICAL TEST) ===');
await page.goto(`${URL}/demo`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);

console.log('Current URL:', page.url());
console.log('mobile-logout-btn:', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link:', await page.locator('a[href="/login"]').count());
const cookies2 = await ctx.cookies();
console.log('Cookies after /demo:', cookies2.length);
for (const c of cookies2) console.log('  -', c.name, '|', c.domain);

console.log('\n=== Step 5: Open mobile menu on /demo ===');
const menuBtn = page.getByRole('button', { name: 'Open menu' });
if (await menuBtn.count() > 0) {
  await menuBtn.click();
  await page.waitForTimeout(500);
}
console.log('mobile-logout-btn (mobile menu):', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link (mobile menu):', await page.locator('a[href="/login"]').count());

await browser.close();
console.log('\n=== DONE ===');