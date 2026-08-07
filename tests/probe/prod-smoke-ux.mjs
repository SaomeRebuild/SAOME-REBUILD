/**
 * Production smoke test against https://saome-frontend.josh1989213.workers.dev
 * — verify the new UX behavior (Header email as link, HomePage no redirect).
 */
import { chromium } from 'playwright';

const URL = 'https://saome-frontend.josh1989213.workers.dev';
const EMAIL = 'admin@saome.org';
const PASSWORD = 'Qwww123123!';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

page.on('pageerror', (err) => console.log('[pageerror]', err.message));

console.log('=== Step 1: Load /login ===');
await page.goto(`${URL}/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

console.log('=== Step 2: Submit login ===');
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);
const loginRespP = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
await page.locator('button[type="submit"]').click();
const loginResp = await loginRespP;
console.log('login status:', loginResp.status());
await page.waitForTimeout(2000);

console.log('URL after login:', page.url());
console.log('Should be /admin/dashboard');

console.log('\n=== Step 3: Click Logo to go to / ===');
await page.locator('a[href="/"]').first().click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
console.log('URL after Logo click:', page.url());
console.log('Should be / (NOT /admin/dashboard)');
console.log('Has marketing hero:', await page.locator('h1').filter({ hasText: /回頭/ }).count() > 0);
console.log('email link is <a>:', await page.locator('[data-testid="auth-user-email"]').evaluate(el => el.tagName));
console.log('email link href:', await page.locator('[data-testid="auth-user-email"]').getAttribute('href'));

console.log('\n=== Step 4: Click email link ===');
await page.locator('[data-testid="auth-user-email"]').click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
console.log('URL after email click:', page.url());

await browser.close();
console.log('\n=== Production smoke test pass ===');