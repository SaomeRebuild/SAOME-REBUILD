/**
 * Member Badge Step Definitions
 * 
 * @module shared/bdd/steps/member-badge
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { testWorld } from '../support/world';

const TIER_LABELS: Record<string, string> = {
  bronze: '銅牌',
  silver: '銀牌',
  gold: '金牌',
};

Given('我的會員等級是 {string}', async function(this: any, tier: string) {
  // Set tier via cookie or localStorage for the test
  await testWorld.page?.evaluate((t) => {
    localStorage.setItem('member_tier', t);
  }, tier);
});

Given('我在會員資料頁面', async function(this: any) {
  await testWorld.page?.goto('/member-profile');
});

When('頁面載入完成', async function(this: any) {
  await testWorld.page?.waitForLoadState('networkidle');
});

When('我的等級升級為 {string}', async function(this: any, newTier: string) {
  await testWorld.page?.evaluate((t) => {
    localStorage.setItem('member_tier', t);
    window.dispatchEvent(new Event('tier-updated'));
  }, newTier);
});

Then('我應該看到 {string} 文字', async function(this: any, text: string) {
  await expect(testWorld.page?.locator(`text=${text}`).first()).toBeVisible();
});

Then('我應該看到{string}圖示', async function(this: any, tier: string) {
  const label = TIER_LABELS[tier] || tier;
  const badge = testWorld.page?.locator(`[data-testid="member-badge"]:has-text("${label}")`);
  await expect(badge).toBeVisible();
});

Then('元件應該重新渲染為{string}', async function(this: any, tier: string) {
  const label = TIER_LABELS[tier] || tier;
  await testWorld.page?.waitForSelector(`[data-testid="member-badge"]:has-text("${label}")`, {
    timeout: 5000,
  });
});
