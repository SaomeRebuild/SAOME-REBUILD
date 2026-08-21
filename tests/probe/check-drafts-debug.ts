/**
 * Playwright test to check user and tenant data
 */

import { chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:5175';
const CREDENTIALS = {
  email: 'eason1989213@gmail.com',
  password: 'www123123',
};

async function run() {
  console.log('Starting user/tenant debug test...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Listen to console messages
  page.on('console', msg => {
    console.log('[CONSOLE]', msg.type(), msg.text());
  });
  
  // Listen to network requests
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/')) {
      console.log(`[API] ${response.status()} ${url}`);
    }
  });

  try {
    // 1. Login and capture cookies
    console.log('\n=== Step 1: Login ===');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[name="email"]', CREDENTIALS.email);
    await page.fill('input[name="password"]', CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    console.log('Login successful');
    
    // Get all cookies
    const cookies = await context.cookies();
    console.log('\nCookies after login:');
    cookies.forEach(c => console.log(`  ${c.name}: ${c.value.substring(0, 50)}...`));
    
    // 2. Try to access drafts endpoint directly
    console.log('\n=== Step 2: Check /api/cards/drafts ===');
    const accessToken = await page.evaluate(() => sessionStorage.getItem('saome.accessToken'));
    console.log('Access token from sessionStorage:', accessToken ? 'present' : 'NULL');
    
    const draftsResult = await page.evaluate(async (token) => {
      const res = await fetch('/api/cards/drafts', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include'
      });
      return {
        status: res.status,
        body: await res.text()
      };
    }, accessToken);
    console.log('Drafts response status:', draftsResult.status);
    console.log('Drafts response body:', draftsResult.body);
    
    // 3. Get /api/auth/me to check user info
    console.log('\n=== Step 3: Check /api/auth/me ===');
    const meResult = await page.evaluate(async (token) => {
      const res = await fetch('/api/auth/me', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include'
      });
      return {
        status: res.status,
        body: await res.text()
      };
    }, accessToken);
    console.log('Me response status:', meResult.status);
    console.log('Me response body:', meResult.body);
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
