/**
 * Production smoke test via Playwright: verify draft TTL feature.
 *
 * Uses Playwright's Node.js API to run against production URLs.
 * Credentials are imported from the standard template.
 *
 * Run:
 *   node tests/smoke/draft-ttl-playwright.ts
 */

import { chromium } from '@playwright/test';
import { SMOKE_CREDENTIALS } from './template';

const TENANT_EMAIL = 'eason1989213@gmail.com';
const TENANT_PASSWORD = 'www123123';
const FRONTEND_URL = 'https://saome-frontend.josh1989213.workers.dev';

async function main() {
  console.log('=== PRODUCTION SMOKE TEST: Draft TTL ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const apiCalls: Array<{
    method: string;
    url: string;
    status?: number;
    responseBody?: string;
  }> = [];

  // Intercept API calls
  page.on('request', (req) => {
    if (req.url().includes('/api/')) {
      apiCalls.push({ method: req.method(), url: req.url() });
    }
  });
  page.on('response', async (resp) => {
    if (resp.url().includes('/api/')) {
      const entry = apiCalls.find(
        (e) => e.url === resp.url() && e.status === undefined,
      );
      if (entry) {
        entry.status = resp.status();
        try { entry.responseBody = await resp.text(); } catch { /* ignore */ }
      }
    }
  });

  try {
    // ── 1. Login ────────────────────────────────────────────────
    console.log('[STEP 1] Login...');
    await page.goto(`${FRONTEND_URL}/login`);
    await page.waitForSelector('input[type=email]', { timeout: 15_000 });
    await page.fill('input[type=email]', TENANT_EMAIL);
    await page.fill('input[type=password]', TENANT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/dashboard', { timeout: 15_000 });
    console.log('  ✅ Login OK, reached dashboard\n');

    // ── 2. Navigate to card-builder ────────────────────────────
    console.log('[STEP 2] Navigate to card-builder...');
    await page.goto(`${FRONTEND_URL}/app/dashboard/card-builder`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    console.log('  ✅ At card-builder page\n');

    // ── 3. Click "從頭建置" ─────────────────────────────────────
    console.log('[STEP 3] Click 從頭建置...');
    const buildBtn = page.getByRole('button', { name: /從頭建置/i });
    await buildBtn.click();
    await page.waitForURL(/\?id=/, { timeout: 15_000 });
    const templateId = new URL(page.url()).searchParams.get('id')!;
    console.log(`  Template ID: ${templateId}`);
    console.log('  ✅ Draft created, editor visible\n');

    // ── 4. Verify expiresAt in POST /api/cards response ─────────
    console.log('[STEP 4] Verify expiresAt in create response...');
    await page.waitForTimeout(1_000); // ensure response captured

    const createCall = apiCalls.find(
      (c) => c.method === 'POST' && c.url.includes('/api/cards'),
    );
    if (!createCall || createCall.status !== 201) {
      console.error('  ❌ FAILED: POST /api/cards did not return 201');
      console.error('  API calls:', apiCalls);
      process.exit(1);
    }

    let createBody: Record<string, unknown>;
    try {
      createBody = JSON.parse(createCall.responseBody!);
    } catch {
      console.error('  ❌ FAILED: Cannot parse create response');
      process.exit(1);
    }
    const template = (createBody as { template?: Record<string, unknown> }).template;
    if (!template) {
      console.error('  ❌ FAILED: No template in create response');
      process.exit(1);
    }

    const expiresAt = template.expiresAt as string | undefined;
    if (!expiresAt) {
      console.error('  ❌ FAILED: expiresAt is null on draft creation');
      console.error('  Template:', JSON.stringify(template, null, 2));
      process.exit(1);
    }

    const expiresDate = new Date(expiresAt);
    const now = new Date();
    const ttlMs = expiresDate.getTime() - now.getTime();
    const ttlHours = ttlMs / (1000 * 60 * 60);
    console.log(`  expiresAt: ${expiresAt}`);
    console.log(`  TTL: ${ttlHours.toFixed(1)}h`);
    if (ttlHours < 23 || ttlHours > 25) {
      console.error(`  ❌ FAILED: TTL ${ttlHours.toFixed(1)}h outside 23-25h tolerance`);
      process.exit(1);
    }
    console.log('  ✅ expiresAt set correctly (~24h)\n');

    // ── 5. Wait 6s → verify touch PATCH is called ──────────────
    console.log('[STEP 5] Wait 6s, verify touch endpoint called...');
    await page.waitForTimeout(6_000);

    const touchCall = apiCalls.find(
      (c) => c.method === 'PATCH' && c.url.includes('/touch'),
    );
    if (!touchCall || touchCall.status !== 200) {
      console.error('  ❌ FAILED: PATCH /api/cards/:id/touch not called or returned non-200');
      console.error('  Touch call:', touchCall);
      process.exit(1);
    }

    let touchBody: Record<string, unknown>;
    try {
      touchBody = JSON.parse(touchCall.responseBody!);
    } catch {
      console.error('  ❌ FAILED: Cannot parse touch response');
      process.exit(1);
    }
    const touchTemplate = (touchBody as { template?: Record<string, unknown> }).template;
    const touchedExpiresAt = touchTemplate?.expiresAt as string | undefined;
    if (!touchedExpiresAt) {
      console.error('  ❌ FAILED: expiresAt null after touch');
      process.exit(1);
    }

    const touchedDate = new Date(touchedExpiresAt);
    const touchedTtlMs = touchedDate.getTime() - new Date().getTime();
    const touchedTtlHours = touchedTtlMs / (1000 * 60 * 60);
    console.log(`  expiresAt after touch: ${touchedExpiresAt}`);
    console.log(`  TTL after touch: ${touchedTtlHours.toFixed(1)}h`);
    if (touchedTtlHours < 23 || touchedTtlHours > 25) {
      console.error(`  ❌ FAILED: TTL after touch ${touchedTtlHours.toFixed(1)}h outside 23-25h tolerance`);
      process.exit(1);
    }
    console.log('  ✅ touch endpoint called, TTL reset correctly\n');

    // ── 6. Final report ────────────────────────────────────────
    console.log('=== ✅ ALL SMOKE TESTS PASSED ===');
    console.log(`Template ID: ${templateId}`);
    console.log(`Draft TTL: ${ttlHours.toFixed(1)}h`);
    console.log(`After touch TTL: ${touchedTtlHours.toFixed(1)}h`);
    console.log(`API calls captured: ${apiCalls.length}`);
    for (const c of apiCalls) {
      const path = c.url.replace('https://saome-frontend.josh1989213.workers.dev', '');
      console.log(`  ${c.method} ${path} → ${c.status}`);
    }

  } catch (err) {
    console.error('\n❌ SMOKE TEST FAILED:', err);
    console.error('API calls captured:');
    for (const c of apiCalls) {
      console.error(`  ${c.method} ${c.url} -> ${c.status}`);
      if (c.responseBody) console.error('   Body:', c.responseBody.slice(0, 200));
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
