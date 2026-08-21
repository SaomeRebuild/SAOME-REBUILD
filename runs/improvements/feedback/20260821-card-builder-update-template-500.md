# Feedback: CardBuilder Step 2 PUT 500 — postgres.js dollar-quoting conflict（2026-08-21）

## 任務背景

CardBuilder 草稿 TTL feature（`expires_at` auto-cleanup）實作完成後，發現 Step 2 的卡片設定（storeName、issuerName）點「下一步」時完全沒有被寫入 DB。進一步追查發現是 `PUT /api/cards/:id` 回 500 Internal Server Error。

## 實作摘要

### Backend Changes

| 檔案 | 變更 |
|------|------|
| `apps/backend/src/modules/cards/db/templates.ts` | 重寫 `updateTemplate` — 放棄 `$N` positional placeholder，改用所有值都透過 `${}` tagged template injection |
| `apps/backend/src/modules/cards/routes/update.ts` | 移除 debug console.log |

### Root Cause

`updateTemplate` 的 SQL 建構邏輯用 `sets.push('name = $1')` 之後，把這些字串拼接進 `sql\`...\`` tagged template。postgres.js 的 SQL parser 會把 template literal 內的 `$1` 視為 dollar-quoted string delimiter，導致後面的 `RETURNING` 被錯誤解析。

```
PostgresError: unterminated dollar-quoted string at or near "$$1 RETURNING ..."
```

四個失敗修復嘗試：

| # | 策略 | 錯誤 |
|---|------|------|
| 1 | `sql.unsafe(sets.join(', '))` + `WHERE id = $${idx}` | `unterminated dollar-quoted string` |
| 2 | `sql(sqlQuery, values)` untagged call | `NOT_TAGGED_CALL` |
| 3 | `sets.map(clause => sql.unsafe(clause))` + template | `syntax error at or near "$1"` |
| 4（成功） | 所有值都用 `${}` tagged template | **200 OK** |

### 為什麼 unit test 沒抓到

`updateTemplate` 完全沒有 unit test 覆蓋。`apps/backend/src/modules/cards/db/templates.test.ts` 不存在。

## 觸發的 rule

- `000-modular-design.mdc`（Part B）：DB 查詢不能寫在 route/service 裡（`templates.ts` 有獨立檔案，但 `updateTemplate` 沒有 test）
- `019-schema-contract-drift.mdc`：無直接觸發（schema 是對的，只是 SQL 建構語法錯誤）

## 探針 Script

`tests/probe/local-backend-direct.ts` — Playwright probe，走完整流程：
1. 登入 → 從頭建置 → 選擇卡片類型 → Step 1 → 2 → 填 storeName + issuerName → 下一步觸發 PUT

## 預防措施

### postgres.js 動態 UPDATE pattern

未來任何模組有動態 `UPDATE SET` 建構，**禁止**：

```typescript
// ❌ 錯誤：$N + sql tagged template 混合
const sets = [];
sets.push(`name = $1`);
values.push(input.name);
await sql`UPDATE t SET ${sql.unsafe(sets.join(', '))} WHERE id = $2`;


// ❌ 錯誤：sql() untagged call
await sql(sqlQuery, values); // NOT_TAGGED_CALL
```

**正確方式**：

```typescript
// ✅ 所有值都透過 ${} tagged template injection
await sql`UPDATE t SET ${input.name !== undefined ? sql`name = ${input.name}` : sql``} WHERE id = ${id}`;
```

如果動態欄位太多（> 5 個），考慮拆成多個獨立的 `UPDATE`（每個用固定欄位），或在 `shared/lib/` 寫一個 `buildUpdateQuery()` helper 封裝這個 pattern。

### 未來必加的測試

- `apps/backend/src/modules/cards/db/templates.test.ts`：測 `updateTemplate` 的 4 種 field combination（只有 name、只有 settings、name + settings + status 等）

## 衍生問題

1. **Debug log 未清理**：`update.ts` 原本有 `console.log` debug statement，已移除
2. **Wrangler reload 延遲**：本地 `wrangler dev` 在 TS 變更後約需 20-25 秒才重載，debug 時需等待
3. **TTL feature 無完整 smoke test**：`create → touch → publish` 完整 flow 需要一個 Playwright smoke test 覆蓋

## 自問

- **下次怎麼不犯？**
  - 新增 DB 操作函式時，**立即**寫對應的 `.test.ts`
  - 動態 UPDATE 必用 tagged template `${}` injection

- **哪條 rule 該補？**
  - `000-modular-design.mdc` Part B 禁止清單加一條：**動態 UPDATE 不得用 `$N` + tagged template 混合**（Postgres.js P0 antipattern）

- **哪個 test 該加？**
  - `apps/backend/src/modules/cards/db/templates.test.ts`（待新建）

## 同步狀態

- 本地 commit: pending
- DEV LOG: `DEV/08-2026/0821-card-builder-step2-update-500.md`
- DEV LOG（TTL 實作）: `DEV/08-2026/0821-card-builder-draft-ttl-cleanup.md`

## 衍生問題：Migration 006 未即時 apply（2026-08-22）

### 問題

Migration `006_add_templates_expires_at.sql` 建立後，**workaround**（移除 SQL 中的 `expires_at` 欄位）被 commit 進 `templates.ts`，導致 production 功能與 code 不同步。直到 MCP reconnected 才補上 migration。

### 根因

| 步驟 | 預期 | 實際 |
|------|------|------|
| 1. 建立 migration | migration 檔進 git | ✅ 完成 |
| 2. Apply migration | 立即透過 Supabase MCP apply 到 DB | ❌ MCP timeout，沒有 retry 就放棄 |
| 3. Code 更新 | migration apply 後才 commit | ❌ 先 commit workaround 再等 migration |

### Migration Apply Checklist（MANDATORY）

> 新增任何 migration 檔後，**必須**逐項確認才能 close session。

| # | 檢查項 | 失敗時的行動 |
|---|--------|--------------|
| 1 | 透過 `saome_supabase` MCP 執行 migration SQL | 嘗試 `supabase` CLI (`npx supabase db push --project-ref <ref>`)，若需要 login 等用戶操作 |
| 2 | 確認 `execute_sql` 回傳 `[]`（DDL success）而非錯誤 | 若 `ALTER TABLE` 報 "column already exists"，表示 migration 已 apply，可安全继续 |
| 3 | Commit message footer 必填 MCP apply 結果 | `Migration: 006_add_templates_expires_at applied via saome_supabase MCP` |
| 4 | 若 MCP 持續 timeout，**不要** commit workaround | 留在本地，等 MCP reconnected 再 apply |

### 受影響的 rule 段落

- `019-schema-contract-drift.mdc` § Migration 紀律：新增 `migration apply` 為第 5 步的必要動作
- `000-modular-design.mdc` Part B § DB queries：DDL migration 屬於 DB schema 變更，視為 contract drift 預防
