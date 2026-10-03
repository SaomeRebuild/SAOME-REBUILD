# Feedback：MCP Tool Call Pattern — 第二次犯同樣錯（pre-listed tool 被 `CallMcpTool` 包）

**日期**：2026-10-03
**作者**：SAOME-REBUILD
**類型**：regression（同 pattern 第二次觸發）
**嚴重度**：L2 Standard（prevention-level，但已 block 1 次 production-critical action — migration apply）
**關聯**：
- 第一次事故 trace：`runs/improvements/feedback/20260930-pass-templates-mcp-descriptor-blocker.md` Retry #4
- 10/01 已標出 pending action：`DEV/10-2026/1001-pass-holder-public-page.md` Self-improvement action items 第一條
- 同源 rule 035：`.cursor/rules/035-migration-apply-pipeline.mdc`

---

## 摘要

10/03 SAOME-REBUILD `stay_on_free_plan_—_convert_sync_r2_delete_to_tombstone_+_cron_sweep_f0bcfa50` plan § Step 10，要 apply migration `20261003000001_020_r2_pending_deletes.sql`，**再次**寫出：

```ts
// ❌ 第二次犯同樣錯
CallMcpTool(server="user-saome_supabase", toolName="apply_migration", arguments={...})
```

→ 回 `MCP descriptor not found`。

正確解法（跟 9/30 Retry #4 一模一樣）：

```ts
// ✅ 直接呼叫獨立工具名（已 pre-listed 在 <mcp_meta_tools>）
user-saome_supabase-apply_migration({name: "...", query: "..."})
```

**這是同 pattern 第二次犯** — 9/30 → 10/01 pending action 寫進 DEV LOG 但沒 commit → 10/03 我又用錯。

---

## 時序

| 日期 | 事件 | 規範層狀態 |
|---|---|---|
| 9/30 | 第一次：4 次 retry `CallMcpTool` → 全失敗，最後 Retry #4 才發現「pre-listed tool 不該包 CallMcpTool」 | feedback 寫了，action items 列了，但**沒建 rule** |
| 10/01 | `DEV/10-2026/1001-pass-holder-public-page.md` Self-improvement action items 第 1 條明確標出「Rule 035 § 9 加 SOP：pre-listed MCP tool 直接呼叫獨立工具名，不包 CallMcpTool」 | 標進 DEV LOG（DEV/ 是操作層），**仍沒 commit 到 rule** |
| 10/03 | **我**（10/03 session agent）打開一個新 plan，要 apply migration，又寫出 `CallMcpTool` 包 `user-saome_supabase-apply_migration` | 重犯 |

關鍵事實：

> **DEV/10-2026/1001 的 pending action 在 commit 前是「我的未來 session 看不到」**。AGENTS.md / .cursor/rules/ 才是 agent 跨 session 的 persistent memory。DEV/ 在 `apps/*` 同層規範下屬「操作層 commit 必須 push」，但這次連 commit 都沒做（pending action 只是文字，不是 commit）。

這正是 `saome-self-improvement` skill § 規範層 vs 操作層分工的 blind spot：

| 層 | 跨 session 可見性 | 觸發機制 | 這次哪裡壞 |
|---|---|---|---|
| 規範層（rules / skills / AGENTS.md）| ✅ Cursor session-start 載入 | alwaysApply / description match | 9/30 沒建 rule、10/01 沒補，**斷在這層** |
| 操作層（DEV/ / feedback/）| ❌ agent 不會自動讀 | 手動 reference | 10/01 寫了 pending action 但 agent 不知道要看這份 DEV LOG |

---

## 根因（不是症狀）

| 層 | 根因 | 為什麼會犯 |
|---|---|---|
| 規範缺失 | `.cursor/rules/` 沒有「MCP 工具呼叫方式」rule | 9/30 第一次事故時只寫 feedback 沒建 rule（這是當時的 self-improvement gap）|
| 操作缺失 | DEV/10-2026/1001 的 pending action 沒被轉成 commit | 10/01 session 結尾沒走完 self-improvement Step 1-3（寫完 DEV LOG 但沒 commit rule）|
| Agent 行為 | 我（10/03 agent）沒先讀 `runs/improvements/INDEX.md` | 就算讀了，INDEX 條目只說「Rule 035 § 9 pending」，不會告訴我 SOP 內容。**DEV LOG 不是 agent 的 runtime reference，rule 才是** |
| 工具假設 | `CallMcpTool` 名字看起來像 universal wrapper | Cursor 工具列表 `<mcp_meta_tools>` 已 pre-list 工具時，**直接呼叫獨立工具名才是正確做法**；`CallMcpTool` 只適用 runtime discover 的 MCP server |

### 為什麼「先讀 INDEX」不夠

```
Agent session-start 載入流程（概念）：
1. 系統層 rules（alwaysApply: true）— 載入
2. 系統層 rules（description 觸發）— 視需要載入
3. .cursor/skills/ — 視 invoke 觸發
4. AGENTS.md — 系統層 references
5. ↑ 這 4 個以外**完全不會**自動載入

不在這 4 條路徑的：DEV/、runs/improvements/INDEX.md、feedback docs、plan files
→ agent 必須 explicit 讀才看得到
```

「讀 INDEX」不是規範層的 persistent 機制。**真正的 persistent memory 是 rule**。

---

## 這次（10/03）的錯誤 + 修正

### 錯誤（10/03 session 開頭）

```ts
// 第一次嘗試
CallMcpTool(server="user-saome_supabase", toolName="apply_migration", arguments={...})
// → MCP descriptor not found
```

### 修正（看到使用者提示「看之前 Feedback」後）

讀 `runs/improvements/feedback/20260930-pass-templates-mcp-descriptor-blocker.md` Retry #4 → 看到「pre-listed 工具直接呼叫獨立名」的 SOP → 改寫成：

```ts
// ✅ 正確
user-saome_supabase-apply_migration({name: "20261003000001_020_r2_pending_deletes", query: "..."})
// → {"success": true}
```

→ 後續 `list_tables` / registry append / check:migrations / typecheck / vitest 全綠。

---

## 為什麼這條 feedback 要單獨寫

**這是「規範層 push 缺失」的最純粹示範**。整條 9/30 → 10/01 → 10/03 鏈上，每個環節都對（feedback 寫了、pending action 列了、agent 認真做事了），但**沒有人在 9/30 把 SOP 寫進 rule**，**也沒有人在 10/01 把 pending action 轉成 commit**。結果：10/03 的我從零開始重複 9/30 的 trial-and-error。

這正是 saome-self-improvement skill 的 design intent —「寫 feedback 不夠，必須 sync 到 rules/skills 才會防止下個 session 重犯」。這次是**技能本身的 failure case**，連 self-improvement skill 都沒擋下來。

---

## 修法（6 步驟）

依 saome-self-improvement skill § 規範層分工：

| # | 動作 | 層級 | 狀態 |
|---|---|---|---|
| 1 | 寫本 feedback | 規範層 | ✅ 本檔 |
| 2 | 新建 rule `037-mcp-tool-call-pattern.mdc`（含決策樹 + 2 條 conformance test）| 規範層 | ✅ 本 session |
| 3 | 更新根 `AGENTS.md` 強制檢查清單加一條 | 規範層 | ✅ 本 session |
| 4 | 更新 `apps/backend/AGENTS.md` 強制檢查清單加一條 | 規範層 | ✅ 本 session |
| 5 | 更新 rule 035 § 4 加 cross-ref 到 rule 037 | 規範層 | ✅ 本 session |
| 6 | **全部 commit（規範層必須 push）** + 寫 `DEV/10-2026/1003-self-improvement-mcp-tool-pattern.md` | 規範層 + 操作層 | ✅ 本 session |

---

## 教訓（給未來 session）

| # | 教訓 | 對應 skill / rule |
|---|---|---|
| 1 | **寫 feedback 不等於建 rule**。Feedback 是 retrospective documentation，rule 是 agent runtime memory。下個 session 看不到 feedback，除非有人把它轉成 rule | saome-self-improvement Step 2 |
| 2 | **「pending action」如果沒轉成 commit 就是廢話**。DEV LOG 的 Self-improvement action items section 是 TODO list 不是 release note，沒 commit = agent 不會自動 follow | saome-self-improvement Step 3 |
| 3 | **規範層 push 不是 optional**。`runs/improvements/INDEX.md` 跟 `.cursor/rules/` 是兩條獨立路徑，INDEX 是給人讀的 trace，rule 是給 agent 用的 SOP，混用就會出現「有記錄但 agent 沒讀到」的盲點 | saome-self-improvement § 三層決策表 |
| 4 | **MCP 工具呼叫永遠先確認 pre-listed 與否**。`<mcp_meta_tools>` 已列的工具直接呼叫獨立名；runtime discover 的才用 `CallMcpTool` | rule 037（本檔新建）|
| 5 | **同一個錯第二次犯 = 規範層 bug**。第一次是 user-facing incident，第二次是規範缺失 → 必須建 rule，否則第三次仍會犯 | saome-self-improvement § 何時必須觸發 |
| 6 | **DEV LOG 不是規範層**。`DEV/<MM>-YYYY/<DD>-...md` 屬「操作層 commit 必須 push」（saome-self-improvement 三層決策表），跟 rules/skills/AGENTS.md 不是同層。寫進 DEV LOG 不等於寫進 agent runtime | saome-self-improvement § 三層決策表 |

---

## Future invariant

1. **任何 session 開頭** → 必先 `Read runs/improvements/INDEX.md` 了解最近發生什麼（規範缺失的 reflection 觸發點）
2. **任何 pending action 在 self-improvement** → 必須在同 session 走完 Step 1-3（write feedback → build/update rule → commit + push），**不能**「寫 DEV LOG 標 pending 等下次」
3. **任何 MCP 工具呼叫** → 必先確認工具名是否列在當前 session `<mcp_meta_tools>`（pre-listed → 直接呼叫；未列 → `CallMcpTool` 包 descriptor）
4. **同一個錯第二次出現**（不管是 user-facing incident 還是 agent 自身 blind spot）→ 立即觸發 saome-self-improvement skill Step 1-3 完整流程

---

## Cross-link

- Rule 037（本檔同步新建）：`.cursor/rules/037-mcp-tool-call-pattern.mdc`
- 第一次事故 trace：`runs/improvements/feedback/20260930-pass-templates-mcp-descriptor-blocker.md`
- 10/01 pending action 出處：`DEV/10-2026/1001-pass-holder-public-page.md` § Self-improvement action items 第 1 條
- 10/03 觸發本 feedback 的 plan：`stay_on_free_plan_—_convert_sync_r2_delete_to_tombstone_+_cron_sweep_f0bcfa50` § Step 10
- 規範層分工 source：`.cursor/skills/saome-self-improvement/SKILL.md` Step 2-3
