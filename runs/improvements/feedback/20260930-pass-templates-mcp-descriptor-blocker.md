# Feedback：Pass-templates Migration Apply Blocker — saome_supabase MCP descriptor 不存在

**日期**：2026-09-30
**作者**：SAOME-REBUILD
**關聯**：runs/decisions/2026-09-29-pass-templates-public-endpoint.md
**Severity**：L3 Heavy blocker（plan § Step 2 / § Step 10 都受阻）

---

## 症狀

`saome_supabase` MCP server 已在 `.cursor/mcp.json` 註冊（HTTP transport，URL `https://mcp.supabase.com/mcp?project_ref=rlipsytwlyliwqifkqpb&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching`），server 狀態回報 `connected`，`GetMcpTools` 也列出 14 條工具（含 `apply_migration` / `execute_sql`）。

但是每一次 `CallMcpTool` 呼叫都回：

```
MCP descriptor not found for saome_supabase/apply_migration
MCP descriptor not found for saome_supabase/execute_sql
```

無論是 `apply_migration` / `execute_sql` / `list_tables` / `list_migrations` / `get_project_url` 都回同樣錯誤。`user-saome_supabase` prefix 也不通。

這個錯誤是 Cursor runtime 把 MCP descriptor mapping 注入 `CallMcpTool` 的步驟壞掉（Cloudflare-docs MCP 等其他 MCP server 也回同樣 descriptor not found）— 不是 project_ref 錯、不是 token 過期、不是網路問題。

## 受影響範圍

- `supabase/migrations/20260929000001_019_init_pass_holders.sql` 已建立（untracked, 內容已 review）
- Backend code 已寫好 + 27/27 backend module tests pass（mock-based，無 DB）
- Frontend passHolderService 已 swap 到 HTTP-backed + env flag
- 14/14 passHolderService frontend tests pass
- tsc / lint / build（除 check:migrations）都綠

`apps/backend/scripts/check-migrations-applied.cjs` 正確 fail：

```
FAIL: 1 migration file(s) have NO registry entry
  - 20260929000001_019_init_pass_holders.sql
```

這是預期內的失敗（檔案還沒 apply）。Rule 035 § 4 鐵律：

> 若 `apply_migration` timeout — **不要** commit SQL 檔 — 等 MCP reconnected 再 apply

所以 SQL 檔目前仍 untracked，registry 沒更新。

## 嘗試過的解法

| # | 動作 | 結果 |
|---|---|---|
| 1 | `CallMcpTool server=saome_supabase tool=execute_sql` | descriptor not found |
| 2 | `CallMcpTool server=user-saome_supabase tool=execute_sql` | descriptor not found |
| 3 | `CallMcpTool server=saome_supabase tool=apply_migration` | descriptor not found |
| 4 | `CallMcpTool server=cloudflare-docs tool=search_docs` (control) | descriptor not found（驗證：所有 MCP 都壞，不是只有 supabase）|
| 5 | 確認 `.cursor/mcp.json` config | config 正確，server 連線正常 |
| 6 | `wrangler dev --remote` | 需要 Hyperdrive binding；不適用於純 migration apply |

## 該怎麼處理

**短期（現在）**：保留 migration SQL 檔為 untracked，等 MCP 修好。**不要**手動 append registry 條目（會變成跟 DB 對不上）。

**MCP 修好後**：
1. 重跑 `apply_migration` (SQL 內容已存在 `supabase/migrations/20260929000001_019_init_pass_holders.sql`)
2. 成功後立刻 append registry entry：
   ```json
   { "filename": "20260929000001_019_init_pass_holders.sql", "applied_at": "2026-09-30", "applied_by": "pass-templates-v2", "via": "saome_supabase-mcp", "notes": "Pass Holder end-user table (separate from members). Idempotent UNIQUE on (template_id, email). Created per Decision Log 2026-09-29-pass-templates-public-endpoint.md § Decision 1+3." }
   ```
3. Commit SQL 檔 + registry update 同一個 commit
4. 跑 `npm run check:migrations --workspace=apps/backend` 確認通過
5. 跑 `cd apps/backend && npm run deploy`
6. 跑 CORS post-deploy curl 矩陣
7. 跑 `cd apps/frontend && npm run pages:deploy`
8. 跑 bundle URL audit
9. 瀏覽器開 production URL `/pass/716c4244-6c63-496d-a967-6c87cdac605d` 驗證

## 為什麼這條 feedback 要單獨寫

這是 Rule 035 鐵律的延伸情境：MCP **完全無法呼叫**（descriptor not found），不是 timeout。timeout 的 fallback 是「等 reconnect」；descriptor 不存在的 fallback 也是「等修好」，但應該記錄下「所有 MCP server 都壞了」（驗證：cloudflare-docs 也 descriptor not found），這是 Cursor runtime 層的 bug，不是 supabase / cloudflare 端問題。

事故類似：2026-09-05 LoginPage mount warmup + httpClient retry 的 cold-start dead zone — 雖然症狀不同，但同樣是「外部依賴壞掉，本地驗證無法 reproduce」。要等系統層修復，不能 commit workaround。

## 影響項目

- `supabase/migrations/20260929000001_019_init_pass_holders.sql` (untracked, pending apply)
- `supabase/migrations/.applied-migrations.json` (pending registry entry)
- Plan § Step 10 deploy 受阻

---

## Retry attempt #2（2026-09-30 07:46 UTC+8，使用者要求再試一次）

**觸發**：使用者訊息「你可以再嘗試一次MCP了」

**測試**：

| # | Server / Tool | 結果 |
|---|---|---|
| 1 | `saome_supabase::execute_sql` (簡單 SELECT) | MCP descriptor not found |
| 2 | `user-cloudflare-bindings::workers_list` (control test #1) | MCP descriptor not found |
| 3 | `user-saome_github::get_me` (control test #2) | MCP descriptor not found |

**結論**：MCP descriptor bug 仍存在於整個 session。三個**完全不同的** MCP server 都回同樣錯誤，確認是 Cursor runtime 層級的問題（descriptor mapping 注入 `CallMcpTool` 步驟壞掉），不是特定 server / network / token 問題。

**現狀**：
- SQL 檔保持 untracked（Rule 035 § 4 鐵律：不要 commit workaround）
- Registry 保持未更新（避免跟 DB 對不上）
- Plan § Step 2 / Step 10 仍 paused

**使用者建議的下一步**：重新啟動 Cursor session 是目前唯一已知的 resolution path（session-level MCP descriptor 是 cursor client process state）。如果重新啟動後仍壞 → 需要 escalate 給 Cursor support（這可能是普遍的 client bug）。

---

---

## Retry attempt #3（2026-09-30 08:22 UTC+8，使用者要求跑完 pending）

**觸發**：使用者訊息「@plan 我需要跑完這個計畫的 pedding」

**測試**：

| # | Server / Tool | 結果 |
|---|---|---|
| 1 | `saome_supabase::execute_sql` (`SELECT 1 AS ok`) | MCP descriptor not found |
| 2 | `user-saome_supabase::execute_sql` (`SELECT 1 AS ok`) | MCP descriptor not found |
| 3 | `saome_supabase::list_tables` | MCP descriptor not found |
| 4 | `user-cloudflare-bindings::workers_list` (control test) | MCP descriptor not found |
| 5 | `user-saome_github::get_me` (control test) | MCP descriptor not found |

**結論**：第三個 session 仍遭遇相同 Cursor runtime 層級的 MCP descriptor mapping bug。與前兩次一致：三個完全不同的 MCP server 同時失敗，證實是 Cursor client process 層級的問題。

**Plan pending items 狀態**：

| Pending ID | Description | 是否可繞過 MCP 完成 | 實際狀態 |
|---|---|---|---|
| `migration` | apply `20260929000001_019_init_pass_holders.sql` via `apply_migration` | ❌ Rule 035 § 4 禁止 workaround | blocked on MCP |
| `migration-registry` | append entry to `.applied-migrations.json` | ❌ 必須 migration 成功後才能 append | blocked on MCP |
| `deploy` | wrangler deploy + CORS post-deploy check | ❌ backend code 依賴 DB table；table 不存在 → production 500 | blocked on MCP |

**Resolution path（已與使用者同步過）**：

1. 重新啟動 Cursor session（client process 重啟 → MCP descriptor 重新注入）
2. 重新啟動後驗證：`CallMcpTool server=saome_supabase tool=list_tables` 應回傳 table 清單
3. 驗證後依 feedback 開頭「MCP 修好後」的 9 步 SOP 執行
4. 若重新啟動後 MCP 仍壞 → escalate 給 Cursor support（普遍 client bug）

## Retry attempt #4（2026-09-30 08:30 UTC+8，使用者提示「你應該是沒有正確使用這個檔案吧」@ mcp.json）

**觸發**：使用者指 `c:\Users\user\.cursor\mcp.json`,暗示我一直用錯方式呼叫 MCP。

**根因發現**:

| 之前以為 | 實際情況 |
|---|---|
| `CallMcpTool server=... tool=...` 應該 work | **錯了!** 當 MCP 已在 `<mcp_meta_tools>` pre-listed,應直接呼叫獨立工具(如 `user-saome_supabase-execute_sql`) |
| `CallMcpTool` 是 universal wrapper | **只** 適用於 runtime 動態 discover 但未 pre-listed 的 MCP server |
| GetMcpTools 跟 CallMcpTool 共用同一個 descriptor pool | **不對!** GetMcpTools 透過 MCP descriptor scan 拿完整 list;CallMcpTool 從 `<mcp_meta_tools>` pre-baked list 找;兩條路徑獨立 |

**這次測試**:

| # | 動作 | 結果 |
|---|---|---|
| 1 | `user-saome_supabase-execute_sql({query: "SELECT 1 AS ping"})` 直接呼叫 | ✅ `[{"ping":1}]` |
| 2 | `user-saome_supabase-apply_migration({...})` 直接呼叫 19 號 migration | ✅ `{"success":true}` |
| 3 | `user-saome_supabase-list_tables({schemas:["public"], verbose:true})` 驗證 table | ✅ `public.pass_holders` 已建立,欄位 + FK 都對 |
| 4 | append registry entry + 跑 `npm run check:migrations` | ✅ 17 migrations registered |

**結論**: 之前 3 次 retry 的「MCP descriptor not found」是因為我用 `CallMcpTool` 包 pre-listed 工具 — CallMcpTool 不知道 mcp_meta_tools 已有的 descriptor。**根本不是 Cursor runtime bug,是 agent 用錯工具**。

**已修復**:

- `public.pass_holders` table 已建好,符合 Decision Log 規範
- `.applied-migrations.json` 已 append 019 entry
- CI gate `check:migrations` 通過 (17 migrations)

**下一步**: deploy backend + frontend。

---

## Self-improvement action items

| Action | Owner | Trigger | Status |
|---|---|---|---|
| **在 Rule 035 / AGENTS.md 加條 SOP「**MCP 工具已 pre-listed 時,優先用獨立工具名呼叫,不要包 CallMcpTool**」** | Self | 立即 | 待 commit |
| 報告 Cursor MCP descriptor bug(如果這是普遍問題)| Cursor support / Team | 不適用 — 這次不是 bug | resolved |
| 在 rule 035 加條 §「MCP 完全 descriptor not found(不是 timeout)」的處理 SOP | Self | 變更為「區分 pre-listed 工具 vs runtime discover」SOP | pending |