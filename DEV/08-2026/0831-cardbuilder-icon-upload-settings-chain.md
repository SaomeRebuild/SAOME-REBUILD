# CardBuilder Icon Upload — Settings 寫入鏈 4 階段修復 Master DEV LOG (2026-08-31)

## Metadata

- **日期**：2026-08-31
- **作者**：Cursor Agent + Josh
- **觸發任務**：`fix_cardbuilder_data_loss_+_icon_preview_6eb27ab7.plan.md` + 後續 Bug #8 / #8.5 / workerd JSON.stringify
- **規則 / skill 觸發**：`019-schema-contract-drift.mdc`、`027-postgres-dynamic-query-pattern.mdc`、`028-image-uploader-pattern.mdc`、`saome-image-upload` SKILL、`saome-task-router`（L2 → L3 Heavy）
- **單一入口**：本 DEV LOG 給未來追整條鏈的人 single source of truth。具體每階段細節看對應 doc。

## TL;DR

| 階段 | Bug | 症狀 | 根因 | 修法 | 對應 doc |
|---|---|---|---|---|---|
| 1 | **Bug A** | Step 3 上傳 logo/icon 後 Step 2 欄位被洗掉 | SQL `settings = $1::jsonb` REPLACE 整個 JSONB | `settings = settings \|\| $1::jsonb` MERGE | [DEV/08-2026/0831-cardbuilder-data-loss-icon-preview-fix.md](./0831-cardbuilder-data-loss-icon-preview-fix.md) |
| 2 | **Bug #8** | 修 Bug A 後 array LHS 繼續膨脹（既有 DB 已 corrupted）| 既有 rows 已經是 array 形態（Bug A 時代殘留）| `updateTemplate` 加 CASE WHEN `jsonb_typeof` 防禦 unwrap | [DEV/08-2026/0831-bug-8-defensive-unwrap.md](./0831-bug-8-defensive-unwrap.md) |
| 3 | **Bug #8.5** | 修 Bug #8 後 array 內 string element 仍 re-corrupt | array tail 是 jsonb string（legacy `JSON.stringify(obj)` 進 array），naive `settings -> -1` 取到 string，後續 `string \|\| object` re-corrupt | nested CASE WHEN 對 array tail 做 string/object 分流 | [runs/improvements/feedback/20260831-bug-8.5-defensive-unwrap-complete.md](../../runs/improvements/feedback/20260831-bug-8.5-defensive-unwrap-complete.md) |
| 4 | **workerd JSON.stringify 500** | **中文 settings 的 PUT 500**（前 3 階段 ASCII 測試全過）| workerd runtime `JSON.stringify` 對 non-ASCII 字串破壞成 `\uFFFD`；`${JSON.stringify(x)}::jsonb` cast 後 trigger raise "got array" | `${sql.json(x)}` 取代 `${JSON.stringify(x)}::jsonb` | [runs/improvements/feedback/20260831-workerd-json-stringify-jsonb-pitfall.md](../../runs/improvements/feedback/20260831-workerd-json-stringify-jsonb-pitfall.md) |

**核心洞察**：4 階段都是 `templates.settings` JSONB column 的「寫入路徑」bug。第 1-3 階段是 SQL 邏輯錯（REPLACE / 沒防禦 / 沒處理 string element），第 4 階段是 **runtime 字串編碼錯**（workerd 對 non-ASCII 的破壞）— 兩個獨立的 bug chain 但收斂在同一個 PUT endpoint。

## 完整時間軸

### 階段 0 — 起始狀況

`updateTemplate` 原始碼（Bugs 出發點）：

```typescript
// apps/backend/src/modules/cards/db/templates.ts (原始)
const setSettings = input.settings !== undefined
  ? sql`settings = ${JSON.stringify(input.settings)}::jsonb`  // ← Bug A 根
  : null;
```

`insertTemplate` 對應位置（當時也是同樣 pattern）：

```typescript
${JSON.stringify(settingsToInsert)}::jsonb  // ← 跟 update 一樣壞
```

### 階段 1 — Bug A：REPLACE → MERGE（2026-08-31 morning）

詳見 [DEV/08-2026/0831-cardbuilder-data-loss-icon-preview-fix.md](./0831-cardbuilder-data-loss-icon-preview-fix.md)

**症狀**：
- Step 2 填了 storeName / issuerName
- Step 3 上傳 logo → `cardService.update(id, { settings: { ...safeSettings, issuerLogo: key } })`
- DB 的 settings 變成只含 `{ storeName, issuerName, issuerLogo }`（其他欄位被洗掉）

**根因**：
```sql
settings = $1::jsonb  -- REPLACE 整個 JSONB
```
前端只送要更新的欄位（logo），後端 SQL 用 `=` 直接覆蓋整個 settings JSONB。

**修法**：
```typescript
settings = settings || ${JSON.stringify(input.settings)}::jsonb
// ↑ 改成 PostgreSQL JSONB merge（|| 運算子）
```

**為什麼後端修而非前端 spread**：

| 方案 | 修改點 | Race condition | 涵蓋未來 step |
|---|---|---|---|
| 後端 MERGE（採用）| 1 行 SQL | 無 | 自動受惠 |
| 前端 spread | 改 handleNext 多送欄位 | TOCTOU race | 每個新 step 都要帶所有既有欄位 |

### 階段 2 — Bug #8：Defensive Unwrap（2026-08-31 mid）

詳見 [DEV/08-2026/0831-bug-8-defensive-unwrap.md](./0831-bug-8-defensive-unwrap.md)

**症狀**：
- Bug A 修了之後，仍然有使用者 PUT 500
- Migration 010 跑了清 corrupted rows，但使用者做新 PUT 又壞掉

**根因**：
- Bug A 時代（`settings = $1::jsonb` REPLACE）已經把部分使用者的 settings 弄成 `jsonb array of partial JSON strings`
- Migration 010 只清**既有** corrupted rows，但 `updateTemplate` 仍用 `settings || ...`，對 corrupted array LHS 會「繼續 append」，永遠壞掉
- **Defensive unwrap 缺失**：沒處理 LHS 不是 object 的 case

**修法**：

```sql
settings = CASE jsonb_typeof(settings)
              WHEN 'object' THEN settings
              WHEN 'array'  THEN settings -> -1   -- ← 暫時簡化版
              WHEN 'string' THEN (settings #>> '{}')::jsonb
              ELSE settings
            END || ${JSON.stringify(input.settings)}::jsonb
```

每個 branch 對應 LHS 形態：
- `object`：正常，passthrough
- `array`：取最後一個 element（最 recent saved state）
- `string`：legacy corruption，用 `#>> '{}'` 取出 string 再 cast jsonb
- else：fallback

**Tests**：新增 3 個 regression test，但都只 assert SQL **字串包含**特定 keywords，**沒驗證 runtime 行為**：

```typescript
// ❌ 測 SQL 關鍵字，不是測行為
expect(setClause).toMatch(/WHEN 'array'/);
expect(setClause).toMatch(/settings -> -1/);
```

### 階段 3 — Bug #8.5：Nested CASE WHEN（2026-08-31 afternoon）

詳見 [runs/improvements/feedback/20260831-bug-8.5-defensive-unwrap-complete.md](../../runs/improvements/feedback/20260831-bug-8.5-defensive-unwrap-complete.md)

**症狀**：
- 修 Bug #8 後，仍然有部分使用者 PUT 500
- DB 內的 array tail 不是 object 而是 jsonb string（legacy 把 `JSON.stringify(obj)` 整個塞進 array）

**根因**：
- 階段 2 的 `WHEN 'array' THEN settings -> -1` 沒檢查 `settings -> -1` 是什麼型別
- Legacy corruption 把 `JSON.stringify(obj)` 整個存進 array，所以 `settings -> -1` 是 **jsonb string**，不是 object
- 後續 `string || object` 落入 PostgreSQL JSONB concat 的 "All other cases" rule → 變成 text array → re-corrupt

**修法**：

```sql
WHEN 'array' THEN (
  CASE jsonb_typeof(settings -> -1)
    WHEN 'string' THEN ((settings -> -1) #>> '{}')::jsonb
    WHEN 'object' THEN (settings -> -1)
    ELSE '{}'::jsonb
  END
)
```

`settings -> -1` 後**再次**檢查型別，巢狀 CASE WHEN。

**Phase 2 Defense in Depth**（同一份 doc）：
- `unwrapCardSettings()` helper 抽到 `CardBuilderEditor.store.ts`（frontend）
- `cardService.toDto()` 加 inline `unwrapCardSettings`（backend）
- 2 個地方都做相同 defensive parsing

**Tests 補強**：4 個 frontend test + 2 個 backend test，這次**測行為**（parse 後的 object 對不對），不是測 SQL 關鍵字。

### 階段 4 — workerd JSON.stringify 500（2026-08-31 evening）

詳見 [runs/improvements/feedback/20260831-workerd-json-stringify-jsonb-pitfall.md](../../runs/improvements/feedback/20260831-workerd-json-stringify-jsonb-pitfall.md)

**症狀**：
- 修 Bug #8.5 後，**純英文字串的 settings 終於 PUT 200**
- 但**包含中文**（storeName="哈"）的 settings 仍然 PUT 500
- 完整錯誤鏈：
  ```
  Frontend PUT /api/cards/:id { settings: { storeName: "哈", iconImage: key } }
   → backend updateTemplate
   → SQL: settings = settings || '{"storeName":"\uFFFD\uFFFD","iconImage":"..."}'::jsonb
   → trigger: Bug #8.5 guard: templates.settings must be a jsonb object, got array
   → response: 500
  ```

**根因**：
- `updateTemplate` 從 Bug A 開始到現在都用 `${JSON.stringify(input.settings)}::jsonb`
- 在 **workerd runtime**（wrangler dev / Cloudflare Workers），`JSON.stringify` 對 non-ASCII 字串破壞成 `\uFFFD`
- 為什麼**之前測試都沒抓到**：
  - Node.js / Vite dev runtime：V8 `JSON.stringify` 正常，typecheck / lint 過
  - vitest 用 `@cloudflare/vitest-pool-workers` 跑 workerd pool，**理論上會抓**，但測試都用 ASCII 字串
  - 直接 Supabase MCP 跑 SQL：繞過 backend，SQL 邏輯本身正確
  - 只有「前端 → wrangler dev 後端 → Supabase」完整鏈才有這個 bug

**修法**：

```typescript
// apps/backend/src/modules/cards/db/templates.ts line 232
// BEFORE
END || ${JSON.stringify(input.settings)}::jsonb

// AFTER
END || ${sql.json(input.settings as any)}
```

`sql.json()` 是 postgres.js 原生 helper，直接把 JS 值編碼成 jsonb parameter，繞過 JS-side `JSON.stringify` 路徑。`insertTemplate` 從來都用 `sql.json()`，這次只是把 UPDATE 對齊 INSERT。

**Evidence chain**：
```
Route log: storeName char codes: 54c8   ← 原始 char code 正確 (U+54C8 = 哈)
UTF-8 bytes:        e5 93 88             ← 正確 UTF-8 編碼
直接 Supabase MCP SQL 測試: 通過          ← SQL 邏輯正常
workerd JSON.stringify: 哈 → \uFFFD\uFFFD ← 唯一可疑點
```

**Verification**：
- PUT 200 OK（之前 500）
- `jsonb_typeof(settings) = 'object'` 保持 object
- `settings->>'storeName' = '哈'`
- `convert_to(storeName, 'UTF8') = \xe5\x93\x88`（正確 UTF-8 bytes）
- trigger 仍有效（手動 `UPDATE ... settings = '[]'::jsonb` 仍然 raise）

## 最終修復細節（templates.ts 完整最終形態）

```typescript
// apps/backend/src/modules/cards/db/templates.ts line 232 area
const setSettings = input.settings !== undefined
  ? sql`settings = CASE jsonb_typeof(settings)
              WHEN 'object' THEN settings
              WHEN 'array'  THEN (
                CASE jsonb_typeof(settings -> -1)
                  WHEN 'string' THEN ((settings -> -1) #>> '{}')::jsonb
                  WHEN 'object' THEN (settings -> -1)
                  ELSE '{}'::jsonb
                END
              )
              WHEN 'string' THEN (settings #>> '{}')::jsonb
              ELSE settings
            END || ${sql.json(input.settings as any)}`
  : null;
```

四階段的累積成果：
- **階段 1 MERGE**：`||` 而非 `=`
- **階段 2 防禦 unwrap**：外層 CASE WHEN 對 LHS 做 type check
- **階段 3 巢狀 unwrap**：array branch 對 `settings -> -1` 再做 type check
- **階段 4 workerd fix**：右運算元用 `sql.json()` 而非手動 stringify

## Migration 配套

詳見 `supabase/migrations/20260831000001` ~ `20260831000005`：

| Migration | 角色 | Status |
|---|---|---|
| 010 fix_all_corrupted_settings_arrays | backfill corrupted array | 待 apply |
| 011 fix_all_settings_strings_to_objects | backfill corrupted string | 待 apply |
| 012 merge_all_array_elements | backfill array elements merge | 待 apply |
| 013 trigger_reject_non_object_settings | trigger 守護 | 待 apply |
| 014 reapply_merge_with_iconImage | 補回誤刪的 iconImage | 待 apply |

**Apply status**: BLOCKED on `saome_supabase` MCP unavailable。

**Application 端修好後，trigger 守護仍有效**：手動 `UPDATE ... settings = '[]'::jsonb` 仍然 raise。但 application 端的 `sql.json()` 路徑永遠送 object，trigger 不會誤傷。

## Rule / SKILL Sedimentation

從這 4 階段學到的新 pattern 沉澱：

| 新規範 | 對應文件 | 變更 |
|---|---|---|
| **workerd `JSON.stringify` pitfall** | `.cursor/rules/027-postgres-dynamic-query-pattern.mdc` | 新增「§ workerd JSON.stringify pitfall」章節 |
| **settings merge 必須用 `sql.json()`** | `.cursor/rules/028-image-uploader-pattern.mdc` § 2 | 加 workerd pitfall 註腳 + 禁止清單 |
| **uploader Step 7 範例** | `.cursor/skills/saome-image-upload/SKILL.md` | 改用 `sql.json(x)` 範例 |

既有規範**沒變動**但已被驗證仍有效：
- `.cursor/rules/019-schema-contract-drift.mdc` 4-layer binding（iconImage 走完整 4 層）
- `.cursor/rules/028-image-uploader-pattern.mdc` § 11/12（mask / stage invariants）
- `.cursor/rules/frontend/024-mobile-future-proof.mdc` Hook Split Pattern（useImageCrop 三檔）

## Self-improvement

### 衍生的 pending action

- [ ] **補 non-ASCII round-trip test** — `updateTemplate.non-ascii.test.ts`（見 feedback § Test Coverage Status），next PR 必做
- [ ] **Apply Migration 010-014** — 等 MCP reconnect 後依序 apply
- [ ] **Production smoke test** — 完整 CardBuilder Step 2 → Step 3 中文設定 + icon upload 真實瀏覽器測試
- [ ] **`unwrapCardSettings` 抽 shared** — backend `cardService.ts` 跟 frontend `CardBuilderEditor.store.ts` 都各自 inline → 應該搬進 `packages/shared/logic/cardSettings.ts`（backend + frontend + 未來 RN 共用）

### Cross-cutting pattern（給未來類似 bug 參考）

**4 個階段共同根因**：`templates.settings` 是 jsonb column，PUT 路徑的 SQL 注入風險高。

**為什麼花 4 階段才修完**：
1. **階段 1** 修 SQL 邏輯（REPLACE → MERGE）— 最淺層
2. **階段 2** 修 defensive parsing（LHS 不是 object 的 case）— 處理既有 corruption
3. **階段 3** 修 nested parsing（array 內 string element）— legacy 雙層 corruption
4. **階段 4** 修 runtime 字串破壞（workerd JSON.stringify）— 完全獨立維度的 bug

每一階段修完都「以為全好了」，下一階段又冒出新症狀。**根本原因**：
- 測試**只測 ASCII**（typecheck / lint / vitest 都沒抓）
- 沒用真實 wrangler dev 環境做 round-trip integration test
- 沒把「wrangler dev + 非 ASCII 字串」當 CI check

**Future prevention**：
- CI 加 `npx wrangler dev` 跑 fixture 端到端測試（用中文 fixture data）
- `updateTemplate` 測試必須含 non-ASCII case（中文 / 日文 / emoji）
- workerd runtime 跟 Node.js runtime 的字串行為差異要在 DEV LOG 中記錄並 link 到 rule

## References

### DEV LOG / Feedback

- [DEV/08-2026/0831-cardbuilder-data-loss-icon-preview-fix.md](./0831-cardbuilder-data-loss-icon-preview-fix.md) — Bug A
- [DEV/08-2026/0831-bug-8-defensive-unwrap.md](./0831-bug-8-defensive-unwrap.md) — Bug #8
- [DEV/08-2026/0831-icon-uploader-implementation.md](./0831-icon-uploader-implementation.md) — IconUploader 實作
- [runs/improvements/feedback/20260830-icon-preview-investigation.md](../../runs/improvements/feedback/20260830-icon-preview-investigation.md) — Phase 2 investigation
- [runs/improvements/feedback/20260831-bug-8.5-defensive-unwrap-complete.md](../../runs/improvements/feedback/20260831-bug-8.5-defensive-unwrap-complete.md) — Bug #8.5
- [runs/improvements/feedback/20260831-workerd-json-stringify-jsonb-pitfall.md](../../runs/improvements/feedback/20260831-workerd-json-stringify-jsonb-pitfall.md) — Bug workerd JSON.stringify（本鏈最終階段）

### Plan / Spec

- `c:\Users\user\.cursor\plans\fix_cardbuilder_data_loss_+_icon_preview_6eb27ab7.plan.md` — 觸發任務 plan
- `c:\Users\user\.cursor\plans\bug_8.5_defensive_unwrap_complete_4dac6384.plan.md` — Bug #8.5 plan

### Source Code

- `apps/backend/src/modules/cards/db/templates.ts` line 232 — `setSettings` 最終形態
- `apps/backend/src/modules/cards/db/templates.ts` line 90 — `insertTemplate`（從來都用 `sql.json()`）
- `apps/backend/src/modules/cards/tests/updateTemplate.merge.test.ts` — 9 個 case（ASCII-only）
- `apps/backend/src/modules/cards/tests/schema-conformance.test.ts` — 5 個 case（4-layer sync）

### Rule / Skill

- `.cursor/rules/019-schema-contract-drift.mdc` — 4-layer binding
- `.cursor/rules/027-postgres-dynamic-query-pattern.mdc` — postgres.js pattern（**本 session 新增 workerd JSON.stringify 章節**）
- `.cursor/rules/028-image-uploader-pattern.mdc` — image uploader pattern（**本 session § 2 補 workerd pitfall 註腳**）
- `.cursor/skills/saome-image-upload/SKILL.md` — uploader SOP（**本 session Step 7 改用 `sql.json()` 範例**）

### Migrations

- `supabase/migrations/20260831000001_010_fix_all_corrupted_settings_arrays.sql`
- `supabase/migrations/20260831000002_011_fix_all_settings_strings_to_objects.sql`
- `supabase/migrations/20260831000003_012_merge_all_array_elements.sql`
- `supabase/migrations/20260831000004_013_recover_iconImage_for_card_2ca4b46c.sql`
- `supabase/migrations/20260831000004_013_trigger_reject_non_object_settings.sql`
- `supabase/migrations/20260831000005_014_reapply_merge_with_iconImage.sql`

---

> 撰寫者：Cursor Agent + Josh ｜ 時間：2026-08-31
