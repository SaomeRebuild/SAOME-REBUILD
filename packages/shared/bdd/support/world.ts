/**
 * Test World - Cucumber Custom World Setup
 * 
 * @module shared/bdd/support/world
 * @description Custom Cucumber World with Playwright page context
 */

import { chromium, Browser, BrowserContext, Page } from '@playwright/test';

/**
 * Global test world instance
 * Provides access to Playwright page and context across step definitions
 */
export const testWorld = {
  browser: null as Browser | null,
  context: null as BrowserContext | null,
  page: null as Page | null,
};

/**
 * Initialize Playwright browser
 */
export async function initializeBrowser(): Promise<void> {
  testWorld.browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  
  testWorld.context = await testWorld.browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  });
  
  testWorld.page = await testWorld.context.newPage();
  
  // Enable console logging
  testWorld.page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`[Browser Console Error] ${msg.text()}`);
    }
  });
  
  // Enable page error logging
  testWorld.page.on('pageerror', error => {
    console.error(`[Page Error] ${error.message}`);
  });
}

/**
 * Close Playwright browser
 */
export async function closeBrowser(): Promise<void> {
  if (testWorld.page) {
    await testWorld.page.close();
  }
  if (testWorld.context) {
    await testWorld.context.close();
  }
  if (testWorld.browser) {
    await testWorld.browser.close();
  }
}

/**
 * Get authenticated page context
 * 
 * @param token - Auth token to set
 */
export async function getAuthenticatedPage(token: string): Promise<Page> {
  if (!testWorld.page) {
    throw new Error('Browser not initialized. Call initializeBrowser() first.');
  }
  
  await testWorld.context?.addCookies([{
    name: 'auth_token',
    value: token,
    domain: 'localhost',
    path: '/',
  }]);
  
  return testWorld.page;
}

/**
 * Clear all authentication
 */
export async function clearAuthentication(): Promise<void> {
  await testWorld.context?.clearCookies();
  await testWorld.page?.evaluate(() => {
    localStorage.removeItem('token');
    sessionStorage.clear();
  });
}
