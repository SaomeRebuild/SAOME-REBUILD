# Hyperdrive 87% Query 爆炸 — 修復紀錄（Phase 1-4 完工）

## Metadata

- 日期：2026-09-11
- 範圍：Hyperdrive Free plan quota 撞牆（~87k/100k queries/day）的修法落地
- 目標：
  1. 落地 Phase 1（Option 1：刪 `findTenantById` + 改用 `getDbForRequest(c)`）
  2. 加 Phase 2 conformance test（13 條 baseline 鎖定 SQL count）
  3. 部署 Phase 3 structured log middleware（`[sql-count] route=... queries=N status=S`）
  4. Phase 4 設定為 pending（等 24h post-deploy 用 `[sql-count]` 量測實際削減量）
- 對應 feedback：`runs/improvements/feedback/20260911-hyperdrive-query-spike-investigation.md` §11
- Branch：`fix/hyperdrive-query-spike-20260911`
- Commit batch：1 個 commit `69d2528 fix(backend): Hyperdrive 87% query spike — Phase 1-4 fix batch`

## 問題與根因（精簡版）

過去 48h Hyperdrive free plan quota **撞到 87%**（~87,000 / 100,000 queries/day），已經連續 2 天。診斷調查見同日 feedback §0-§10，結論是 **6 個互相疊加的架構性 multiplier**，不是 retry storm 或 race condition。Top 3 offenders：

| Rank | Multiplier | Daily 估算 | 修法 |
|---|---|---|---|
| #1 | 10 個 card routes **冗餘 `findTenantById` lookup**（JWT 已經帶 tenantId，row 從未被讀取）| ~25-40k（29-46%）| 改用 `user.tenantId` 字串比對 |
| #2 | **`getDb()` 沒用既有 `getDbForRequest(c)` memoization** → 每 request 兩個 warmup SELECT 1（middleware + handler）| ~10-15k（11-17%）| 改 helper |
| #3 | Card preview image 同張圖被 **6 個 component 重複 fetch**（每 user 行為）| ~5-10k（6-11%）| Phase 3 structured log 先 expose 量測路徑，Phase 5 再修 |

## 為什麼這次必須做、且必須現在做

- **Quota 已撞 87%**：再 1 天（50% 成長 margin）就會超過 100% free plan，Hyperdrive 會被 throttle 或 upgrade 收費
- **不是 race condition / retry storm**：傳統 retry fix 無效；必須動架構
- **JWT decision 已落地**：`runs/decisions/2026-09-09-jwt-tenant-id-trust.md` 9/9 已經把 `tenantId` 放進 JWT，10 個 card routes 卻沒跟上 — 是「決策已定但 follow-up 漏掉」的典型 debt
- **root cause 是 Option 1，trivial-risk**：純刪掉 + 改 import，沒有邏輯變更；delivery 風險低

## 實作內容

### Phase 1 — Option 1：刪 `findTenantById` + 改 `getDbForRequest(c)`（11 檔變動，+70/-77 lines）

**修改檔案（11 個）：**

```
apps/backend/src/modules/cards/routes/
├── create.ts                  ← getDbForRequest + 刪 findTenantById
├── getById.ts                 ← getDbForRequest + 刪 findTenantById
├── list.ts                    ← getDbForRequest + 刪 findTenantById
├── getLatestDraft.ts          ← getDbForRequest + 刪 findTenantById
├── update.ts                  ← getDbForRequest + 刪 findTenantById
├── touch.ts                   ← getDbForRequest + 刪 findTenantById
├── publish.ts                 ← getDbForRequest + 刪 findTenantById
├── delete.ts                  ← getDbForRequest + 刪 findTenantById
├── getImage.ts                ← getDbForRequest + 刪 findTenantById
└── generate-upload-url.ts     ← getDbForRequest + 刪 findTenantById

apps/backend/src/shared/middleware/auth.ts
└── ← getDbForRequest + AuthenticatedUser interface 加 tenantId?: string

apps/backend/src/shared/db/client.ts
└── ← getDbForRequest() 擴充 parameter type 接受 Hono Context
```

**Owner check pattern 改寫**：

```ts
// ❌ Before（10 個 routes 都在做）
const tenant = await findTenantById(sql, user.tenantId);   // ← 多 1 個 SELECT
if (template.tenant_id !== tenant.id) throw new ForbiddenError();

// ✅ After
if (template.tenant_id !== user.tenantId) throw new ForbiddenError();
// ↑ JWT 已經 trusted（per 2026-09-09 decision），user.tenantId 是可靠來源
```

**`findTenantById` reference count：16 → 5**（1 def + 4 uses: `me.ts` / `refreshService.ts` / `tenants.ts` 內部使用 — 這 3 個地方仍需要 row 所以保留）

### Phase 2 — SQL Count Baseline Tests（13 條新測試）

**2 個新測試檔**：

| 檔案 | 條數 | 用途 |
|---|---|---|
| `apps/backend/src/modules/cards/tests/sql-count-baseline.test.ts` | 8 | 鎖定 8 個 card route handler 各自期望的 SQL 數 |
| `apps/backend/src/modules/auth/tests/sql-count-baseline.test.ts` | 5 | 鎖定 5 個 auth route handler 的 SQL 數 + findTenantById 行為 |

**關鍵 assertion（regression guard）**：

```ts
// 在 card route handler 跑完後斷言：沒有任何 SELECT/UPDATE/INSERT/DELETE FROM tenants
for (const call of sqlCalls) {
  expect(call).not.toMatch(/FROM tenants/i);
  expect(call).not.toMatch(/UPDATE tenants/i);
  expect(call).not.toMatch(/INSERT INTO tenants/i);
  expect(call).not.toMatch(/DELETE FROM tenants/i);
}
```

理由：10 個 card routes 不能再加回 `findTenantById` lookup。任何 refactor 把 tenant SELECT 加回去，**test 立刻 fail**，強制 reviewer 重看此次修法。

**Mock 策略**：用 `vi.mock('@/shared/db/client', ...)` 把 `getDbForRequest` 換成測試用 spy，spy 記錄所有 `sql\`...\`` 呼叫，最後算總數並對每個 token pattern 跑 regex match。

### Phase 3 — Structured Log `[sql-count]` Middleware（3 檔變動）

**新增/修改檔案**：

| 檔案 | 動作 |
|---|---|
| `apps/backend/src/shared/middleware/sqlCount.ts` | NEW — middleware，攔截 response，記錄此 request 跑了幾個 SQL |
| `apps/backend/src/shared/db/client.ts` | MODIFIED — 加 `_queryCounters` WeakMap + `attachQueryCounter` Proxy 包 sql instance |
| `apps/backend/src/index.ts` | MODIFIED — 掛 `sqlCountMiddleware`（在 requestId 之後）|

**核心設計**：

```ts
// shared/db/client.ts
const _queryCounters = new WeakMap<object, number>();

export function getDbForRequest(c: Context): Sql {
  // memoization：同一 request 的 sql instance 是同一個
  const sql = createSqlInstance(...);
  if (!_queryCounters.has(sql)) _queryCounters.set(sql, 0);
  return attachQueryCounter(sql, _queryCounters);
}

// middleware 跑完後再讀 counter
app.use('*', async (c, next) => {
  await next();
  const sql = getDbForRequest(c);
  const queries = _queryCounters.get(sql) ?? 0;
  console.log(`[sql-count] route=${c.req.method} path=${c.req.path} queries=${queries} status=${c.res.status}`);
});
```

**`[sql-count]` 是 Cloudflare Dashboard 可搜尋字串**，24h post-deploy 直接從 Workers & Pages → saome-backend → Logs → 過濾 `[sql-count]` 拿每個 route 的實際 queries。

### Phase 4 — Verification（Pending，等 24h post-deploy）

**完成驗證（本地層）**：

- typecheck: `npx tsc -b --noEmit` exit 0
- tests: 225/225 passed（18 個 test file，比 +13 = 28 是包含 worker pool 跑的所有 test file）
- `findTenantById` grep 在 card routes 中: 16 → **5**（剩 5 是 me.ts / refreshService.ts / tenants.ts / 1 def，這 3 個地方仍合法需要 row）
- `getDb(c.env.HYPERDRIVE)` grep 在 card routes 中: 10 → **0**（全部改 `getDbForRequest(c)`）

**24h post-deploy 驗證（待執行）**：

跑 `npx wrangler tail saome-backend --search "[sql-count]" --format pretty` 30 分鐘，group by route，sum queries 對照 §11.6 SOP：

| 觀察值 | 行動 |
|---|---|
| ~35k/day（60% 削減）| 結案，符合預期 |
| 50-60k/day（40% 削減）| 進 Phase 5（Option 2 image cache / Option 3 cron bypass）|
| > 70k/day | revert，找新 bug |
| 增加 | revert，找新 bug |

## 為什麼不在這次 PR 一起做 Option 2（image in-process cache）

| 考量 | 詳細 |
|---|---|
| **scope 控管** | Phase 1-4 已經是 sufficient scope（預期 ~50% 削減）；再加 Option 2 增加 PR review surface |
| **image cache 需要先有量測** | 我們對「image/logo 同張圖 6 次 fetch」的 live evidence 不足（5min tail window 看到 1 user 行為推到 6x）；Phase 3 structured log deploy 完後 24h 就有真實量測，再決定要不要進 Option 2 |
| **cache key 設計有 risks** | image URL 帶 `v=${issuerLogoVersion}` cache-buster 是刻意設計來「logo 變更立即看到」；in-process cache 必須正確處理「logo upload 觸發 invalidate」鏈，否則使用者更新 logo 看不到新版本，比 quota 問題更 UX 糟糕 |

**所以順序是 Phase 1-4 先 ship 拿到量測 → Phase 5 再依數據決策**。

## 驗證

### TypeScript

```bash
cd apps/backend
npx tsc -b --noEmit   # exit 0
```

### Vitest（含 worker pool）

```bash
cd apps/backend
npm test
# 預期：225 / 225 passed (18 test files)
# 含 13 條新 sql-count-baseline tests
```

### 完工時 grep 驗證

```bash
cd apps/backend

# 確認 10 個 card routes 沒有 findTenantById lookup
grep -rn "findTenantById" src/modules/cards/routes/ 2>&1 || echo "OK: 0 hits"

# 確認 10 個 card routes 沒有人 getDb(c.env.HYPERDRIVE)
grep -rn "getDb(c.env.HYPERDRIVE)" src/modules/cards/routes/ 2>&1 || echo "OK: 0 hits"

# 確認 findTenantById 還在合理的地方（me.ts / refreshService.ts / tenants.ts / 1 def）
grep -rn "findTenantById" src/ | wc -l
# 預期：~5（4 uses + 1 def）
```

### Post-deploy（24h 後再跑，屬 Phase 4 SOP）

```bash
npx wrangler tail saome-backend --search "[sql-count]" --format pretty
# 觀察 30 分鐘，group by route，sum queries
# 或：Workers Dashboard → saome-backend → Logs → filter "[sql-count]"
```

## 後續注意事項（future invariants）

1. **card route 不能再加回 `findTenantById` lookup**（會被 sql-count-baseline test 擋下）
2. **card route 必須用 `getDbForRequest(c)` 不是 `getDb(c.env.HYPERDRIVE)`** — 任何 code review 看到後者直接 reject
3. **不要亂改 `_queryCounters` WeakMap**：這個 counter 是 `[sql-count]` middleware 的 source of truth
4. **Phase 4 verification 必須跑 `wrangler tail --search "[sql-count]"` 拿到實際數字**，不能憑「應該減少」結案
5. **若 Phase 4 顯示削減 < 40%**：進 Phase 5（Option 2 image cache 或 Option 3 cron bypass），不要直接在這層繼續糾結
6. **若未來加新 card route**：必走相同 pattern（getDbForRequest + 不 call findTenantById），且加 sql-count-baseline test 作為 conformance guard

## 為什麼這次 PR 只動 11 個 backend 檔案而不動 frontend / DB schema

| 維度 | 改動 | 理由 |
|---|---|---|
| Backend routes | 11 個檔案 | 主修法 |
| Backend middleware | 1 個（auth.ts 加 tenantId）| JWT trust decision 早就落地，這只是 follow-up |
| Backend db/client.ts | 2 個改動（getDbForRequest type extension + counter WeakMap）| Phase 1 + Phase 3 都需要 |
| Backend middleware/sqlCount.ts | NEW | Phase 3 |
| Backend index.ts | 1 個改動（掛 sqlCountMiddleware）| Phase 3 |
| **共 15 個 backend 檔案變動** | | |
| Frontend | 0 | 完全沒動 — Hyperdrive 是 backend-only issue |
| DB schema | 0 | 完全沒動 — schema 不變，只刪 runtime lookup |
| Cloudflare config | 0 | wrangler.jsonc 不變 |

這個 PR 是純 backend runtime 優化，沒有前端 / DB / config 變更 → **review 表面小、deploy 風險低**。

## 對齊既有 decision / rule

| Reference | 為什麼相關 |
|---|---|
| `runs/decisions/2026-09-09-jwt-tenant-id-trust.md` | 本次 root cause 起源 — 該 decision 9/9 已經說 tenantId 可信，但 10 個 card routes 沒 follow-up；本 PR 是 follow-up |
| `.cursor/rules/000-modular-design.mdc` Part B | backend 三層分層（route/service/db）的延伸 — 這次證明了「route handler 多 call 一個 db function 也是 silent overhead」 |
| `.cursor/rules/030-effect-first-run-not-trustworthy.mdc` | autosave baseline pattern，本批次間接守護 — 沒動它，但避免「前端寫更頻繁」重蹈覆轍 |
| `.cursor/rules/036-worker-runtime-cors-defense.mdc` §9 | 提到的 `scheduled` handler + Hyperdrive warmup cron 跟本批次獨立 — 兩條都是 backend 優化路線 |
| Rule 017 § backend Worker CORS post-deploy check | deploy 後必跑的 curl 矩陣跟本批次無直接關係，但仍該照例跑 |

## Commit 規劃（本 PR 採 1 個 commit 策略）

| Commit | Hash | 內容 |
|---|---|---|
| `fix(backend): Hyperdrive 87% query spike — Phase 1-4 fix batch` | `69d2528` | 11 個 route + 1 middleware + 2 client + 1 index + 2 test file 共 15 個 backend 檔案 |

**為什麼 1 commit**：Phase 1-3 必須同 commit（缺任何一條等於 deploy 半成品，會引發「partial fix 導致 user 端看到不一致行為」）。Phase 4 是 verification gate，不是 code change，獨立於此 commit 之外。

push 完應為：

```
$ git log --oneline origin/main..HEAD
69d2528 fix(backend): Hyperdrive 87% query spike — Phase 1-4 fix batch
```

## 給後續 session（Phase 4 verification session）

未來 session 開頭看到 `[sql-count]` Phase 4 pending 標記，**觸發 SOP**：

1. Deploy 已過 24h？
2. `wrangler tail saome-backend --search "[sql-count]" --format pretty` 跑 30 分鐘
3. Group by route，sum queries 算 daily 等效值
4. 對照 §11.6 SOP 表：
   - ~35k/day（60% 削減）→ 結案，close INDEX entry
   - 50-60k/day → 進 Phase 5，依數據決定 Option 2 image cache 或 Option 3 cron bypass
   - 增減異常 → revert
5. 把 verification 結果寫到本 DEV LOG 末尾 + 更新 INDEX entry + close plan file §11.4 status

## 同 session 的其他 dev log

- `DEV/09-2026/0911-step6-cashback-card-dev-log.md`：Step 6 Cashback Card Logic 完工（第三個 Step 6 sub-module）
- `runs/improvements/feedback/20260911-hyperdrive-query-spike-investigation.md`：本批次的調查報告（已完成 + §11.4 Phase 4 pending，等 deploy）
