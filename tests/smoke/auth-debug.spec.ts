/**
 * Debug login flow against local dev server.
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Log all console messages
  page.on('console', (msg) => {
    console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  // Log all requests
  page.on('request', (req) => {
    if (req.url().includes('/api')) {
      console.log(`[REQUEST] ${req.method()} ${req.url()}`);
    }
  });
  page.on('response', (res) => {
    if (res.url().includes('/api')) {
      console.log(`[RESPONSE] ${res.status()} ${res.url()}`);
    }
  });

  try {
    // Step 1: Go to login page
    console.log('\n=== Step 1: Load login page ===');
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    console.log(`URL after load: ${page.url()}`);

    // Step 2: Fill in credentials
    console.log('\n=== Step 2: Fill credentials ===');
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await emailInput.fill('eason1989213@gmail.com');
    await passwordInput.fill('www123123');
    console.log('Credentials filled');

    // Step 3: Submit
    console.log('\n=== Step 3: Submit login ===');
    const submitBtn = page.getByRole('button', { name: /登入|login|submit/i });
    console.log(`Submit button found: ${await submitBtn.isVisible()}`);
    await submitBtn.click();

    // Step 4: Wait for navigation
    console.log('\n=== Step 4: Wait for navigation ===');
    try {
      await page.waitForURL(/\/app\/dashboard|\/login/, { timeout: 10000 });
      console.log(`URL after submit: ${page.url()}`);
    } catch (e) {
      console.log(`Navigation timeout. Current URL: ${page.url()}`);
    }

    // Check for error banners
    const errorBanners = await page.locator('[class*="error"], .text-red-500').allTextContents();
    if (errorBanners.length > 0) {
      console.log('\n=== Error messages found ===');
      errorBanners.forEach((t) => console.log(` - ${t}`));
    }

    // Check page content
    const bodyText = await page.locator('body').textContent();
    console.log(`\nPage content preview: ${bodyText?.slice(0, 300)}`);

  } catch (e) {
    console.error('Test error:', e);
  } finally {
    await browser.close();
  }
}

main();
