/**
 * Smoke test for the card builder flow:
 *  1. Login as tenant
 *  2. Navigate to /app/dashboard/card-builder
 *  3. Click "從頭建置" (Build from Scratch)
 *  4. Assert URL changes to include ?id= and editor becomes visible
 *
 * Captures console logs + network requests for diagnosis.
 *
 * Run:  npx playwright test tests/smoke/card-builder-build-from-scratch.spec.ts
 */
import { test, expect, type ConsoleMessage, type Request } from '@playwright/test';
import { SMOKE_CREDENTIALS } from './template';

const { email: TENANT_EMAIL, password: TENANT_PASSWORD } = SMOKE_CREDENTIALS.tenant;

test.describe('Card builder: Build from Scratch', () => {
  test('tenant: click 從頭建置 → URL gets ?id= and editor visible', async ({ page }) => {
    test.setTimeout(90_000);

    // Capture console output
    const consoleLogs: Array<{ type: string; text: string }> = [];
    page.on('console', (msg: ConsoleMessage) => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      consoleLogs.push({ type: 'pageerror', text: err.message });
    });

    // Capture network: only the ones relevant to our flow
    const apiRequests: Array<{ method: string; url: string; status?: number; postData?: string }> = [];
    page.on('request', (req: Request) => {
      const url = req.url();
      if (url.includes('/api/')) {
        apiRequests.push({ method: req.method(), url, postData: req.postData() ?? undefined });
      }
    });
    page.on('response', async (resp) => {
      const url = resp.url();
      if (url.includes('/api/')) {
        const idx = apiRequests.findIndex((r) => r.url === url && r.status === undefined);
        if (idx >= 0) {
          apiRequests[idx].status = resp.status();
        }
      }
    });

    // ── 1. Login ────────────────────────────────────────────────
    await page.goto('/login');
    await page.waitForSelector('input[type=email]', { timeout: 15_000 });
    await page.fill('input[type=email]', TENANT_EMAIL);
    await page.fill('input[type=password]', TENANT_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for tenant dashboard redirect
    await page.waitForURL('**/app/dashboard', { timeout: 15_000 });
    console.log('[STEP] reached tenant dashboard');

    // ── 2. Navigate to card-builder ────────────────────────────
    await page.goto('/app/dashboard/card-builder');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    console.log('[STEP] reached /app/dashboard/card-builder');
    console.log('[URL] before click:', page.url());

    // Sanity: page title visible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // ── 3. Click "從頭建置" ─────────────────────────────────────
    const buildBtn = page.getByRole('button', { name: /從頭建置|Build from Scratch/i });
    await expect(buildBtn).toBeVisible({ timeout: 5_000 });
    console.log('[STEP] build-from-scratch button is visible');

    // We use waitForURL after click; first ensure no overlay intercepts the button.
    await buildBtn.click({ timeout: 5_000 });

    // ── 4. Verify URL gets ?id= and editor is visible ──────────
    try {
      await page.waitForURL(/\?id=/, { timeout: 15_000 });
    } catch (e) {
      // Diagnostic dump on failure
      console.error('=== FAILURE DIAGNOSTICS ===');
      console.error('[URL] after click (no ?id= detected):', page.url());
      console.error('[PAGE TITLE]:', await page.title());
      console.error('[CONSOLE LOGS]:');
      for (const l of consoleLogs) console.error(`  [${l.type}] ${l.text}`);
      console.error('[API REQUESTS]:');
      for (const r of apiRequests) console.error(`  ${r.method} ${r.url} -> ${r.status ?? '???'} body=${r.postData ?? ''}`);
      throw e;
    }

    console.log('[URL] after click:', page.url());
    const url = new URL(page.url());
    const id = url.searchParams.get('id');
    expect(id, 'URL must contain ?id=<something> after Build from Scratch').toBeTruthy();
    expect(id!.length).toBeGreaterThan(0);
    console.log('[URL] extracted id =', id);

    // Editor visible: look for the "Back to Library" button that lives inside
    // CardBuilderEditorWorkspace — this button only appears when the editor is mounted.
    const backBtn = page.getByRole('button', { name: 'Back to Library', exact: true });
    await expect(backBtn).toBeVisible({ timeout: 10_000 });
    console.log('[EDITOR] back button visible');

    // Final report
    console.log('=== SUCCESS REPORT ===');
    console.log(`URL: ${page.url()}`);
    console.log(`Template ID: ${id}`);
    console.log(`API requests captured: ${apiRequests.length}`);
    for (const r of apiRequests) {
      console.log(`  ${r.method} ${r.url} -> ${r.status ?? 'pending'} body=${r.postData ?? ''}`);
    }
  });
});