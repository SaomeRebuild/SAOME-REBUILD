/**
 * Probe local backend (127.0.0.1:8787) Set-Cookie presence.
 * Goal: confirm source code 直跑有 Set-Cookie header（跟 production 對比）。
 */
import { chromium } from 'playwright';

const LOCAL_API = 'http://127.0.0.1:8787';
const FRONTEND = 'http://localhost:5173';
const EMAIL = 'admin@saome.org';
const PASSWORD = 'Qwww123123!';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
const page = await ctx.newPage();

await page.goto(`${FRONTEND}/login`);
await page.waitForLoadState('networkidle');

// Monkey-patch fetch to call local backend instead of production
await page.evaluate((apiBase) => {
  const origFetch = window.fetch.bind(window);
  // eslint-disable-next-line
  window.fetch = (input, init) => {
    if (typeof input === 'string' && input.includes('josh1989213.workers.dev')) {
      input = input.replace('https://saome-backend.josh1989213.workers.dev', apiBase);
    }
    return origFetch(input, init);
  };
}, LOCAL_API);

await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);

const respP = page.waitForResponse(r => r.url().includes('/api/auth/login'));
await page.locator('button[type="submit"]').click();
const resp = await respP;

console.log('=== LOCAL BACKEND LOGIN RESPONSE ===');
console.log('Status:', resp.status());
console.log('URL:', resp.url());
const headers = resp.headers();
console.log('set-cookie:', headers['set-cookie'] ?? '(MISSING)');
console.log('all headers:');
for (const [k, v] of Object.entries(headers)) {
  if (k.startsWith('access-control') || k === 'set-cookie' || k === 'content-type') {
    console.log(`  ${k}: ${v}`);
  }
}
const text = await resp.text();
console.log('body[0..300]:', text.slice(0, 300));

const cookies = await ctx.cookies();
console.log('\n=== COOKIES after local login ===');
console.log('count:', cookies.length);
for (const c of cookies) console.log('  -', c.name, c.domain, c.path);

await browser.close();