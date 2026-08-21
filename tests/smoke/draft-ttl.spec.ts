/**
 * Production smoke test: verify draft TTL feature end-to-end.
 *
 * Uses page.route() to pass-through all requests (continue()) while
 * capturing response bodies via a response listener.
 *
 * Run:
 *   npx playwright test tests/smoke/draft-ttl.spec.ts
 */

import { test, expect, type ConsoleMessage } from '@playwright/test';

const TENANT_EMAIL = 'eason1989213@gmail.com';
const TENANT_PASSWORD = 'www123123';

type CapturedResponse = {
  status: number;
  body: string;
};

// Global map: URL -> {status, body}
const captured = new Map<string, CapturedResponse>();

function passThroughAndCapture(route: { continue: () => Promise<void> }) {
  // Let the request pass through unmodified
  route.continue();
}

test.describe('Draft TTL: create → touch → expiresAt behavior', () => {
  test.beforeEach(async ({ page }) => {
    captured.clear();
    // Pass ALL requests through, capture response bodies separately
    await page.route('**', passThroughAndCapture);
    // Capture every API response body
    page.on('response', async (resp) => {
      if (resp.url().includes('/api/')) {
        try {
          const text = await resp.text();
          captured.set(resp.url(), { status: resp.status(), body: text });
        } catch { /* ignore */ }
      }
    });
  });

  test('create draft → expiresAt ~24h; touch resets TTL', async ({ page }) => {
    test.setTimeout(90_000);

    // ── Console capture ─────────────────────────────────────────
    const consoleLogs: Array<{ type: string; text: string }> = [];
    page.on('console', (msg: ConsoleMessage) => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      consoleLogs.push({ type: 'pageerror', text: err.message });
    });

    // ── 1. Login ────────────────────────────────────────────────
    console.log('[STEP 1] Login...');
    await page.goto('https://saome-frontend.josh1989213.workers.dev/login');
    await page.waitForSelector('input[type=email]', { timeout: 15_000 });
    await page.fill('input[type=email]', TENANT_EMAIL);
    await page.fill('input[type=password]', TENANT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/dashboard', { timeout: 15_000 });
    console.log('  ✅ Login OK');

    // ── 2. Navigate to card-builder ────────────────────────────
    console.log('[STEP 2] Navigate to card-builder...');
    await page.goto('https://saome-frontend.josh1989213.workers.dev/app/dashboard/card-builder');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    console.log('  ✅ At card-builder page');

    // ── 3. Click "Build from Scratch" ────────────────────────────
    console.log('[STEP 3] Click Build from Scratch...');
    await page.getByRole('button', { name: /Build from Scratch/i }).click();
    await page.waitForURL(/\?id=/, { timeout: 15_000 });
    const templateId = new URL(page.url()).searchParams.get('id')!;
    console.log(`  Template ID: ${templateId}`);
    console.log('  ✅ Draft created');

    // Wait for any remaining network requests to settle
    await page.waitForTimeout(1_500);

    // ── 4. Verify expiresAt in POST /api/cards response ─────────
    console.log('[STEP 4] Verify expiresAt...');

    const createUrl = [...captured.keys()].find(
      (k) => k.includes('/api/cards') && captured.get(k)!.status === 201,
    );
    const capturedKeys = [...captured.keys()].map((k) =>
      k.replace('https://saome-backend.josh1989213.workers.dev', ''),
    );
    expect(createUrl, `POST /api/cards must be captured. Captured: ${capturedKeys.join(', ')}`).toBeTruthy();

    const createData = captured.get(createUrl)!;
    let createBody: Record<string, unknown>;
    try {
      createBody = JSON.parse(createData.body);
    } catch {
      throw new Error(`Failed to parse POST /api/cards response: ${createData.body}`);
    }
    const template = (createBody as { template?: Record<string, unknown> }).template;
    expect(template, `POST /api/cards must return template. Body: ${createData.body}`).toBeTruthy();

    const expiresAt = template!.expiresAt as string | undefined;
    expect(expiresAt, `expiresAt must be set on draft creation. Body: ${createData.body}`).toBeTruthy();

    const expiresDate = new Date(expiresAt);
    const now = new Date();
    const ttlMs = expiresDate.getTime() - now.getTime();
    const ttlHours = ttlMs / (1000 * 60 * 60);
    console.log(`  expiresAt: ${expiresAt}`);
    console.log(`  TTL: ${ttlHours.toFixed(1)}h`);
    expect(ttlHours, `TTL should be ~24h, got ${ttlHours.toFixed(1)}h`).toBeGreaterThan(23);
    expect(ttlHours, `TTL should be ~24h, got ${ttlHours.toFixed(1)}h`).toBeLessThan(25);
    console.log('  ✅ expiresAt set correctly (~24h)');

    // ── 5. Navigate to editor again → touch PATCH is called ────
    console.log('[STEP 5] Navigate to editor, wait for touch...');
    await page.goto(`https://saome-frontend.josh1989213.workers.dev/app/dashboard/card-builder?id=${templateId}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const touchUrl = [...captured.keys()].find((k) => k.includes('/touch'));
    const touchCapturedKeys = [...captured.keys()].map((k) =>
      k.replace('https://saome-backend.josh1989213.workers.dev', ''),
    );
    expect(touchUrl, `PATCH /api/cards/:id/touch must be captured. Captured: ${touchCapturedKeys.join(', ')}`).toBeTruthy();

    const touchData = captured.get(touchUrl)!;
    expect(touchData.status, 'PATCH /api/cards/:id/touch should return 200').toBe(200);

    let touchBody: Record<string, unknown>;
    try {
      touchBody = JSON.parse(touchData.body);
    } catch {
      throw new Error(`Failed to parse touch response: ${touchData.body}`);
    }
    const touchTemplate = (touchBody as { template?: Record<string, unknown> }).template;
    expect(touchTemplate, `Touch response must have template. Body: ${touchData.body}`).toBeTruthy();

    const touchedExpiresAt = touchTemplate!.expiresAt as string | undefined;
    expect(touchedExpiresAt, `expiresAt must be set after touch. Body: ${touchData.body}`).toBeTruthy();

    const touchedDate = new Date(touchedExpiresAt);
    const touchedTtlMs = touchedDate.getTime() - new Date().getTime();
    const touchedTtlHours = touchedTtlMs / (1000 * 60 * 60);
    console.log(`  PATCH /api/cards/:id/touch → ${touchData.status}`);
    console.log(`  expiresAt after touch: ${touchedExpiresAt}`);
    console.log(`  TTL after touch: ${touchedTtlHours.toFixed(1)}h`);
    expect(touchedTtlHours, `TTL after touch should be ~24h, got ${touchedTtlHours.toFixed(1)}h`).toBeGreaterThan(23);
    expect(touchedTtlHours, `TTL after touch should be ~24h, got ${touchedTtlHours.toFixed(1)}h`).toBeLessThan(25);
    console.log('  ✅ touch endpoint called, TTL reset correctly');

    // ── 6. Final report ────────────────────────────────────────
    console.log('\n=== ✅ ALL SMOKE TESTS PASSED ===');
    console.log(`Template ID: ${templateId}`);
    console.log(`Draft TTL: ${ttlHours.toFixed(1)}h`);
    console.log(`After touch TTL: ${touchedTtlHours.toFixed(1)}h`);
    console.log(`Total captured responses: ${captured.size}`);
    for (const [url, data] of captured) {
      const path = url.replace('https://saome-backend.josh1989213.workers.dev', '');
      console.log(`  ${data.status} ${path}`);
    }
  });
});
