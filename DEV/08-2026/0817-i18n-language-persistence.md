# 0817 i18n Language Persistence — Switch to English Reverts on Page Navigation

## Metadata

- **日期**：2026-08-17
- **作者**：Cursor Agent
- **規則 / skill 觸發**：`saome-dev-logging`、`saome-task-router`（L2）

---

## 症狀

> 使用者回報：切換到英文（EN）後，點擊其他頁面，語言會還原成中文（zh-TW）。

- **環境**：本地 dev（`localhost:5173`）
- **觸發條件**：在 Landing Page / Login Page 點擊語言切換 → 點擊 Header / Footer 連結

---

## 探針 / 重現

1. 開啟 Landing Page（`/`）
2. 點擊 Footer 的 `EN` 語言切換
3. UI 切換為英文 ✅
4. 點擊 Header 的 `/product` 連結
5. 頁面載入後，UI 回到中文 ❌

---

## 根因分析

### 根因 1（主要）：Marketing Header / Footer 使用 `<a href>` 觸發完整頁面重載

`Header.tsx`（lines 101-108, 198-207）與 `Footer.tsx`（lines 58-67）將內部路由渲染為 `<a href>` 而非 `<Link to>`。

點擊觸發**完整頁面重載**（HTTP GET），React app 重新初始化：
- `i18n/init()` 重新執行
- `lng: 'zh-TW'`（hardcoded default）重新設定
- `changeLanguage('en')` 的設定被清除

**對比**：`DashboardHeader` 正確使用 `<Link to>`，Dashboard 內部導航不會觸發此問題。

### 根因 2（次要）：i18n 沒有 localStorage 持久化

`changeLanguage()` 只寫入記憶體，沒有寫入 `localStorage`。

即使修好 `<a href>` 問題，瀏覽器重新整理仍會導致語言還原。

`useTheme` hook 正確實作了 `localStorage` 持久化（`saome.theme` key），i18n 從未套用相同模式。

### 根因 3（附帶）：`auth.en.ts` 缺少多個 key

登入表單相關 key（`noAccount`, `registerLink`, `forgotPassword`, `networkError`, `confirmPasswordMismatch`, `accountEmailHint`, `passwordHint`）在 `auth.en.ts` 缺失，導致英文使用者看到空白字串。

### 根因 4（附帶）：`theme.zh-TW.ts` 缺少 theme switcher 相關 key

`theme.zh-TW.ts` 缺少 4 個 key：`toggleLabel`, `currentLabel`, `resolvedLight`, `resolvedDark`。

### 根因 5（死程式碼）：`packages/shared/i18n/` 三個檔案零 import

`packages/shared/i18n/en.ts`、`zh-TW.ts`、`index.ts` 完全沒有被任何檔案 import，是死程式碼。

---

## 實作

### Phase 1：修復 anchor links

**`Header.tsx`**：
- Desktop nav：`<a href>` → `<Link to={link.href}>`
- Mobile drawer nav：同上

**`Footer.tsx`**：
- `footerLinks`：`<a href>` → `<Link to={link.href}>`
- `mailto:` 保持 `<a href>`（外部連結）
- 社交媒體 placeholder 保持 `<a href="#">`

### Phase 2：加入 localStorage 持久化

**`apps/frontend/src/i18n/index.ts`**：

```ts
const LANGUAGE_KEY = 'saome.lang';

function getInitialLanguage(): string {
  try {
    const persisted = localStorage.getItem(LANGUAGE_KEY);
    if (persisted === 'en' || persisted === 'zh-TW') return persisted;
  } catch {
    // SSR or blocked localStorage
  }
  return 'zh-TW';
}

export function setLanguage(lang: 'en' | 'zh-TW') {
  try { localStorage.setItem(LANGUAGE_KEY, lang); } catch {}
  void i18n.changeLanguage(lang);
}
```

Init 時：`lng: getInitialLanguage()` 而非 hardcoded `'zh-TW'`。

**`LanguageSwitcher.tsx`** 與 **`AuthLanguageSwitcher.tsx`**：
- 改用 `setLanguage(lang.code)` 而非直接呼叫 `i18n.changeLanguage(lang.code)`

### Phase 3：修正 i18n key drift

**`theme.zh-TW.ts`**：補回 4 個缺少的 key。

**`auth.en.ts`**：完整重寫，與 `auth.zh-TW.ts` 對齊所有 key。

### Phase 4：清理死程式碼

刪除 `packages/shared/i18n/` 三個零 import 檔案：
- `packages/shared/i18n/en.ts`
- `packages/shared/i18n/zh-TW.ts`
- `packages/shared/i18n/index.ts`

### Phase 5：加入 Browser Language Detection

修好 localStorage 持久化後，未登入訪客（無 localStorage 語言偏好）預設語言仍是 hardcoded `'zh-TW'`。需要從瀏覽器語言設定自動偵測。

**新增 `packages/shared/i18n/`**：

| 檔案 | 用途 |
|------|------|
| `detectLanguage.ts` | 純函式，讀 `navigator.languages[0]` 與 `navigator.language`，fallback 為 `'zh-TW'` |
| `detectLanguage.web.ts` | Vite 自動選擇的 browser shim（移除 test env guard） |
| `index.ts` | barrel export |

**Frontend config 更新**：

| 檔案 | 變動 |
|------|------|
| `vite.config.ts` | 加 `zustand` + `@saome/shared/i18n/detectLanguage` aliases |
| `vitest.config.ts` | 同上 |
| `test/setup.ts` | 設 `process.env.TEST_LANG='zh-TW'` 覆寫 jsdom 的 `navigator.language='en'` |
| `i18n/index.ts` | `getInitialLanguage()` 改呼叫 `detectDeviceLanguage()` 而非 hardcoded fallback |

---

## 驗證結果

| 驗證項 | 結果 |
|---|---|
| TypeScript（`tsc -b --noEmit`） | ✅ exit 0 |
| `npm run verify:i18n` | ✅ 12 namespace(s) passed |
| Vitest unit tests | ✅ 241 passed, 1 failed（預先存在的 `TemplateLibraryGrid` 失敗）|
| Linter | ✅ No errors |

---

## 衍生待辦

- [x] i18n localStorage 持久化 → 已實作
- [x] `auth.en.ts` key drift → 已實作
- [x] `theme.zh-TW.ts` key drift → 已實作
- [x] `packages/shared/i18n/` 死程式碼 → 已刪除
- [x] Browser Language Detection → 已實作

---

## 自問

- **下次怎麼不犯？**
  1. Marketing Shell（Header / Footer）所有內部連結預設用 `<Link to>` 而非 `<a href>`
  2. i18n 實作時，鏡像 `useTheme` 的 localStorage 持久化模式
  3. Browser 偵測 utility 要區分「在 browser 執行時的實作」與「在 test jsdom 環境的 fallback」

- **哪條 rule 該補？**
  `013-rwd.mdc` 已有 `<a href>` vs `<Link to>` 的 mobile-first 行為差異說明，但缺少「Marketing Shell Header/Footer 的連結應該用 `<Link to>` 以避免 i18n 重置」的具體約束。

> 撰寫者：Cursor Agent ｜ 時間：2026-08-17
