/**
 * Verify production backend after wrangler deploy — v2.
 * Goal: confirm Set-Cookie + expiresIn: 28800 + session persists across /demo.
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:5173';
const EMAIL = 'admin@saome.org';
const PASSWORD = 'Qwww123123!';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
const page = await ctx.newPage();

page.on('pageerror', (err) => console.log('[pageerror]', err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    console.log(`[browser ${msg.type()}]`, msg.text());
  }
});

// Capture all /api/* requests for diagnosis
const apiCalls = [];
page.on('response', (resp) => {
  const url = resp.url();
  if (url.includes('/api/')) {
    apiCalls.push({ url, status: resp.status() });
  }
});

console.log('=== Step 1: Hard load localhost:5173/login ===');
await page.goto(`${URL}/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

console.log('=== Step 2: Submit login ===');
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);

const loginRespP = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
await page.locator('button[type="submit"]').click();
const loginResp = await loginRespP;
console.log('login status:', loginResp.status());
console.log('set-cookie:', loginResp.headers()['set-cookie'] ?? '(MISSING)');
const body = await loginResp.json();
console.log('expiresIn:', body.expiresIn);

await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);

const cookies = await ctx.cookies();
console.log('Cookies after login:', cookies.length);
for (const c of cookies) console.log('  -', c.name, c.domain, c.path, c.secure, c.sameSite);

console.log('=== Step 3: Header state on /login ===');
console.log('desktop-logout-btn:', await page.locator('[data-testid="desktop-logout-btn"]').count());
console.log('mobile-logout-btn:', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link:', await page.locator('a[href="/login"]').count());
console.log('auth-user-email visible:', await page.locator('[data-testid="auth-user-email"]').count());

console.log('=== Step 4: Open mobile menu ===');
await page.getByRole('button', { name: 'Open menu' }).click();
await page.waitForTimeout(500);
console.log('mobile-logout-btn (mobile menu):', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('mobile-auth-user-email:', await page.locator('[data-testid="mobile-auth-user-email"]').count());

console.log('=== Step 5: Close mobile menu & navigate to /demo via direct goto ===');
await page.getByRole('button', { name: 'Close menu' }).click();
await page.waitForTimeout(500);
// mobile viewport: demo link is in mobile menu; close then goto directly
await page.goto(`${URL}/demo`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

console.log('Current URL:', page.url());
console.log('=== Step 6: Header state on /demo ===');
console.log('desktop-logout-btn:', await page.locator('[data-testid="desktop-logout-btn"]').count());
console.log('mobile-logout-btn:', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link:', await page.locator('a[href="/login"]').count());
console.log('auth-user-email visible:', await page.locator('[data-testid="auth-user-email"]').count());

const cookies2 = await ctx.cookies();
console.log('Cookies after /demo:', cookies2.length);
for (const c of cookies2) console.log('  -', c.name, c.domain, c.path);

console.log('=== Step 7: Open mobile menu on /demo ===');
await page.getByRole('button', { name: 'Open menu' }).click();
await page.waitForTimeout(500);
console.log('mobile-logout-btn (mobile menu on /demo):', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('mobile-auth-user-email:', await page.locator('[data-testid="mobile-auth-user-email"]').count());
console.log('login-link (mobile menu):', await page.locator('a[href="/login"]').count());

console.log('\n=== API call trace ===');
for (const c of apiCalls) console.log(' -', c.status, c.url);

await browser.close();