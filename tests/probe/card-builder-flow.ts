/**
 * Playwright test to debug card builder flow
 */

import { chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:5175';
const CREDENTIALS = {
  email: 'eason1989213@gmail.com',
  password: 'www123123',
};

async function run() {
  console.log('Starting Playwright test...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Listen to console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('[CONSOLE ERROR]', msg.text());
    }
  });
  
  // Listen to network requests
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/')) {
      console.log(`[API] ${response.status()} ${url}`);
    }
  });

  try {
    // 1. Login
    console.log('\n=== Step 1: Login ===');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[name="email"]', CREDENTIALS.email);
    await page.fill('input[name="password"]', CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    console.log('Login successful, on dashboard');
    
    // 2. Navigate to card builder
    console.log('\n=== Step 2: Navigate to Card Builder ===');
    await page.goto(`${BASE_URL}/app/dashboard/card-builder`);
    await page.waitForLoadState('networkidle');
    
    // 3. Click "從頭建置"
    console.log('\n=== Step 3: Click "從頭建置" ===');
    const buildButton = page.locator('button:has-text("從頭建置")');
    await buildButton.click();
    
    // Wait for dialog to appear
    await page.waitForTimeout(500);
    
    // Check if there's a draft dialog (wait up to 2 seconds)
    try {
      const resumeDialog = page.locator('text=未完成的草稿').first();
      await resumeDialog.waitFor({ state: 'visible', timeout: 2000 });
      console.log('Found resume draft dialog');
      
      // Find and click the radio for discard, then click confirm
      const discardRadio = page.locator('input[type="radio"][value="discard"]');
      await discardRadio.waitFor({ state: 'visible', timeout: 2000 });
      await discardRadio.check();
      console.log('Selected discard radio');
      
      // Click the confirm button
      const confirmBtn = page.locator('button').filter({ hasText: '確認' });
      await confirmBtn.waitFor({ state: 'visible', timeout: 2000 });
      await confirmBtn.click();
      console.log('Clicked 確認');
      
      // Wait for navigation
      await page.waitForURL('**/card-builder?id=**', { timeout: 10000 });
      console.log('Navigated to editor:', page.url());
      return; // Exit early, we navigated successfully
    } catch (e) {
      console.log('No draft dialog or click failed:', e);
    }
    
    // If no dialog, check current URL - maybe we navigated automatically
    const currentUrl = page.url();
    if (currentUrl.includes('id=')) {
      console.log('Already on editor page:', currentUrl);
    } else {
      console.log('Not on editor page yet, current URL:', currentUrl);
    }
    
    // 4. Step 1: Select card type
    console.log('\n=== Step 4: Complete Step 1 ===');
    await page.waitForSelector('text=選擇卡種', { timeout: 5000 });
    console.log('Step 1 loaded');
    
    // Wait for card type buttons to be interactive
    await page.waitForTimeout(1000);
    
    // Find and click the first card type button (stamp_card) - use force click
    const cardTypeGrid = page.locator('.grid.grid-cols-3');
    const firstCardTypeBtn = cardTypeGrid.locator('button').first();
    
    // Wait for button to be enabled
    await firstCardTypeBtn.waitFor({ state: 'visible' });
    
    // Check initial state
    const initialPressed = await firstCardTypeBtn.getAttribute('aria-pressed');
    console.log('Initial aria-pressed:', initialPressed);
    
    // Click with force to bypass any overlay/interception
    await firstCardTypeBtn.click({ force: true });
    console.log('Clicked first card type');
    
    // Wait for state update
    await page.waitForTimeout(500);
    
    // Verify selection worked
    const afterPressed = await firstCardTypeBtn.getAttribute('aria-pressed');
    console.log('After click aria-pressed:', afterPressed);
    
    // Enter card name - find any text input in the form
    const nameInput = page.locator('input[type="text"]').first();
    if (await nameInput.isVisible()) {
      const placeholder = await nameInput.getAttribute('placeholder');
      console.log('Found input with placeholder:', placeholder);
      await nameInput.fill('測試集點卡');
      console.log('Entered card name');
      await page.waitForTimeout(300);
    } else {
      console.log('Name input not found');
    }
    
    // Check Next button state
    await page.waitForTimeout(300);
    const nextButton = page.locator('button:has-text("下一步")').first();
    const isDisabled = await nextButton.isDisabled();
    console.log('Next button disabled:', isDisabled);
    
    if (!isDisabled) {
      await nextButton.click();
      console.log('Clicked Next button');
    } else {
      console.log('Cannot proceed - cardType or name not set');
      await page.screenshot({ path: 'step1-state.png', fullPage: true });
    }
    
    // 5. Step 2: Fill required fields
    console.log('\n=== Step 5: Complete Step 2 ===');
    await page.waitForTimeout(1000);
    
    // Check if we're on step 2
    const step2Title = page.locator('text=卡片設定').first();
    if (await step2Title.isVisible()) {
      console.log('On Step 2');
    }
    
    // Fill store name
    const storeInput = page.locator('input[placeholder="輸入商家名稱"]').first();
    if (await storeInput.isVisible()) {
      await storeInput.fill('測試商家');
      console.log('Filled store name');
    } else {
      console.log('Store input not found');
    }
    
    // Fill issuer name
    const issuerInput = page.locator('input[placeholder="輸入發卡機構名稱"]').first();
    if (await issuerInput.isVisible()) {
      await issuerInput.fill('測試發卡機構');
      console.log('Filled issuer name');
    }
    
    // Fill valid days
    const validDaysInput = page.locator('input[placeholder="輸入有效天數"]').first();
    if (await validDaysInput.isVisible()) {
      await validDaysInput.fill('30');
      console.log('Filled valid days');
    }
    
    // Wait for validation to update
    await page.waitForTimeout(500);
    
    // Click Next to Step 3
    const nextButton2 = page.locator('button:has-text("下一步")').first();
    const isStep2Disabled = await nextButton2.isDisabled();
    console.log('Step 2 Next button disabled:', isStep2Disabled);
    
    if (!isStep2Disabled) {
      await nextButton2.click();
      console.log('Clicked Next to Step 3');
    } else {
      console.log('Cannot proceed Step 2 - missing required fields');
      await page.screenshot({ path: 'step2-state.png', fullPage: true });
    }
    
    // 6. Step 3
    console.log('\n=== Step 6: Check Step 3 ===');
    await page.waitForTimeout(2000);
    
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
    
    // Check for errors
    const errorToast = page.locator('[role="alert"], .toast-error').first();
    if (await errorToast.isVisible()) {
      const errorText = await errorToast.textContent();
      console.log('ERROR TOAST:', errorText);
    }
    
    // Take a screenshot
    await page.screenshot({ path: 'card-builder-debug.png', fullPage: true });
    console.log('\nScreenshot saved to card-builder-debug.png');
    
    // Log any errors
    console.log('\n=== Summary ===');
    console.log('Test completed. Check card-builder-debug.png');
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'card-builder-error.png', fullPage: true });
    console.log('Error screenshot saved');
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
