/**
 * Production login flow test via PowerShell + Node.js
 */
import { chromium } from '@playwright/test';

const EMAIL = 'eason1989213@gmail.com';
const PASSWORD = 'www123123';
const BACKEND = 'https://saome-backend.josh1989213.workers.dev';
const FRONTEND = 'https://saome-frontend.josh1989213.workers.dev';
const LOGIN_URL = `${FRONTEND}/login`;

async function main() {
  console.log('=== Production Login Flow Test ===\n');
  console.log(`Target: ${LOGIN_URL}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleMessages = [];
  const corsErrors = [];
  const httpErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
    if (text.includes('CORS') || text.includes('has been blocked') || text.includes('net::ERR_FAILED') || text.includes('ERR_ABORTED')) {
      corsErrors.push(text);
    }
  });

  page.on('response', async resp => {
    if (resp.status() >= 400) {
      const headers = resp.headers();
      const shortUrl = resp.url().replace(BACKEND, 'backend').replace(FRONTEND, 'frontend');
      httpErrors.push({
        url: shortUrl,
        status: resp.status(),
        acao: headers['access-control-allow-origin'] ?? 'MISSING',
      });
    }
  });

  page.on('requestfailed', req => {
    const shortUrl = req.url().replace(BACKEND, 'backend').replace(FRONTEND, 'frontend');
    console.log(`  REQUEST FAILED: ${shortUrl} | ${req.failure()?.errorText}`);
  });

  try {
    console.log('\n[1] Navigate to login page...');
    const resp = await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 30000 });
    console.log(`    HTTP ${resp.status()}`);
    await page.waitForTimeout(2000);

    console.log('\n[2] Fill login form...');
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const emailVisible = await emailInput.isVisible({ timeout: 5000 }).catch(() => false);
    const passwordVisible = await passwordInput.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`    email visible=${emailVisible} | password visible=${passwordVisible}`);

    if (!emailVisible) {
      const title = await page.title();
      const bodySnippet = (await page.locator('body').innerHTML()).substring(0, 300);
      console.log(`\n    Page title: ${title}`);
      console.log(`    Body: ${bodySnippet}`);
    }

    await emailInput.fill(EMAIL);
    await passwordInput.fill(PASSWORD);

    console.log('\n[3] Submit...');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(6000);

    const currentUrl = page.url();
    const onLogin = currentUrl.includes('/login');
    const hasToken = await page.evaluate(() => sessionStorage.getItem('saome.accessToken') !== null);
    console.log(`\n[4] Result:`);
    console.log(`    URL: ${currentUrl}`);
    console.log(`    Still on /login: ${onLogin}`);
    console.log(`    Access token: ${hasToken}`);

    // Direct backend probe
    const probe = await page.evaluate(async (be) => {
      try {
        const r = await fetch(`${be}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'probe@test.com', password: 'wrong' }),
        });
        return { status: r.status, acao: r.headers.get('access-control-allow-origin') };
      } catch (e) { return { error: e.message }; }
    }, BACKEND);
    console.log(`\n[5] Backend direct probe: ${JSON.stringify(probe)}`);

    console.log(`\n=== HTTP ERRORS (${httpErrors.length}) ===`);
    httpErrors.forEach(e => console.log(`  ${e.status} ${e.url} | ACAO=${e.acao}`));

    console.log(`\n=== CORS ERRORS (${corsErrors.length}) ===`);
    corsErrors.forEach(e => console.log(`  ${e.substring(0, 200)}`));

    console.log(`\n=== ALL CONSOLE (${consoleMessages.length}) ===`);
    consoleMessages.forEach(m => console.log(`  ${m.substring(0, 200)}`));

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
