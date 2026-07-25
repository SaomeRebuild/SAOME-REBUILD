---
description: SAOME 新架構 skill router。同時認得 WordPress 既有 skills 與新架構 skills。mu-plugins 內的 skills 僅用於追溯商業邏輯。
---

# SAOME Skill Router（新架構版）

## ⚠️ 重要前提

**mu-plugins 是 Read-Only 參考區**：
- ✅ 可用：商業邏輯追溯、技能對照（理解舊系統怎麼做）
- ❌ 不可用：沿用程式碼、UI 風格、CSS 命名、互動模式

詳見 `.cursor/rules/005-reference-mu-plugins.mdc`。

## 10 秒快速判斷

### 新架構（Cloudflare / Hono / React）
1. 提到 React 元件 / shadcn / token → `ui-ux-pro-max`（設計風格） + `ui-styling`（shadcn 實作）
2. 提到 Hono route / middleware / service → `hono-skill` + `code-review-skill/reference/saome-hono.md`（SAOME 專屬 pattern）
3. 提到 Postgres / RLS / migration → `supabase`（主要）+ `supabase-postgres-best-practices`（效能優化）+ `code-review-skill/reference/saome-db.md`（SAOME 專屬 pattern）
4. 提到 Workers / KV / R2 / D1 / Durable Object → `cloudflare`（主 skill） + `wrangler`（CLI 實作） + `workers-best-practices`（最佳化）
5. 提到 AI Agent / streaming chat / WebSocket → `agents-sdk`（主 skill） + `cloudflare/references/`（各產品詳解）
6. 提到 Wrangler deploy / config / secret → `wrangler`（完整 CLI 指令）
7. 提到 Passcreator API / webhook → `code-review-skill/reference/saome-integrations.md`
8. 提到 Mailgun route / template → `code-review-skill/reference/saome-integrations.md`
9. 提到 Line Pay / 付款 → `code-review-skill/reference/saome-integrations.md`
10. 提到 spec-kit 流程（`/speckit.*`）→ 見下方「Spec-kit 流程（MANDATORY）」段對照表

### Spec-kit 流程（MANDATORY — 規格/SC/Task 唯一入口）

> SAOME 於 2026-07-25 全面改用 [GitHub spec-kit](https://github.com/github/spec-kit)。SAOME 自製的 `_template/`、`007-sdd.mdc` / `008-bdd.mdc` / `009-tdd.mdc` **已刪除**。所有規格必須透過下列 10 個 slash command 產生。

| 階段 | slash command | 對應 skill / 模板 | 用途 |
|---|---|---|---|
| 原則 | `/speckit.constitution` | `.specify/memory/constitution.md` | 編輯專案最高原則 |
| 規格 | `/speckit.specify` | `.specify/templates/spec-template.md`（SAOME 慣例輸出 `specs/spec/<feature_id>/spec.md`） | 從需求產生 `spec.md` |
| 釐清 | `/speckit.clarify` | — | 對規格提問補完模糊點 |
| 計畫 | `/speckit.plan` | `.specify/templates/plan-template.md` | 從規格產生技術 `plan.md` |
| 任務 | `/speckit.tasks` | `.specify/templates/tasks-template.md` | 從計畫拆解 `tasks.md` |
| 檢查清單 | `/speckit.checklist` | `.specify/templates/checklist-template.md` | 產生驗收 checklist |
| 實作 | `/speckit.implement` | Superpowers `test-driven-development` + `refactoring` | 依任務執行（搭配 TDD） |
| 一致性 | `/speckit.analyze` | — | 對照 spec/plan/tasks 一致性 |
| 收斂 | `/speckit.converge` | — | 對 codebase 找剩餘工作 |
| Issue 化 | `/speckit.taskstoissues` | GitHub MCP | 把 tasks 轉 GitHub issue |

**配套 Superpowers skill**（Cursor 透過 `using-superpowers` 自動載入）：
- `brainstorming` — 開工前
- `writing-plans` — 寫 plan 階段
- `test-driven-development` — 每個 task
- `refactoring` — Green 之後
- `verification-before-completion` — 宣稱完成前
- `systematic-debugging` — 偵錯時

### WordPress 既有（mu-plugins 內，Read-Only 參考）

> ⚠️ 全部 mu-plugins 內的 skill **僅用於商業邏輯追溯**，不可指導新架構程式碼撰寫。

- 提到 WP hook / filter → `saome-wordpress-hooks`（**Read-Only 參考**，在 mu-plugins）
- 提到 AJAX / REST → `saome-api-ajax-js`（**Read-Only 參考**，在 mu-plugins）
- 提到 debug → `saome-debug-playbook`（**Read-Only 參考**，在 mu-plugins）

### 跨架構
- 提到從 mu-plugins 找對應邏輯 → `.cursor/workflows/migrate-from-wp.md`
- 提到新增功能完整流程 → `.cursor/workflows/new-feature.md`
- 提到部署 → `.cursor/workflows/deploy.md`

### CI/CD
- PR / branch CI 失敗，需要調查原因 → `fix-ci`（找失敗 job、檢日誌、apply 修復）
- 需要持續監控 CI 直到全綠（push 後等結果）→ `loop-on-ci`（用 `gh pr checks --watch`）
- PR 需要同時處理 conflicts、comments、CI 三件事 → `babysit`
- 需要在 CI 層級跑 smoke tests（Playwright）→ `run-smoke-tests`
- 需要確認程式碼編譯 / type-check 沒問題 → `check-compiler-errors`

### Agent 自我改進
- 用戶抱怨「又犯同樣錯誤」或主動提出改進需求 → `saome-self-improvement`
- 發現重複失敗模式（≥2 次相同錯誤）→ `saome-self-improvement`
- CI 失敗原因是「規則不明確」導致的架構問題 → `saome-self-improvement`
- 每次任務結束，主動反思是否有可改進的空間 → `saome-self-improvement`

**常見情境對照：**

| 情境 | 應該用 |
|---|---|
| CI 紅了，不知道為什麼 | 先看 log 確認原因，再決定用 `fix-ci` 或 `loop-on-ci` |
| workflow 檔案本身有問題（例如 migration 邏輯錯）| 直接修檔案 + `fix-ci` 確認修復是否有效 |
| push 後要等 CI 結果才能繼續 | `loop-on-ci` |
| PR 有 reviewer comment + CI 失敗 + conflicts | `babysit` |
| 想在 local 確認 build 會過再 push | `check-compiler-errors` |
| 用戶抱怨「又犯同樣的錯誤」 | `saome-self-improvement` |
| 發現同一失敗模式出現 2+ 次 | `saome-self-improvement` |

> 注意：`fix-ci` 和 `loop-on-ci` 都用 `gh` CLI 操作 GitHub Actions，確認 `gh` 已安裝且有 repo 讀寫權限。

### 收尾流程（PR 開啟前必跑）
- 程式碼審查 → `.cursor/rules/000-code-review.mdc`（11 類檢查）
- AI 痕跡清理 → `.cursor/rules/000-deslop.mdc` + `.cursor/skills/deslop`
- Log 紀律 → `.cursor/rules/000-log-discipline.mdc`（DEBUG 清、ERROR 留、PII mask）
- 自我審查 → `.cursor/skills/requesting-code-review`
- PR 整理 → `.cursor/skills/make-pr-easy-to-review`
- Bugbot 審查 → `.cursor/skills/review-bugbot`
- Security 審查 → `.cursor/skills/review-security`

## 決策流程
1. 先讀任務關鍵詞
2. 判斷新架構 / WordPress / 跨架構
3. 選主 Skill，列次 Skill
4. 讀 SKILL.md 再動工

## 自然語言意圖識別（MANDATORY — 動詞識別第一關）

> 任何使用者自然語言訊息含動詞語意（**新增 / 加上 / 排除 / 刪除 / 拿掉 / 實作 / 做 / 改 / 重構 / 遷移 / deprecate / 暫停**）→ **先**走 `saome-intent-router` 識別動詞 → AskQuestion 確認 → 委派給對應 speckit-* / saome-* / workflow-* skill。

| 步驟 | Skill |
|---|---|
| 動詞識別（add / remove / exclude / implement / amend / refactor / migrate / deprecate） | `saome-intent-router` |
| 領域路由（提到 React / Hono / Supabase / Workers） | `saome-skill-router`（本 skill） |
| 模式選擇（Ask / Plan / Agent） | `saome-skill-router` 模式選擇 SOP |

**分工**：
- `saome-intent-router` 管**動詞**（新增/刪除/實作/改）
- `saome-skill-router` 管**領域**（React/Hono/Supabase/Workers）
- 兩個都會被觸發：先 intent-router（識別要幹嘛）→ 再 skill-router（用什麼技術）

## 模式選擇（MANDATORY — 任何任務第一關）

|| 使用者訊息類型 | 建議模式 |
|---|---|---|
| 「規劃 / 設計 / 架構 / 評估 / 怎麼做」→ 還沒要寫 code | **Ask / Plan** |
| 「新功能 / 新 spec / 從零開始 / 跨模組重構」→ 牽涉 spec 變更 | **Ask → Plan → Agent** |
| 「修 / 改 / 補 / 跑 / 部署」→ 已有方向 | **Agent** |
| 「看 / 解釋 / 為什麼 / 哪裡」→ 純問答 | **Ask** |

> **強制規則**：新功能首發必須先 Ask 模式用 `AskQuestion` 收設計決策，再進入 Plan 模式寫草稿，最後才切回 Agent 模式寫 code。詳見 `.cursor/rules/001-methodology.mdc` 階段零點五。
>
> ❌ 禁止：直接從 Agent 模式開始寫新功能（會跳過 user 設計決策，事後重寫風險高）。
>
> ❌ 禁止：Ask 模式時主動寫檔（Ask 模式在 Cursor IDE 是 read-only）。

## PR 開啟前必跑清單（MANDATORY）

任何 PR 開啟前必須跑下列檢查（依序）：

1. **Code Review** → `.cursor/rules/000-code-review.mdc` 11 項檢查
2. **Deslop** → `.cursor/rules/000-deslop.mdc` AI 痕跡黑名單 + `.cursor/skills/deslop`
3. **Log Audit** → `.cursor/rules/000-log-discipline.mdc` 移除 debug log + PII 檢查
4. **Self Review** → `.cursor/skills/requesting-code-review`
5. **PR 整理** → `.cursor/skills/make-pr-easy-to-review`

## 絕對禁止
- ❌ 用 mu-plugins skill 來「指導新架構該怎麼寫程式碼」
- ❌ 把 mu-plugins 的 CSS / UI 風格遷移到新架構
- ❌ 把 mu-plugins 的 PHP 函式「翻譯」成 TypeScript
