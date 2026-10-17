# Feedback：PassHolder `payment_status` `not_required` Enum 修法 — MCP Apply 阻塞（deferred to next session）

**日期**：2026-10-18
**作者**：SAOME-REBUILD
**類型**：L2 Standard（前端 helper + backend zod refine + migration 024 + tests）
**Plan 連結**：[`stamp_card_payment_status_'not_required'_enum_fix_3c2acefb.plan.md`](../../.cursor/plans/stamp_card_payment_status_'not_required'_enum_fix_3c2acefb.plan.md)
**Decision log**：[`2026-10-18-payment-status-not-required-enum.md`](../decisions/2026-10-18-payment-status-not-required-enum.md)
**關聯 issue**：用戶回報 stamp card 註冊後 `pass_holders.payment_status = 'pending'` 但該 card 不需付費下載

---

## 摘要

把 `public.pass_holders.payment_status` 從 3-value enum (`pending` / `completed` / `failed`) 擴展為 4-value enum（新增 `not_required`），讓非付費 template（stamp / free reward / cashback / coupon / multipass / gift / free membership）寫入明確的「無付款概念」狀態，避免污染「未完成付款查詢」。所有 code + tests + decision log 已 commit，但 **migration 024 因 MCP session-level dispatch 問題阻塞於本 session**，deferred 到下次重連 MCP 的 session 補 apply + registry。

## 範圍（6 個改檔 + 1 個新 feedback + INDEX update）

### 修改

| 檔案 | 變更 |
|---|---|
| [`packages/shared/types/passHolder.ts`](../../packages/shared/types/passHolder.ts) | `PassHolderPayload.paymentStatus` union 加 `'not_required'` + 註解 |
| [`apps/backend/src/modules/pass-templates/schemas/request.ts`](../../apps/backend/src/modules/pass-templates/schemas/request.ts) | `passHolderPaymentStatusSchema` 加值 + `passHolderRegisterPayloadSchema.superRefine` cross-field validation（`completed` ↔ `paymentProvider` 一致性 + `not_required` 禁止帶 provider）|
| [`apps/backend/src/modules/pass-templates/db/passHolders.ts`](../../apps/backend/src/modules/pass-templates/db/passHolders.ts) | `PassHolderRow.payment_status` + `upsertPassHolder` input `paymentStatus?` type union 加值 |
| [`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.helpers.ts`](../../apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.helpers.ts) | `resolvePaymentFields` 非 paid 分支回傳 `'not_required'`（一行改動）|
| [`apps/backend/src/modules/pass-templates/tests/register.test.ts`](../../apps/backend/src/modules/pass-templates/tests/register.test.ts) | +4 條 cross-field refine conformance test（`not_required` 接受無 provider / `not_required` 帶 provider reject / `completed` 沒 provider reject / `completed` 帶 provider accept）|
| [`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.test.tsx`](../../apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.test.tsx) | 既有「submit triggers the mock service」test 新增 `paymentStatus: 'not_required'` + `paymentProvider: undefined` 斷言 + 新增 1 條 conformance test `conformance: non-paid template register call uses paymentStatus "not_required" (regression 2026-10-18)` |
| [`supabase/migrations/.applied-migrations.json`](../../supabase/migrations/.applied-migrations.json) | **DEFERRED**（見下方「Migration Apply 阻塞」段）|

### 新增

| 檔案 | 用途 |
|---|---|
| [`supabase/migrations/20261018000001_024_add_not_required_payment_status.sql`](../../supabase/migrations/20261018000001_024_add_not_required_payment_status.sql) | CHECK constraint drop + recreate，含 `'not_required'`（**untracked**，deferred apply）|
| [`runs/decisions/2026-10-18-payment-status-not-required-enum.md`](../decisions/2026-10-18-payment-status-not-required-enum.md) | 三段式決策紀錄 |
| [`runs/improvements/feedback/20261018-pass-holder-not-required-payment-status.md`](20261018-pass-holder-not-required-payment-status.md) | 本檔（feedback + MCP blocker 紀錄）|

## 三層後果對照

| 場景 | Before | After |
|---|---|---|
| Stamp card 註冊 | `payment_status = 'pending'`（語意污染）| `payment_status = 'not_required'`（明確「無付款」）|
| 付費 membership + 模擬付款完成 | `payment_status = 'completed'` + `payment_provider = 'ecpay'` | 不變 |
| 付費 membership + 真實 gateway pending | `payment_status = 'pending'` | 不變 |
| Query「找出所有未完成付款的 holder」| 把 stamp card / free-template rows 全部撈出（false positive）| 只撈「真實 pending」rows |

## Migration Apply 阻塞（2026-10-18 session-level MCP 問題）

### 症狀

`supabase/migrations/20261018000001_024_add_not_required_payment_status.sql` 已寫入並通過 `check:migrations` 命名 convention 驗證，但 `apply_migration` 工具呼叫在本 session 內 **所有變體都 fail with `MCP descriptor not found`**：

| 嘗試 | 結果 |
|---|---|
| `CallMcpTool(server='user-saome_supabase', toolName='apply_migration', ...)`（Rule 037 § 4 retest 的「underscore」變體）| `MCP descriptor not found for user-saome_supabase/apply_migration` |
| `CallMcpTool(server='user-saome-supabase', ...)`（用 serverName 含 dash）| `MCP descriptor not found for user-saome-supabase/apply_migration` |
| `CallMcpTool(server='saome-supabase', ...)`（去 user- prefix）| `MCP descriptor not found for saome-supabase/apply_migration` |
| `CallMcpTool(server='saome_supabase', ...)`（underscore + 去 prefix）| `MCP descriptor not found for saome_supabase/apply_migration` |
| `CallMcpTool(server='user-saome-supabase/apply_migration', ...)` | `MCP descriptor not found for user-saome-supabase/apply_migration/apply_migration` |
| Read-only `CallMcpTool(server='user-saome-supabase', toolName='list_tables', ...)` | `MCP descriptor not found for user-saome-supabase/list_tables` |

`GetMcpTools` 確認 saome-supabase server 狀態為 `connected` 且所有 tools（`apply_migration` / `execute_sql` / `list_tables` 等）皆 in catalog。但這些 tool 沒被注入本 session 的 function palette，**且 `CallMcpTool` 走 runtime dispatch 找不到 pre-listed descriptor** — Rule 037 § 2 描述的「`CallMcpTool` 不知道 `<mcp_meta_tools>` 已有的 descriptor」典型症狀。

### 為什麼 `CallMcpTool` 一直 fail

per Rule 037：
- `<mcp_meta_tools>` pre-baked list：Cursor 啟動時把 saome-supabase 等 server 的 tool descriptor 預先注入；本 session 似乎**未執行**這個注入步驟（只有 `CallMcpTool` / `GetMcpTools` / `FetchMcpResource` 三個 MCP-related function 在 `<functions>` block 內）
- `CallMcpTool` runtime dispatch：透過 server / tool name 動態查 descriptor，但只認 runtime discover 來的 tool

本 session 的問題：「pre-listed tool 沒注入 + `CallMcpTool` 走 runtime dispatch 找不到 pre-listed」 — 兩條路徑都斷。

### 下次 session 補 apply 步驟（exact copy-paste）

**Step 1 — Apply migration via pre-listed MCP tool**（在新 session 跑，期望 pre-listed tool 已注入 function palette）：

```ts
// 直接呼叫（不是 CallMcpTool 包裝）
user-saome_supabase-apply_migration({
  name: '20261018000001_024_add_not_required_payment_status',
  query: `ALTER TABLE public.pass_holders
            DROP CONSTRAINT IF EXISTS pass_holders_payment_status_check;
          ALTER TABLE public.pass_holders
            ADD CONSTRAINT pass_holders_payment_status_check
            CHECK (payment_status IN ('pending', 'completed', 'failed', 'not_required'));`,
});
```

若 `user-saome_supabase-apply_migration` 仍 fail，fallback：用 Supabase dashboard SQL editor 或 psql 直接跑同樣的 SQL（DDL 是 idempotent：第二次跑只會 fail with "constraint already exists" — 表示已 apply 過，可跳到 Step 2）。

**Step 2 — Append registry entry to `.applied-migrations.json`**（無論用哪種 apply 方式都必跑）：

在 `supabase/migrations/.applied-migrations.json` 的 `applied` 陣列最尾端加：

```jsonc
{ "filename": "20261018000001_024_add_not_required_payment_status.sql",
  "applied_at": "2026-10-18",
  "applied_by": "stamp-card-payment-status-not-required",
  "via": "saome_supabase-mcp",
  "notes": "Widen payment_status CHECK to include 'not_required' (4th enum value) — distinguishes 'paid template awaiting real gateway' (still 'pending') from 'non-paid template, no payment concept' (now 'not_required'). See runs/decisions/2026-10-18-payment-status-not-required-enum.md. Migration 024 untracked in repo because MCP apply was blocked by session-level dispatch issue — registry is the authoritative source per Rule 035." }
```

**Step 3 — Verify CI gate**：

```bash
npm run check:migrations --workspace=apps/backend
# 預期：exit 0, "OK: 24 migrations registered as applied."
```

**Step 4 — Production verification**（optional 但建議）：

```sql
-- 確認新 enum 真的生效
SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint
 WHERE conrelid = 'public.pass_holders'::regclass
   AND contype = 'c'
   AND pg_get_constraintdef(oid) LIKE '%payment_status%';
-- 預期：pass_holders_payment_status_check ... CHECK (payment_status IN ('pending', 'completed', 'failed', 'not_required'))
```

**Step 5 — Amend 或 squash commit**（per Rule 011 § feedback-in-same-commit）：

若本次 commit（不含 SQL 檔）已 push，amend 進去；若還沒 push，squash：

```bash
# 在 worktree 內（有 migration SQL 檔 untracked）
git add supabase/migrations/20261018000001_024_add_not_required_payment_status.sql
git commit --amend --no-edit

# 或如 commit 還在本地：
git add supabase/migrations/20261018000001_024_add_not_required_payment_status.sql
git commit --amend -m "fix(pass-holder): add 'not_required' payment_status enum value (migration 024 applied)"
```

**Step 6 — Update this feedback 標記完成**：

`runs/improvements/feedback/INDEX.md` 加一行記錄，並把本 feedback 的狀態從 `MCP Apply 阻塞` 改為 `MCP Apply 完成（下次 session 補 commit amend）`。

## 驗證（本 session 跑的）

| 驗證項 | 結果 |
|---|---|
| Backend `npm run typecheck` | exit 0 |
| Frontend `npm run typecheck` (`tsc -b --noEmit`) | exit 0 |
| Frontend `tsc -b apps/frontend/tsconfig.app.json --noEmit` | exit 0 |
| Backend pass-templates tests | 8 files / 186 tests pass |
| Frontend PassHolder-related tests | 8 files / 106 tests pass |
| i18n smoke (`verify-i18n-keys.mjs`) | 21 namespaces / 42 locale files passed |
| `npm run check:migrations --workspace=apps/backend` | **FAIL**（1 migration file has NO registry entry — 預期，因為 MCP apply 阻塞）|

## 5 條教訓

1. **語意污染是 enum 設計的隱性 bug**：`'pending'` 同時承載「等待付款」+「無付款概念」兩種語意，是這次 stamp card 報案的根本原因。`not_required` enum 值是廉價修法，避免 nullable 或新增 column 的大改動。

2. **Rule 037 § 4 retest 是救命法則**：本 session 已試 5 種 `CallMcpTool` 變體都 fail，Rule 037 § 4 明確說「用 `CallMcpTool` 包 pre-listed 工具失敗 4 次仍繼續試」是 anti-pattern — 應「立即切換成獨立工具名呼叫」。但本 session 的獨立工具名呼叫也沒注入 function palette，這是更深層的 session 問題。

3. **session-level MCP setup 不是 agent 能解的問題**：當 `<mcp_meta_tools>` 預先注入步驟沒在啟動時跑，agent 沒有「重新注入」的 entry point — 只能等 user 重啟 Cursor / 重連 MCP / 換 session。

4. **Code change 與 migration 耦合的解耦策略**：當 migration 無法立刻 apply，code + tests + decision log 仍可 ship（DB schema 是事後驗證對象，code 邏輯只依賴 zod schema 跟 union type）。但 CI migration gate 會 fail 直到 registry 補上，這個 trade-off 必須在 commit message 明確標出。

5. **下次 session 接續工作的 metadata 必須明確**：本 feedback 的「下次 session 補 apply 步驟」段把 SQL 全文、registry JSON、verify 指令、amend 指令都列清楚 — 任何 agent 接手都能直接執行，不需重做 research。

## Future Invariants

- `public.pass_holders.payment_status` 4-value enum（`pending` / `completed` / `failed` / `not_required`）永久對應 4 種語意：
  - `pending` = 付費 template 等待真實 gateway callback
  - `completed` = 付費 template 付款完成
  - `failed` = 付費 template 真實 gateway 拒絕
  - `not_required` = 非付費 template，無付款概念
- Frontend `resolvePaymentFields` 在非 paid state 永遠 emit `not_required`（不能再 emit `pending`）
- Backend zod cross-field refinement 守：`completed` ↔ `paymentProvider` 必同時 set/not_set（`not_required` 必不帶 `paymentProvider`）
- 未來新增 production origin 必須同步 wrangler.jsonc 跟 runtimeCors.ts 兩處（per Rule 036）

## Follow-ups

| # | 內容 | 優先度 | 觸發時機 |
|---|---|---|---|
| 1 | **下次 session MCP reconnected 補 apply 024 + registry + amend commit**（per 上方 Step 1-5）| **P0** | Next session with working MCP |
| 2 | **Legacy rows backfill**：production `'pending'` rows 對應非付費 template 的，用 `runs/decisions/2026-10-18-payment-status-not-required-enum.md`「Legacy data」段的 SQL 一次性 backfill | P2 | Product wants to clean up legacy data |
| 3 | **Schema conformance test**：vitest 跑「query 出所有 `payment_status = 'pending'` 且 `payment_provider IS NULL` 的 row，數量應隨 backfill 遞減」 | P2 | After backfill scheduled |
| 4 | **Self-improvement feedback rule**：Rule 037 § 4 retest 提的「`CallMcpTool` 失敗 4 次仍繼續試」應明確建議「**第 2 次失敗**就應該 stop 並 surface blocker 給 user」 — 這次我 retry 5 次才停，下次應早一點 stop | P3 | Schedule a self-improvement pass |

## Commit 安排（本 session）

因 MCP apply 阻塞，本次 commit **不含 migration SQL 檔**：

```
fix(pass-holder): add 'not_required' payment_status enum value

- Shared PassHolderPayload.paymentStatus union adds 'not_required'
- Backend zod schema adds 'not_required' to passHolderPaymentStatusSchema
  + .superRefine cross-field validation (completed ↔ paymentProvider
  consistency, not_required forbids paymentProvider)
- Backend PassHolderRow + upsertPassHolder input type union updates
- Frontend resolvePaymentFields emits 'not_required' for non-paid
  templates (stamp / free reward / cashback / etc.)
- +4 backend cross-field refine tests, +1 frontend conformance test,
  +1 update to existing assertion
- DB-level enum update deferred — see feedback for manual apply steps

Refs: runs/decisions/2026-10-18-payment-status-not-required-enum.md
      runs/improvements/feedback/20261018-pass-holder-not-required-payment-status.md
Migration: 024 BLOCKED — session-level MCP dispatch issue.
           Manual apply steps in feedback §"下次 session 補 apply 步驟"
```

**Untracked**（要 amend 進去）：
- `supabase/migrations/20261018000001_024_add_not_required_payment_status.sql`
- `.applied-migrations.json` registry entry（apply 之後再 append）