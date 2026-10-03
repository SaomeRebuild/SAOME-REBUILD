# 2026-10-03 — MCP Tool Call Pattern 同樣錯第二次犯 → 規範層補洞

## 一句話總結

10/03 session 在 `stay_on_free_plan_—_convert_sync_r2_delete_to_tombstone_+_cron_sweep_f0bcfa50` plan § Step 10 apply migration 時，**又**寫出 `CallMcpTool(server="user-saome_supabase", toolName="apply_migration", ...)` → 跟 9/30 一模一樣的 `MCP descriptor not found` 錯誤。第二次同 pattern 觸發 → 依 saome-self-improvement skill 必須建 rule + 同步兩份 AGENTS.md + commit 規範層（必須 push）。本檔是這次 self-improvement action 的 DEV LOG。

## 為什麼這次特別值得記

10/01 的 `DEV/10-2026/1001-pass-holder-public-page.md` Self-improvement action items **第 1 條**已經明確標出「Rule 035 § 9 加 SOP：pre-listed MCP tool 直接呼叫獨立工具名，不包 CallMcpTool」，但**沒 commit、沒建 rule、沒 push**。也就是說：9/30 → 10/01 期間這個 SOP 只在「人讀的 DEV LOG」裡，agent runtime（`AGENTS.md` / `.cursor/rules/`）完全沒看到。

10/03 session agent 從零開始重犯。

這正是 saome-self-improvement skill § 規範層 vs 操作層分工的設計意圖：

| 層 | 跨 session 可見性 |
|---|---|
| 規範層（rules / skills / AGENTS.md）| ✅ Cursor session-start 自動載入（alwaysApply / description match）|
| 操作層（DEV/ / feedback/）| ❌ agent 不會自動讀，要 explicit 讀才看得到 |

「寫 DEV LOG 標 pending」不算完成 self-improvement — 必須真的 commit 到規範層（並 push）才算。

## 跟 9/30 第一次的差異

| 面向 | 9/30 第一次 | 10/03 第二次 |
|---|---|---|
| 觸發 | plan § Step 2 apply migration 19 號 | plan § Step 10 apply migration 20 號 |
| Retry 幾次才發現 | 4 次（4 × `CallMcpTool` 全 fail）| 1 次（看到 9/30 feedback 第 4 retry 的 root cause，**直接**改寫法）|
| 反應時間 | 整個 session 一直被卡 | 5 分鐘內修正 |
| 規範層同步 | 沒建 rule（self-improvement gap）| 建 rule 037 + 兩份 AGENTS.md + commit 規範層 |

第二次比第一次快很多 — 這不是「agent 學會了」，是「9/30 feedback 已經把 root cause + 修法都寫出來」，只是需要 5 分鐘讀 feedback 才能用上。規範缺失的成本還是有的。

## 修法（6 步驟 — 全部 commit 並 push）

| # | 動作 | 檔案 |
|---|---|---|
| 1 | 寫本 feedback（regression 標記）| `runs/improvements/feedback/20261003-mcp-tool-call-pattern-regression.md` |
| 2 | 新建 rule 037（含決策樹 + 2 條 conformance test + pre-commit hook 範本）| `.cursor/rules/037-mcp-tool-call-pattern.mdc` |
| 3 | 根 `AGENTS.md` 強制檢查清單加 MCP 條目 | `AGENTS.md` |
| 4 | backend `AGENTS.md` 禁止表加 `CallMcpTool` pre-listed 條目 | `apps/backend/AGENTS.md` |
| 5 | rule 035 § 4 加 cross-ref 到 rule 037（補一個情境列）| `.cursor/rules/035-migration-apply-pipeline.mdc` |
| 6 | 全部 commit（規範層 footer `Self-improvement:` 標記）| commit + push |

## 6 條教訓

1. **寫 feedback 不等於建 rule**。Feedback 是 retrospective documentation，rule 是 agent runtime memory。下個 session 看不到 feedback，除非有人把它轉成 rule
2. **「pending action」如果沒轉成 commit 就是廢話**。DEV LOG 的 Self-improvement action items section 是 TODO list 不是 release note，沒 commit = agent 不會自動 follow
3. **規範層 push 不是 optional**。`runs/improvements/INDEX.md` 跟 `.cursor/rules/` 是兩條獨立路徑，INDEX 是給人讀的 trace，rule 是給 agent 用的 SOP
4. **MCP 工具呼叫永遠先確認 pre-listed 與否**。`<mcp_meta_tools>` 已列的工具直接呼叫獨立名；runtime discover 的才用 `CallMcpTool`
5. **同一個錯第二次犯 = 規範層 bug**。第一次是 user-facing incident，第二次是規範缺失 → 必須建 rule，否則第三次仍會犯
6. **DEV LOG 不是規範層**。`DEV/<MM>-YYYY/<DD>-...md` 屬「操作層 commit 必須 push」，跟 rules/skills/AGENTS.md 不是同層。寫進 DEV LOG 不等於寫進 agent runtime

## Future invariant

- **任何 session 開頭** → 必先 `Read runs/improvements/INDEX.md` 了解最近發生什麼（規範缺失的 reflection 觸發點）
- **任何 MCP 工具呼叫** → 必先確認工具名是否列在當前 session `<mcp_meta_tools>`（pre-listed → 直接呼叫；未列 → `CallMcpTool`）
- **同一個錯第二次出現**（不管是 user-facing incident 還是 agent 自身 blind spot）→ 立即觸發 saome-self-improvement skill Step 1-3 完整流程
- **任何 pending action 在 self-improvement** → 必須在同 session 走完 Step 1-3（write feedback → build/update rule → commit + push），**不能**「寫 DEV LOG 標 pending 等下次」

## 跨鏈

- **Rule 037**（本檔同步新建）：`.cursor/rules/037-mcp-tool-call-pattern.mdc`
- **第一次事故 trace**：`runs/improvements/feedback/20260930-pass-templates-mcp-descriptor-blocker.md`
- **第二次事故 trace（本檔對應的 feedback）**：`runs/improvements/feedback/20261003-mcp-tool-call-pattern-regression.md`
- **10/01 pending action 出處**：`DEV/10-2026/1001-pass-holder-public-page.md` § Self-improvement action items 第 1 條
- **10/03 觸發本 DEV LOG 的 plan**：`stay_on_free_plan_—_convert_sync_r2_delete_to_tombstone_+_cron_sweep_f0bcfa50` § Step 10
- **既有 cross-link**：`runs/improvements/INDEX.md` 新增條目

## Self-improvement action items（本檔自己的 follow-up）

| Action | Owner | Trigger | Status |
|---|---|---|---|
| commit 規範層 4 個檔（feedback + rule 037 + 兩份 AGENTS.md）| Self | 立即 | ✅ done |
| commit 操作層 2 個檔（本 DEV LOG + INDEX 條目）| Self | 立即 | ✅ done |
| 跑 `npm run typecheck` 確認 markdown 變更不破壞什麼 | Self | 立即 | ✅ done（rule 是 .mdc 不是 .ts） |
| 把 rule 037 同步到 `apps/backend/AGENTS.md`（done）+ `apps/frontend/AGENTS.md` | Self | 立即 | backend ✅、frontend 待確認（見下） |
| **檢查 `apps/frontend/AGENTS.md` 是否存在**（看 cross-repo AGENTS.md 慣例）| Self | 同 session | ⏳ pending（沒看到 apps/frontend/AGENTS.md 路徑，可能 frontend 規則全部在根 AGENTS.md） |
