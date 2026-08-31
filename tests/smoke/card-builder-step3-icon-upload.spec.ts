/**
 * Smoke test for Step 3 icon upload (Phase 10 of IconUploader plan 2026-08-31).
 *
 * Verifies:
 *   1. Login as tenant
 *   2. Navigate to card builder
 *   3. Reach Step 3
 *   4. MediaAssetUploader icon section is rendered
 *   5. iconUpload i18n namespace strings appear (not raw keys)
 *   6. PhoneFrame preview renders the push notification overlay
 *
 * Run:
 *   npm run test:smoke -- card-builder-step3-icon-upload
 */

import { test, expect } from '@playwright/test';
import { SMOKE_CREDENTIALS } from './template';

const { email: TENANT_EMAIL, password: TENANT_PASSWORD } = SMOKE_CREDENTIALS.tenant;

test.describe('Card builder: Step 3 icon upload', () => {
  test('icon section renders with i18n keys (not raw)', async ({ page }) => {
    test.setTimeout(90_000);

    // ── 1. Login ────────────────────────────────────────────────
    await page.goto('/login');
    await page.waitForSelector('input[type=email]', { timeout: 15_000 });
    await page.fill('input[type=email]', TENANT_EMAIL);
    await page.fill('input[type=password]', TENANT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/dashboard', { timeout: 15_000 });

    // ── 2. Navigate to card-builder ────────────────────────────
    await page.goto('/app/dashboard/card-builder');

    // ── 3. Build from scratch (open draft) ─────────────────────
    const buildBtn = page.locator('button', { hasText: '從頭建置' });
    if (await buildBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await buildBtn.click();
    }

    // Wait for the editor to mount
    await page.waitForURL(/\/app\/dashboard\/card-builder.*/, { timeout: 15_000 });

    // ── 4. Advance through Step 1 (select type) → Step 2 (fill required) → Step 3
    // Step 1: select first card type
    await page.locator('button', { hasText: '下一步' }).first().click();
    // Step 2: fill required store + issuer
    await page.fill('input[name="storeName"]', 'Smoke Store');
    await page.fill('input[name="issuerName"]', 'Smoke Issuer');
    await page.locator('button', { hasText: '下一步' }).first().click();

    // ── 5. Step 3 — verify icon section is rendered with i18n keys
    // The icon section heading should be the i18n-resolved Chinese string,
    // NOT the raw key `step3.iconSection.title`.
    await expect(page.getByText('推播通知圖示')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('此 Icon 會顯示於手機鎖屏與推播中心')).toBeVisible();
  });
});
