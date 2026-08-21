/**
 * Playwright probe: "從頭建置" abandon → create flow
 *
 * Captures full console + network diagnostics when the createDraft fails.
 *
 * Run:
 *   npx playwright test tests/probe/draft-abandon-probe.ts
 *   npx playwright test tests/probe/draft-abandon-probe.ts --headed
 */
import { test, expect, type ConsoleMessage, type Request } from '@playwright/test';
import { SMOKE_CREDENTIALS } from '../smoke/template';

const { email: TENANT_EMAIL, password: TENANT_PASSWORD } = SMOKE_CREDENTIALS.tenant;

test.describe('Probe: 從頭建置 abandon → create flow', () => {
  test('diagnose SaomeApiError on createDraft after abandon', async ({ page }) => {
    test.setTimeout(120_000);

    // ── Diagnostics capture ────────────────────────────────────────
    const consoleLogs: Array<{ type: string; text: string }> = [];
    page.on('console', (msg: ConsoleMessage) => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      consoleLogs.push({ type: 'pageerror', text: err.message });
    });

    const apiLog: Array<{ method: string; url: string; status?: number; postData?: string; failed?: boolean }> = [];
    page.on('request', (req: Request) => {
      if (req.url().includes('/api/')) {
        apiLog.push({ method: req.method(), url: req.url(), postData: req.postData() ?? undefined });
      }
    });
    page.on('response', (resp) => {
      if (resp.url().includes('/api/')) {
        const entry = apiLog.find((r) => r.url === resp.url() && r.status === undefined);
        if (entry) entry.status = resp.status();
      }
    });
    page.on('requestfailed', (req) => {
      const entry = apiLog.find((r) => r.url === req.url());
      if (entry) entry.failed = true;
    });

    // ── 1. Login ──────────────────────────────────────────────────
    await page.goto('/login');
    await page.waitForSelector('input[type=email]', { timeout: 15_000 });
    await page.fill('input[type=email]', TENANT_EMAIL);
    await page.fill('input[type=password]', TENANT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/dashboard', { timeout: 15_000 });
    console.log('[LOGIN] success');

    // ── 2. Navigate to card-builder ────────────────────────────────
    await page.goto('/app/dashboard/card-builder');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    console.log('[PAGE] /app/dashboard/card-builder loaded');

    // ── 3. Click "從頭建置" ──────────────────────────────────────
    const buildBtn = page.getByRole('button', { name: /從頭建置|Build from Scratch/i });
    await expect(buildBtn).toBeVisible({ timeout: 5_000 });
    await buildBtn.click();

    // Wait for either a dialog OR a URL change
    const hasDialog = await Promise.race([
      page.waitForSelector('dialog', { state: 'visible', timeout: 10_000 }).then(() => true),
      page.waitForURL(/\?id=/, { timeout: 10_000 }).then(() => false),
    ]);

    console.log('[DIALOG] dialog appeared =', hasDialog);

    if (hasDialog) {
      // Dialog: click "確認" (abandon)
      const confirmBtn = page.getByRole('button', { name: /確認|Confirm/i });
      await confirmBtn.click();
      console.log('[DIALOG] clicked 確認/Confirm');
    }

    // ── 4. Wait for result ────────────────────────────────────────
    // Give up to 20s for either success (URL ?id=) or error toast
    let success = false;
    try {
      await page.waitForURL(/\?id=/, { timeout: 20_000 });
      success = true;
    } catch {
      // No URL change — likely API error
    }

    // ── 5. Diagnostic dump ────────────────────────────────────────
    console.log('\n=== DIAGNOSTIC REPORT ===');
    console.log('[URL]', page.url());
    console.log('[SUCCESS]', success);

    console.log('\n[CONSOLE LOGS]');
    for (const l of consoleLogs) {
      console.log(`  [${l.type}] ${l.text}`);
    }

    console.log('\n[API REQUESTS]');
    for (const r of apiLog) {
      console.log(`  ${r.method} ${r.url} status=${r.status ?? '???'} failed=${r.failed ?? false} body=${r.postData ?? ''}`);
    }

    // ── 6. Assertions ─────────────────────────────────────────────
    if (!success) {
      // Check for error toast
      const errorToast = page.locator('[role="alert"]:has-text("API error")');
      const toastVisible = await errorToast.isVisible().catch(() => false);
      console.log('[TOAST ERROR] visible =', toastVisible);
      if (toastVisible) {
        console.log('[TOAST TEXT]', await errorToast.textContent());
      }
    }

    expect(success, '從頭建置 should succeed (URL should contain ?id=)').toBe(true);
  });
});
