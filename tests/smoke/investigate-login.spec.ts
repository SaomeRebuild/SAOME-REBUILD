/**
 * Image endpoint investigation — run with:
 * PLAYWRIGHT_BASE_URL=http://localhost:5174 npx playwright test tests/smoke/investigate-login.spec.ts --project=chromium
 */

import { test, expect } from '@playwright/test';

const TEMPLATE_ID = 'b9fc0dce-aa82-4c98-9983-55b3d014ead5';
const IMAGE_URL = `https://saome-assets.pages.dev/efb3fbbc-0b7d-48f1-8e65-8bafa17e0893/b9fc0dce-aa82-4c98-9983-55b3d014ead5/issuer-logo.png`;

test('test R2 public URL directly', async ({ request }) => {
  const response = await request.get(IMAGE_URL);
  console.log('R2 URL status:', response.status());
  console.log('R2 URL content-type:', response.headers()['content-type']);
  console.log('R2 URL content-length:', response.headers()['content-length']);
  const body = await response.body();
  console.log('R2 URL body length:', body.length);
  // Check first few bytes for PNG magic number
  console.log('First bytes:', body.slice(0, 8));
  expect(response.status()).toBe(200);
});

test('inspect card image endpoint response', async ({ page }) => {
  // First login to get a valid token
  await page.goto('/login');
  await page.waitForTimeout(2000);

  // Intercept image response
  const imageRespPromise = page.waitForResponse(
    resp => resp.url().includes('/image/logo'),
    { timeout: 10000 }
  ).catch(() => null);

  // Go to dashboard and then card builder
  await page.goto('/dashboard');
  await page.waitForTimeout(2000);
  await page.goto(`/dashboard/cards/${TEMPLATE_ID}/edit?step=3`);
  await page.waitForTimeout(3000);

  const imageResp = await imageRespPromise;
  if (imageResp) {
    console.log('\n=== Image Response ===');
    console.log('URL:', imageResp.url());
    console.log('Status:', imageResp.status());
    console.log('Content-Type:', imageResp.headers()['content-type']);
    console.log('Content-Length:', imageResp.headers()['content-length']);
    const body = await imageResp.body();
    console.log('Body length:', body.length);
    console.log('First bytes (hex):', Buffer.from(body.slice(0, 8)).toString('hex'));
  } else {
    console.log('\nNo image response intercepted');
  }

  // Check if the <img> element exists and what src it has
  const img = page.locator('img[alt="Logo"]').first();
  const src = await img.getAttribute('src').catch(() => null);
  console.log('\n=== <img src> ===');
  console.log('src:', src);
  const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth).catch(() => 0);
  console.log('naturalWidth:', naturalWidth);

  expect(true).toBe(true); // Placeholder
});

test('investigate login flow - token storage and /me endpoint', async ({ page, request }) => {
  // Intercept all fetch/XHR to see API calls
  const apiCalls: { url: string; method: string; status: number; response?: unknown }[] = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/') || url.includes('localhost:8787')) {
      const body = await response.text().catch(() => '');
      let parsed: unknown;
      try { parsed = JSON.parse(body); } catch { parsed = body; }
      apiCalls.push({ url, method: response.request().method(), status: response.status(), response: parsed });
    }
  });

  // Go to login page
  await page.goto('/login');

  // Fill credentials — input[type=email] inside the login form
  await page.locator('input[type="email"]').fill(CREDENTIALS.email);
  await page.locator('input[type="password"]').fill(CREDENTIALS.password);

  // Click login
  await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/auth/login') && resp.status() !== 0),
    page.getByRole('button', { name: /login|sign in|登入/i }).click(),
  ]);

  // Wait for navigation away from login
  await page.waitForURL(url => !url.pathname().includes('/login'), { timeout: 10000 }).catch(() => {
    console.log('Did not navigate away from login page');
  });

  // Print all API calls
  console.log('\n=== API Calls ===');
  for (const call of apiCalls) {
    console.log(`[${call.method}] ${call.url} → ${call.status}`);
    if (call.status >= 400) {
      console.log('  Response:', JSON.stringify(call.response, null, 2));
    }
  }

  // Check localStorage
  const localStorageData: Record<string, string> = {};
  await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) localStorageData[key] = localStorage.getItem(key) ?? '';
    }
  });
  console.log('\n=== localStorage ===');
  console.log(JSON.stringify(localStorageData, null, 2));

  // Check cookies
  const cookies = await page.context().cookies();
  console.log('\n=== Cookies ===');
  console.log(JSON.stringify(cookies, null, 2));

  // Try to extract token from localStorage or cookies
  let token = localStorageData['accessToken'] || localStorageData['token'] || localStorageData['authToken'];
  if (!token) {
    const refreshCookie = cookies.find(c => c.name.includes('refresh') || c.name.includes('token'));
    if (refreshCookie) token = refreshCookie.value;
  }

  console.log('\n=== Token found ===');
  console.log(token ? `Token: ${token.substring(0, 50)}...` : 'NO TOKEN FOUND');

  // Test /me endpoint with found token
  if (token) {
    const meResponse = await request.get('http://localhost:8787/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`\n=== /me endpoint ===`);
    console.log(`Status: ${meResponse.status()}`);
    console.log('Response:', JSON.stringify(await meResponse.json(), null, 2));
  } else {
    console.log('\nCannot test /me - no token found');
  }
});
