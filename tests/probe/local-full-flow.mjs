/**
 * Full AuthProvider flow with local backend via monkey-patched fetch.
 * Confirms: login → cookie set → navigate to /demo → AuthProvider still has user.
 */
import { chromium } from 'playwright';

const LOCAL_API = 'http://127.0.0.1:8787';
const FRONTEND = 'http://localhost:5173';
const EMAIL = 'admin@saome.org';
const PASSWORD = 'Qwww123123!';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
const page = await ctx.newPage();

page.on('pageerror', (err) => console.log('[pageerror]', err.message));

// Install route interception BEFORE app loads
await page.route('**/*.josh1989213.workers.dev/api/**', async (route) => {
  const url = route.request().url();
  const localUrl = url.replace('https://saome-backend.josh1989213.workers.dev', LOCAL_API);
  console.log(`[route] ${route.request().method()} ${url} → ${localUrl}`);
  const headers = { ...route.request().headers() };
  // Strip hop-by-hop headers
  delete headers.host;
  delete headers['content-length'];
  const opts = {
    method: route.request().method(),
    headers,
    body: route.request().postData(),
  };
  try {
    const r = await fetch(localUrl, opts);
    const responseHeaders = {};
    r.headers.forEach((v, k) => { responseHeaders[k] = v; });
    const buf = Buffer.from(await r.arrayBuffer());
    await route.fulfill({
      status: r.status,
      headers: responseHeaders,
      body: buf,
    });
  } catch (e) {
    console.log('[route] fetch failed:', e.message);
    await route.abort();
  }
});

console.log('=== Step 1: /login ===');
await page.goto(`${FRONTEND}/login`);
await page.waitForLoadState('networkidle');

console.log('=== Step 2: Submit login ===');
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);
await page.locator('button[type="submit"]').click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);

console.log('Current URL:', page.url());
console.log('mobile-logout-btn:', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link:', await page.locator('a[href="/login"]').count());

const cookies = await ctx.cookies();
console.log('Cookies after login:', cookies.length);
for (const c of cookies) console.log('  -', c.name, c.domain, c.path);

console.log('=== Step 3: Open mobile menu ===');
const menuBtn = page.getByRole('button', { name: 'Open menu' });
await menuBtn.click();
await page.waitForTimeout(500);
console.log('mobile-logout-btn (mobile menu):', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link (mobile menu):', await page.locator('a[href="/login"]').count());

console.log('=== Step 4: Navigate to /demo ===');
await page.goto(`${FRONTEND}/demo`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);

console.log('Current URL:', page.url());
console.log('mobile-logout-btn (after /demo):', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link (after /demo):', await page.locator('a[href="/login"]').count());

console.log('=== Step 5: Open mobile menu on /demo ===');
const menuBtn2 = page.getByRole('button', { name: 'Open menu' });
await menuBtn2.click();
await page.waitForTimeout(500);
console.log('mobile-logout-btn (mobile menu on /demo):', await page.locator('[data-testid="mobile-logout-btn"]').count());
console.log('login-link (mobile menu on /demo):', await page.locator('a[href="/login"]').count());

const cookies2 = await ctx.cookies();
console.log('Cookies after /demo:', cookies2.length);
for (const c of cookies2) console.log('  -', c.name, c.domain, c.path);

await browser.close();