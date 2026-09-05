---
date: 2026-09-06
type: data-migration
title: Step 5 Passcreator API alignment — backfill notificationRadius → locationsMaxDistance
refs: supabase/migrations/20260906000001_017_rename_notificationRadius_to_locationsMaxDistance.sql
related_rules:
  - 035-migration-apply-pipeline
  - 019-schema-contract-drift
  - 027-postgres-dynamic-query-pattern
---

# Step 5 Passcreator API alignment — data backfill (Migration 017)

## 背景

SAOME 卡片 builder 的 Step 5（CardLocation）refactor 從 `notificationRadius`
單一距離欄位，擴展為 Passcreator API 對齊的多欄位 schema：

| 舊 API key | 新 API key | 類型 | 說明 |
|---|---|---|---|
| `notificationRadius` | `locationsMaxDistance` | number | 距離門檻（m） |
| （不存在） | `locationsDisabled` | boolean | 整個 location 功能開關，default false |
| （不存在） | `locations[].relevantText` | string \| null | 每個地點的客製化提示文字 |

Schema / backend request / store / UI 改動在 2026-09-06 之前已分批合入
（見 `git log -- packages/shared/schemas/card.ts`）。

但是 — DB 內 34 筆既有 template 的 `settings` JSONB 還是舊 shape。
若不在 migration 把 DB 對齊新 schema，下次使用者打開 Step 5 時 store 會讀到
舊 key、無對應 UI；下次使用者編輯後 PUT 出去，後端 `||` merge 又會把
`notificationRadius` 寫回 settings（silent drift）。

## 解法

`20260906000001_017_rename_notificationRadius_to_locationsMaxDistance.sql`
跑三個 idempotent UPDATE：

```sql
-- (1) rename 舊 key
UPDATE templates SET settings =
  (settings - 'notificationRadius')
  || jsonb_build_object('locationsMaxDistance', (settings->>'notificationRadius')::int)
WHERE settings ? 'notificationRadius';

-- (2) inject default for new key
UPDATE templates SET settings =
  settings || '{"locationsDisabled": false}'::jsonb
WHERE NOT (settings ? 'locationsDisabled');

-- (3) backfill per-location field
UPDATE templates SET settings = jsonb_set(
  settings, '{locations}',
  (SELECT COALESCE(jsonb_agg(loc || jsonb_build_object('relevantText', loc->'relevantText')), '[]'::jsonb)
     FROM jsonb_array_elements(settings->'locations') AS loc),
  true
)
WHERE jsonb_typeof(settings->'locations') = 'array'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(settings->'locations') AS elem
              WHERE NOT (elem ? 'relevantText'));
```

**每個 UPDATE 都有 WHERE guard**，重跑是 no-op。

## Apply 結果（rule 035 pipeline）

| 階段 | 結果 |
|---|---|
| `apply_migration` via saome_supabase MCP | success |
| verify (idempotent check) | `old_key_count=0`, `missing_disabled=0`, `missing_relevant_text=0` |
| spot-check 唯一受影響 row | `98c28215-...`: notificationRadius:100 → locationsMaxDistance:100 |
| `check:migrations` CI gate | `OK: 15 migrations registered as applied` |

**Pre-migration 統計**：`34 total rows`, `1 row with notificationRadius`,
`0 rows with locationsMaxDistance`, `0 rows with locationsDisabled`.
**Post-migration**：`34 total rows`, `0 rows with notificationRadius`,
`1 row with locationsMaxDistance (value preserved as 100)`,
`34 rows with locationsDisabled (defaults injected)`,
`1 row's locations[0] now has relevantText`.

## Code 端為何不必改

Grep 結果顯示 10 個檔案仍 reference `notificationRadius`：

```
packages/shared/schemas/card.ts:201
apps/backend/src/modules/cards/schemas/request.ts:132
apps/backend/src/modules/cards/db/templates.ts:171
apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.ts:779
```

全部都是 **defensive legacy fallback**：

- shared schema: `notificationRadius: z.number().optional()` 標 deprecated，
  註解「backend silently accepts incoming notificationRadius but does NOT
  prefer it over locationsMaxDistance」
- store: 「if `locationsMaxDistance` missing but legacy `notificationRadius`
  exists, fall back」— 防任何 row 被 migration 漏掉
- backend request: 保留 optional field 讀舊欄位，**不會主動寫入**

Post-Migration-017，DB 內已無 `notificationRadius` 殘留。
但 schema 暫留 optional 是 correct — 多一層保險。
下次清理（Step 6+）可以正式 deprecate 並 remove optional field。

## 為什麼這個 migration 用 `||` operator 是安全的

跟 Rule 032（後端 JSONB merge silent killer）的 risk 不一樣：

- Rule 032 場景：前端 PUT 帶 empty value，`||` 把 DB 真實資料洗空
- 本 migration 場景：一次性 backfill，所有更新都來自 DB 內既有 rows，
  不會有「empty value 蓋 real value」風險

但**未來 Step 5 的 normal PUT 仍要走 Rule 032 的防護**：
- front-end client-side validation（`safeParse` before PUT）
- back-end zod schema rejection（`description: min(1)` 等）
- trigger reject non-object settings（migration 013）

## 自問

- [ ] Migration 已 apply + registry 已更新？✅
- [ ] CI gate `check:migrations` 通過？✅
- [ ] Code 端不需要改動（defensive fallback 暫留是 intentional）？✅
- [ ] Pre-commit typecheck 通過？需要驗證

## Follow-up

- 後續若要正式 remove `notificationRadius` legacy fallback（schema / store /
  backend request 都拿掉），需要再開 Step 5.1 refactor + 新 migration 驗證
  0 row 真的有 legacy key（理論上不可能，但 conformance test 必加）。
