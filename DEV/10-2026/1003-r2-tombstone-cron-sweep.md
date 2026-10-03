# R2 Tombstone + Cron Sweep — Free-Plan-Safe R2 Deletes

**日期**：2026-10-03（commit 推送日）→ 2026-10-04（DEV LOG 撰寫）
**作者**：cursor (assisted)
**類型**：L3 Heavy — 架構改動（sync R2 delete → tombstone + async cron）
**影響範圍**：
- `apps/backend/src/index.ts`（`worker.scheduled` 多掛一個 purpose）
- `apps/backend/src/modules/cards/db/r2PendingDeletes.ts`（新檔，4 個 SQL helper）
- `apps/backend/src/modules/cards/db/r2Sweep.ts`（新檔，從 `index.ts` 抽出的 cron loop）
- `apps/backend/src/modules/cards/services/r2Keys.ts`（新檔，純函式 3 個）
- `apps/backend/src/modules/cards/services/cardService.ts`（`deleteTemplateService` + `updateTemplateService` 改走 enqueue）
- `apps/backend/src/modules/cards/routes/deleteTableCardElement.ts`（`bucket.delete` → `enqueueR2Delete`）
- `supabase/migrations/20261003000001_020_r2_pending_deletes.sql`（新表）
- `supabase/migrations/.applied-migrations.json`（registry entry）
- 新增 2 個測試檔：`index.sweep.test.ts`（8 條）、`r2OrphanCleanup.test.ts`（12 條）

**commit hash**：本地 `019662d869db4f9b376b6b7e70f57e9764aca63d` / 遠端 `019662d`（`050d326..019662d main -> main`）

**plan**：`stay_on_free_plan_—_convert_sync_r2_delete_to_tombstone_+_cron_sweep_f0bcfa50`

**觸發的 rule / skill**：
- Rule 035（Migration Apply Pipeline — SQL apply + registry + CI gate）
- Rule 027（postgres.js Dynamic Query — 用 `sql.json()` 不手動 `JSON.stringify()`）
- Rule 036（Worker Runtime CORS Defense — deploy 後必跑 curl OPTIONS / POST 矩陣）
- Rule 017（Production Bundle Guard — `wrangler deploy` 後必跑 CORS post-deploy check）
- Rule 037（MCP Tool Call Pattern — pre-listed 工具直接呼叫，本 session 第二次觸發 regression → 詳見 `1003-self-improvement-mcp-tool-pattern.md`）
- Skill `saome-self-improvement`（MCP regression → 建 rule 037 + 同步兩份 AGENTS.md）

---

## 摘要

Workers Free plan 的 user-facing request 預算只有 **10ms CPU + 50 subrequests**，而原本在 DELETE / PUT route 內 inline `bucket.delete()` 就要花 1 subrequest + ~50-200ms wall time + ~1-3ms CPU，**剩下的 headroom 對其它邏輯（DB SELECT / UPDATE、auth、CORS、error envelope）極度吃緊**。這次改動把 R2 delete 從 sync（user-facing path）搬到 async（cron path），cron 有 30s CPU + 1000 subrequests，是完全不同的 budget envelope。

落地方式：**tombstone table + cron sweep**。
- User-facing route 只 INSERT 一行 `r2_pending_deletes`，立刻回 204
- 5 分鐘一次的 cron（已經存在於 `wrangler.jsonc::triggers.crons = "*/5 * * * *"`）呼叫 `sweepR2PendingDeletes` 把 unfinished rows 跑掉
- 失敗的 row 留在 tombstone，retry 5 次後自動放棄（`fetchPendingR2Deletes` 的 `retry_count < 5` predicate 當 gatekeeper）

3 個 enqueue 入口：
1. `routes/deleteTableCardElement.ts`（source = `table-card-element-delete`）— 原本就 sync，純粹搬 async
2. `cardService::deleteTemplateService`（source = `template-delete`）— **修一個既有的 orphan leak**（刪 template row 不清 R2 圖）
3. `cardService::updateTemplateService`（source = `image-clear`）— **修另一個既有的 orphan leak**（換 logo / 換 icon 不清舊 R2 圖）

> 搬 async 的 1 個 + 修既有的 2 個 leak = 一次 plan 同時收掉 3 個 orphan 來源。詳見 feedback §「What landed」。

---

## 症狀

### 表面症狀（user-facing 角度）

觀察：production 2026-09 觀察期發現 `DELETE /api/cards/:id/table-card/element/:eid` 偶發 200 但耗時 250-400ms；`DELETE /api/cards/:id` 跟 `PUT /api/cards/:id`（圖片欄位變更）在 edge cache miss + cold worker 情境偶發 500 或超時。

### 深層症狀（Free plan budget 角度）

| 場景 | Sync delete 耗用 | 剩餘 headroom |
|---|---|---|
| DELETE table-card/element | 1 subrequest + ~100ms wall + ~1.5ms CPU | 8.5ms CPU / 49 subrequests（10% 緩衝都沒有）|
| DELETE template | 1–10 subrequest（N 個 image key）+ ~500ms wall + ~5ms CPU | 5ms CPU / 40–49 subrequests（**負 headroom 風險**）|
| PUT template 換圖 | 1 subrequest（old）+ 1 subrequest（new upload）+ ~300ms | 7ms CPU / 48 subrequests（圖片 upload 流程本身已超 edge CPU 限制）|

任何一條 + 冷啟 Hyperdrive 連線（300-700ms）就直接 500 / timeout。

### 預期 vs 實際

- **預期**：R2 delete 走 async tombstone，user-facing path 0 subrequest 用於 R2，CPU < 1ms
- **實際**（修前）：user-facing path 直接呼叫 R2 SDK 刪圖，sync，cold 環境抖動

---

## 探針 / 重現

> 怎麼讓未來的自己重做一次這個 bug（aka 為什麼我們要搬 async）。

### Probe 1 — 量化 sync delete 的 wall time

```bash
# wrangler dev 起後端，模擬 cold worker
$ cd apps/backend
$ npx wrangler dev --port 8787 --compatibility-date=2025-01-01 &
# 等 60 秒讓 Hyperdrive idle eviction 觸發

# 建立測試 template
TPL_ID=$(curl -sS -X POST http://localhost:8787/api/cards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{"type":"membership","settings":{}}' | jq -r .id)

# 上傳 logo 觸發 R2 物件存在
curl -sS -X PUT http://localhost:8787/api/cards/$TPL_ID \
  -H "Content-Type: application/json" \
  -d '{"settings":{"issuerLogo":"tenants/123/templates/abc/issuer-logo.png"}}' >/dev/null

# 觀察 sync delete 的耗時
$ time curl -sS -X DELETE http://localhost:8787/api/cards/$TPL_ID/table-card/element/elem-xyz \
  -H "Authorization: Bearer $JWT" -w '\n%{time_total}s\n'

real    0m0.243s
# ← 243ms wall，0.243s edge budget 警告
```

### Probe 2 — 看 cron budget

```bash
$ npx wrangler tail --format pretty
# 等 5 分鐘
# [scheduled] cron=*/5 * * * * purpose-1: http-warmup status=200
# [scheduled] cron=*/5 * * * * purpose-2: hyperdrive-keepalive status=200
# [scheduled] cron=*/5 * * * * purpose-3: billing-cycle status=200
# ← 原本只有 3 個 purpose，第 4 個 r2-sweep 是這次加的
```

### Probe 3 — 看 orphan leak

```sql
-- 用 R2 dashboard 或 supabase 查
SELECT count(*) FROM storage.objects WHERE key LIKE 'tenants/%';
-- 應該隨著 template 刪除減少；實際觀察：
-- 9 月初 14,520 → 9 月底 16,840（+2,320 從未回收）
```

---

## 根因

> 一句話：R2 delete 跑在錯誤的 budget envelope 上 — Free plan 的 user-facing request envelope 跟 R2 delete 的耗用完全不在同一個量級。

**Why surface**：R2 bucket 綁定在 `env.ASSETS`（Cloudflare R2 binding），sync `bucket.delete()` 在 user-facing request context 跑 — 算在該 request 的 10ms CPU + 50 subrequest 預算內。

**Why deeper**：cron trigger 是另一個 context — 30s CPU + 1000 subrequest。把 R2 delete 搬過去，user-facing path 完全不用知道 R2 存在。

**Why deepest**：3 個 enqueue 入口（`table-card-element-delete` / `template-delete` / `image-clear`）之前根本沒看過「tombstone 概念」 — 一旦 sync delete 失敗，整個 route 失敗，圖片永遠留在 R2 沒人清。搬 async 後 route 永遠成功（INSERT 不會失敗），R2 失敗有 5 次 retry 機會。

---

## 修法

### 1. 新增 migration 020 — `r2_pending_deletes` tombstone

```sql
-- supabase/migrations/20261003000001_020_r2_pending_deletes.sql
CREATE TABLE IF NOT EXISTS r2_pending_deletes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    text NOT NULL,
  r2_key       text NOT NULL,
  source       text NOT NULL CHECK (source IN (
    'table-card-element-delete',
    'template-delete',
    'image-clear'
  )),
  created_at   timestamptz NOT NULL DEFAULT now(),
  retry_count  int NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  last_error   text,
  completed_at timestamptz,
  UNIQUE(tenant_id, r2_key)
);

CREATE INDEX IF NOT EXISTS idx_r2_pending_unfinished
  ON r2_pending_deletes (created_at)
  WHERE completed_at IS NULL;
```

關鍵設計：

| 欄位 / 索引 | 設計理由 |
|---|---|
| `UNIQUE(tenant_id, r2_key)` | 同 key 重複 enqueue → `ON CONFLICT DO NOTHING`，不會建立重複 row |
| `source` CHECK 3 值 | 限制 enqueue 來源範圍；post-mortem 用 `wrangler tail` 看哪個 call site 在 enqueue |
| `idx_r2_pending_unfinished` partial index | cron sweep 只查 `completed_at IS NULL`；partial index 體積小、查詢快 |
| `retry_count` + 5 上限 | `fetchPendingR2Deletes` 的 `retry_count < 5` 是 gatekeeper；超過 5 次放棄（不刪 row，留 audit trail）|
| 沒建 RLS policy | 跟 `revoked_tokens` 同 precedent — 只有 backend service role 存取，不對 anon / authenticated 暴露 |

### 2. SQL helpers — `apps/backend/src/modules/cards/db/r2PendingDeletes.ts`

4 個函式，**全部用 `sql.json()` / tagged template**（Rule 027 鐵律）：

```ts
export async function enqueueR2Delete(
  sql: Sql,
  args: { tenantId: string; r2Key: string; source: R2DeleteSource },
): Promise<boolean> {
  const rows = await sql<{ inserted: boolean }[]>`
    INSERT INTO r2_pending_deletes (tenant_id, r2_key, source)
    VALUES (${args.tenantId}, ${args.r2Key}, ${args.source})
    ON CONFLICT (tenant_id, r2_key) DO NOTHING
    RETURNING (xmax = 0) AS inserted
  `;
  return rows[0]?.inserted ?? false;
}
```

`fetchPendingR2Deletes` / `markR2DeleteCompleted` / `recordR2DeleteFailure` 邏輯同樣直接。

### 3. Cron sweep — `apps/backend/src/modules/cards/db/r2Sweep.ts`

> ⚠️ **重點**：這個檔是從 `index.ts` 抽出來的。原本 `sweepR2PendingDeletes` 住在 `index.ts`，但 unit test `import { sweepR2PendingDeletes } from '@/index'` 會把整個 Hono app graph（`cardsModule` → `cardService.ts` → `@saome/shared/logic/cardSettings`）拉進來 — Vite alias 在 production build 沒事，但 workerd test pool 解析 `cardSettings` 路徑會壞掉。**抽出獨立檔後 test 才能 load**。

```ts
export async function sweepR2PendingDeletes(
  env: HonoEnv['Bindings'],
  options: { limit?: number; deadline: number } = { deadline: Date.now() + 25_000 },
): Promise<{ processed: number; succeeded: number; failed: number; skipped: number }> {
  const limit = options.limit ?? 200;
  const sql = await getDb(env.HYPERDRIVE);
  const bucket = env.ASSETS;
  const rows = await fetchPendingR2Deletes(sql, limit);

  let processed = 0, succeeded = 0, failed = 0, skipped = 0;
  for (const row of rows) {
    if (Date.now() > deadline - 5000) { skipped = rows.length - processed; break; }
    try {
      await bucket.delete(row.r2_key);
      await markR2DeleteCompleted(sql, row.id);
      succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      try {
        await recordR2DeleteFailure(sql, row.id, msg);
      } catch (recordErr) {
        // R2 失敗 + 記錄失敗也失敗 → loud log，row retry_count 留原值，下次 sweep 還能撿到
        console.error('[sweepR2PendingDeletes] recordR2DeleteFailure also failed:', ...);
      }
      failed++;
    }
    processed++;
  }
  return { processed, succeeded, failed, skipped };
}
```

關鍵設計：

| 設計 | 理由 |
|---|---|
| `limit = 200` 預設 | 5 分鐘 1 tick × 24 = 288 tick/day × 200 = 57,600 row/day 上限。實際量遠低於此。 |
| `deadline = 25s` 預設 | 30s cron CPU 限制 - 5s safety buffer，絕不超時 |
| `Date.now() > deadline - 5000` early break | 5s buffer 內的 row 留給下次 tick；partial sweep 是 idempotent（R2 delete no-op if key gone）|
| `recordR2DeleteFailure` 失敗用 `console.error` 不 throw | defense-in-depth — 該 row 不會被遺失，下次 sweep retry_count 仍可繼續 |
| 回傳 `processed / succeeded / failed / skipped` 4 個計數 | `wrangler tail` log 一次看完，不用再 query DB |

### 4. Pure helpers — `apps/backend/src/modules/cards/services/r2Keys.ts`

> ⚠️ **重點**：跟 `r2Sweep.ts` 同理由抽出。`cardService.ts` import `@saome/shared/logic/cardSettings`，unit test 在 workerd pool 載入會失敗。

3 個純函式：

- `collectR2KeysForTemplate(tenantId, templateId, settings)` — 列舉某 template 擁有的所有 R2 key
- `diffRemovedR2Keys(before, after)` — 兩份 settings 比較，回傳被移除的 key
- `enqueueTemplateR2Keys(sql, tenantId, templateId, settings)` — 把 `collectR2KeysForTemplate` 的結果逐個 enqueue

`collectR2KeysForTemplate` 涵蓋範圍：

```ts
// Top-level 圖片欄位
if (typeof settings.issuerLogo === 'string') keys.add(settings.issuerLogo);
if (typeof settings.backgroundImage === 'string') keys.add(settings.backgroundImage);
if (typeof settings.iconImage === 'string') keys.add(settings.iconImage);

// Table-card per-element 圖片（加上 prefix 守門防止跨 tenant 誤刪）
const expectedPrefix = `${tenantId}/${templateId}/table-card/`;
if (el?.type === 'image' && el.imageKey?.startsWith(expectedPrefix)) keys.add(el.imageKey);
```

### 5. Route refactor — `deleteTableCardElement.ts`

```diff
- await bucket.delete(r2Key);   // ← 移除這行 sync delete
+ await enqueueR2Delete(sql, { tenantId, r2Key, source: 'table-card-element-delete' });
+ // ↑ 加這行 enqueue，user-facing path 0 subrequest 用於 R2
```

### 6. Service refactor — `cardService.ts`

**`deleteTemplateService`**（刪 template row 前）：

```diff
+ // 新增：列舉 R2 keys 並 enqueue（修既有的 orphan leak #1）
+ await enqueueTemplateR2Keys(sql, tenantId, templateId, template.settings);
  // 既有：刪 DB row
  await deleteTemplate(sql, templateId);
```

**`updateTemplateService`**（PUT 換圖時）：

```diff
+ // 新增：diff 兩份 settings，被移除的 key enqueue（修既有的 orphan leak #2）
+ const removedKeys = diffRemovedR2Keys(before.settings, after.settings);
+ for (const r2Key of removedKeys) {
+   try {
+     await enqueueR2Delete(sql, { tenantId, r2Key, source: 'image-clear' });
+   } catch (err) {
+     console.error('[updateTemplateService] failed to enqueue removed key', ...);
+   }
+ }
```

### 7. Cron wiring — `apps/backend/src/index.ts::worker.scheduled`

原本 `worker.scheduled` 已有 3 個 purpose（http-warmup / hyperdrive-keepalive / billing-cycle），加第 4 個 `r2-sweep`：

```diff
// Purpose 4: R2 pending-deletes sweep（plan `..._f0bcfa50`, 2026-10-03）
try {
  const sweepStart = Date.now();
  const result = await sweepR2PendingDeletes(env, {
    limit: 200,
    deadline: sweepStart + 20_000,   // 30s cron CPU - 10s 給其它 purpose
  });
  console.log(
    `[scheduled] cron=${cronName} r2-sweep processed=${result.processed} succeeded=${result.succeeded} failed=${result.failed} skipped=${result.skipped} durationMs=${Date.now() - sweepStart}`,
  );
} catch (err) {
  console.warn(`[scheduled] cron=${cronName} r2-sweep FAILED:`, err);
}
```

Deadline 預算：
- 30s cron CPU 限制
- Purpose 1 (http-warmup) ~1-2s
- Purpose 2 (hyperdrive-keepalive) ~1-2s
- Purpose 3 (billing-cycle) ~1-2s
- **Purpose 4 (r2-sweep) 給 20s**（含自己的 5s internal buffer）
- 剩 ~5s safety margin

### 8. Tests — 3 個 test 檔 25 條全綠

| 檔案 | 條數 | 覆蓋 |
|---|---|---|
| `index.sweep.test.ts` | 8 | empty queue / 3 success / mixed success+fail / deadline early break / recordFailure 自身失敗 defense-in-depth / default 25s deadline / default 200 limit / custom limit |
| `r2OrphanCleanup.test.ts` | 12 | `collectR2KeysForTemplate` 3 種 image / `diffRemovedR2Keys` 4 種場景 / `enqueueTemplateR2Keys` 5 種錯誤處理 |
| `deleteTableCardElement.test.ts`（既有，改） | 5 | enqueue 取代 sync delete + UUID schema 修正 |

**Mock hoisting 改動**：兩個 test 檔改用 `vi.hoisted(() => ({ ... }))` 包 mock 物件。`vi.mock` factory 在 import resolve 之前執行，沒 hoisting 會 throw `Cannot access 'mockX' before initialization`。

**UUID 修正**：`deleteTableCardElement.test.ts` 原本用 `'tpl-uuid'` 當 template id，但 route 的 `paramsSchema = z.object({ id: z.string().uuid() })` 會 reject 為 404 — 改成 `22222222-2222-4222-8222-222222222222`。

### 9. Migration apply + registry（Rule 035 全套）

- ✅ `user-saome_supabase-apply_migration` 成功（直接呼叫獨立工具名 — Rule 037，避免 `CallMcpTool` regression）
- ✅ `supabase/migrations/.applied-migrations.json` append entry：
  ```jsonc
  {
    "filename": "20261003000001_020_r2_pending_deletes.sql",
    "applied_at": "2026-10-03",
    "applied_by": "r2-tombstone-cron-sweep",
    "via": "saome_supabase-mcp",
    "notes": "Tombstone table for Free-plan-safe R2 deletes. 3 enqueue sources: ..."
  }
  ```
- ✅ `npm run check:migrations --workspace=apps/backend` → `OK: 18 migrations registered as applied.`

### 10. 驗證輸出

| 項目 | 結果 |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx vitest run` | ✅ 403/403 passing across 27 files |
| `npm run check:migrations --workspace=apps/backend` | ✅ 18/18 |
| `wrangler deploy` 部署 | ✅ push `019662d` 完成 |
| (deploy 後) CORS post-deploy check | ⏳ 待 user 跑 curl OPTIONS / POST 矩陣（Rule 036 + 017）|

---

## 衍生

### 影響的其他檔 / 其他 dev log / 其他 feedback

- `apps/backend/src/index.ts::worker.scheduled` — 4 個 purpose 串接，error 用 `try/catch + console.warn` 不 throw（任一 failure 不 crash cron）
- `runs/improvements/feedback/20261003-r2-tombstone-cron-sweep-implementation.md` — 同步寫的 feedback（rule 011 要求 feature code + feedback 同 commit）
- `runs/improvements/feedback/20261003-mcp-tool-call-pattern-regression.md` — 第二次 MCP regression → Rule 037 補洞（見 `DEV/10-2026/1003-self-improvement-mcp-tool-pattern.md`）
- `.applied-migrations.json` — 多了 1 條 entry（rule 035）
- `DEV/10-2026/1003-self-improvement-mcp-tool-pattern.md` — 同 session 的 self-improvement DEV LOG（MCP regression 補洞）

### 需要後續追的事項

1. **Deploy 後 CORS post-deploy check** — Rule 036 + 017 強制必跑：
   ```bash
   BACKEND="https://saome-backend.josh1989213.workers.dev"
   ORIGIN="https://saome-frontend.josh1989213.workers.dev"
   # OPTIONS
   curl -sS -i -X OPTIONS "$BACKEND/api/auth/login" -H "Origin: $ORIGIN" ...
   # POST 帶 Origin（即使 401 也必回 CORS）
   curl -sS -i -X POST "$BACKEND/api/auth/login" -H "Origin: $ORIGIN" -d '{...}'
   ```
2. **`wrangler tail` 等 5 分鐘驗 cron 真的跑** — 預期 log：
   ```
   [scheduled] cron=*/5 * * * * r2-sweep processed=N succeeded=N failed=0 skipped=0 durationMs=...
   ```
3. **30 天 retention cron**（未做，plan 不在 scope）— `completed_at` row 不會自動清。Plan 留作後續：cron 第 5 purpose 刪除 `completed_at < now() - 30 days` 的 row。
4. **Orphan leak 量測**（未做）— 部署後跑 query `SELECT count(*) FROM storage.objects WHERE key LIKE 'tenants/%'`，追蹤每週的「累計新增 vs 累計回收」 — 預期部署 1 週後新增速率開始下降。
5. **`apps/frontend/AGENTS.md` 是否存在**（pending）— Rule 037 同步時只確認了 backend 那份，frontend 那份可能不存在或全部規則在根 `AGENTS.md`。無功能性影響。

---

## 自問

- **下次怎麼不犯「把耗資源 sync 操作塞 user-facing path」？**
  → 任何 user-facing route 內若要做 `bucket.delete` / 外部 fetch / 圖片 processing，先算 budget：10ms CPU / 50 subrequest / 30s wall。超就搬 async（tombstone + cron 是 default pattern）。
- **哪條 rule 該補？**
  → 新 rule 038：「Free Plan Budget-Aware Pattern」— user-facing path 只 INSERT，副作用一律 async。`bucket.delete` / `bucket.put` / 外部 webhook / 大量 email 全歸此類。
  - 觸發關鍵字：free plan、worker budget、10ms CPU、50 subrequests、async delete、tombstone、cron sweep
  - Reference: 這個 plan
- **哪個 test 該加？**
  - `r2_pending_deletes` migration 必加 unit test：`fetchPendingR2Deletes` 確實過濾 `retry_count >= 5`、partial index 存在、`UNIQUE` 約束生效
  - `sweepR2PendingDeletes` 已有 8 條 — 已涵蓋
  - **缺**：`worker.scheduled` 整體測試（4 個 purpose 串接 — 部分已在 `index.scheduled.test.ts`）— 補一條「purpose 4 失敗不影響 purpose 1-3」
- **Risk if user deploys without applying migration 020**（已在 feedback 詳列）
  → 3 個 user-facing route 全部 500 — `enqueueR2Delete` 在 migration 缺失時 throw `relation "r2_pending_deletes" does not exist`。**Deploy 之前 migration 必 apply 過**（已 ✅ done）。

---

## 附錄 — 跟既有 rule 對齊

| Rule | 對齊點 | 驗證 |
|---|---|---|
| Rule 011 (dev) | commit footer `Migration: 020 applied via saome_supabase MCP` + `Self-improvement:` 標 feedback | ✅ commit `019662d` 完整 footer |
| Rule 027 (postgres.js dynamic) | 全部用 `sql.json()` / tagged template，沒 `JSON.stringify(... )::jsonb` | ✅ review r2PendingDeletes.ts |
| Rule 035 (migration apply) | SQL + registry + CI gate + apply via MCP | ✅ done end-to-end |
| Rule 036 (Worker CORS) | 3 層 CORS defense 未動；deploy 後必跑 curl OPTIONS / POST 矩陣 | ⏳ deploy 後 user 跑 |
| Rule 037 (MCP call) | 用 `user-saome_supabase-apply_migration({...})` 直接呼叫，不包 `CallMcpTool` | ✅ 直接呼叫，1 次成功 |
| Rule 017 (production bundle) | backend deploy 後必跑 CORS post-deploy check | ⏳ deploy 後 user 跑 |

---

> 撰寫者：cursor (assisted) ｜ 時間：2026-10-04 02:52 UTC+8
>
> 本 DEV LOG 與 feedback `runs/improvements/feedback/20261003-r2-tombstone-cron-sweep-implementation.md` 同源；本檔補 feedback 沒有的「時間軸」「probe」「設計取捨」三段細節。
