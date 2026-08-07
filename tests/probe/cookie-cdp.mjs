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

// Capture raw response via CDP
const cdp = await ctx.newCDPSession(page);
const responses = [];
cdp.on('Network.responseReceived', (e) => {
  if (e.response.url.includes('/api/auth/login')) {
    responses.push(e.response);
  }
});
cdp.on('Network.loadingFinished', async (e) => {
  // Find response for this request
});
await cdp.send('Network.enable');

const respP = page.waitForResponse(r => r.url().endsWith('/api/auth/login'));
await page.locator('button[type="submit"]').click();
const resp = await respP;
console.log('Login status:', resp.status());

await page.waitForTimeout(2000);

// Get response headers via CDP
const allCookies = await cdp.send('Network.getAllCookies');
console.log('=== CDP Network.getAllCookies ===');
console.log('count:', allCookies.cookies.length);
for (const c of allCookies.cookies) {
  console.log(JSON.stringify({
    name: c.name,
    domain: c.domain,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite,
    expires: c.expires,
    size: c.size,
  }));
}

// Get the response body and headers via CDP — use Fetch.enable
const fetchId = `login-${Date.now()}`;
const cdpFetch = await ctx.newCDPSession(page);
await cdpFetch.send('Network.enable');

// Use Fetch domain to get raw response from any past response
// — actually, Network.getResponseBody works for past requests
// We need the requestId from the response we care about.

// Actually, Playwright's response.httpResponse() gives body
// Use response.allHeaders() (Playwright internal API)
const fetches = await resp.allHeaders();
console.log('=== response.allHeaders() ===');
for (const [k, v] of Object.entries(fetches)) {
  console.log(`  ${k}: ${v}`);
}

await browser.close();