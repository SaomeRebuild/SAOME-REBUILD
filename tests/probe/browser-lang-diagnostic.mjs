/**
 * Diagnostic: capture all console messages and network failures.
 */

import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    locale: 'en-US',
  });

  const page = await context.newPage();

  const consoleLogs = [];
  const networkFails = [];

  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('requestfailed', req => {
    networkFails.push(`${req.failure()?.errorText}: ${req.url()}`);
  });

  await page.addInitScript(() => {
    localStorage.removeItem('saome.lang');
    window.__navigatorLanguages = navigator.languages;
  });

  console.log('Navigating to http://localhost:5173 ...');
  
  try {
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (e) {
    console.log(`goto error: ${e.message}`);
  }

  // Wait for React to render
  await page.waitForTimeout(5000);

  const rootContent = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML.substring(0, 1000) : 'ROOT NOT FOUND';
  });

  const bodyText = await page.textContent('body');

  console.log(`\nConsole logs:`);
  consoleLogs.forEach(l => console.log(`  ${l}`));

  console.log(`\nNetwork failures:`);
  networkFails.forEach(f => console.log(`  ${f}`));

  console.log(`\n#root content:\n${rootContent}`);
  console.log(`\nBody text (first 300 chars): "${bodyText?.substring(0, 300).replace(/\n/g, ' ')}"`);

  await browser.close();
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
