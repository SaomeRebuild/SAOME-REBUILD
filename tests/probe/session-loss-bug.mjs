/**
 * Session-loss bug repro probe (simplified).
 */

import { chromium } from 'playwright';

const URL = 'http://localhost:5173';
const EMAIL = 'admin@saome.org';
const PASSWORD = 'Qwww123123!';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
const page = await ctx.newPage();

// Capture console logs
page.on('console', (msg) => console.log(`[browser ${msg.type()}]`, msg.text()));
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

// Capture network requests for /api/auth/*
page.on('request', (req) => {
  if (req.url().includes('/api/auth/')) {
    console.log(`>> ${req.method()} ${req.url()}`);
  }
});
page.on('response', async (res) => {
  if (res.url().includes('/api/auth/')) {
    const text = await res.text().catch(() => '');
    console.log(`<< ${res.status()} ${res.url()} :: ${text.slice(0, 120)}`);
  }
});

console.log('=== Step 1: Go to /login ===');
await page.goto(`${URL}/login`);
await page.waitForLoadState('networkidle');

console.log('=== Step 2: Login as admin ===');
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);
await page.locator('button[type="submit"]').click();
await page.waitForLoadState('networkidle');

console.log('=== Step 3: After login — current URL ===');
console.log('URL:', page.url());

console.log('=== Step 4: Check cookie ===');
const cookies = await ctx.cookies();
const refreshCookie = cookies.find(c => c.name === 'saome_refresh');
console.log('saome_refresh cookie:', refreshCookie ? JSON.stringify({
  domain: refreshCookie.domain,
  path: refreshCookie.path,
  secure: refreshCookie.secure,
  httpOnly: refreshCookie.httpOnly,
  sameSite: refreshCookie.sameSite,
  expires: refreshCookie.expires,
}) : 'NOT SET');

console.log('=== Step 5: Check Header state ===');
const logoutBtn = await page.locator('[data-testid="mobile-logout-btn"]').count();
const loginLink = await page.locator('a[href="/login"]').count();
console.log('mobile-logout-btn:', logoutBtn, 'login-link:', loginLink);

console.log('=== Step 6: Open mobile menu ===');
const menuBtn = await page.getByRole('button', { name: 'Open menu' }).count();
if (menuBtn > 0) {
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForTimeout(500);
  console.log('Menu opened.');
}

const logoutBtnAfter = await page.locator('[data-testid="mobile-logout-btn"]').count();
const loginLinkAfter = await page.locator('a[href="/login"]').count();
console.log('After menu open — mobile-logout-btn:', logoutBtnAfter, 'login-link:', loginLinkAfter);

console.log('=== Step 7: Navigate to /demo ===');
await page.goto(`${URL}/demo`);
await page.waitForLoadState('networkidle');

console.log('Current URL:', page.url());

const cookies2 = await ctx.cookies();
const refreshCookie2 = cookies2.find(c => c.name === 'saome_refresh');
console.log('After /demo — saome_refresh cookie:', refreshCookie2 ? 'STILL SET' : 'GONE');

const logoutBtn2 = await page.locator('[data-testid="mobile-logout-btn"]').count();
const loginLink2 = await page.locator('a[href="/login"]').count();
console.log('After /demo — mobile-logout-btn:', logoutBtn2, 'login-link:', loginLink2);

console.log('=== Step 8: Open menu on /demo ===');
const menuBtn2 = await page.getByRole('button', { name: 'Open menu' }).count();
if (menuBtn2 > 0) {
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForTimeout(500);
}

const logoutBtn3 = await page.locator('[data-testid="mobile-logout-btn"]').count();
const loginLink3 = await page.locator('a[href="/login"]').count();
console.log('After menu open on /demo — mobile-logout-btn:', logoutBtn3, 'login-link:', loginLink3);

await page.screenshot({ path: 'C:/tmp/session-loss-bug.png', fullPage: true });

await browser.close();
console.log('=== Done ===');