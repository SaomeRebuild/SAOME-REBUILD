# Dashboard Chrome + Theme System — 實作 Feedback

**日期**：2026-08-09
**類型**：feedback
**範圍**：frontend / dashboard / theme
**階段**：L3 Heavy → Plan → Implementation → Smoke

---

## 實作過程中發現的問題

### F1：Storybook CSF v3 格式不相容

**預期**：Storybook 8.x 用 CSF v3，`type Meta<typeof Component>` 可以正常解析。

**實際**：`@storybook/react-vite` 一直噴 `Cannot find module '@storybook/react'`。檢查發現：`@storybook/react` 在 `package.json` 的 `devDependencies` 位置，`@storybook/react-vite` 會自己 resolve 到同版本的 `@storybook/react`。

**修法**：package.json 加 `"@storybook/react": "^8.5.0"` explicit dependency。

**教訓**：monorepo workspace dependency hoisting 行為跟 npm 獨立專案不同，Storybook 這種有多個 peer dep 的套件最好 explicit。

---

### F2：Design System MASTER.md 更新節奏問題

**預期**：ui-ux-pro-max 跑完直接補進 MASTER.md，流程乾淨。

**實際**：ui-ux-pro-max 的 token 輸出覆蓋範圍比預期大（dark mode token 一堆），直接 merge 可能衝掉既有的章節。最後手動挑出 light-mode 相關的補充進去。

**修法**：維持「ui-ux-pro-max 輸出 → 手動 filter → 進 MASTER.md」的流程，不整個覆寫。

**教訓**：ui-ux-pro-max 的 token 輸出**不是** atomic patch，是整份重建；未來需要一個 `scripts/merge-tokens.js` 來做 diff-merge。

---

### F3：DashboardHeader 的 NavItem slot prop 實作

**預期**：`DashboardHeader` 接受 `navItems: NavItem[]` prop，差異化在頁面層控制。

**實際**：一開始把 `DashboardHeaderNav.tsx` 寫死了，後來重構成 `<header>` + `<DashboardHeaderNav items={navItems} />` 分離。

**修法**：見 `runs/decisions/2026-08-09-dashboard-chrome-theme.md` Q4 決議。

**教訓**：sub-component 拆分要在寫第一版時就做，不要事後重構。「業務元件一個資料夾」的規則要搭配「sub-component 在資料夾內預先拆分」才能真正防堵 god component。

---

### F4：Vitest + RTL + i18next 設定

**預期**：在 `setup.ts` 一次設定好 i18next，test 內 `useTranslation` 就正常。

**實際**：`i18next` 在 vitest worker 內的初始化順序跟 Vite dev server 不同，需要 `i18n.changeLanguage` 手動觸發或 `waitFor` 等待翻譯載入。

**修法**：`DashboardHeader.test.tsx` 內加 `await waitFor(() => expect(screen.queryByText('dashboard.title')).toBeInTheDocument());` 確保翻譯載入後再斷言。

**教訓**：i18next 在 Vitest 的初始化跟 React i18next 文件說的不完全一致，需要实际测试驗證最佳實踐。

---

### F5：Playwright smoke test 的登入流程

**預期**：smoke test 直接 POST login API，拿到 token 後存 cookie，跳過 UI 登入流程加速測試。

**實際**：`loginService` 依賴 `sql`（Hyperdrive binding），在 smoke test 環境要 mock Hyperdrive。改用 UI flow（填表 + 點擊）更接近真實使用情境，且不需要 mock Hyperdrive。

**修法**：`dashboard-debug.spec.ts` 用 `page.fill()` + `page.click()` 走完整 UI flow。

**教訓**：BFF service 在 smoke test 環境的 mock 成本有時比走 UI flow 還高。測試策略要跟環境特性搭配，不要因為「API 測試更快」就硬走 API。

---

## 順利的地方

| # | 項目 | 說明 |
|---|---|---|
| S1 | Route-based shell split | `App.tsx` 條件 render 符合預期，RN 化時替換底層 rendering engine 即可 |
| S2 | 3-state theme system | `useTheme` hook 的 `system` enum + `matchMedia` listener 未來可直接換成 RN `Appearance` |
| S3 | i18n theme namespace 拆分 | theme translation 獨立 namespace，RN 化時替換翻譯檔案格式（JSON → TS）即可 |

---

## 自問

### 下次怎麼不犯？

1. **Storybook 多 package**：未來加 Storybook component 前，先確認所有 `@storybook/*` packages 的版本號一致，加進同一個 `check-storybook-versions.cjs` 脚本。
2. **ui-ux-pro-max merge**：寫一個 `scripts/merge-design-tokens.cjs`，接受「既有 MASTER.md + ui-ux-pro-max 輸出」，輸出 diff，讓人確認哪些章節要覆寫再執行。
3. **sub-component 預先拆分**：規則加一條「業務元件資料夾內，主組件第一版寫完後，立即檢查是否有超過 50 行的 JSX；超過就拆分」。

### 哪條 rule 該補？

| 規則 | 建議 |
|---|---|
| `000-modular-design.mdc` | 加一條：sub-component 拆分時機（主組件 > 50 行 JSX） |
| `006-verification.mdc` | 加 Storybook version consistency check |
| `frontend/023-shared-package.mdc` | 加 i18n namespace 拆分最佳實踐（theme/dashboard/auth 各自獨立）|

### 哪個 test 該加？

| 測試 | 位置 |
|---|---|
| `ThemeToggle.test.tsx` | 測 light/dark/system 三狀態切換 + localStorage persist |
| `useTheme.test.tsx` | 測 `matchMedia` listener 在 component mount/unmount 時正確新增/移除 |
| `DashboardHeader.test.tsx` | 測不同 `navItems` prop 渲染不同連結 |
| `DashboardShell.test.tsx` | 測 `<DashboardShell>` 內含 `<DashboardHeader>` + `<DashboardFooter>` |
