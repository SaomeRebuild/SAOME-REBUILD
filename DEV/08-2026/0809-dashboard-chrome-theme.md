# Dashboard Chrome + Theme System 實作日誌

## Metadata

- **日期**：2026-08-09
- **作者**：Josh（agent-assisted via Cursor）
- **觸發**：使用者要求建立 Dashboard UI chrome + Theme toggle
- **規則 / skill 觸發**：`saome-task-router`（L3 Heavy）、`saome-dev-logging`

---

## 實作範圍

### 新增檔案

| 檔案 | 說明 |
|---|---|
| `components/business/dashboard/DashboardHeader/` | Header 元件（6 個子檔）|
| `components/business/dashboard/DashboardFooter/` | Footer 元件 |
| `components/layout/DashboardShell.tsx` | Dashboard 殼層 |
| `components/layout/MarketingShell.tsx` | Marketing 殼層 |
| `components/ui/theme/ThemeProvider.tsx` | ThemeProvider |
| `components/ui/theme/ThemeToggle.tsx` | ThemeToggle 按鈕 |
| `hooks/useTheme.ts` | Theme hook |
| `hooks/useStorage.ts` | Storage hook（localStorage wrapper）|
| `i18n/locales/theme.en.json` | Theme namespace 英 |
| `i18n/locales/theme.zh-TW.json` | Theme namespace 繁 |
| `tests/smoke/dashboard-debug.spec.ts` | Dashboard smoke test |
| `design-system/MASTER.md` | 新增 light-mode token 章節 |
| `apps/frontend/playwright.config.ts` | Playwright 設定 |

### 修改檔案

| 檔案 | 說明 |
|---|---|
| `App.tsx` | DashboardMarketingShell / DashboardShell 條件 render |
| `main.tsx` | `<ThemeProvider>` 包 `<AuthProvider>` |
| `index.css` | `[data-theme=dark]` / `[data-theme=light]` 兩套 token |
| `src/hooks/index.ts` | barrel export useTheme / useStorage |
| `src/components/ui/index.ts` | barrel export ThemeProvider / ThemeToggle |
| `src/i18n/index.ts` | 註冊 theme namespace |
| `i18n/locales/*.json` | theme namespace 翻譯 |
| `package.json` | 新增 playwright/test 依賴 |

---

## 自問

- **下次怎麼不犯？**
  - Dashboard chrome 的 shell 拆分已完成，RN 化時零成本遷移
  - Theme 3-state（light/dark/system）已對齊 RN `Appearance` API
- **哪條 rule 該補？**
  - Login button `disabled` 防連點：加進 `frontend/024-mobile-future-proof.mdc` 的「禁止 pattern」清單
- **哪個 test 該加？**
  - `useTheme.test.tsx`：測 `system` 偏好偵測切換
  - `ThemeToggle.test.tsx`：測 light/dark/system 三狀態切換
