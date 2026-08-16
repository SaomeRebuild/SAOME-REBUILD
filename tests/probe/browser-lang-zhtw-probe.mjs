/**
 * Verify zh-TW still works (baseline).
 */

import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'zh-TW' });
  const page = await context.newPage();

  await page.addInitScript(() => localStorage.removeItem('saome.lang'));

  await page.goto('http://localhost:5182', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);

  const bodyText = await page.textContent('body');
  const isChinese = bodyText?.includes('更多回頭的客戶') ?? false;
  const isEnglish = bodyText?.includes('More returning customers') ?? false;

  console.log(`[zh-TW baseline]`);
  console.log(`  navigator.languages: zh-TW`);
  console.log(`  Contains "更多回頭的客戶": ${isChinese}`);
  console.log(`  Contains "More returning customers": ${isEnglish}`);

  if (isChinese && !isEnglish) {
    console.log(`✅ PASS: zh-TW baseline still works.`);
  } else {
    console.log(`❌ FAIL: zh-TW baseline broken.`);
    process.exit(1);
  }

  await browser.close();
}

main().catch(console.error);
