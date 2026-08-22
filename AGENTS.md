# Frontend Agent 守則

> 繼承根目錄 `AGENTS.md` 全部規則，本檔只列補充。

## Self-Improvement（MANDATORY）

任何 session 結束前、同樣的錯第二次出現、或使用者要求反省時，必須引用 `.cursor/skills/saome-self-improvement/SKILL.md`。詳見該 skill。

## Article Writing（MANDATORY）

寫 root-level 文章 / blog / 教學文 / polished 公開文時，必須引用 `.cursor/skills/article-writing/SKILL.md`。紀律見 `.cursor/rules/articles/001-article-style.mdc`。

**DEV LOG 走另一個 skill**：`saome-dev-logging`（debug log / 事故記錄 / 維運筆記）。DEV LOG 跟 article 是兩件事，混用會破壞兩者的目的。

判斷口訣：

- **article**：給別人讀，讀者舒適度優先
- **DEV LOG**：給未來的自己讀，raw data 完整性優先

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

詳見 `.cursor/rules/000-modular-design.mdc`（含 React 元件 / Hono backend / 第三方 API 包裝 / API contract 四個 Part）與 `.cursor/rules/frontend/022-component-reuse.mdc`（React 元件重用）。

**sub-component 拆分門檻**：主組件 JSX 行數 > 50 行時，立即拆分 sub-component，再開始寫 test。

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
- ✅ 任何 session 開頭或收到新任務時，**必須先 invoke `saome-task-router`** 判斷任務級距
- ✅ 寫多步表單 / `<input type="email">` / `<input type="password">` 前**必須**讀 `.cursor/rules/018-form-autofill-and-multi-step-state.mdc`
- ✅ 改 backend schema (`request.ts` / `dto.ts`) 或新增 DB migration 前**必須**讀 `.cursor/rules/019-schema-contract-drift.mdc`
- ✅ Feedback 在實作過程中**即時**寫入 DEV LOG 的「衍生」段落，不要事後補
- ✅ DEV LOG 寫完 → 讀「自問」段落 → 在 `runs/improvements/INDEX.md` 加 pending action
- ✅ feature 的 code + feedback **同 commit**，不要分開兩個 commit
- ✅ 新增任何 `.stories.tsx` 前，對齊 `@storybook/react` 跟 `@storybook/react-vite` 版本
- ✅ 所有 smoke test credential 從 `tests/smoke/template.ts` import，禁止 hard-code 在 spec 內
- ✅ 每次跑 smoke test 用 `npm run test:smoke`（統一 playwright config 在 root）
- ✅ 任何 migration 檔建立後，**必須**立即透過 `saome_supabase` MCP apply，commit footer 填 `Migration: <name> applied via saome_supabase MCP`
- ✅ `templateSettingsSchema`（或任何 shared schema）新增 field 時，**必須**同步檢查四層：shared schema → backend request.ts → backend db interface → backend service（詳見 `.cursor/rules/019-schema-contract-drift.mdc` §4.1）

## Task Router 入口（MANDATORY）

> 任何 session 開頭或收到新任務時，**必須先 invoke `saome-task-router`** 判斷任務級距。

### 四級分流表

| 等級 | 觸發條件 | 工作流程深度 |
|------|----------|--------------|
| **L1 Trivial** | 改 UI 元件屬性 / 修 typo / 改文案 | 直接做 → lint → test |
| **L2 Standard** | 新 L1/L2 元件 / 一般 bug fix | TDD → Verification |
| **L3 Heavy** | 新功能涉及多模組 / 架構改動 / 跨 package 變更 | Brainstorming → Decision Log → TDD → Review → Smoke |
| **L3 Escape Hatch** | L3 Heavy 但需求模糊 / 跨系統整合 / Breaking change | L3 Heavy + Spec-Kit 完整流程 |

詳見 `.cursor/skills/saome-task-router/SKILL.md`。

### Decision Log 規範（L3 Heavy 必填）

L3 Heavy 任務**必須**寫 `runs/decisions/YYYY-MM-DD-<topic>.md`，含三段式：
- **背景**：為什麼要做這個決定
- **選項與決定**：列舉選項、最終選擇及理由
- **影響**：這個決定影響哪些現有系統

### 已廢除項目清單（2026-07-29）

以下為**已廢除**，不再使用：
- `.cursor/rules/002-bdd.mdc`（已刪除）
- `.cursor/rules/012-bdd-workflow.mdc`（已刪除）
- `.feature` 檔（已刪除）
- `packages/shared/bdd/`（已刪除）
- `test:bdd` / `test:bdd:watch` npm scripts（已移除）

## Auth flow 鐵律（自 2026-07-28 admin-login recovery chain 補上）

每個 auth-related page / form 都必須通過下列檢查，缺一即視為 bug：

1. **後端 200 ≠ 通過**：成功的 200 response 加上正確的 `Set-Cookie` 不代表登入完成。**必須**手動驗證 user 看到的下一個畫面（next screen）有可讀內容、token 正確帶到下一個 request、可關閉 tab 後重開仍持 session。
2. **SPA 必走 client-side redirect**：任何 `setState({user,accessToken})` 之後必須**同步**呼叫 `navigate(ROLE_HOME_PATH[role], { replace: true })` 或 `useAuthRedirect()`。Login 跟 Register 行為必須對稱（同一個 hook 或同等 explicit navigate）。
3. **AuthGuard 必有對稱 reverse-direction**：每一個 `<AuthGuard>`（未登入 → 推 login）必對應一個 `<AuthenticatedRedirect>`（已登入 → 推 home）。back button 是常見的回歸來源。
4. **「It works but it looks wrong」仍是 P0**：每個 placeholder / L1 元件必須跑 `forbidden-class scan`（禁 `bg-white` / `text-neutral-{50..900}` / `bg-[#abc]` 等 hardcoded colour），參考 `apps/frontend/src/components/ui/feedback/ComingSoonCard.test.tsx` 的實作。
5. **useAuth() 回傳形狀**：每次使用 `useAuth()` 前，確認其回傳值形狀。`useAuth()` 回傳 `{ state: AuthState, ... }`，`tenant` 在 `state.tenant` 底下，不是直接解構。

> 這 5 條鐵律來自 7+ 個 bug 的教訓（見 `DEV/08-2026/0808-bug-7-trace.md` — Bug-4 umbrella / 4b / 4c / 4d / 5 / 6 / 7a / 7b / 7 follow-up）。
> `useAuth()` 回傳形狀問題見 `DEV/08-2026/0822-card-builder-step2-issuer-fix-and-membership-extension.md`。
> 任何 auth-related work 必先讀該檔。決策依據見 `DEV/08-2026/0808-dev.md`。
>
> 注意：auth / payment / session recovery / checkout 都是 **critical chain**。修這條 chain 上的 bug 即便 scope 看似 L2，也必須走 L3 流程 + production smoke test（詳見 `.cursor/rules/001-methodology.mdc` § Critical chain bridge 與 `.cursor/skills/saome-task-router/SKILL.md` Step 5）。

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

## SDD/TDD 方法論整合（MANDATORY）

SAOME-REBUILD 采用 task-router 分流的兩層方法論，詳細說明見：

- **憲法**: `.specify/memory/constitution.md` — 定义核心原则
- **橋梁 Skill**: `.cursor/skills/saome-methodology-bridge/SKILL.md` — 統一觸發時機與資料流向

### task-router 分流後的流程

| 等級 | 流程 |
|------|------|
| L1 Trivial | 直接做 → lint → test |
| L2 Standard | TDD → Verification |
| L3 Heavy | Brainstorming → Decision Log → TDD → Review → Smoke |
| L3 Escape Hatch | L3 Heavy + Spec-Kit 完整流程 |

### 快速觸發（task-router 分流後）

| 情境 | 關鍵字 | task-router 等級 |
|------|--------|----------------|
| 改 UI / 修 typo | 改 UI、切版、修 typo | L1 Trivial |
| 新 L1/L2 元件 / bug fix | 新增、元件、fix | L2 Standard |
| 新功能（多模組） | 新功能、加功能 | L3 Heavy |
| 需求含糊 / 跨系統 | 平台整合、BREAKING | L3 Escape Hatch |
| Deploy | deploy、部署、上線 | Smoke Test |

詳見 `.cursor/skills/saome-task-router/SKILL.md` 與 `.cursor/skills/saome-methodology-bridge/SKILL.md`。

## 表單 / Schema 整合 Skill

寫 multi-step form 或 schema 跨 package 對齊時，引用：

- `.cursor/skills/saome-form-integrity/SKILL.md` — 表單 autofill + schema drift 的 playbook
- `.cursor/rules/018-form-autofill-and-multi-step-state.mdc` — autofill + multi-step state 鐵律
- `.cursor/rules/019-schema-contract-drift.mdc` — DB ↔ zod schema ↔ backend contract 鐵律

事故紀錄：`runs/improvements/feedback/20260731-register-autofill-schema-drift.md`。

## Backend 開發紀律

### postgres.js Dynamic Query

動態 UPDATE / INSERT 必須使用 tagged template injection，禁止混合 `$N` positional placeholder。
詳見 `.cursor/rules/027-postgres-dynamic-query-pattern.mdc`。

```typescript
// ✅ 正確：所有值都透過 ${} 注入
await sql`UPDATE t SET ${input.name !== undefined ? sql`name = ${input.name}` : sql``} WHERE id = ${id}`;

// ❌ 錯誤：$N + tagged template 混合 → unterminated dollar-quoted string
```

### Migration Apply Checklist

新增 migration 檔後，**必須**逐項確認才能 close session：

| # | 檢查項 | 失敗時的行動 |
|---|--------|-------------|
| 1 | 透過 `saome_supabase` MCP `apply_migration` | 若 MCP timeout，**不要** commit workaround；等 MCP reconnected 再 apply |
| 2 | 確認 `execute_sql` 回傳 `[]`（DDL success）| 若 "column already exists"，表示 migration 已 apply，可安全繼續 |
| 3 | Commit message footer 必填 MCP apply 結果 | `Migration: <name> applied via saome_supabase MCP` |

詳見 `.cursor/rules/frontend/025-vibe-coding-l2-checklist.mdc` § DB Migration Checklist。
