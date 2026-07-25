# SAOME-REBUILD Agent 入口

> 新架構 WordPress → Cloudflare Workers / Hono / React / Supabase
> **2026-07-25 更新**：spec-kit 已透過 `specify init --here --integration cursor-agent` 真實初始化，10 個 `speckit-*` skill 已注入 `.cursor/skills/`。SAOME 自製 SDD 流程（`specs/spec/_template/`、`007~009.mdc`、8-step workflow）已刪除。

---

## 🚀 啟動序列（每次進入必執行）

**這個章節是給新 Agent 看的。照順序執行，一步一步來。**

### Step 0 — 載入 Superpowers `using-superpowers`（MANDATORY）

**在動任何動作前**，**先**用 `globals` Read 工具讀 `C:\Users\user\.cursor\plugins\local\superpowers\skills\using-superpowers\SKILL.md`，並遵守它的 <EXTREMELY-IMPORTANT> 規範：

> If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

每次對話開始時必說「Using `using-superpowers` to 決定流程」並列舉這次任務相關的 skill（brainstorming / writing-plans / test-driven-development / verification-before-completion / systematic-debugging / ...）。

### Step 0.5 — 模式選擇（MANDATORY）

完成 Step 0 後，**依任務性質選擇模式**：

| 模式 | 用途 | 進入時機 |
|------|------|----------|
| **Ask** | 純問答 / 檢視 / 流程討論 | user 沒要求改 code |
| **Plan** | 規劃但不寫檔 | user 要策略 / 架構決策 |
| **Agent** | 真的改 code / 寫檔案 | user 要求實作 |

> 流程建議（新功能）：**Ask → Plan → Agent**（先收齊設計決策 → 走 `brainstorming` → 寫草稿 → 才動工）
> 詳見 `.cursor/rules/001-methodology.mdc` 階段零。

### Step 1 — 載入本專案 Skills（第二關）

```
在讀任何東西之前，先讀：
  1. .cursor/skills/saome-skill-router/SKILL.md（決定方向）
  2. .cursor/skills/saome-dev/SKILL.md（DEV 紀錄規範）
```

這兩個 skill 決定「接下來要讀哪些 rules」「這個任務的標準作業流程」。

### Step 2 — 讀取目前狀態（按順序）

```
1. 讀取 AGENTS.md（你正在讀這個）
2. 讀取 DEV/README.md → 找到最新一篇
3. 讀取最新的 DEV/MM-YYYY/MMDD-dev.md
   → 必看「🤝 Handoff To Next Agent」段（次優先任務 / 必先讀 / 必先驗證 / 已知地雷）
   → 再看「✅ 完成事項 / 🔍 洞察 / 📋 待辦」
4. 檢查 specs/ 有沒有正在進行中的 spec
   → 如果有，讀取 spec.md + tasks.md
   → **必同時檢查 specs/features/ 有沒有對應 .feature（SDD 後必接 BDD，不可跳）**
5. 檢查 runs/improvements/feedback/ 有沒有未處理的 self-improvement
```

> **目前狀態（2026-07-25）**：Frontend 首頁 + Header + Footer 完成（tsc 0 error、build success、6 sections）。下一個待辦是 Backend 啟動或 Vitest 設定補齊。詳見 `DEV/07-2026/0725-dev.md` Session 2 段落。

### Step 3 — 載入相關 Rules（**按任務類型載入**（不要一次讀 16 條））

| 任務類型 | 必載 rules |
|---------|-----------|
| **任何任務** | `001-methodology.mdc` + `002-multi-tenant.mdc` + `004-security.mdc` |
| **新功能 / 改 spec** | + `003-i18n.mdc` + `005-reference-mu-plugins.mdc` |
| **寫 backend route / service** | + `backend/034-service-pattern.mdc` |
| **寫 React component** | + `frontend/022-component-reuse.mdc` + `frontend/023-shared-package.mdc` + `frontend/024-mobile-future-proof.mdc` + `uiux/010~014` |
| **結束任務前** | + `006-verification.mdc` + `000-code-review.mdc` + `000-deslop.mdc` + `000-log-discipline.mdc` |
| **準備寫 DEV 紀錄** | + `011-dev.mdc` |
| **用戶抱怨重複錯誤** | + `010-self-improvement.mdc` |
| **Workers / Cloudflare** | + `007-cloudflare-workers.mdc` |

**架構鐵律（始終套用，不需載入）**：`000-modular-design` / `000-dynamic-config` / `000-business-constants` / `000-glossary`

### Step 4 — 開始工作

```
完成 Step 1-3 後，根據目前狀態決定：
- 有未完成的待辦 → 從 tasks.md 的 NEXT Phase 繼續
- 還沒有 spec → 從第一個功能開始走 SDD 流程（Ask → Plan → Agent）
- 任務結束前 → 填寫 `🤝 Handoff To Next Agent` 段（在 DEV/MMDD-dev.md 內）
```

### 附錄：Skill 觸發關鍵字對照（路由速查）

| 提到 / 觸發 | Skill |
|---|---|
| CI / workflow 失敗 | `fix-ci` |
| 等待 CI 結果 | `loop-on-ci` |
| PR conflicts + comments + CI 三件事 | `babysit` |
| 「又犯同樣錯誤」 | `saome-self-improvement` |
| React / UI / shadcn | `ui-ux-pro-max` + `ui-styling` |
| Hono / Workers | `hono-skill` + `cloudflare` |
| DB / Postgres / RLS | `supabase` + `supabase-postgres-best-practices` |
| smoke test / E2E | `run-smoke-tests` |
| 編譯 / type-check | `check-compiler-errors` |
| 部署 / Wrangler | `wrangler` |
| 想看最佳化 | `workers-best-practices` |
| 從 mu-plugins 找對應邏輯 | `.cursor/workflows/migrate-from-wp.md` |
| 新功能完整流程 | `.cursor/workflows/new-feature.md` |
| 部署 | `.cursor/workflows/deploy.md` |

---

## ⚠️ 鐵律（Always Apply）

### 流程鐵律
| # | Rule | 用途 |
|---|------|------|
| 1 | `.specify/memory/constitution.md` + `001-methodology.mdc` | spec-kit + Superpowers 流程入口（見上方「spec-kit Skills」） |
| 2 | `002-multi-tenant.mdc` | company_id 隔離鐵律 |
| 3 | `003-i18n.mdc` | 雙語規範 |
| 4 | `004-security.mdc` | 安全鐵律 |
| 5 | `006-verification.mdc` | 完成驗證 |
| 6 | `005-reference-mu-plugins.mdc` | mu-plugins 引用守則 |

### 架構鐵律
| # | Rule | 用途 |
|---|------|------|
| 7 | `000-modular-design.mdc` | 模組化設計（檔案大小上限） |
| 8 | `000-dynamic-config.mdc` | 動態化禁寫死 |
| 9 | `000-business-constants.mdc` | 店家可自訂常數走 DB |

### 收尾鐵律
| # | Rule | 用途 |
|---|------|------|
| 10 | `000-code-review.mdc` | 程式碼審查 11 類檢查 |
| 11 | `000-deslop.mdc` | AI 痕跡黑名單 |
| 12 | `000-log-discipline.mdc` | Log 紀律 |
| 13 | `010-self-improvement.mdc` | 自我改進迴圈 |
| 14 | `011-dev.mdc` | DEV 開發紀錄規範 |
| 15 | `000-glossary.mdc` | 術語表 |

### 平台 Rule
| # | Rule | 用途 |
|---|------|------|
| 16 | `007-cloudflare-workers.mdc` | Workers 開發鐵律（永遠從最新文件取值） |

---

## ⚠️ mu-plugins（Read-Only 參考）

`mu-plugins/` 只作為商業邏輯參考，還有第三方API使用的參考，**不可沿用**：
- ❌ UI 視覺風格、CSS 命名、互動模式
- ❌ PHP / JS / CSS 程式碼本身
- ❌ shadcn / UI lib 元件選擇、Tailwind class 組合
- ❌ 資料表結構（必須重新設計）
- ✅ 商業邏輯流程與規則（if-then、權限、業務約束）
- ✅ 資料表欄位的業務語意

詳見 `.cursor/rules/005-reference-mu-plugins.mdc`。

## ⚠️ UIUX 風格尚未定案

未跑 `ui-ux-pro-max` 評估流程前，禁止自行決定顏色、字型、版面。
詳見 `.cursor/rules/uiux/010-uiux-pro-max.mdc`。

---

## 技能路由

**所有任務第一關：用 saome-skill-router 判斷方向。**

詳見 `.cursor/skills/saome-skill-router/SKILL.md`。

### 本專案 Skills

| Skill | 用途 |
|-------|------|
| `saome-skill-router` | 技能路由（整合全部全域 skills + SAOME 專屬情境） |
| `saome-self-improvement` | 自我改進迴圈（分析失敗模式 → 提案 → 人類確認 → 合併） |

### spec-kit Skills（2026-07-25 初始化，**真實官方**）

> 透過 `specify integration install cursor-agent` 注入，10 個 slash command。

| Skill | 對應 slash command | 用途 |
|-------|---------------------|------|
| `speckit-constitution` | `/speckit.constitution` | 編輯 `.specify/memory/constitution.md` |
| `speckit-specify` | `/speckit.specify` | 從需求產生 `spec.md` |
| `speckit-clarify` | `/speckit.clarify` | 對 `spec.md` 提問補完 |
| `speckit-plan` | `/speckit.plan` | 從 `spec.md` 產生 `plan.md` |
| `speckit-tasks` | `/speckit.tasks` | 從 `plan.md` 拆解 `tasks.md` |
| `speckit-checklist` | `/speckit.checklist` | 產生驗收 checklist |
| `speckit-implement` | `/speckit.implement` | 依 `tasks.md` 執行 |
| `speckit-analyze` | `/speckit.analyze` | 對齊 spec / plan / tasks |
| `speckit-converge` | `/speckit.converge` | 對 codebase 找剩餘工作 |
| `speckit-taskstoissues` | `/speckit.taskstoissues` | tasks.md 轉 GitHub issue |

**SDD 流程入口**：`/speckit.constitution` → `/speckit.specify` → ...（見 `.cursor/rules/001-methodology.mdc`）。
**禁止**：手寫 spec.md / plan.md / tasks.md、跳過 constitution 直接 specify、跳過 checklist 直接 implement。
| `saome-dev` | DEV 開發紀錄（每次 session 必填） |

### 全域 Skills（`~/.cursor/skills/`，所有專案皆可用）

| Skill | 用途 | 觸發條件 |
|-------|------|---------|
| `cloudflare` | Cloudflare 全平台決策樹 | Workers / KV / R2 / D1 / Durable Object / AI |
| `wrangler` | Wrangler CLI 完整指令 | Wrangler / `wrangler deploy` / `wrangler dev` |
| `agents-sdk` | Cloudflare AI Agents SDK | AI agent / streaming / WebSocket / `@callable` |
| `durable-objects` | Durable Objects 進階用法 | Durable Object / DO class |
| `workers-best-practices` | Workers 效能與安全最佳化 | Workers 優化 / cold start / V8 isolate |
| `web-perf` | Core Web Vitals 審計 | Web Vitals / performance audit |
| `sandbox-sdk` | 安全程式碼執行 | code interpreter / sandbox |
| `building-mcp-server-on-cloudflare` | 在 Cloudflare 上建 MCP Server | build MCP server / create MCP tools / deploy MCP |
| `building-ai-agent-on-cloudflare` | 在 Cloudflare 上建 AI Agent | build agent / AI agent / chat agent |
| `cloudflare-email-service` | Email Workers / Email Routing | Email Workers / Email Routing / Mailgun |
| `hono-skill` | Hono API 通用知識 | Hono / middleware / route |
| `code-review-skill` | 程式碼審查 | PR review / code review |
| `fix-ci` | 找失敗 job、檢日誌、apply 修復 | CI 失敗 / workflow 錯誤 |
| `loop-on-ci` | 持續監控 CI 直到全綠 | 等待 CI 結果 |
| `babysit` | 同時處理 PR conflicts + comments + CI | PR conflicts / 多重 PR 問題 |
| `run-smoke-tests` | Playwright smoke tests 驗證 | smoke test / E2E |
| `check-compiler-errors` | 編譯 / type-check | build error / lint error / type error |
| `supabase` | Supabase 全產品 | Supabase / Auth / RLS / Edge Functions / storage |
| `supabase-postgres-best-practices` | Postgres 效能優化 | Postgres 效能 / index / query 優化 |

### 全域 MCP Servers

| MCP Server | URL | 用途 |
|------------|-----|------|
| `cloudflare-api` | `https://mcp.cloudflare.com/mcp` | Cloudflare API 完整操作 |
| `cloudflare-docs` | `https://docs.mcp.cloudflare.com/mcp` | 即時查 Cloudflare 文件 |
| `cloudflare-bindings` | `https://bindings.mcp.cloudflare.com/mcp` | Workers bindings 幫手 |
| `cloudflare-builds` | `https://builds.mcp.cloudflare.com/mcp` | Workers 部署管理 |
| `cloudflare-observability` | `https://observability.mcp.cloudflare.com/mcp` | Log 分析 |
| `hono-docs` | `https://hono-docs-mcp.yusukebe.workers.dev/mcp` | Hono 文件查詢 |
| `saome_supabase` | Supabase MCP | Supabase 全功能（DB, Auth, Storage, Edge Functions） |
| `saome_github` | GitHub MCP | GitHub 操作（PR, Issues, Actions） |

### Cloudflare Commands

| Command | 用途 | 觸發條件 |
|---------|------|---------|
| `/cloudflare:build-agent` | 透過 Agents SDK 建立 AI Agent | 使用該指令 |
| `/cloudflare:build-mcp` | 透過 McpAgent 建立 MCP Server | 使用該指令 |

---

## 子目錄入口

| 目錄 | 入口檔案 |
|------|---------|
| `frontend/` | `frontend/AGENTS.md` |
| `backend/` | `backend/AGENTS.md` |
| `specs/` | `specs/AGENTS.md` |

---

## Read-Only 區

`mu-plugins/` 完全不可編輯，只能參考商業邏輯（不可沿用程式碼或 UI）。
