/**
 * Smoke test: CardBuilder full flow from scratch
 * 1. Login as tenant
 * 2. Navigate to card builder
 * 3. Build from scratch
 * 4. Fill Step 1 (card type) and Step 2 (store info)
 * 5. Trigger save and capture the API response/error
 */
import { test, expect, type ConsoleMessage, type Response } from '@playwright/test';

const TENANT_EMAIL = 'eason1989213@gmail.com';
const TENANT_PASSWORD = 'www123123';

test.describe('CardBuilder: Full Flow + Error Capture', () => {
  test('Step 1 -> Step 2 -> save and capture error', async ({ page }) => {
    test.setTimeout(90_000);

    // Capture console + network
    const consoleLogs: Array<{ type: string; text: string }> = [];
    page.on('console', (msg: ConsoleMessage) => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      consoleLogs.push({ type: 'pageerror', text: err.message });
    });

    const apiRequests: Array<{ method: string; url: string; status?: number; postData?: string }> = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/')) {
        apiRequests.push({ method: req.method(), url: req.url(), postData: req.postData() ?? undefined });
      }
    });
    page.on('response', async (resp) => {
      if (resp.url().includes('/api/')) {
        const req = apiRequests.find(r => r.url === resp.url() && r.status === undefined);
        if (req) {
          req.status = resp.status();
        }
      }
    });

    // ── 1. Login ────────────────────────────────────────────────
    await page.goto('/login');
    await page.waitForSelector('input[type=email]', { timeout: 15_000 });
    await page.fill('input[type=email]', TENANT_EMAIL);
    await page.fill('input[type=password]', TENANT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/dashboard', { timeout: 15_000 });
    console.log('[STEP] Logged in as tenant');

    // ── 2. Card builder ─────────────────────────────────────────
    await page.goto('/app/dashboard/card-builder');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    console.log('[STEP] On card-builder page');

    // ── 3. Build from scratch ────────────────────────────────────
    const buildBtn = page.getByRole('button', { name: /從頭建置|Build from Scratch/i });
    await expect(buildBtn).toBeVisible({ timeout: 5_000 });
    await buildBtn.click();
    await page.waitForURL(/\?id=/, { timeout: 15_000 });
    console.log('[STEP] Editor opened, id:', new URL(page.url()).searchParams.get('id'));

    // ── 4. Step 1: pick any card type ───────────────────────────
    const cardTypeButtons = page.locator('[class*="grid"] button, [class*="Grid"] button, button[class*="rounded"]').filter({ hasText: /.+/ });
    const firstCard = cardTypeButtons.first();
    if (await firstCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstCard.click();
      console.log('[STEP] Card type selected');
    }

    // Click Next to go to Step 2
    const nextBtn = page.getByRole('button', { name: /下一步|Next/i });
    if (await nextBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nextBtn.click();
      console.log('[STEP] Clicked Next -> Step 2');
    }

    await page.waitForTimeout(2_000);

    // ── 5. Fill Step 2 fields ──────────────────────────────────
    // Fill storeName if present
    const storeNameInput = page.locator('input[name*="store"], input[name*="name"], input[placeholder*="名稱"], input[placeholder*="商店"]').first();
    if (await storeNameInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await storeNameInput.fill('測試商店');
      console.log('[STEP] Filled storeName');
    }

    // Fill issuerName if present
    const issuerInput = page.locator('input[name*="issuer"], input[placeholder*="發卡"]').first();
    if (await issuerInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await issuerInput.fill('測試發卡機構');
      console.log('[STEP] Filled issuerName');
    }

    await page.waitForTimeout(1_000);

    // ── 6. Save / Next (trigger the API call) ───────────────────
    const saveBtn = page.getByRole('button', { name: /儲存|Save|下一步|Next/i }).first();
    if (await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await saveBtn.click();
      console.log('[STEP] Clicked save/next');
    }
    await page.waitForTimeout(5_000);

    // ── 7. Report ───────────────────────────────────────────────
    console.log('\n=== FINAL REPORT ===');
    console.log(`URL: ${page.url()}`);

    // Print API requests
    for (const r of apiRequests) {
      console.log(`API: ${r.method} ${r.url} -> ${r.status ?? 'pending'}`);
      if (r.postData) console.log(`  Body: ${r.postData}`);
    }

    // Print console logs
    console.log('\nConsole logs:');
    for (const l of consoleLogs) {
      if (l.type === 'error' || l.type === 'pageerror' || l.type === 'warn') {
        console.log(`  [${l.type}] ${l.text}`);
      }
    }

    // Look for error messages on the page
    const errorText = await page.locator('[class*="error"], [class*="Error"], .text-destructive').allTextContents();
    if (errorText.length) {
      console.log('\nPage error elements:');
      for (const t of errorText) console.log(`  "${t}"`);
    }

    // Check for toast-like elements
    const toastText = await page.locator('[role="alert"], [class*="toast"], [class*="Toast"]').allTextContents();
    if (toastText.length) {
      console.log('\nToast elements:');
      for (const t of toastText) console.log(`  "${t}"`);
    }
  });
});
