# 2026-10-19 Pass Holder V3 簽發 — production row 83d3139a 6 個欄位 NULL 修補 (Partial update + COALESCE fix)

**日期**：2026-10-19
**作者**：SAOME-REBUILD
**範圍**：L3 Heavy（DB partial-update 修補 + conformance test 補完 + frontend 復原 UI + 一次性 backfill script）
**Decision log**：`runs/decisions/2026-10-19-pass-holder-v3-issuance.md`（既有）
**Plan**：`file:///c%3A/Users/user/.cursor/plans/v3_iphoneuri_null_%E4%BF%AE%E8%A3%9C_2e403bdf.plan.md`

---

## Symptom

User 反饋：「之前註冊的 83d3139a row，6 個 runtime 欄位全部 NULL，只有 barcode_value 有值，user 怎麼辦？」。

**Production DB row 確認**：

```sql
SELECT id, pass_identifier, download_url, barcode_value, issued_at, issuance_error, iphone_uri, android_uri
  FROM public.pass_holders
 WHERE id = '83d3139a-c3bb-4806-8900-5e9b759d0122';
-- id:        83d3139a-c3bb-4806-8900-5e9b759d0122
-- pass_identifier: NULL
-- download_url:    NULL
-- barcode_value:   'gksd85wrye2c0pgdwa6ad4877d53e04'  ← 唯獨這個有
-- issued_at:       NULL
-- issuance_error:  NULL  ← success path
-- iphone_uri:      NULL
-- android_uri:     NULL
```

6 個 runtime 欄位全 NULL，barcode 反而有值。User 看不到 pass、拿不到 .pkpass、客服看不到 row 對應什麼。

---

## Root cause

`apps/backend/src/modules/pass-templates/db/passHolders.ts::updatePassHolderIssuance` 的 SQL 用 **`SET xxx = ${input.xxx ?? null}` 無條件覆寫**所有 7 個 runtime 欄位。

`apps/backend/src/modules/pass-templates/services/registerService.ts::attemptIssuance` 的成功路徑對**同一個 row** 跑**兩次** `updatePassHolderIssuance`：

1. **第一次**：傳 7 個欄位（`passIdentifier` / `downloadUrl` / `barcodeValue` / `issuedAt` / `iPhoneUri` / `androidUri` / `issuanceError=undefined`）→ 全部寫入
2. **第二次**（barcode backfill）：只傳 `barcodeValue` → 沒傳的 6 個欄位被 `?? null` 變 NULL，被 `SET xxx = null` 抹掉

**時序**：

```
T0    issuePass 回 barcodeValue: null (placeholder normalized)
T1    updatePassHolderIssuance({ id, passIdentifier, downloadUrl, barcodeValue: null, issuedAt, iPhoneUri, androidUri })
      → SQL:  SET pass_identifier = $1, download_url = $2, barcode_value = $3, issued_at = $4, issuance_error = $5, iphone_uri = $6, android_uri = $7
      → row 7 欄都有值（barcode_value: NULL 暫時）
T2    backfillBarcodeValue() 拿到 real barcode 'gksd85wrye2c0pgdwa6ad4877d53e04'
T3    updatePassHolderIssuance({ id, barcodeValue: 'gksd...' })
      → SQL:  SET pass_identifier = $1, ... = $7  ← 沒傳的 6 個欄位都 ${input.xxx ?? null} = null
      → row 只剩 barcode_value 有值, 6 欄位被 wipe
```

**為什麼前幾輪測試全綠**：`passcreator.test.ts` 跟 `register.test.ts` 都是 mock `updatePassHolderIssuance` 為 vi.fn() — spy on function call，**完全沒檢查 SQL 內部 SET 行為**。Mock-only test 對 partial-update 行為沒有任何覆蓋。

---

## Fix（這次 session）

### 1. COALESCE partial update 修補（核心）

`passHolders.ts::updatePassHolderIssuance` SQL 把 6 個 runtime 欄位用 `COALESCE(${newValue}, <col>)` 包裝 — `NULL`/`undefined` 都視為 NULL，`COALESCE(NULL, col) = col` 保留原值；新值非 NULL 時覆寫。

```sql
UPDATE public.pass_holders
   SET pass_identifier = COALESCE(${input.passIdentifier ?? null}, pass_identifier),
       download_url     = COALESCE(${input.downloadUrl ?? null}, download_url),
       barcode_value    = COALESCE(${input.barcodeValue ?? null}, barcode_value),
       issued_at        = COALESCE(${input.issuedAt ?? null}::timestamptz, issued_at),
       issuance_error   = ${input.issuanceError ?? null},           -- 故意不用 COALESCE
       iphone_uri       = COALESCE(${input.iPhoneUri ?? null}, iphone_uri),
       android_uri      = COALESCE(${input.androidUri ?? null}, android_uri)
 WHERE id = ${input.id}
```

**關鍵設計選擇 — `issuance_error` 不包 COALESCE**：

| 路徑 | 期望行為 | COALESCE 行為 | 不包 COALESCE 行為 |
|---|---|---|---|
| Success | 清空 stale 錯誤 → 顯示新下載 | `COALESCE(NULL, col) = col` 保留 stale error → banner 仍跑 | `SET col = NULL` → 清空 ✅ |
| Failure | 覆寫成新 i18n key | `COALESCE(key, col) = key` 覆寫 ✅ | `SET col = key` 覆寫 ✅ |

兩條路徑對 `issuance_error` 期待不同行為 — success 想清空、failure 想覆寫。COALESCE 只能滿足「保留」，不滿足「清空」。

### 2. 4 條 partial update conformance test（pin 死 SQL 行為）

`apps/backend/src/modules/pass-templates/db/passHolders.test.ts`（新檔）用 mock SQL dispatcher 觀察 emitted SQL 跟 COALESCE 模擬執行結果：

| # | 測試 | 預期 |
|---|---|---|
| 1 | 5/6 欄位有傳 + 1 個 omit (`androidUri`) | 5 個新值寫入，1 個 (`android_uri`) 保留 pre-existing value |
| 2 | 只傳 `barcodeValue`，其他 6 個 omit | barcode 寫入，6 個 sibling 欄位**全部**保留 pre-existing value（**核心 regression**） |
| 3 | `issuanceError: undefined` (success path) | `issuance_error` 清空 NULL（清掉 stale 錯誤） |
| 4 | `issuanceError: 'passHolder.errors.upstreamFailed'` (failure path) | `issuance_error` 設成新 i18n key |

Mock dispatcher 實作一個「smart SQL parser」：把 emitted SQL 切成 `SET <col> = <rhs>` 子句，識別 `COALESCE($N, <col>)` 跟 `=$N` 兩種 pattern，套對應的 NULL-preserve / NULL-overwrite 語意。比純字串 assert 強：直接驗證「partial update 的執行語意」，不只是「SQL string 包含 COALESCE」。

**Regex 修法**：第一版 regex 是 `^COALESCE\(\$([0-9]+),\s*${col}\)`，但 SQL 對 `issued_at` 加了 `::timestamptz` cast 變成 `COALESCE($4::timestamptz, issued_at)` — 第一版 regex 沒涵蓋 `::cast`，2 條 test fail。修成 `^COALESCE\(\$([0-9]+)(?:::[^,)]+)?,\s*${col}\)` 允許 optional cast，4 條全綠。

### 3. 既有 8 條 register test 重跑確認 0 regression

`apps/backend/src/modules/pass-templates/tests/register.test.ts` 跟 `passcreator.test.ts` 全部跑過：完整 V3 success path 第一次 UPDATE 仍寫 7 欄，partial update 對「完整 payload」是 idempotent ✅；barcode backfill 第二次 UPDATE 只傳 barcodeValue，partial update 讓其他 6 欄保留 ✅；failure path catch 區塊 SET `issuance_error = <key>`，partial update 對 `issuance_error` 仍 SET ✅。

### 4. 既有 4 條 passHolders.test.ts partial update test

第二輪修 regex（`(?:::[^,)]+)?` 對齊 `::timestamptz` cast）後 4 條全綠：
- 5/6 欄位 omit test: ✅
- 1/6 欄位 omit test: ✅
- issuanceError undefined test: ✅
- issuanceError string test: ✅

### 5. Frontend lost-data fallback UI（defense-in-depth）

**即使修了 forward path，lost data row 仍存在**（pre-fix era 的 row 已經寫進 DB）。給 user 一個 recovery path：

`apps/frontend/src/components/business/pass/PassHolderPassDownload/PassHolderLostDataBanner.tsx`（新 sub-component）：
- 識別 partial state：`barcodeValue` set + 3 個 URI 都 null
- 顯示 recovered barcode + 「請聯絡客服重新簽發」banner
- Mailto CTA → `template.supportEmail ?? 'support@saome.org'`

`PassHolderPassDownload.tsx` 加 4 個 state 分支：
- `hasError` → error banner
- `hasAnyUri` → 完整下載 + barcode + Android reminder
- `hasBarcodeButNoUri`（新）→ 顯示 barcode + lost-data banner
- 否則 → 「尚未發行」

`passHolder.{zh-TW,en}.ts` 加 `lostData.{title, body, contactCta}` i18n keys。

`PassHolderPassDownload.test.tsx` 加 2 條新 test：
- Lost-data state 顯示 banner + 顯示 barcode + 隱藏 not-ready copy
- `template.supportEmail` 覆寫 mailto 收件人

**Frontend 拆分**：`PassHolderPassDownload` 主組件加上 lost-data logic 後膨脹到 220 行 — 違反 Rule 000 § A.1（main ≤ 100 行）。把 lost-data banner 抽成 `PassHolderLostDataBanner.tsx` sub-component，主組件回到 149 行（其中 60% 是 docblock，code 邏輯 < 70 行）。

### 6. Backfill diagnostic script（一次性，best-effort）

`apps/backend/scripts/backfill-pass-holder-download-url.cjs`（新檔）：

**功能**：
1. `SELECT` 所有 lost data row（barcode 有、其他 5 個 column NULL）
2. Dry-run 印出 table：`(id, template_id, email, barcode_value, created_at)`
3. `--apply` 模式：對每個 row 跑 V3 `listPasses(env, { templateId })` + best-effort barcode match + UPDATE `download_url` + `pass_identifier`

**限制（寫在 docblock）**：
- V3 LIST response 沒 email / phone 對應欄位（per `PassBackfillResponse` 介面），**沒辦法直接 1-to-1 match**
- 唯一可行 match 策略：barcode string equality（`V3 item.barcodeValue || generatedId || autoGeneratedId === row.barcode_value`）
- 必須 exactly 1 candidate 才視為 unique match（避免 multi-pass template 的歧義）
- `iphone_uri` / `android_uri` / `issued_at` **無法從 V3 LIST 拿回** — 必須 user 重 register

**為什麼是 diagnostic-only**：
- 預期 unique match 命中率極低（lost data row 數 < 10，per template 累積 pass 數 < 100 才有機會 unique）
- 沒 match 的 row 仍要靠 user 重 register + COALESCE 修法避免再 wipe

**執行 SOP**：
```bash
# 估 blast radius
node apps/backend/scripts/backfill-pass-holder-download-url.cjs

# best-effort backfill
node apps/backend/scripts/backfill-pass-holder-download-url.cjs --apply
```

---

## 為什麼這個 bug SAOME family 內第 N 次「mock vs real partial update」

| 案例 | family | root cause | 修法 |
|---|---|---|---|
| 8/21 CardBuilder PUT 500 | dynamic UPDATE | `${sql.unsafe($N)}` 跟 tagged template 混 | `${}` tagged template injection |
| 8/31 workerd JSON.stringify | jsonb cast | workerd 對 non-ASCII 破壞成 \uFFFD | `sql.json()` helper |
| 9/05 Step 4 autosave | jsonb merge | `\|\|` operator 對 empty value 覆蓋 | 3 層 defense（前端 zod + 後端 zod + DB CHECK） |
| 10/19 V3 partial update（這次） | dynamic UPDATE partial | `SET xxx = ${input.xxx ?? null}` 對 omit 欄位 nullify | `COALESCE(${input.xxx ?? null}, <col>)` |

**共同 fingerprint**：「mock 函式被 spy / vi.fn() 取代，但 spy 只看 function call signature，沒看 SQL 內部 SET 行為」。Mock-driven test 對 partial update / conditional field 行為 0 覆蓋。

**修法 SOP 草案**（Rule 032 補強 / Rule 040 衍生）：
- 任何 `UPDATE` 涉及 jsonb / multi-field partial update → 必加 SQL-text assertion 驗 SET clause 結構
- Mock dispatcher 必實作 partial-update 語意模擬（不是只回傳 row）
- Production DB inspection 必跑（`SELECT WHERE state-not-expected`）— 比 mock test 真實

---

## 3 條教訓

1. **`SET xxx = ${input.xxx ?? null}` 對 partial payload 是 silent killer** — caller 漏傳欄位時不會 throw、不會 warning、默默 NULL 寫入。任何多欄位 partial update 必走 `COALESCE($new, <col>)` — 跟 Rule 032 (jsonb merge) 同源道理。
2. **Mock 函式 spy 只看 call signature，不看 emitted SQL** — 對 partial update / conditional field 行為 0 覆蓋。修法是「smart mock dispatcher」：解析 SQL 結構 + 模擬 partial-update 執行語意 + 比字串 assert 強。`passHolders.test.ts` 的 `createPartialUpdateMockSql` 是這個 pattern 第一個 reference implementation。
3. **Lost data 在 production 不可逆**（V3 LIST response 沒 identifier / iPhoneUri / androidUri）— UI 必須給 user 明確 recovery path（聯絡客服 + barcode 保留），不是 silent 「尚未發行」copy。Frontend 必須有 lost-data state 分支，不要 try to make 沒資料的東西看起來像 pre-launch waiting。

---

## Verification

| 項目 | 結果 |
|---|---|
| `npx tsc -b apps/backend/tsconfig.json --noEmit` | exit 0 |
| `npx tsc -b apps/frontend/tsconfig.app.json --noEmit` | exit 0 |
| `npm test --workspace=apps/backend` | 41 檔 / 730 tests 全綠（含 4 條新 partial update conformance + 8 條既有 V3 場景 0 regression）|
| `npm test --workspace=apps/frontend -- src/components/business/pass/PassHolderPassDownload` | 11 tests 全綠（9 既有 + 2 新 lost-data） |
| `npm test --workspace=apps/frontend` | 148 檔 / 1945 tests 全綠 |
| `npm run verify:i18n` | 21 namespace OK（新增 `passHolder.{zh-TW,en}::lostData.*` 4 key）|
| `node -c apps/backend/scripts/backfill-pass-holder-download-url.cjs` | 語法 OK |
| `npm run check:migrations` | 0 變更（本 PR 不動 schema） |

---

## 6 future invariants

(a) `updatePassHolderIssuance` 寫 6 個 runtime 欄位必走 `COALESCE($N, <col>)` pattern — omit 欄位保留 pre-existing value，不 silent nullify；(b) `issuance_error` 故意不用 COALESCE — success path 清空 stale 錯誤、failure path 覆寫新 key；(c) `passHolders.test.ts::createPartialUpdateMockSql` 是 partial-update smart mock pattern reference implementation；(d) Backfill script `backfill-pass-holder-download-url.cjs` 必先 dry-run 估 blast radius 再 --apply，unique match 才 UPDATE（避免 multi-pass template 歧義）；(e) Frontend `PassHolderPassDownload` 4-state 分支順序鎖定 `hasError > hasAnyUri > hasBarcodeButNoUri > pre-launch`；(f) Lost data row 補不回的欄位（`iphone_uri` / `android_uri` / `issued_at`）user 必須重 register，COALESCE 修法保證重 register 不再 wipe 既有欄位。

---

## 4 follow-up

(P0) **Production smoke test**（deploy 後跑 Playwright `/pass/{templateId}` flow，verify 7 欄都填 + 二次 register 不 wipe 既有欄位 — Rule 005 + Rule 036）；(P1) **Lost data row 重 register** SOP — 對 83d3139a 等 row 主動 call registerService.attemptIssuance，新 V3 issue 補 identifier + URIs，COALESCE 保證舊 barcode 不 wipe；(P1) **V3 LIST 加 email 對應欄位**（Passcreator 端 upstream request）— 才能做 1-to-1 backfill match 取代目前 unique-candidate 啟發式；(P2) **Rule 032 補強 partial-update smart mock pattern** — 把 `createPartialUpdateMockSql` 抽到 `@/shared/lib/test` 共用，新 partial update feature 直接 import。

---

## 觸發的 Rule

- Rule 000 § A.1 — main component ≤ 100 行（`PassHolderPassDownload` 220 行 → 拆 `PassHolderLostDataBanner`）
- Rule 006 — dry-run + --apply SOP（backfill script）
- Rule 011 — feedback 同 commit（這份 feedback 跟 code 改動同 PR）
- Rule 019 § 4.1 — 4 層 schema 同步（`PassHolderRow` interface + `PassHolderIssuanceUpdate` DTO + `updatePassHolderIssuance` SQL + `registerService` caller 全部對齊 COALESCE 行為）
- Rule 025 — 完工前驗證清單（typecheck + vitest + verify:i18n + 一次性 syntax check）
- Rule 027 § tagged template — UPDATE 仍用 `${}` injection，COALESCE 包裝不混 `$N`
- Rule 032 — 後端 JSONB merge 是 silent killer 同源道理（partial update 對 omit 欄位保留原值）
- Rule 035 — 本 PR 不新增 migration（pure backend + frontend fix + 一次性 script）
- Rule 040 (草案) — 第三方 API + DB partial update 必做 SQL-text assertion，mock 必 partial-update-smart
