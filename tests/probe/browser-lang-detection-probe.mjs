/**
 * Test browser language detection for i18n.
 * 
 * Simulates an English-browser user visiting the landing page
 * with no saved language preference (localStorage cleared).
 * 
 * Expected: page renders in English (detectDeviceLanguage → 'en').
 */

import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({ headless: true });

  // Set browser locale to English (simulating user's OS/browser language = English)
  const context = await browser.newContext({
    locale: 'en-US',
    acceptLanguageOverride: 'en-US,en;q=0.9',
  });

  const page = await context.newPage();

  // Clear localStorage to simulate first visit (no persisted language preference)
  await page.addInitScript(() => {
    localStorage.removeItem('saome.lang');
  });

  // Capture navigator.languages
  await page.addInitScript(() => {
    window.__navigatorLanguages = navigator.languages;
  });

  console.log('Navigating to http://localhost:5182 ...');
  await page.goto('http://localhost:5182', { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Give i18n time to initialize
  await page.waitForTimeout(2000);

  // Diagnostic A: navigator.languages
  const navLangs = await page.evaluate(() => window.__navigatorLanguages);
  console.log(`\n[A] navigator.languages:`, navLangs);

  // Diagnostic E: simulate getInitialLanguage()
  const pageDetectResult = await page.evaluate(() => {
    const stored = localStorage.getItem('saome.lang');
    if (stored === 'en' || stored === 'zh-TW') {
      return { source: 'localStorage', lang: stored };
    }
    const primary = navigator.languages?.[0] ?? navigator.language;
    if (primary.startsWith('zh')) return { source: 'browser', lang: 'zh-TW' };
    if (primary.startsWith('en')) return { source: 'browser', lang: 'en' };
    return { source: 'fallback', lang: 'zh-TW' };
  });
  console.log(`[E] Simulated getInitialLanguage():`, pageDetectResult);

  // Diagnostic D: localStorage
  const storedLang = await page.evaluate(() => localStorage.getItem('saome.lang'));
  console.log(`[D] localStorage 'saome.lang': "${storedLang}"`);

  // Actual page content
  const bodyText = await page.textContent('body');
  const isChinese = bodyText?.includes('更多回頭的客戶') ?? false;
  const isEnglish = bodyText?.includes('More returning customers') ?? false;
  const isLoading = (bodyText === null || bodyText.trim() === '' || (bodyText?.length ?? 0) < 100);
  console.log(`\n[RESULT] Page content:`);
  console.log(`  Body text length: ${bodyText?.length ?? 0}`);
  console.log(`  Body text preview: "${bodyText?.substring(0, 200).replace(/\n/g, ' ')}"`);
  console.log(`  Contains "更多回頭的客戶" (Chinese): ${isChinese}`);
  console.log(`  Contains "More returning customers" (English): ${isEnglish}`);

  if (isLoading) {
    console.log(`\n⚠️  Page still loading — waiting 5s...`);
    await page.waitForTimeout(5000);
    const bodyText2 = await page.textContent('body');
    const isChinese2 = bodyText2?.includes('更多回頭的客戶') ?? false;
    const isEnglish2 = bodyText2?.includes('More returning customers') ?? false;
    console.log(`  After 5s wait:`);
    console.log(`    Body length: ${bodyText2?.length ?? 0}`);
    console.log(`    Contains "更多回頭的客戶" (Chinese): ${isChinese2}`);
    console.log(`    Contains "More returning customers" (English): ${isEnglish2}`);
    if (isEnglish2 && !isChinese2) {
      console.log(`\n✅ PASS: Browser language detection is working correctly.`);
    } else if (isChinese2 && !isEnglish2) {
      console.log(`\n❌ FAIL: Still showing Chinese.`);
      process.exit(1);
    } else {
      console.log(`\n⚠️  Page content unclear. Preview: "${bodyText2?.substring(0, 300).replace(/\n/g, ' ')}"`);
      process.exit(1);
    }
  } else if (isChinese && !isEnglish) {
    console.log(`\n❌ FAIL: Browser language detection not working.`);
    console.log(`   navigator.languages=${JSON.stringify(navLangs)}`);
    console.log(`   simulated getInitialLanguage()=${JSON.stringify(pageDetectResult)}`);
    process.exit(1);
  } else if (isEnglish) {
    console.log(`\n✅ PASS: Browser language detection is working correctly.`);
  } else {
    console.log(`\n⚠️  UNCLEAR: Could not determine page language.`);
    process.exit(1);
  }

  await browser.close();
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
