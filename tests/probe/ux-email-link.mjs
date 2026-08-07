/**
 * E2E verify: HomePage no longer redirects authed users; Header email is a link
 * to the role dashboard.
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:5173';
const EMAIL = 'admin@saome.org';
const PASSWORD = 'Qwww123123!';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

page.on('pageerror', (err) => console.log('[pageerror]', err.message));

const apiCalls = [];
page.on('response', (resp) => {
  if (resp.url().includes('/api/')) apiCalls.push({ url: resp.url(), status: resp.status() });
});

console.log('=== Step 1: Hard load /login ===');
await page.goto(`${URL}/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

console.log('=== Step 2: Submit login ===');
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);
const loginRespP = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
await page.locator('button[type="submit"]').click();
await loginRespP;
await page.waitForTimeout(1500);

// After login we should be on /admin/dashboard
console.log('Current URL after login:', page.url());
console.log('email link href:', await page.locator('[data-testid="auth-user-email"]').getAttribute('href'));
console.log('email link is <a>:', await page.locator('[data-testid="auth-user-email"]').evaluate(el => el.tagName));

console.log('\n=== Step 3: Click Logo to navigate to / (HomePage) ===');
await page.locator('a[href="/"]').first().click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);

console.log('Current URL after Logo click:', page.url());
console.log('Should NOT have redirected away from /');
console.log('Has marketing hero text:', await page.locator('h1').filter({ hasText: /更多回頭|回頭/ }).count());
console.log('email link still rendered:', await page.locator('[data-testid="auth-user-email"]').count());
console.log('email link href on /:', await page.locator('[data-testid="auth-user-email"]').getAttribute('href'));

console.log('\n=== Step 4: Navigate to /demo via direct URL ===');
await page.goto(`${URL}/demo`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
console.log('Current URL:', page.url());
console.log('email link on /demo:', await page.locator('[data-testid="auth-user-email"]').count());
console.log('Should still see logout btn (no session lost):', await page.locator('[data-testid="desktop-logout-btn"]').count());

console.log('\n=== Step 5: Click email link — should navigate to /admin/dashboard ===');
await page.locator('[data-testid="auth-user-email"]').click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
console.log('Current URL after email click:', page.url());

console.log('\n=== Step 6: Visit /pricing/compare (public route) ===');
await page.goto(`${URL}/pricing/compare`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
console.log('Current URL:', page.url());
console.log('Has email link:', await page.locator('[data-testid="auth-user-email"]').count());
console.log('Should NOT have redirected:', page.url() === `${URL}/pricing/compare`);

console.log('\n=== Step 7: Mobile viewport — email is a clickable link ===');
await ctx.close();
const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 800 } });
const mobilePage = await mobileCtx.newPage();
await mobilePage.goto(`${URL}/login`, { waitUntil: 'networkidle' });
await mobilePage.locator('input[type="email"]').fill(EMAIL);
await mobilePage.locator('input[type="password"]').fill(PASSWORD);
await mobilePage.locator('button[type="submit"]').click();
await mobilePage.waitForTimeout(2000);

await mobilePage.getByRole('button', { name: 'Open menu' }).click();
await mobilePage.waitForTimeout(500);
const mobileEmail = mobilePage.locator('[data-testid="mobile-auth-user-email"]');
console.log('Mobile email tag:', await mobileEmail.evaluate(el => el.tagName));
console.log('Mobile email href:', await mobileEmail.getAttribute('href'));

await browser.close();
console.log('\n=== API call summary ===');
const unique = new Map();
for (const c of apiCalls) unique.set(c.url + ' ' + c.status, c);
for (const c of unique.values()) console.log(' -', c.status, c.url);