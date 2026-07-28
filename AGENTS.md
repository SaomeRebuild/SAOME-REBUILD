# Frontend Agent 守則

> 繼承根目錄 `AGENTS.md` 全部規則，本檔只列補充。

## Self-Improvement（MANDATORY）

任何 session 結束前、同樣的錯第二次出現、或使用者要求反省時，必須引用 `.cursor/skills/saome-self-improvement/SKILL.md`。詳見該 skill。

## New Repo SOP（MANDATORY）

任何新建 saome-* repo（saome-backend / saome-api-worker / saome-postgresql …）時，必須引用 `.cursor/skills/saome-new-repo/SKILL.md`，遵守路徑規則、必含檔案、defensive .gitignore 範本、禁止清單。

## ⚠️ 關於 mu-plugins 的 UI

**禁止沿用 mu-plugins 的任何 UI 內容**：
- ❌ 視覺風格（顏色、字型、版面、互動模式）
- ❌ CSS class 命名（.saome-* 等）
- ❌ jQuery / WP 互動模式
- ❌ shadcn / UI lib 元件選擇（必須透過 ui-ux-pro-max 評估後才能定）
- ❌ Tailwind class 組合（必須等 design token 規範）

UIUX 風格尚未定案，所有 UI 元件必須：
1. 先跑 `.cursor/rules/uiux/010-uiux-pro-max.mdc` 流程
2. 等 design system 完成後才能開始寫元件

詳見 `.cursor/rules/005-reference-mu-plugins.mdc`。

## ⚠️ Design System

所有 UI 決策以 `design-system/MASTER.md` 為源頭。

## 技術棧
- React 19 + Vite + TypeScript（strict）
- Tailwind CSS + shadcn/ui + Radix UI（需 ui-ux-pro-max 評估後才能定）
- TanStack Query（server state）
- Zustand（client state，僅小範圍）
- react-i18next（zh-TW + en）
- Storybook（元件文件）
- Vitest + React Testing Library（單元測試）

## 5 層元件分層（MANDATORY）

| Level | 位置 | 範例 |
|-------|------|------|
| L1 UI 元件 | `frontend/src/components/ui/` | `<Button>`, `<TextField>`, `<Modal>` |
| L2 業務元件 | `frontend/src/components/business/<scope>/<Name>/` | `<MemberCard>`, `<LinePayCheckoutButton>` |
| L3 Layout | `frontend/src/components/layout/` | `<Header>`, `<Sidebar>`, `<PageShell>` |
| Hooks | `frontend/src/hooks/` | `useAuth`, `usePermission`, `useTableQuery` |
| 服務層 | `frontend/src/services/`（BFF 用） | `passService`, `emailService` |

## 模組化結構（MANDATORY）

每個業務元件是**一個資料夾**：

```
components/business/<scope>/<Name>/
├── index.ts
├── <Name>.tsx              ← 主組件（<= 100 行，只做組裝）
├── <Name>Header.tsx        ← sub-component
├── <Name>Stats.tsx
├── <Name>Actions.tsx
├── <Name>Skeleton.tsx
├── <Name>.types.ts
├── <Name>.hooks.ts
├── <Name>.test.tsx
└── <Name>.stories.tsx
```

詳見 `.cursor/rules/000-modular-design.mdc` 與 `.cursor/rules/frontend/022-component-reuse.mdc`。

## Config 結構（MANDATORY）

```
apps/frontend/src/config/
├── index.ts            ← 對外暴露
├── env.ts              ← 環境變數 + zod 驗證
├── api.ts              ← API 設定
├── routes.ts           ← 路由常數
├── features.ts         ← feature flags
├── limits.ts           ← 業務限制
└── constants.ts        ← 角色、狀態、事件
```

詳見 `.cursor/rules/000-dynamic-config.mdc`。

## shared Package 邊界（MANDATORY）

apps/frontend/ **只能放 Web 特定內容**。所有可共用的程式碼必須在 `packages/shared/`：
- ✅ TypeScript 介面、zod schemas、業務邏輯純函式、常數、API contracts、i18n 翻譯檔
- ❌ 禁止在 apps/frontend/ 內寫任何可共用的業務邏輯
- ❌ 禁止在 apps/frontend/ 直接呼叫 `fetch` / `localStorage`
- 詳見 `.cursor/rules/frontend/023-shared-package.mdc`

## Mobile Future-Proof（MANDATORY）

為未來 React Native 化預先準備。每個 PR 必須能回答「換成 RN 需要改什麼？」：
- 業務邏輯在 packages/shared/，RN 化零成本遷移
- ❌ 禁止在 component 內寫業務邏輯
- ❌ 禁止直接使用 Web-only API（localStorage、IntersectionObserver 等）
- 詳見 `.cursor/rules/frontend/024-mobile-future-proof.mdc`

## RWD（MANDATORY）

所有 UI 必須 mobile-first：
- 預設 mobile 樣式，用 Tailwind breakpoint 增強
- 觸控目標 ≥ 44pt（mobile）
- 文字 ≥ 14px（mobile）
- DataTable 在 mobile 改用卡片列表
- 詳見 `.cursor/rules/uiux/013-rwd.mdc` 與 `014-breakpoints.mdc`

## 強制檢查
- ✅ 任何 UI 字串必走 i18n key，禁止 hard-code
- ✅ 任何互動元件必有對應 Storybook + test
- ✅ 任何 icon 必用 Lucide SVG，禁用 emoji
- ✅ 任何顏色 / spacing 必用 design token，禁用 hard-code hex
- ✅ 任何新 UI 必須先檢查 `components/ui/` 與 `components/business/` 是否有可重用元件
- ✅ 禁止在 component 內寫業務邏輯（拆到 hook 或 service）
- ✅ 禁止跨層引用（L2 不可直接修改 L1；改成變體擴充）
- ✅ commit 前判斷層級（規範層 / 操作層 / 私人層），依層級決定是否 push（見 `.cursor/skills/saome-self-improvement/SKILL.md` Step 3 三層決策表）
- ✅ 規範層（rules / skills / AGENTS.md / feedback）與操作層 commit **必須 push**（除非含 secret）

## Auth flow 鐵律（自 2026-07-28 admin-login recovery chain 補上）

每個 auth-related page / form 都必須通過下列檢查，缺一即視為 bug：

1. **後端 200 ≠ 通過**：成功的 200 response 加上正確的 `Set-Cookie` 不代表登入完成。**必須**手動驗證 user 看到的下一個畫面（next screen）有可讀內容、token 正確帶到下一個 request、可關閉 tab 後重開仍持 session。
2. **SPA 必走 client-side redirect**：任何 `setState({user,accessToken})` 之後必須**同步**呼叫 `navigate(ROLE_HOME_PATH[role], { replace: true })` 或 `useAuthRedirect()`。Login 跟 Register 行為必須對稱（同一個 hook 或同等 explicit navigate）。
3. **AuthGuard 必有對稱 reverse-direction**：每一個 `<AuthGuard>`（未登入 → 推 login）必對應一個 `<AuthenticatedRedirect>`（已登入 → 推 home）。back button 是常見的回歸來源。
4. **「It works but it looks wrong」仍是 P0**：每個 placeholder / L1 元件必須跑 `forbidden-class scan`（禁 `bg-white` / `text-neutral-{50..900}` / `bg-[#abc]` 等 hardcoded colour），參考 `apps/frontend/src/components/ui/feedback/ComingSoonCard.test.tsx` 的實作。

## CORS / Mixed Content 鐵律

任何 deploy 後的整合測試**必須**包含這兩個靜態檢查，缺一即視為 deploy 失敗：

- **Mixed Content grep**：`grep -c localhost dist/assets/*.js` 必須為 0。任何 frontend bundle 不能內含 localhost URL 指向 production backend。完整 post-build audit script 範本見 `.cursor/rules/017-production-bundle-guard.mdc`。
- **CORS preflight trace**：DevTools Network 上若 OPTIONS 回 204 但 response 沒有 `Access-Control-Allow-Origin` header → 瀏覽器會 silently drop POST。用 Cloudflare Observability `$metadata.service eq <name>` 確認 backend 有收到 OPTIONS，但 POST 沒出現 = CORS 拒絕。`ALLOWED_ORIGIN_PATTERNS` 用法見 `.cursor/rules/015-cloudflare-pages-deploy.mdc` + `apps/backend/wrangler.jsonc`。

## 變更既有元件
- L1（shadcn 元件）可改，但改完更新 `design-system/MASTER.md`
- L2（業務元件）需在 PR 描述說明影響範圍
- 任何 breaking change 必須走 `001-methodology.mdc` 的 SDD 流程

## 禁止
- ❌ 沿用 mu-plugins 的 UI 風格（**重複強調**）
- ❌ 寫死任何顏色 / 字型 / 間距值
- ❌ 跳過 ui-ux-pro-max 直接寫 UI 元件
- ❌ 引用未實際寫成 .mdc 的 rule 路徑（引用前必須先產生對應檔案）
- ❌ 在合併 / 替換 / 刪除任何目錄前，沒先跑 `git ls-tree` 對比

---

## SDD/BDD/TDD 方法論整合（MANDATORY）

SAOME-REBUILD 採用三層方法論開發流程，詳細說明見：

- **憲法**: `.specify/memory/constitution.md` — 定義核心原則
- **橋梁 Skill**: `.cursor/skills/saome-methodology-bridge/SKILL.md` — 統一觸發時機與資料流向

### 三系統關係

| 系統 | 驗證層次 | 工具 | 產出 |
|------|----------|------|------|
| SDD | 規格層 | Spec-Kit | spec.md, plan.md, tasks.md |
| BDD | 行為層 | Cucumber | *.feature, step definitions |
| TDD | 實作層 | Vitest + RTL | *.test.tsx |
| Smoke | 整合層 | Playwright | smoke test report |

### 快速觸發

| 情境 | 關鍵字 | 必需流程 |
|------|--------|----------|
| 新功能 | 新功能、加功能、做頁面 | SDD + BDD + TDD + Review |
| 修 bug | 修 bug、修復、fix | TDD + Review |
| 改 UI | 改 UI、切版 | TDD + RWD + Review |
| 加業務邏輯 | 加業務邏輯 | SDD + BDD + TDD + Review |
| 重構 | 重構、refactor | SDD + TDD + Review |
| Deploy | deploy、部署、上線 | Smoke Test |

詳見 `.cursor/skills/saome-methodology-bridge/SKILL.md`。
