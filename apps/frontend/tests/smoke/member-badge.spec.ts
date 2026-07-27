import { test, expect } from '@playwright/test';

/**
 * Smoke Test: MemberBadge Component
 * 
 * Verifies the core functionality of the MemberBadge component
 * works correctly in a real browser environment.
 */

test.describe('MemberBadge Smoke Test', () => {
  test('金牌會員顯示正確', async ({ page }) => {
    await page.goto('/member-profile');
    await page.evaluate(() => localStorage.setItem('member_tier', 'gold'));
    await page.reload();
    
    const badge = page.locator('[data-testid="member-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('金牌');
  });

  test('銀牌會員顯示正確', async ({ page }) => {
    await page.goto('/member-profile');
    await page.evaluate(() => localStorage.setItem('member_tier', 'silver'));
    await page.reload();
    
    const badge = page.locator('[data-testid="member-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('銀牌');
  });

  test('銅牌會員顯示正確', async ({ page }) => {
    await page.goto('/member-profile');
    await page.evaluate(() => localStorage.setItem('member_tier', 'bronze'));
    await page.reload();
    
    const badge = page.locator('[data-testid="member-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('銅牌');
  });

  test('包含無障礙標籤', async ({ page }) => {
    await page.goto('/member-profile');
    await page.evaluate(() => localStorage.setItem('member_tier', 'gold'));
    await page.reload();
    
    const badge = page.locator('[data-testid="member-badge"]');
    await expect(badge).toHaveAttribute('aria-label', '會員等級：金牌');
  });

  test('在 mobile viewport 正常顯示', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/member-profile');
    await page.evaluate(() => localStorage.setItem('member_tier', 'gold'));
    await page.reload();
    
    const badge = page.locator('[data-testid="member-badge"]');
    await expect(badge).toBeVisible();
  });
});
