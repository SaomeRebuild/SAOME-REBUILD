/**
 * Verify Set-Cookie is in browser response via Playwright allHeaders.
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:5173';
const EMAIL = 'admin@saome.org';
const PASSWORD = 'Qwww123123!';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
const page = await ctx.newPage();

await page.goto(`${URL}/login`);
await page.waitForLoadState('networkidle');

await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);

const respP = page.waitForResponse(r => r.url().endsWith('/api/auth/login'));
await page.locator('button[type="submit"]').click();
const resp = await respP;
console.log('Status:', resp.status());
const headers = resp.allHeaders();
console.log('Total header keys:', Object.keys(headers).length);
console.log('Has set-cookie key?', 'set-cookie' in headers);
console.log('set-cookie value:', headers['set-cookie'] ?? '(none)');

// Use headersArray if available
try {
  const arr = await resp.headersArray();
  console.log('headersArray length:', arr.length);
  for (const h of arr) {
    if (h.name.toLowerCase().includes('cookie')) {
      console.log(`  [arr] ${h.name}: ${h.value}`);
    }
  }
} catch (e) {
  console.log('headersArray err:', e.message);
}

await browser.close();