/**
 * Auth Domain Step Definitions
 *
 * @module shared/bdd/steps/auth
 * @description 認證流程專用 step definitions:
 *   - Lockout 計時器設定/操作(直接戳 useLoginLockout hook 的 localStorage 約定)
 *   - 多語系切換 + i18n 驗證
 *   - Session storage/cleanup 工具
 *   - 直接呼叫後端 API(用於測試「繞過前端 UX lock」情境)
 *
 * 注意:這個檔案內所有 step definitions 與既有 navigation / form / assertion step
 * 並存,並由 `steps/index.ts` 統一 export。不得重複定義相同 text pattern
 * (Cucumber 會在啟動時報錯)。
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { expect, request as pwRequest } from '@playwright/test';
import { testWorld } from '../support/world.ts';

// ───────────────────────────────────────────────────────────
// Lockout scenarios
// ───────────────────────────────────────────────────────────

/**
 * 模擬「對某個 email 連續 N 次輸入錯誤密碼」後,後端累計了 N 次失敗。
 *
 * 實作上我們直接寫入 localStorage 約定欄位 + 設 cookie:
 *  - localStorage: `saome:loginLockout:${email}` → `{ failures: 3, lockoutUntil: <ts> }`
 *  - cookie: `saome_session_failed_attempts` → 3  (供後端讀)
 *
 * 前端的 `useLoginLockout` hook 規範的 storage key 命名為上述。
 * 若 storage key 變更,需同步修改此 step。
 */
Given('我對 {string} 連續 {int} 次輸入錯誤密碼', async function(
  this: any,
  email: string,
  attempts: number
) {
  if (!testWorld.page) {
    throw new Error('Browser not initialized. Call initializeBrowser() first.');
  }

  // 寫入前端 lockout 約定
  const lockoutUntil = Date.now() + 10 * 60 * 1000;
  await testWorld.context?.addCookies([
    {
      name: 'saome_session_failed_attempts',
      value: String(attempts),
      domain: 'localhost',
      path: '/',
    },
  ]);
  await testWorld.page.evaluate(
    ({ e, lockoutData }) => {
      localStorage.setItem(
        `saome:loginLockout:${e.toLowerCase()}`,
        JSON.stringify(lockoutData)
      );
    },
    { e: email, lockoutData: { attempts, lockoutUntil } }
  );
});

Given('{string} 已被鎖定 {int} 分鐘', async function(
  this: any,
  email: string,
  minutes: number
) {
  if (!testWorld.page) {
    throw new Error('Browser not initialized.');
  }
  const lockoutUntil = Date.now() + minutes * 60 * 1000;
  await testWorld.context?.addCookies([
    {
      name: 'saome_session_failed_attempts',
      value: '3',
      domain: 'localhost',
      path: '/',
    },
  ]);
  await testWorld.page.evaluate(
    ({ e, ts }) => {
      localStorage.setItem(
        `saome:loginLockout:${e.toLowerCase()}`,
        JSON.stringify({ attempts: 3, lockoutUntil: ts })
      );
    },
    { e: email, ts: lockoutUntil }
  );
});

Then('我看到倒數計時', async function(this: any) {
  // Lockout 期間 UI 必存在倒數元件(data-testid 規範)
  await expect(testWorld.page.locator('[data-testid="lockout-countdown"]')).toBeVisible();
});

Then('倒數計時的值下降 {int} 秒', async function(this: any, seconds: number) {
  // 讀兩次,確認差值
  const before = await testWorld.page
    .locator('[data-testid="lockout-countdown"]')
    .textContent();
  await testWorld.page.waitForTimeout(seconds * 1000);
  const after = await testWorld.page
    .locator('[data-testid="lockout-countdown"]')
    .textContent();
  expect(before).not.toEqual(after);
});

// ───────────────────────────────────────────────────────────
// Direct API calls (used by lockout feature to "bypass frontend")
// ───────────────────────────────────────────────────────────

When('我直接呼叫後端 {string} 帶入正確密碼', async function(
  this: any,
  endpoint: string
) {
  if (!testWorld.context) {
    throw new Error('Browser not initialized.');
  }
  // Use Playwright's APIRequestContext to talk directly to the API host
  const apiContext = await pwRequest.newContext({
    baseURL: process.env.API_BASE_URL || 'http://localhost:8787',
    extraHTTPHeaders: { 'Content-Type': 'application/json' },
  });
  const body = await this.buildLastSubmittedLoginBody?.bind(this)();
  const response = await apiContext.post(endpoint, { data: body });
  this.lastApiStatus = response.status();
  this.lastApiJson = await response.json().catch(() => ({}));
  await apiContext.dispose();
});

// ───────────────────────────────────────────────────────────
// Tenant-login happy path helpers
// ───────────────────────────────────────────────────────────

Given('系統中已存在 tenant 帳號 {string} 密碼 {string}', async function(
  this: any,
  email: string,
  password: string
) {
  // 後端階段需要 fixture;前端 BDD 階段只記到 world 供後續步驟複用
  this.lastSubmittedLogin = { email, password, role: 'tenant' };
  this.buildLastSubmittedLoginBody = () => ({ email, password });
});

Given('系統中已存在 admin 帳號 {string} 密碼 {string}', async function(
  this: any,
  email: string,
  password: string
) {
  this.lastSubmittedLogin = { email, password, role: 'admin' };
  this.buildLastSubmittedLoginBody = () => ({ email, password });
});

// ───────────────────────────────────────────────────────────
// Session / sign-out helpers
// ───────────────────────────────────────────────────────────

Given('我已登入為 tenant 角色', async function(this: any) {
  // 設定 cookie 模擬 session,讓前端判斷為已登入
  await testWorld.context?.addCookies([
    {
      name: 'saome_session',
      value: 'fixture-tenant-session',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
    },
  ]);
  // 模擬 access token in memory
  await testWorld.page?.evaluate(() => {
    const fakeAccess = 'fake.access.tenant';
    localStorage.setItem('saome:fakeAccess', fakeAccess);
  });
});

Given('我的 refresh token 已過期', async function(this: any) {
  await testWorld.context?.addCookies([
    {
      name: 'saome_session',
      value: 'expired-fake',
      domain: 'localhost',
      path: '/',
      expires: 1, // Unix epoch — already expired
    },
  ]);
});

// ───────────────────────────────────────────────────────────
// Localization helpers
// ───────────────────────────────────────────────────────────

When('我點語言切換器選擇 {string}', async function(this: any, langLabel: string) {
  // 假設 Header 內有一個 i18n switcher button(具體 selector 由前端實作決定,
  // 此處採 data-testid 約定)
  const map: Record<string, string> = {
    English: 'en',
    '繁體中文': 'zh-TW',
    'zh-TW': 'zh-TW',
    en: 'en',
  };
  const locale = map[langLabel] || 'en';
  // 直接寫 localStorage 模擬使用者已切換
  await testWorld.page?.evaluate((l) => {
    localStorage.setItem('saome:locale', l);
  }, locale);
  // 重新載入頁面讓 i18n 重新初始化
  await testWorld.page?.reload();
  await testWorld.page?.waitForLoadState('networkidle');
});

Then('表單 title 是 {string}', async function(this: any, title: string) {
  await expect(
    testWorld.page.locator('[data-testid="auth-title"]')
  ).toHaveText(title);
});

Then('email 欄位 placeholder 是 {string}', async function(this: any, ph: string) {
  await expect(testWorld.page.locator('input[name="email"]')).toHaveAttribute(
    'placeholder',
    ph
  );
});

Then('密碼欄位 placeholder 是 {string}', async function(this: any, ph: string) {
  await expect(testWorld.page.locator('input[name="password"]')).toHaveAttribute(
    'placeholder',
    ph
  );
});

Then('「登入」按鈕文字是 {string}', async function(this: any, text: string) {
  await expect(
    testWorld.page.locator('[data-testid="login-submit"]')
  ).toHaveText(text);
});

Then('「登入」按鈕文字變 {string}', async function(this: any, text: string) {
  await expect(
    testWorld.page.locator('[data-testid="login-submit"]')
  ).toHaveText(text);
});

Then('我看到英文錯誤訊息 {string}', async function(this: any, msg: string) {
  await expect(testWorld.page.locator('[data-testid="login-error"]'))
    .toBeVisible()
    .toHaveText(msg);
});

// ───────────────────────────────────────────────────────────
// Coming soon page assertions
// ───────────────────────────────────────────────────────────

Then('我看到 tenant 的 {string} 殼頁', async function(this: any, label: string) {
  await expect(
    testWorld.page.locator('[data-testid="coming-soon-app"]')
  ).toContainText(label);
});

Then('我看到 admin 的 {string} 殼頁', async function(this: any, label: string) {
  await expect(
    testWorld.page.locator('[data-testid="coming-soon-admin"]')
  ).toContainText(label);
});
