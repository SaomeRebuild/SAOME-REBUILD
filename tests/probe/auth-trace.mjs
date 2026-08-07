/**
 * Trace AuthProvider behavior across /demo navigation.
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:5173';
const EMAIL = 'admin@saome.org';
const PASSWORD = 'Qwww123123!';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

page.on('pageerror', (err) => console.log('[pageerror]', err.message));
page.on('console', (msg) => console.log(`[browser ${msg.type()}]`, msg.text()));

// Inject diagnostic: log useAuth state changes via window
await page.addInitScript(() => {
  window.__authEvents = [];
});

const apiCalls = [];
page.on('response', async (resp) => {
  const url = resp.url();
  if (url.includes('/api/auth/refresh')) {
    let body = null;
    try { body = await resp.json(); } catch {}
    apiCalls.push({ url, status: resp.status(), body });
  }
});

console.log('=== Load /login ===');
await page.goto(`${URL}/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

console.log('=== Submit login ===');
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);
const loginRespP = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
await page.locator('button[type="submit"]').click();
await loginRespP;
await page.waitForTimeout(1500);

const desktopLogout = await page.locator('[data-testid="desktop-logout-btn"]').count();
console.log('After login desktop-logout-btn:', desktopLogout);

console.log('=== Navigate to /demo ===');
await page.goto(`${URL}/demo`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const desktopLogoutDemo = await page.locator('[data-testid="desktop-logout-btn"]').count();
console.log('After /demo desktop-logout-btn:', desktopLogoutDemo);
const authEmailDemo = await page.locator('[data-testid="auth-user-email"]').count();
console.log('After /demo auth-user-email:', authEmailDemo);

console.log('\n=== /api/auth/refresh trace ===');
for (const c of apiCalls) {
  console.log(' -', c.status, c.url, 'user=' + (c.body?.user?.email ?? 'NONE'), 'role=' + (c.body?.user?.role ?? 'NONE'));
}

console.log('\n=== Auth state via DOM check ===');
const headerHTML = await page.locator('header').innerHTML();
const isAuthenticatedDom = headerHTML.includes('auth-user-email') || headerHTML.includes('desktop-logout-btn');
console.log('isAuthenticated (DOM inference):', isAuthenticatedDom);

await browser.close();