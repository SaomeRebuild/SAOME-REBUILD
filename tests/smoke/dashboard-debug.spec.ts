/**
 * Smoke test to diagnose i18n and mobile menu issues on dashboard pages.
 * Run: npx playwright test tests/smoke/dashboard-debug.spec.ts --headed
 */
import { test, expect } from '@playwright/test';
import { SMOKE_CREDENTIALS } from './template';

const { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } = SMOKE_CREDENTIALS.admin;
const { email: TENANT_EMAIL, password: TENANT_PASSWORD } = SMOKE_CREDENTIALS.tenant;

test.describe('Dashboard i18n + mobile menu debug', () => {

  test('admin dashboard: i18n and mobile menu', async ({ page }) => {
    test.setTimeout(60000);
    // 1. Login
    await page.goto('http://localhost:5173/login');
    await page.waitForSelector('input[type=email]', { timeout: 15000 });
    await page.fill('input[type=email]', ADMIN_EMAIL);
    await page.fill('input[type=password]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard', { timeout: 10000 });

    // 2. Check i18n on dashboard header
    const logoText = page.locator('[data-testid="saome-logo-text"]');
    const logoContent = await logoText.textContent();
    console.log('[HEADER] saome-logo-text content:', JSON.stringify(logoContent));

    const logoutBtn = page.locator('[data-testid="dashboard-logout-btn"]');
    const logoutText = await logoutBtn.textContent();
    console.log('[HEADER] logout btn text:', JSON.stringify(logoutText));

    // 3. Check footer i18n
    const footerCopyright = page.locator('[data-testid="dashboard-footer-copyright"]');
    const footerText = await footerCopyright.textContent();
    console.log('[FOOTER] copyright text:', JSON.stringify(footerText));

    // 4. Mobile menu inspection
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size
    await page.reload();
    await page.waitForTimeout(500);

    const hamburger = page.locator('button[aria-label*="menu"], button[aria-label*="選單"]');
    const hamburgerCount = await hamburger.count();
    console.log('[MOBILE] hamburger buttons found:', hamburgerCount);

    if (hamburgerCount > 0) {
      await hamburger.first().click();
      await page.waitForTimeout(300);
    }

      // Check what's inside the drawer
      const drawerText = await page.locator('nav.absolute').textContent();
      console.log('[MOBILE DRAWER] full text:', JSON.stringify(drawerText?.substring(0, 500)));

      // Check for theme toggle inside drawer
      const themeToggleInDrawer = await page.locator('nav.absolute [role="group"]').count();
      console.log('[MOBILE DRAWER] ThemeToggle groups inside drawer:', themeToggleInDrawer);

      // Check for logout inside drawer
      const logoutInDrawer = await page.locator('nav.absolute [data-testid="dashboard-logout-btn"]').count();
      console.log('[MOBILE DRAWER] logout btns inside drawer:', logoutInDrawer);
  });

  test('tenant dashboard: i18n and mobile menu', async ({ page }) => {
    test.setTimeout(60000);
    // 1. Login
    await page.goto('http://localhost:5173/login');
    await page.waitForSelector('input[type=email]', { timeout: 15000 });
    await page.fill('input[type=email]', TENANT_EMAIL);
    await page.fill('input[type=password]', TENANT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/app/dashboard', { timeout: 10000 });

    // 2. Check i18n
    const logoText = page.locator('[data-testid="saome-logo-text"]');
    const logoContent = await logoText.textContent();
    console.log('[TENANT] saome-logo-text:', JSON.stringify(logoContent));

    // 3. Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForTimeout(500);

    const hamburger = page.locator('button[aria-label*="menu"], button[aria-label*="選單"]');
    const hamburgerCount = await hamburger.count();
    console.log('[MOBILE] hamburger buttons found:', hamburgerCount);

    if (hamburgerCount > 0) {
      await hamburger.first().click();
      await page.waitForTimeout(300);

      const drawerText = await page.locator('nav.absolute').textContent();
      console.log('[MOBILE DRAWER] full text:', JSON.stringify(drawerText?.substring(0, 500)));
    }
  });
});
