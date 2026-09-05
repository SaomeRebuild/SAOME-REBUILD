/**
 * Smoke test: auth logout (B4 2026-09-05).
 *
 * Critical assertions:
 *   1. After login, dashboard renders and the Logout button is visible.
 *   2. Clicking Logout navigates to /login (replace=true, so back button
 *      doesn't return to dashboard).
 *   3. The HttpOnly `saome_refresh` cookie is cleared from the browser jar.
 *   4. Reloading `/app/dashboard` after logout lands on `/login` (AuthGuard
 *      catches the unauthenticated state and redirects). The page should
 *      NOT silently re-login.
 *
 * NOTE: This test requires a running backend (wrangler dev on :8787). When
 * the backend isn't reachable, the test is auto-skipped.
 */

import { test, expect } from '@playwright/test';

test.describe('Auth logout (B4)', () => {
  test.skip(
    ({ }) => !process.env.SAOME_E2E_BACKEND,
    'Set SAOME_E2E_BACKEND=1 to run e2e auth-logout tests (requires live backend)',
  );

  test('login → dashboard → logout → /login + cookie cleared', async ({ page, context }) => {
    // 1. Login
    await page.goto('/login');
    await page.locator('input[type=email]').fill(process.env.E2E_TEST_EMAIL ?? '');
    await page.locator('input[type=password]').fill(process.env.E2E_TEST_PASSWORD ?? '');
    await page.locator('button[type=submit]').click();

    // Wait for dashboard
    await page.waitForURL(/\/app\/dashboard/, { timeout: 15_000 });

    // Logout button visible
    const logoutBtn = page.locator('[data-testid="dashboard-logout-btn"]');
    await expect(logoutBtn).toBeVisible();

    // Verify saome_refresh cookie exists at this point
    const cookiesBefore = await context.cookies();
    const refreshBefore = cookiesBefore.find((c) => c.name === 'saome_refresh');
    expect(refreshBefore).toBeDefined();

    // 2. Click Logout
    await logoutBtn.click();

    // 3. Navigate to /login (replace=true)
    await page.waitForURL(/\/login/, { timeout: 10_000 });

    // 4. Cookie cleared
    const cookiesAfter = await context.cookies();
    const refreshAfter = cookiesAfter.find((c) => c.name === 'saome_refresh');
    // Cookie should be gone OR have Max-Age=0/expired (cookie cleared by browser)
    if (refreshAfter) {
      expect(refreshAfter.expires).toBeLessThanOrEqual(Date.now() / 1000);
    } else {
      expect(refreshAfter).toBeUndefined();
    }

    // 5. Reload /app/dashboard — should land on /login (AuthGuard, not silent re-login)
    await page.goto('/app/dashboard');
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  });
});
