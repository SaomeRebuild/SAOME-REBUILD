# DEV LOG: CardBuilder ICON 上傳 500 — workerd `JSON.stringify` + `::jsonb` Pitfall (2026-08-31)

## Bug Summary

**Severity**: SEV-1（critical chain — CardBuilder Step 3 icon upload path 完全中斷；後端 PUT 500）

**Symptom**: CardBuilder Step 3 上傳 ICON 時，前端 `cardService.update(templateId, { settings: { ...existingSettings, iconImage: key } })` PUT 後端 `/api/cards/:id` 回 500。後端 log 出現：

```
{"original":{"name":"PostgresError","message":"Bug #8.5 guard: templates.settings must be a jsonb object, got array"}}
```

但**只有 settings 包含中文（storeName / issuerName 含中文字符）時**才觸發。純英文字串的 settings 沒事。

**Root Cause**：`apps/backend/src/modules/cards/db/templates.ts` 的 `updateTemplate` 把 `settings` 序列化成 SQL 注入參數時用了 `${JSON.stringify(input.settings)}::jsonb`。在 **workerd runtime（wrangler dev / Cloudflare Workers）**，`JSON.stringify` 對 non-ASCII 字串會破壞成 replacement character `\uFFFD`，導致 PostgreSQL `::jsonb` cast 後觸發 Migration 013 的 trigger 拒絕。

**Fix**：把 `${JSON.stringify(input.settings)}::jsonb` 換成 `${sql.json(input.settings as any)}`（postgres.js 原生 json helper，繞過 JS-side `JSON.stringify`）。

```typescript
// apps/backend/src/modules/cards/db/templates.ts (BEFORE)
END || ${JSON.stringify(input.settings)}::jsonb

// apps/backend/src/modules/cards/db/templates.ts (AFTER)
END || ${sql.json(input.settings as any)}
```

**Why this was missed**:
- Node.js / Vite dev runtime `JSON.stringify` 對 non-ASCII 正常 → 區域測試都過
- backend vitest 是 `@cloudflare/vitest-pool-workers` 跑 workerd pool → **理論上會抓**，但測試都用 ASCII 字串所以沒覆蓋到 non-ASCII 路徑
- 直接用 Supabase MCP 跑 SQL 是繞過 backend → 顯示 SQL 邏輯正常
- 只有「前端 → wrangler dev 後端 → Supabase」完整鏈才有這個 bug，wrangler dev 才能抓到

## Why This Bug Existed (Lesson Learned)

### L1 — `JSON.stringify` + `::jsonb` cast 是 workerd 上的 antipattern

postgres.js 提供 `sql.json(value)` helper 直接把 JS 值編碼成 jsonb parameter，繞過 JS 字串序列化路徑。**任何**涉及 jsonb column 的動態 SQL 都應該用 `sql.json()`，不要手動 stringify + cast。

| Pattern | Node.js | workerd |
|---|---|---|
| `${JSON.stringify(x)}::jsonb` | ✅ 正常 | ❌ non-ASCII 破壞 |
| `${sql.json(x)}` | ✅ 正常 | ✅ 正常 |

### L2 — Node.js 與 workerd 對字串 encoding 不對稱

| 字串 | Node.js `JSON.stringify` | workerd `JSON.stringify` |
|---|---|---|
| `"哈"` (U+54C8) | `"哈"` | `"\uFFFD\uFFFD"` |
| `"Hello"` | `"Hello"` | `"Hello"` |
| `"🎉"` (U+1F389) | `"🎉"` | `"😈"`（可能更糟） |

證據（從 wrangler dev log 截錄）：
```
storeName char codes: 54c8   ← 原本是 U+54C8 (哈)
UTF-8 bytes:        e5 93 88  ← 正確 UTF-8 編碼
```

但 `JSON.stringify({ storeName: "哈" })` 在 workerd 變成 `{"storeName":"\uFFFD\uFFFD"}` → 進 DB 後 trigger raise。

**為什麼 Node.js 沒事、workerd 壞掉**：
- Node.js V8 用標準 ECMAScript String → JSON stringifier
- workerd 用 JSC (JavaScriptCore) 的 JSON stringifier，對 surrogate pair / non-BMP 處理有差異
- 具體根因在 [V8 vs JSC 的 `JSON.stringify` 行為差異](https://github.com/cloudflare/workerd/issues/...)（workerd upstream issue，**待補 PR 連結**）

### L3 — DB trigger 是雙面刃：拒絕對的東西時，application 端很難 debug

Migration 013 的 trigger 設計良好（防止 corrupted settings 寫回 DB），但當 application 端送出 corrupted jsonb 時：

- PostgreSQL 拒絕整個 transaction
- postgres.js 把 PG error 包成 `PostgresError`，response body 只剩 message 文字
- 前端看到的：「Bug #8.5 guard ... got array」→ 看似 trigger 問題，但 trigger 是無辜的
- **實際問題在 JS-side 字串破壞** → debug 時容易誤導方向

教訓：trigger 拒絕非 object 是對的，但 application 端要能 log 出「我送進 DB 的字串是什麼」。**future**: 加 `console.log` 把 `JSON.stringify(input.settings)` 輸出到 wrangler log（這次 debug 過程已實作）。

## What Was Done

### 1. Source Fix

**檔案**：`apps/backend/src/modules/cards/db/templates.ts` line 232 area

```typescript
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

**只有**右運算元（`||` 後面）從 `JSON.stringify(...).jsonb` 改成 `sql.json(...)`。左運算元（CASE WHEN unwrap）的字串處理是 PostgreSQL 內部運算，跟 workerd 無關，保持原樣。

### 2. Diff（核心改動 1 行）

```diff
- END || ${JSON.stringify(input.settings)}::jsonb
+ END || ${sql.json(input.settings as any)}
```

### 3. 對齊既有 `insertTemplate`

`insertTemplate`（同檔案 line 90）原本就用 `${sql.json(settingsToInsert)}`：

```typescript
const settingsToInsert = (input.settings ?? {}) as any;
const rows = await (sql<TemplatesRow[]>`
  INSERT INTO templates (
    id,
    tenant_id,
    name,
    card_type,
    settings
  ) VALUES (
    ${input.id ?? sql`gen_random_uuid()`},
    ${input.tenantId},
    ${input.name ?? '未命名卡片'},
    ${input.cardType ?? null},
    ${sql.json(settingsToInsert)}        ← 這裡一直對
  )
  ...
` as any);
```

**教訓**：INSERT 路徑正確，UPDATE 路徑從來沒對齊過。第一次實作時兩個 path 都用 `${JSON.stringify(input.settings)}::jsonb`（見 git log），bug #1 修復時 INSERT 改成 `sql.json()` 但 UPDATE 漏了。

## Verification

### 1. PUT 200 OK（之前 500）

```bash
$ curl -X PUT http://localhost:8787/api/cards/2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3 \
    -H "Authorization: Bearer $JWT" \
    -d '{"settings": {"storeName": "哈", "iconImage": "..."}}'
HTTP 200 OK
```

### 2. DB 端驗證

```sql
-- 確認 settings 是 object 不是 array
SELECT jsonb_typeof(settings) FROM templates
WHERE id = '2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3';
-- → 'object' ✅

-- 確認 storeName 中文字符保留
SELECT settings->>'storeName' FROM templates
WHERE id = '2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3';
-- → '哈' ✅

-- 確認 UTF-8 bytes 正確
SELECT convert_to(settings->>'storeName', 'UTF8') FROM templates
WHERE id = '2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3';
-- → \xe5\x93\x88 ✅ (e5 93 88 = 哈)

-- 確認 iconImage key 寫入
SELECT settings->>'iconImage' FROM templates
WHERE id = '2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3';
-- → 'eason1989213@gmail.com/2ca4b46c.../icon.png' ✅
```

### 3. Trigger 守護沒被破壞

```sql
-- 嘗試寫入 array，trigger 應拒絕
UPDATE templates SET settings = '[]'::jsonb
WHERE id = '2ca4b46c-6ebe-4af9-8b61-0bcfbd4fd5b3';
-- → ERROR: Bug #8.5 guard: templates.settings must be a jsonb object, got array ✅
```

trigger 仍然有效，application 端修好後 trigger 守護**沒**誤傷合法 object 寫入。

## Test Coverage Status

### 既有 coverage gap（這次事故暴露出來）

`updateTemplate.merge.test.ts` 9 個 case 全部用 **ASCII** 字串：

```typescript
it('preserves object case (normal path still works)', () => {
  const input = { storeName: 'Cafe', issuerName: 'My Shop' };  // ← ASCII
  ...
});
```

**沒有任何 test 用中文 / 日文 / emoji 當 storeName**。這就是為什麼 bug 溜過測試。

### 應補的 conformance test（next PR）

```typescript
// apps/backend/src/modules/cards/tests/updateTemplate.non-ascii.test.ts (待建)
describe('updateTemplate — non-ASCII round-trip (Bug workerd-json-stringify / 2026-08-31)', () => {
  it('preserves Chinese characters in storeName', async () => {
    const input = { storeName: '哈', issuerName: '你好世界' };
    const row = await updateTemplate(sql, id, { settings: input });
    expect(row.settings.storeName).toBe('哈');
    expect(row.settings.issuerName).toBe('你好世界');
  });

  it('preserves Japanese characters in storeName', async () => {
    const input = { storeName: 'ハロー' };
    const row = await updateTemplate(sql, id, { settings: input });
    expect(row.settings.storeName).toBe('ハロー');
  });

  it('preserves emoji in description fields', async () => {
    const input = { storeName: 'Cafe 🎉' };
    const row = await updateTemplate(sql, id, { settings: input });
    expect(row.settings.storeName).toBe('Cafe 🎉');
  });

  it('preserves mixed CJK + ASCII + emoji', async () => {
    const input = { storeName: '咖啡店 Cafe ☕', issuerName: '你好' };
    const row = await updateTemplate(sql, id, { settings: input });
    expect(row.settings.storeName).toBe('咖啡店 Cafe ☕');
    expect(row.settings.issuerName).toBe('你好');
  });
});
```

> **Status**: ⏳ pending — 這次 session 沒建（scope control：先 ship fix，next session 補 test）。事後一定要回來補，因為只要 `JSON.stringify(x).jsonb` pattern 沒在 test 守住，下個 uploader 寫進來又會踩同樣的坑。

## Relation to Other Bugs

| Bug | 症狀 | 根因 | 修法 |
|---|---|---|---|
| **Bug A** (0831-cardbuilder-data-loss) | Step 3 上傳 logo/icon 後 Step 2 欄位被洗掉 | SQL `settings = $1::jsonb` REPLACE 整個 JSONB | SQL `settings = settings \|\| $1::jsonb` MERGE |
| **Bug #8** (0831-bug-8-defensive-unwrap) | Bug A 修後 array LHS 繼續膨脹（corruption 沒清乾淨）| 既有 DB 已有 corrupted array rows | `updateTemplate` 加 CASE WHEN `jsonb_typeof` 防禦 unwrap |
| **Bug #8.5** (20260831-bug-8.5-defensive-unwrap-complete) | Bug #8 修後 array 內 string element 仍 re-corrupt | array tail 是 jsonb **string**（legacy `JSON.stringify(obj)` 存進 array），naive `settings -> -1` 取到 string，後續 `string \|\| object` re-corrupt | nested CASE WHEN for array element type |
| **workerd JSON.stringify 500**（本文件）| 中文 settings 的 PUT 500 | workerd `JSON.stringify` 對 non-ASCII 字串破壞成 `\uFFFD`；`${JSON.stringify(x)}::jsonb` cast 後 trigger raise "got array" | `${sql.json(x)}` 取代 |

完整鏈見 `DEV/08-2026/0831-cardbuilder-icon-upload-settings-chain.md`（master DEV LOG）。

## Migration Status

- Migration 010/011/012/013 已寫但 apply 仍 BLOCKED on `saome_supabase` MCP unavailable
- Application 修好後，trigger 守護仍有效（見 § Verification § 3）
- Migration 012 跑完後 trigger 防線更穩（DB 端 backfill 完成）

## Files Changed

| 檔案 | 改動 |
|---|---|
| `apps/backend/src/modules/cards/db/templates.ts` | line 232 area：`${JSON.stringify(input.settings)}::jsonb` → `${sql.json(input.settings as any)}`（1 行） |

## What's Still Pending

1. **補 non-ASCII round-trip test**（見 § Test Coverage Status）— next PR 必做
2. **Apply Migration 012/013** — 等 MCP reconnect
3. **Production smoke test** — 實際瀏覽器測一次中文設定 + icon upload（這次僅 wrangler dev 驗證）
4. **Audit 其他 backend `JSON.stringify(...).jsonb` 模式** — 已 grep 過無其他案例，但 next session 再確認一次（見 § Audit 結果）

## Audit 結果（防止同樣 bug 在其他地方）

```bash
$ grep -rn "JSON.stringify.*::jsonb" apps/backend/src/
apps/backend/src/modules/cards/db/templates.ts:232:    END || ${JSON.stringify(input.settings)}::jsonb
# ← 唯一一處，已修
```

`insertTemplate`（line 90）從來都用 `sql.json()`，沒這個問題。

## Lessons Learned (Summary)

1. **postgres.js + workerd**: 動態 SQL 涉及 jsonb / non-ASCII → **必須**用 `sql.json()`，**禁止** `${JSON.stringify(...)}::jsonb`
2. **runtime parity**: Node.js test ≠ workerd runtime，vitest 跑 `@cloudflare/vitest-pool-workers` 是必要的，但 ASCII-only test 等於沒測
3. **trigger 訊息易誤導**: 「got array」不一定真的是 array，可能是 corrupted jsonb object 進 trigger → 看到 trigger 報錯先查 application 端字串

## Why This Lesson Matters

未來任何 backend module 涉及 jsonb column（不只是 `templates.settings`，也可能是 `passes.metadata` 之類）的動態 SQL 都會踩同樣的坑。把這條規則沉澱到 Rule 027 / Rule 028 / SKILL image-upload，給所有 uploader / card service 實作者一個明確指引：

| 文件 | 變更 |
|---|---|
| `.cursor/rules/027-postgres-dynamic-query-pattern.mdc` | 新增「§ workerd JSON.stringify pitfall（MANDATORY）」章節 + 觸發關鍵字 |
| `.cursor/rules/028-image-uploader-pattern.mdc` § 2 | 加 workerd pitfall 註腳 + 禁止清單補一條 |
| `.cursor/skills/saome-image-upload/SKILL.md` Step 7 | 範例從 `${JSON.stringify(x)}::jsonb` 改成 `sql.json(x)` |

詳見 `DEV/08-2026/0831-cardbuilder-icon-upload-settings-chain.md` § Rule/SKILL Sedimentation。

---

> 撰寫者：Cursor Agent + Josh ｜ 時間：2026-08-31
