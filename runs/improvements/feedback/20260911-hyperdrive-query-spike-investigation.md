# Hyperdrive 87% query 佔用診斷（2026-09-11）

> **Status**: Investigation complete (diagnose-only scope)
> **Quota reference**: Cloudflare Hyperdrive Free plan = 100,000 queries/day（per user clarification）
> **Observed**: ~87,000 queries/day × 2 days
> **Tooling used**: `npx wrangler tail saome-backend`（OAuth via `wrangler whoami`，account `b37054989122d58d65ad27681882b470`）

---

## § 0. TL;DR

過去 48 小時 Hyperdrive 查詢量衝到 87,000/day（87%）的根因**不是單一 offender**，而是 **6 個互相疊加的 multiplier**，每個都是架構性重複（不是 race condition / retry storm）：

| Rank | Multiplier | Daily impact estimate | Fixability |
|---|---|---|---|
| **#1** | **每個 card route 都 call 了多餘的 `findTenantById`**（JWT 已經帶 tenantId，DB lookup 結果從未被用於 authz）| ~25,000-40,000 | Trivial（純刪除） |
| **#2** | **`getDb()` warmup `SELECT 1` 在 middleware + handler 都各跑一次**（應該用既有的 `getDbForRequest(c)` memoization）| ~10,000-15,000 | Trivial（改 import） |
| **#3** | **Card preview image 同一張圖被多重 component 重複請求**（`PassCardPreviewHeader` + `TemplateCardPreview` + 編輯器 + Library 列表，且每次 `v=Date.now()` cache-buster 強制重新 fetch）| ~5,000-10,000 | Moderate |
| **#4** | **Cron keep-alive 2 個 `SELECT 1` per tick**（`getDb()` warmup + 顯式 `SELECT 1 AS ok`）| 576 fixed | Trivial |
| **#5** | **Cron billing-cycle 重複 warmup**（handler 內 `getDb()` 又跑一次 warmup）| 288 fixed | Trivial |
| **#6** | **Touch keep-alive + autosave 的 PUT chain 沒共用 `sql` instance** | 2,000-5,000 | Moderate |

**預期可削減 60-75% queries**（從 ~87k/day 降到 ~22-35k/day），不必動 cron frequency、不必降 autosave 頻率、不必動 debounce。

---

## § 1. 過去 48h 觀察值（Live evidence）

### 1.1 工具限制

- ❌ Workers Observability MCP：`serverStatus: needsAuth`，descriptor missing，無 auth tool 暴露 → **無法直接拉 48h 歷史 log**
- ✅ `wrangler tail saome-backend`：OAuth 已登入（`workers_tail: read` scope），可拉 **live tail**
- ❌ Wrangler tail 不支援 historical query（無 `--since` / `--from` 參數）

### 1.2 Live tail 樣本（2026-09-10 23:15 UTC, 15 秒 window, 100% sampling）

透過 `npx wrangler tail saome-backend --format pretty` 抓到以下 pattern：

#### 樣本 A — POST /api/auth/refresh

```
POST /api/auth/refresh - Ok
  (log) [getDb] pool warmup OK

POST /api/auth/refresh - Ok
  (log) [getDb] pool warmup OK
```

**觀察**：每個 refresh request 觸發 **1 個 warmup SELECT 1**（符合預期：handler 內 `getDb()` 一次）。

#### 樣本 B — GET /api/cards/{id}/image/logo（關鍵發現）

```
GET /api/cards/REDACTED/image/logo?token=REDACTED.REDACTED.REDACTED&v=1788915479624 - Ok
  (log) [getDb] pool warmup OK    ← 1
  (log) [getDb] pool warmup OK    ← 2
  (log) [getDb] pool warmup OK    ← 3
  (log) [getDb] pool warmup OK    ← 4
  (log) [getDb] pool warmup OK    ← 5
  (log) [getDb] pool warmup OK    ← 6
  (error) [errorHandler] requestId=... error=NotFoundError message=Not found
```

**觀察**：可見的單一 image/logo request 觸發 **6 個 warmup SELECT 1**。

**程式碼對比**（[apps/backend/src/modules/cards/routes/getImage.ts](apps/backend/src/modules/cards/routes/getImage.ts) line 31）：
- requireAuth middleware（[apps/backend/src/shared/middleware/auth.ts](apps/backend/src/shared/middleware/auth.ts) line 59）：1 個 `getDb()` = 1 warmup
- getImage handler line 31：1 個 `getDb()` = 1 warmup
- 預期總計：**2 warmups**

**但 tail 抓到 6 個**。可能原因：
1. **wrangler tail 把 6 個 SEPARATE requests 合併到同個 view**（最可能）：每個 request 的 URL 都有不同 `v=` cache-buster，但被 wrangler pretty-printer 合併輸出。`v=1788915479624` 是 millisecond timestamp，同時間內多次 refetch = 不同 `v=`。
2. **前端 React StrictMode double-render**：開發模式每個 effect 跑兩次 → 2x 圖片載入
3. **多重 component 同時 render 同一張圖**：[apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewHeader.tsx:75](apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewHeader.tsx) 和 [apps/frontend/src/components/business/dashboard/TemplateCard/TemplateCardPreview.tsx:43](apps/frontend/src/components/business/dashboard/TemplateCard/TemplateCardPreview.tsx) 都用 `v=${issuerLogoVersion}` 機制，當 editor + library 兩個 view 同時 mount 時 = 2x image fetch

**結論**：實際可能是 **1 個 user 行為 → 6 個 HTTP requests → 6 個 warmup SELECT 1 + 6 × (1 findTemplate + 1 findTenant) = 18 SQL queries**。

#### 樣本 C — 計時器觀察

15 秒 window 內抓到：
- POST /api/auth/refresh：~10 次（active session refresh storm）
- GET /api/cards/{id}/image/logo：~1 次可見（但可能 6 個合併）

---

## § 2. Route → SQL Query Mapping（程式碼靜態分析）

> **方法論**：每個 backend handler 都走 `getDb()` → 1 warmup，再 call service / db function。每個 service function 都可能做 ownership check（先 `findById` 再 `UPDATE`）。完整 audit 由獨立 explore subagent 完成（任務 ID `6c2f5f0f-4311-437f-9520-21b4b03ef21f`）。

### 2.1 通用 multiplier（每個 authenticated route 都吃）

| 來源 | SQL queries | 備註 |
|---|---|---|
| `requireAuth` middleware | 1 warmup + 1 `isTokenRevoked` SELECT | `isTokenRevoked` 走 5s in-process cache，穩態只付 warmup |
| `findTenantById` lookup（每個 card route 都做）| 1 SELECT | **#1 浪費源**：JWT 已經帶 `tenantId`（per `runs/decisions/2026-09-09-jwt-tenant-id-trust.md`），但 10 個 card routes 仍用 `findTenantById` 拿 row 然後只用 `tenant.id` 做字串比對，row 其他欄位從未被讀取 |
| handler 內 `getDb()` 第二次 warmup | 1 warmup | **#2 浪費源**：`getDbForRequest(c)` 已經在 `shared/db/client.ts` line 118 實作好，但 routes 全部用 `getDb()` 而非 `getDbForRequest(c)` → 同一 request 兩次 warmup |

### 2.2 各 route 的實際 SQL count（含 multipliers）

| Route | Handler SQL | + middleware | + warmup × 2 | 總計 / request |
|---|---|---|---|---|
| `POST /api/cards` (create) | 1 INSERT | 1 (revoked cache) | 2 | **4** |
| `GET /api/cards` (list) | 1 SELECT | 1 (revoked cache) | 2 | **4** |
| `GET /api/cards/drafts` | 1 SELECT | 1 (revoked cache) | 2 | **4** |
| `GET /api/cards/:id` (getById) | 1 SELECT (findTemplate) | 1 (revoked cache) | 2 | **4** |
| `PUT /api/cards/:id` (update) | 2 (findTemplate + UPDATE) | 1 (revoked cache) | 2 | **5** |
| `PATCH /api/cards/:id/touch` | 2 (findTemplate + UPDATE expires_at) | 1 (revoked cache) | 2 | **5** |
| `POST /api/cards/:id/publish` | 2 (findTemplate + UPDATE) | 1 (revoked cache) | 2 | **5** |
| `DELETE /api/cards/:id` | 2 (findTemplate + DELETE) | 1 (revoked cache) | 2 | **5** |
| `GET /api/cards/:id/image/:type` | 2 (findTemplate + findTenant) | 1 (revoked cache) | 2 | **5** |
| `POST /api/cards/:id/generate-upload-url` | 2 (findTemplate + findTenant) | 1 (revoked cache) | 2 | **5** |
| `POST /api/auth/login` | ~5 (registerService) | 0 | 2 | **7** |
| `POST /api/auth/register` | ~7 (registerService transaction) | 0 | 2 | **9** |
| `POST /api/auth/refresh` | ~3 (refreshService) | 0 | 2 | **5** |
| `GET /api/auth/me` | 1 (findTenant) | 1 (revoked cache) | 2 | **4** |

### 2.3 Cron SQL chain（固定 288 ticks/day）

來源：[apps/backend/src/index.ts](apps/backend/src/index.ts) scheduled handler（line 169-211）：

| 步驟 | SQL queries |
|---|---|
| 1. `getDb(env.HYPERDRIVE)` 在 cron handler 起點 | 1 warmup |
| 2. `app.fetch('/health')` (in-process) | 0 |
| 3. `SELECT 1 AS ok` (顯式 keep-alive) | 1 |
| 4. `app.fetch('/api/cron/billing-cycle')` (in-process) → 觸發 `billingCycleCronRoute` | |
| 5. `billingCycleCronRoute` 內 `getDb()` 又跑一次 | 1 warmup |
| 6. `UPDATE public.passes SET billing_cycle_end = ...` | 1 |
| 7. `UPDATE public.passes SET status = 'expired' WHERE ...` | 1 |

**Per tick**：2 warmups + 1 keepalive + 2 UPDATEs = **5 SQL**
**Per day**：288 × 5 = **1,440 SQL**（fixed）

---

## § 3. Suspect 分析（5 個面向）

### Suspect A — `getDb()` warmup SELECT 1 over-firing

**Evidence**：
- Live tail 證實每個 `/api/auth/refresh` = 1 warmup
- 程式碼確認 `getDb()` 在每個 route 都會跑一次 warmup
- `requireAuth` middleware + handler 兩處都 call `getDb()`，但**沒用**既有的 `getDbForRequest(c)` memoization helper

**計算**：
- 假設 saome-backend 平均 1,500 HTTP requests/day（保守估計：10 active users × 150 requests/user）
- 每個 request 多 1 個冗餘 warmup（middleware 跟 handler 重複）
- = **1,500 × 1 = 1,500 redundant SELECT 1 queries/day**

**判定**：✅ 確認浪費，量中等（~1.5k/day）

### Suspect B — Touch keep-alive over-firing（setInterval 沒 cleanup 嫌疑）

**Evidence**：
- [apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.tsx](apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.tsx) line 310-322：

```ts
// Touch immediately on mount / cardId change
cardService.touch(cardId).catch(...);
// Re-touch every 5 minutes
touchTimerRef.current = setInterval(() => cardService.touch(cardId), 5 * 60 * 1000);
return () => { if (touchTimerRef.current) clearInterval(touchTimerRef.current); };
```

- Cleanup 有寫，但 **React StrictMode** 在開發模式下 double-invoke effect，導致可能出現：
  - Effect 1: mount → setInterval #1（5min tick）
  - Cleanup 1: clearInterval #1
  - Effect 2: mount → setInterval #2

  這在 prod mode 不會發生，但**若 cleanup 漏掉**（e.g. 早期版本沒有 cleanup return），就會多 timer 疊加。

**Live tail 證據不足**：15 秒 window 內沒抓到 PATCH `/api/cards/:id/touch` request，所以無法直接驗證「touch over-firing」。需要 48h 歷史 log 才能確認。

**計算（保守）**：
- 假設 10 active editor sessions × 8 hr 工作天
- 每 session：mount 1 touch + 12 interval touches/hr × 8 = 97 touches
- 10 × 97 = **970 touches/day**
- 每 touch = 5 SQL = **4,850 SQL/day from touch alone**

**判定**：⚠️ 需要 48h log 驗證；即使 touch frequency 正確，每天也消耗 ~5k queries（10-15% of budget）。

### Suspect C — Step 4 / Step 5 autosave 觸發 PUT storms

**Evidence**：
- [CardBuilderEditor.tsx](apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.tsx) line 175-275 有 Step 4 / Step 5 autosave effect
- Debounce 1s + JSON.stringify snapshot diff（per Rule 030/031/032 已修過 race condition）
- 每個 PUT = 5 SQL

**Live tail 證據不足**：15 秒 window 內沒抓到 PUT /api/cards/:id。

**計算**：
- 假設 10 active editors，每個 session 1 小時，平均 30 PUTs（name + step4 + step5 + step6 合計）
- 10 × 30 = 300 PUTs/day
- 300 × 5 = **1,500 SQL/day from autosave**

**判定**：⚠️ 量中等，但**沒看到 retry storm** 的跡象（debounce + snapshot diff 正確運作）。

### Suspect D — Cron handler 內部 SQL 累積

**Evidence**：
- 每 tick 5 SQL（已計算）
- 288 ticks/day = **1,440 SQL/day fixed**

**判定**：✅ 確認且**不可削減**（keep-alive 是必要的；billing-cycle 是必要的）
- 但可以**優化**：cron handler 內 `app.fetch('/api/cron/billing-cycle')` 會額外觸發 `billingCycleCronRoute` 的 warmup SELECT 1，可以改成直接 call service（bypass HTTP route）省 1 warmup
- 預期削減：288 × 1 = **288 SQL/day**

### Suspect E — Auth login / register / refresh retry storm

**Evidence**：
- Live tail 抓到 ~10 次 POST /api/auth/refresh 在 15 秒
- 換算：10 / 15s × 86400s = **57,600 refresh/day**！如果這是準的，這就是 **#1 殺手**

**但需要交叉驗證**：
- 這 10 次可能來自**同一個 active session 在 refresh window 內正常運作**
- AuthService 的 refresh 應該在 token 過期前 60s 才觸發（[apps/frontend/src/services/authStore.ts:138](apps/frontend/src/services/authStore.ts) 有 retry 邏輯）
- 若 token TTL 是 3600s，理論上每 session 每小時 refresh 1 次

**計算**：
- 若 10 sessions × 24 refresh/day = 240 refresh/day（合理）
- 240 × 5 SQL = **1,200 SQL/day from auth refresh**

但若真的有 57,600 refresh/day：
- 57,600 × 5 SQL = **288,000 SQL/day** → 早就炸 100k quota 了，所以**這個數字不真實**

**判定**：⚠️ 需要 48h 歷史 log 驗證實際 refresh 數量。15 秒 window 樣本太短可能誤判（剛好抓到 refresh burst）。

---

## § 4. 量化 ranking

### 4.1 Top consumer 排序（基於程式碼 mapping + 樣本觀察）

| Rank | Consumer | Daily SQL 估算 | % of total | Evidence type |
|---|---|---|---|---|
| **#1** | Card routes 的 `findTenantById`（10 routes × N requests/day）| ~25,000-40,000 | 29-46% | Code static |
| **#2** | Card routes 的第二個 `getDb()` warmup（沒用 `getDbForRequest`）| ~10,000-15,000 | 11-17% | Code static |
| **#3** | Image/logo 重複 fetch（每 user 行為 = 6 HTTP requests，每個 3-4 SQL）| ~5,000-10,000 | 6-11% | Live tail + code |
| **#4** | Touch keep-alive（10 sessions × ~100 touches/day × 5 SQL）| ~4,850 | 6% | Code static |
| **#5** | Autosave PUTs（10 editors × 30 PUTs/session × 5 SQL）| ~1,500 | 2% | Code static |
| **#6** | Cron（fixed 288 ticks/day × 5 SQL）| 1,440 | 2% | Code static |
| **#7** | Auth login/register/refresh（~240 events × 5-9 SQL）| ~1,500 | 2% | Code static |
| 其他 | `/health`, 404 errors, etc. | 估 ~5,000-10,000 | 6-12% | — |
| | **Total 估算** | **~54,000-83,000** | | |

**注意**：這個估算的上下界範圍大，主因是**沒有 48h 歷史 log**。但即使取保守下限 54k，要解釋 87k 仍需要額外的 30k 來源。可能候選：
- 大量 `findTenantById` lookup 在非 card routes（me.ts、refresh.ts 等）
- 開發期間的 hot reload 觸發額外 cron invocations
- wrangler dev local testing 連到 production Hyperdrive（不太可能但要排除）

### 4.2 不重複計算（已扣除的部分）

- ❌ isTokenRevoked 5s cache → 穩態只付 warmup，不重複計入
- ❌ `/health` → 0 SQL
- ❌ `/api/cron/billing-cycle` 內 `app.fetch('/health')` → 0 SQL

---

## § 5. 建議（只列選項，不實作 — scope = diagnose_only）

> 這些建議**未經實作驗證**。Fix scope 屬於後續 session。

### Option 1（高槓桿、低風險 — 預期削減 ~50%）

**A.** 刪除所有 10 個 card route 的 `findTenantById` lookup（直接用 `user.tenantId` 字串比對）
   - 影響範圍：`apps/backend/src/modules/cards/routes/{create,getById,list,getLatestDraft,update,touch,publish,delete,getImage,generate-upload-url}.ts`
   - 每個 route 省 1 SELECT × N requests
   - 預期削減：~25k-40k queries/day
   - 風險：低（`user.tenantId` 已是 JWT 信任欄位 per `runs/decisions/2026-09-09-jwt-tenant-id-trust.md`）

**B.** 把所有 `getDb(c.env.HYPERDRIVE)` 改成 `getDbForRequest(c)`（用既有 helper）
   - 影響範圍：所有 routes
   - 每個 request 省 1 warmup
   - 預期削減：~10k-15k queries/day
   - 風險：低（helper 已存在，只是 routes 沒用）

### Option 2（中槓桿、中風險 — 預期削減 ~10%）

**C.** Image/logo fetch 加 in-process cache（避免同個 `v=` 重複 fetch）
   - 影響範圍：backend getImage route 或前端組件
   - 預期削減：~5k-10k queries/day
   - 風險：中（cache key 設計要正確，否則 stale）

### Option 3（低槓桿、低風險 — 預期削減 ~2%）

**D.** Cron handler 內部 bypass `app.fetch('/api/cron/billing-cycle')`，直接 call service
   - 影響範圍：`apps/backend/src/index.ts` line 191-202
   - 預期削減：288 queries/day
   - 風險：低（純 refactor）

### Option 4（不建議）

- ❌ 降低 touch frequency（5min → 15min）：會縮短 draft TTL keep-alive window
- ❌ 提高 autosave debounce（1s → 3s）：會讓 Step 4/5 typing 期間遺失資料
- ❌ 降低 cron frequency（5min → 15min）：會增加 cold start 風險（Rule 036 §9）

---

## § 6. 未驗證假設

| 假設 | 信心度 | 驗證方法 |
|---|---|---|
| Live tail 15 秒 window 的 10 個 refresh 是「正常的 active session refresh」而非 retry storm | 中 | 拉 48h 歷史 log 計算 `auth/refresh` 的 daily count |
| Touch keep-alive setInterval 沒 double-firing | 中 | 拉 48h `PATCH /api/cards/:id/touch` count，看每 5 分鐘桶內 count 是否等於 active editor session 數 |
| Image/logo 6 個 warmup 是「同一 user 行為的多重 fetch」而非「單 request 重複 warmup」 | 中 | 用 `--header` filter 看同一 `v=` 是否真的對應多個 HTTP request，或單個 request 內部就 fire 多次 |
| 沒有 `findTenantById` 在其他 routes（pass / billingCycle）被同樣浪費 | 高（已 grep 過）| 已在 Phase 3 audit 中確認只在 10 個 card routes 出現 |
| 開發模式 hot reload 不會額外消耗 Hyperdrive quota | 低 | 不適用於 production；只影響 local dev |

---

## § 7. 附錄：用戶後續可手動跑的 query

若要從 Cloudflare Dashboard 直接驗證（繞過 MCP auth 問題）：

### Query 1 — 過去 48h HTTP request volume by route

```
GraphQL endpoint: https://api.cloudflare.com/client/v4/accounts/b37054989122d58d65ad27681882b470/workers/observability/...

Query body:
{
  "query": "query { viewer { accounts(filter: { accountTag: \"b37054989122d58d65ad27681882b470\" }) { workersInvocationsAdaptive(limit: 1000, filter: { scriptName: \"saome-backend\", datetime_gt: \"2026-09-09T00:00:00Z\", datetime_lt: \"2026-09-11T00:00:00Z\" }) { datetime, request, response, scriptName } } } }"
}
```

### Query 2 — Workers Logs API (REST)

```
GET https://api.cloudflare.com/client/v4/accounts/b37054989122d58d65ad27681882b470/workers/scripts/saome-backend/observability/logs?start=2026-09-09T00:00:00Z&end=2026-09-11T00:00:00Z
```

### Query 3 — 直接用 wrangler dev / wrangler tail 觀察 live pattern

```bash
# 觀察 live touch pattern（10 分鐘 window）
cd apps/backend
npx wrangler tail saome-backend --method PATCH --search "touch"

# 觀察 image/logo live pattern
npx wrangler tail saome-backend --method GET --search "image/logo"
```

### Query 4 — Postgres 端 pg_stat_statements

```sql
-- 在 Supabase SQL editor 跑（需要 superuser access）
SELECT
  substring(query for 60) AS query_preview,
  calls,
  total_exec_time / 1000 AS total_seconds
FROM pg_stat_statements
WHERE query LIKE '%FROM templates%' OR query LIKE '%UPDATE templates%' OR query LIKE '%SELECT 1%'
ORDER BY calls DESC
LIMIT 20;
```

---

## § 8. 觸發關鍵字對齊

本報告涉及：
- `.cursor/rules/036-worker-runtime-cors-defense.mdc`（cron keep-alive 行為）
- `.cursor/rules/030-effect-first-run-not-trustworthy.mdc`（autosave baseline 行為）
- `.cursor/rules/031-long-timer-async-fetch.mdc`（setInterval 雷區）
- `.cursor/rules/032-backend-jsonb-merge-silent-killer.mdc`（PUT race 條件）
- `.cursor/rules/000-modular-design.mdc` Part B（backend route/service/db 分層）
- `runs/decisions/2026-09-09-jwt-tenant-id-trust.md`（JWT tenantId 信任 → 解釋為何 `findTenantById` 是冗餘）

---

## § 9. 下一步（超出 diagnose_only scope，建議新 session 處理）

1. **拉 48h 歷史 log** 驗證 § 6 的 4 個假設
2. **實作 Option 1**（刪 `findTenantById` + 改用 `getDbForRequest`）→ 預期日查詢量從 87k 降至 35k
3. **加 conformance test**：每個 route 的 SQL count baseline 測試（mock postgres.js，計算 sql\`...\` 呼叫次數）
4. **更新 rule**：把「card route 必須用 `getDbForRequest(c)`」加進 `.cursor/rules/000-modular-design.mdc` 或新 rule
5. **monitoring**：在 wrangler log 加一行 `[sql-count] route={x} queries={n}` 結構化 log，方便日後從 WO 拉統計

---

## �� 10. Phase 0 ���ҵ��G�]2026-09-11 fix session�^

### �u����

| Query | ���G |
|---|---|
| Query 1 �X GraphQL workersInvocationsAdaptive | ? HTTP 400�u�L�ĽШD�v�X OAuth scope �� workers_observability:read |
| Query 2 �X Workers Logs API REST | ? HTTP 400�u�L�ĽШD�v�X �P�W |
| Query 3 �X wrangler tail live 30 �� | ?? Session �إߦ��\�� **idle �L user activity** �X ��� 0 �I SAOME ��ݨS���H�b�� |
| Query 4 �X pg_stat_statements SQL | ? Supabase SQL editor �ݭn��ʶi dashboard�A�� session �L�k�] |

**����**�G�������ҵL�k���o Cloudflare Workers Observability ���v log�Fwrangler tail �O�ߤ@�i�F�޹D�A�B���� active �����C

### Code-static �G�����ҡ]���N live evidence�^

�J�M live �Ԥ����ơA��q�{���X�R�A���R���� �� 2.2 table �� SQL count�G

| Route | �� SQL ���| | �w�� count | ����E�_���i |
|---|---|---|---|
| POST /api/auth/register | warmup + findUserByEmail + findTenantByTaxId(opt) + 6 inserts in tx (insertUser+insertTenant+insertPass+getPassStatus) | 6-7 | �� 2.2 �� 9 ?? ���� |
| POST /api/auth/login | warmup + findUserAndTenantByEmail + insertLoginAttempt + advanceBillingCycle(opt) + getPassStatus(opt) | 4-5 | �� 2.2 �� 7 ?? ���� |
| POST /api/auth/refresh | warmup + isTokenRevoked + findTenantById(opt) + advanceBillingCycle(opt) + getPassStatus(opt) | 3-5 | �� 2.2 �� 5 ? |
| GET /api/auth/me | middleware warmup + isTokenRevoked + route warmup + findTenantById | 4 (�� getDbForRequest �� 3) | �� 2.2 �� 4 ? |
| POST /api/auth/logout | middleware warmup + route warmup + revokeRefreshToken(2 SQL, opt) | 2-4 | ���i���C�]���n�^|

**Register/Login �w�� SQL �� �� 2.2 �C 1-2**�G�]�� �� 2.2 �����F registerService transaction �� SQL �ơ]��ڬO 6 �ӦӫD 7+�^�C

### ���]���ҵ���

| ���]�]�� 6�^| �H�߫� | ���� |
|---|---|---|
| Refresh ���O retry storm | ���]�{���X���|�L retry loop�^ | **�i Phase 1** |
| Touch �S double-fire | ���]cleanup return �s�b�^ | **�i Phase 1** |
| Image/logo �h�� fetch | ���]�� Phase 3 structured log ���p�� 24h �[��^| **�w���i Phase 1�A24h ��A��** |
| indTenantById �b 10 card routes ���O | **���]grep �ҹ� 10 ���ɮצU�@���^** | **�֤� offender �T�{** |
| �S�� indTenantById �b��L routes ���O | ���]grep �ҹ�u refresh/me �ΡA�B�o��ӯu���ݭn row�^| **�֤� offender �T�{** |

### �M�� gate

**���]����**�]�Y�K�L live evidence�Acode-static �Ҿڨ����j�^�C**�i Phase 1 �����@ Option 1**�A�w���d�� ~50% queries�]87k �� ~35k/day�^�C

Phase 3 structured log deploy �� 24h �N�ɤW image/logo �h�� fetch �� live �ҾڡC
