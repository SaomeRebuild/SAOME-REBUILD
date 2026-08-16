/**
 * Capture the actual 500 error body from Vite dev server for src/i18n/index.ts
 */

import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();

  // Intercept all responses
  page.on('response', async resp => {
    if (resp.url().includes('i18n')) {
      const status = resp.status();
      if (status >= 400) {
        try {
          const text = await resp.text();
          console.log(`\n=== 500 ERROR for ${resp.url()} ===`);
          console.log(text.substring(0, 3000));
          console.log(`=== END ===`);
        } catch (e) {
          console.log(`Could not read body: ${e.message}`);
        }
      } else {
        console.log(`[OK] ${status}: ${resp.url()}`);
      }
    }
  });

  // Also try directly
  const resp = await fetch('http://localhost:5173/src/i18n/index.ts');
  console.log(`Direct fetch status: ${resp.status}`);
  if (resp.status >= 400) {
    const text = await resp.text();
    console.log(`Body:\n${text.substring(0, 3000)}`);
  }

  await page.goto('http://localhost:5173', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  await browser.close();
}

main().catch(console.error);
