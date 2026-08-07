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

// Click and wait for response
const respP = page.waitForResponse(r => r.url().includes('/api/auth/login') && r.request().method() === 'POST');
await page.locator('button[type="submit"]').click();
const resp = await respP;

console.log('=== LOGIN RESPONSE ===');
console.log('Status:', resp.status());
const h = resp.headers();
console.log('Headers (object form):');
for (const [name, value] of Object.entries(h)) {
  console.log(`  ${name}: ${value}`);
}

const allCookies = await ctx.cookies();
console.log('\n=== ALL COOKIES after login ===');
console.log('count:', allCookies.length);
for (const c of allCookies) {
  console.log(JSON.stringify(c));
}

await browser.close();