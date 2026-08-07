import { chromium } from 'playwright';

const URL = 'http://localhost:5173';
const EMAIL = 'admin@saome.org';
const PASSWORD = 'Qwww123123!';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
const page = await ctx.newPage();

// Track ALL responses (with timing) for /api/auth/*
const responses = [];
page.on('response', async (res) => {
  if (res.url().includes('/api/auth/')) {
    responses.push({
      url: res.url(),
      status: res.status(),
      headers: res.headers(),
      body: (await res.text().catch(() => '')).slice(0, 200),
    });
  }
});

await page.goto(`${URL}/login`);
await page.waitForLoadState('networkidle');

console.log('After /login load — responses:', responses.length);
responses.length = 0;

await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);

// Get button text to verify it's enabled
const btn = page.locator('button[type="submit"]');
const btnText = await btn.textContent();
console.log('Button text:', btnText);

await btn.click();

// Wait for redirect or error
await page.waitForTimeout(3000);

console.log('Current URL:', page.url());
console.log('After submit — responses:');
for (const r of responses) {
  console.log(`  ${r.status} ${r.url}`);
  if (r.headers['set-cookie']) console.log(`    Set-Cookie: ${r.headers['set-cookie']}`);
  if (r.body) console.log(`    Body: ${r.body}`);
}

const allCookies = await ctx.cookies();
console.log('\n=== ALL COOKIES ===');
for (const c of allCookies) {
  console.log(JSON.stringify(c));
}

await browser.close();