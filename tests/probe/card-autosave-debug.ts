/**
 * Debug probe v2: better login flow + card builder auto-save trace
 */
import { chromium } from '@playwright/test';

const EMAIL = 'eason1989213@gmail.com';
const PASSWORD = 'www123123';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const networkLog: Array<{
    url: string;
    method: string;
    status: number;
    responseBody: string;
  }> = [];

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('.workers.dev/api/')) {
      let body = '(empty)';
      try {
        const text = await response.text();
        body = text.substring(0, 1000);
      } catch { /* ignore */ }
      networkLog.push({
        url,
        method: response.request().method(),
        status: response.status(),
        responseBody: body,
      });
    }
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('[CONSOLE ERROR]', msg.text().substring(0, 200));
    }
  });

  // Step 1: Go to login
  console.log('1. Going to login page...');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  console.log('   URL:', page.url());

  // Step 2: Fill and submit login
  console.log('2. Filling login form...');
  await page.waitForSelector('input[type="email"]', { timeout: 5000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for navigation away from login
  console.log('3. Waiting for login to complete...');
  try {
    await page.waitForURL((url) => !url.toString().includes('login') && !url.toString().includes('auth'), { timeout: 15000 });
    console.log('   Logged in, at:', page.url());
  } catch (e) {
    console.log('   Login did not redirect, current URL:', page.url());
    // Take screenshot
    await page.screenshot({ path: 'login-debug.png' });
    console.log('   Screenshot saved: login-debug.png');
  }

  // Step 3: Navigate to card builder
  console.log('4. Going to card builder...');
  await page.goto('http://localhost:5173/card-builder');
  await page.waitForLoadState('networkidle');
  console.log('   URL:', page.url());

  // Step 4: Wait for step 1 to render and check for auto-save
  await page.waitForTimeout(2000);

  // Step 5: Try to find and click Next button to trigger step 2 auto-save
  console.log('5. Looking for next step button...');
  const buttons = await page.locator('button').all();
  for (const btn of buttons) {
    const text = await btn.textContent();
    if (text && (text.includes('下一步') || text.includes('Next') || text.includes('下一步'))) {
      console.log('   Found button:', text.trim());
      // Check if it's enabled
      const isDisabled = await btn.getAttribute('disabled');
      console.log('   Disabled:', isDisabled !== null);
      break;
    }
  }

  // Report network
  console.log('\n=== All .workers.dev API calls ===');
  for (const entry of networkLog) {
    const shortUrl = entry.url.replace('https://saome-backend.josh1989213.workers.dev', '');
    console.log(`${entry.method} ${entry.status} ${shortUrl}`);
    if (!entry.responseBody.startsWith('{') && entry.responseBody !== '(empty)') {
      console.log('  Body:', entry.responseBody.substring(0, 200));
    } else if (entry.responseBody !== '(empty)') {
      try {
        const parsed = JSON.parse(entry.responseBody);
        console.log('  Body:', JSON.stringify(parsed, null, 2).substring(0, 500));
      } catch {
        console.log('  Body:', entry.responseBody.substring(0, 200));
      }
    }
  }

  await page.screenshot({ path: 'card-builder-debug.png' });
  console.log('\nScreenshot: card-builder-debug.png');
  await browser.close();
  console.log('Done.');
}

main().catch(console.error);
