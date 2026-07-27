/**
 * Smoke test: auth flow renders & basic navigation works.
 *
 * NOTE: This test is intentionally minimal because the backend isn't running
 * during Playwright smoke. We only verify the FE pages render correctly.
 */

import { test, expect } from '@playwright/test';

test.describe('Auth smoke', () => {
  test('login page renders with form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // The form should have email + password fields (autocomplete attr = email / current-password)
    await expect(page.locator('input[type=email]')).toBeVisible();
    await expect(page.locator('input[type=password]')).toBeVisible();
  });

  test('language switcher is clickable', async ({ page }) => {
    await page.goto('/login');
    const switcher = page.getByRole('button', { name: /Toggle language|English|繁體中文/ });
    await expect(switcher).toBeVisible();
    await switcher.click();
    // After click, the button label toggles between zh-TW and en
    await page.waitForTimeout(500);
  });

  test('register page renders step 1', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Stepper + contactName field visible
    await expect(page.getByLabel(/聯絡人姓名|Contact name/i).first()).toBeVisible();
  });
});