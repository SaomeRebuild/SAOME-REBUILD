/**
 * Verify production backend after wrangler deploy.
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

console.log('=== Step 1: Hard load localhost:5173/login ===');
await page.goto(`${URL}/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

console.log('=== Step 2: Submit login ===');
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);

const loginRespP = page.waitForResponse(r => r.url().endsWith('/api/auth/login'));
await page.locator('button[type="submit"]').click();
const loginResp = await loginRespP;
console.log('login status:', loginResp.status());
console.log('set-cookie:', loginResp.headers()['set-cookie'] ?? '(MISSING)');
const body = await loginResp.json();
console.log('expiresIn:', body.expiresIn);

await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);

const cookies = await ctx.cookies();
console.log('Cookies after login:', cookies.length);
for (const c of cookies) console.log('  -', c.name, c.domain, c.path, c.secure, c.sameSite);

console.log('=== Step 3: After login — Header state ===');
console.log('mobile-logout-btn:', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link:', await page.locator('a[href="/login"]').count());

console.log('=== Step 4: Open mobile menu ===');
const menuBtn = page.getByRole('button', { name: 'Open menu' });
await menuBtn.click();
await page.waitForTimeout(500);
console.log('mobile-logout-btn (mobile menu):', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link (mobile menu):', await page.locator('a[href="/login"]').count());

console.log('=== Step 5: Navigate to /demo ===');
await page.goto(`${URL}/demo`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);

console.log('Current URL:', page.url());
console.log('mobile-logout-btn (after /demo):', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link (after /demo):', await page.locator('a[href="/login"]').count());

console.log('=== Step 6: Open mobile menu on /demo ===');
const menuBtn2 = page.getByRole('button', { name: 'Open menu' });
await menuBtn2.click();
await page.waitForTimeout(500);
console.log('mobile-logout-btn (mobile menu on /demo):', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link (mobile menu on /demo):', await page.locator('a[href="/login"]').count());

const cookies2 = await ctx.cookies();
console.log('Cookies after /demo:', cookies2.length);
for (const c of cookies2) console.log('  -', c.name, c.domain, c.path);

await browser.close();