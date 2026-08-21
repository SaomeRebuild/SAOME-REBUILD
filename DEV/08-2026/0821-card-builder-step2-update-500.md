# CardBuilder Step 2 PUT 500 — postgres.js dollar-quoting conflict

## Metadata

- **日期**：2026-08-21
- **作者**：cursor-agent
- **觸發規則 / skill**：`000-modular-design.mdc`（backend DB 查詢禁止在 route/service 裡）、`saome-dev-logging` skill

## 症狀

> Step 2 點「下一步」時，`PUT /api/cards/:id` 回 500 Internal Server Error，卡片設定（storeName、issuerName）沒有被寫入 DB。

- **環境**：本地 development（`wrangler dev` + `vite dev`）
- **觸發條件**：CardBuilder 流程中，選擇卡片類型（Step 1）→ 填寫 storeName + issuerName（Step 2）→ 點「下一步」
- **觀察到的錯誤**：
  - 前端 console：`[handleNext] onSave failed: SaomeApiError: Internal server error`
  - 後端 wrangler log：`PostgresError: unterminated dollar-quoted string at or near "$$1 RETURNING id, tenant_id, status, name, card_type, settings, created_at, updated_at, expires_at"`
- **預期 vs 實際**：
  - 預期：`PUT 200`，settings 寫入 DB
  - 實際：`PUT 500`，settings 仍是 `{}`

## 探針 / 重現

### Playwright probe

`tests/probe/local-backend-direct.ts` — 完整流程：

```typescript
// 登入 → 從頭建置 → 選擇卡片類型 → Step 1 → 2 → 填 storeName + issuerName → 下一步觸發 PUT
```

捕獲到的 API response：

```
PUT 500 /api/cards/27081569-4f40-4186-b1d9-8bf0798f5e6d
Body: {"error":{"code":"INTERNAL_ERROR","i18nKey":"common.error.internal","message":"Internal server error","details":{"original":{"name":"PostgresError","message":"unterminated dollar-quoted string at or near \"$$1 RETURNING id, tenant_id, status, name, card_type, settings, created_at, updated_at, expires_at\""}}},"requestId":"..."}}
```

### wrangler debug log

```
[PUT /api/cards/:id] templateId: xxx body: {"settings":{"storeName":"kkk","issuerName":"pppp"}}
[PUT /api/cards/:id] parsed OK, calling service...
[PUT /api/cards/:id] ERROR: unterminated dollar-quoted string at or near "$$1 RETURNING ..."
```

## 根因

> postgres.js 的 `$N` positional placeholder 與 tagged template literal 的參數注入衝突。`updateTemplate` 把 `SET name = $1, settings = $2, ...` 當作 SQL 字串插入 tagged template，postgres.js 把 `$1` 視為 dollar-quoted string delimiter。

### 為什麼之前沒抓到

- `insertTemplate` 只寫固定欄位，沒有動態拼接
- `updateTemplate` 是新增功能（TTL feature 的一部分），從來沒實測過完整 flow
- Unit test 沒有 `updateTemplate` 的 case

### 四次失敗修復嘗試

| # | 策略 | 結果 |
|---|------|------|
| 1 | `sql.unsafe(sets.join(', '))` + `WHERE id = $${idx}` | `unterminated dollar-quoted string`：postgres.js 在 template literal 內解析 `$1` |
| 2 | `sql(sqlQuery, values)` untagged call | `NOT_TAGGED_CALL`：postgres.js 要求所有 SQL 都經 tagged template |
| 3 | `sets.map(clause => sql.unsafe(clause))` + `sql\`...\`` | `syntax error at or near "$1"`：`sql.unsafe()` 把 `$1` 變成字串而非 placeholder |
| 4 | 所有值都用 `${}` tagged template injection | **200 OK ✅** |

## 修法

- **檔案**：`apps/backend/src/modules/cards/db/templates.ts`
- **修改函式**：`updateTemplate`

```typescript
// 修復後：所有值都透過 ${} tagged template 注入，完全不碰 $N
export async function updateTemplate(
  sql: Sql,
  id: string,
  input: UpdateTemplateInput,
): Promise<TemplatesRow> {
  const rows = await sql<TemplatesRow[]>`
    UPDATE templates
       SET
         ${input.name !== undefined ? sql`name = ${input.name}` : sql``}
         ${input.name !== undefined && (input.cardType !== undefined || input.settings !== undefined || input.status !== undefined) ? sql`,` : sql``}
         ${input.cardType !== undefined ? sql`card_type = ${input.cardType}` : sql``}
         ${input.cardType !== undefined && (input.settings !== undefined || input.status !== undefined) ? sql`,` : sql``}
         ${input.settings !== undefined ? sql`settings = ${JSON.stringify(input.settings)}` : sql``}
         ${input.settings !== undefined && input.status !== undefined ? sql`,` : sql``}
         ${input.status !== undefined
           ? input.status === 'published'
             ? sql`status = ${input.status}, expires_at = NULL`
             : sql`status = ${input.status}`
           : sql``}
     WHERE id = ${id}
    RETURNING id, tenant_id, status, name, card_type, settings, created_at, updated_at, expires_at
  `;

  if (!rows[0]) {
    throw new Error('updateTemplate: template not found');
  }
  return rows[0];
}
```

**驗證**：`PUT 200`，settings 正確寫入 `{"storeName":"kkk","issuerName":"pppp"}`

## 衍生

- 清理 `update.ts` 的 debug console.log
- 這個 bug 說明 `updateTemplate` 完全沒有 unit test 覆蓋
- `touchExpiresAt` 沒有這個問題（因為 `SET` 欄位是固定的，沒有動態拼接）

## 自問

- **下次怎麼不犯？**
  - `updateTemplate` 必須加 unit test，mock `sql` 確保 query 語法正確
  - 動態 UPDATE 的 pattern 應該拆出可測試的 helper，不在 `updateTemplate` 裡直接寫 SQL

- **哪條 rule 該補？**
  - `000-modular-design.mdc` 的 backend 禁止清單應加一條：動態 UPDATE 不得用 `$N` 拼接 + tagged template 混合

- **哪個 test 該加？**
  - `apps/backend/src/modules/cards/db/templates.test.ts`（目前不存在）—— `updateTemplate` 的 4 種 field combination + `touchExpiresAt`

---

> 撰寫者：cursor-agent ｜ 時間：2026-08-21
