import { chromium } from 'playwright';

const URL = 'http://localhost:5173';
const EMAIL = 'admin@saome.org';
const PASSWORD = 'Qwww123123!';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
const page = await ctx.newPage();

page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(`${URL}/login`);
await page.waitForLoadState('networkidle');

console.log('=== Step 1: Login ===');
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);
const loginRespP = page.waitForResponse(r => r.url().endsWith('/api/auth/login'));
await page.locator('button[type="submit"]').click();
const loginResp = await loginRespP;
console.log('login status:', loginResp.status());
console.log('set-cookie header:', loginResp.headers()['set-cookie'] ?? '(missing)');
console.log('Current URL:', page.url());

await page.waitForLoadState('networkidle');

console.log('\n=== Step 2: After login, on /admin/dashboard ===');
console.log('mobile-logout-btn count:', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link count:', await page.locator('a[href="/login"]').count());
console.log('mobile-auth-user-email:', await page.locator('[data-testid="mobile-auth-user-email"]').textContent().catch(() => 'NONE'));

const cookies = await ctx.cookies();
console.log('cookies count:', cookies.length);
for (const c of cookies) console.log('  -', c.name, c.domain, c.path);

console.log('\n=== Step 3: Open mobile menu ===');
const menuBtn = page.getByRole('button', { name: 'Open menu' });
console.log('Menu button count:', await menuBtn.count());
await menuBtn.click();
await page.waitForTimeout(500);

console.log('mobile-logout-btn count:', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link count:', await page.locator('a[href="/login"]').count());

console.log('\n=== Step 4: Click 定價 link (it goes to /#pricing, not /demo) ===');
const pricingLink = page.locator('a[href="/#pricing"]');
console.log('pricing link count:', await pricingLink.count());
await pricingLink.click();
await page.waitForTimeout(1500);
console.log('Current URL:', page.url());

console.log('\n=== Step 5: After clicking 定價 ===');
console.log('mobile-logout-btn count:', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link count:', await page.locator('a[href="/login"]').count());

console.log('\n=== Step 6: Navigate to /demo explicitly ===');
await page.goto(`${URL}/demo`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);

console.log('Current URL:', page.url());
console.log('mobile-logout-btn count:', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link count:', await page.locator('a[href="/login"]').count());

await browser.close();