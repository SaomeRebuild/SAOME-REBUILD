/**
 * Debug script: "從頭建置" abandon → create flow against production.
 *
 * Run:
 *   npx tsx tests/smoke/draft-abandon-debug.ts
 */
import { chromium } from '@playwright/test';

const BASE = 'https://saome-frontend.josh1989213.workers.dev';
const EMAIL = 'eason1989213@gmail.com';
const PASSWORD = 'www123123';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const apiLog: Array<{ method: string; url: string; status?: number; postData?: string; body?: string }> = [];
  page.on('request', (req) => {
    if (req.url().includes('/api')) {
      apiLog.push({ method: req.method(), url: req.url(), postData: req.postData() ?? undefined });
    }
  });
  page.on('response', async (resp) => {
    if (resp.url().includes('/api')) {
      const entry = apiLog.find((r) => r.url === resp.url());
      if (entry) {
        entry.status = resp.status();
        if (!resp.ok()) {
          entry.body = await resp.text().catch(() => '?');
        }
      }
    }
  });

  try {
    // ── 1. Login ────────────────────────────────────────────────
    console.log('=== [1] Login ===');
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for login response directly so we can read the body
    const loginResp = await page.waitForResponse(
      (r) => r.url().includes('/api/auth/login'),
      { timeout: 15_000 },
    );
    console.log('[LOGIN RESP]', loginResp.status(), await loginResp.text().catch(() => '?'));

    await page.waitForURL(/\/app\/dashboard|\/login/, { timeout: 5_000 });
    console.log('[LOGIN] URL after submit:', page.url());

    if (!page.url().includes('/app/dashboard')) {
      const body = await page.locator('body').textContent();
      console.error('[LOGIN FAILED] Not redirected to dashboard');
      console.error('[BODY PREVIEW]', body?.slice(0, 300));
    console.log('\n=== AUTH API ===');
    for (const r of apiLog.filter((r) => r.url.includes('/api/auth'))) {
      console.log(`  ${r.method} ${r.url} -> ${r.status ?? '???'} body=${r.body ?? r.postData ?? ''}`);
    }
      process.exit(1);
    }

    // ── 2. Navigate to card-builder ────────────────────────────────
    console.log('\n=== [2] Navigate to card-builder ===');
    await page.goto(`${BASE}/app/dashboard/card-builder`);
    await page.waitForLoadState('networkidle');
    console.log('[PAGE] URL:', page.url());

    // ── 3. Click "從頭建置" ─────────────────────────────────────
    console.log('\n=== [3] Click 從頭建置 ===');
    const buildBtn = page.getByRole('button', { name: /從頭建置|Build from Scratch/i });
    await buildBtn.click();
    console.log('[CLICK] Button clicked');

    // Wait for either dialog or URL change
    await page.waitForTimeout(2_000);
    const dialogVisible = await page.locator('dialog').isVisible().catch(() => false);
    console.log('[DIALOG] visible:', dialogVisible);

    if (dialogVisible) {
      // ── 3a. Click "確認" (abandon) ───────────────────────────
      console.log('\n=== [3a] Click 確認 (abandon) ===');
      const confirmBtn = page.getByRole('button', { name: /確認|Confirm/i });
      await confirmBtn.click();
      console.log('[CLICK] Confirm clicked');
    }

    // ── 4. Wait for result ────────────────────────────────────────
    console.log('\n=== [4] Wait for result ===');
    await page.waitForTimeout(5_000);
    console.log('[URL] Final:', page.url());

    // ── 5. Report ────────────────────────────────────────────────
    console.log('\n=== API REQUESTS ===');
    for (const r of apiLog) {
      console.log(`  ${r.method} ${r.url} -> ${r.status ?? '???'} body=${r.body ?? r.postData ?? ''}`);
    }

    const hasId = page.url().includes('?id=');
    console.log('\n[RESULT] Success (URL has ?id=):', hasId);
    if (!hasId) {
      const body = await page.locator('body').textContent();
      console.log('[PAGE CONTENT]', body?.slice(0, 500));
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
