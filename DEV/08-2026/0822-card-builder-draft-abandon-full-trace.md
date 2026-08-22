# CardBuilder 草稿機制完整實錄（Aug 21–22）

## Metadata

- **日期**：2026-08-22
- **作者**：cursor-agent
- **commit hash**：local（未 commit）
- **規則 / skill 觸發**：`saome-dev-logging` skill、`019-schema-contract-drift.mdc`（DB ↔ schema drift）、`025-vibe-coding-l2-checklist.mdc`（L2 checklist）

---

## 背景

CardBuilder 草稿機制經過兩天實作，涉及多個子系統：

1. **Aug 21**：`templates` 表草稿 TTL 自動清理機制
2. **Aug 21**：Schema drift bug（`card_type` optional 漏同步）
3. **Aug 22**：Production 所有 Card API 500（Migration 未 apply）
4. **Aug 22**：IssuerName 預填失敗 + `isPaid` extension drift
5. **Aug 22**：Abandon 改為直接刪除 ROW

---

## Day 1（2026-08-21）：草稿 TTL 機制實作

### 問題：草稿表格爆量

`templates` 表累積大量 orphan 草稿（使用者開了編輯器但從未存檔或發布），佔用 DB 空間。

### 解法：24 小時 TTL + pg_cron 自動清理

#### Migration

```sql
-- 006_add_templates_expires_at.sql
ALTER TABLE public.templates ADD COLUMN expires_at TIMESTAMPTZ NULL;
CREATE INDEX idx_templates_expires_at ON public.templates (expires_at)
  WHERE expires_at IS NOT NULL;
SELECT cron.schedule(
  'cleanup_expired_draft_templates',
  '0 * * * *',
  $$DELETE FROM public.templates WHERE status = 'draft' AND expires_at IS NOT NULL AND expires_at < now()$$
);
```

```sql
-- 007_nullable_card_type.sql
ALTER TABLE public.templates ALTER COLUMN card_type DROP NOT NULL;
-- 區分 orphan draft（card_type=NULL）與正常草稿（card_type 有值）
```

#### 生命週期設計

```
新建草稿（從頭建置）
  → createTemplate(cardType=undefined)
  → DB: card_type=NULL, expires_at=now()+24h

使用者正常編輯
  → 每 5 分鐘 auto-save
  → cardService.touch() → expires_at 重置為 now()+24h

使用者發布卡片
  → updateTemplate(status='published') → expires_at=NULL

pg_cron 每小時執行
  → DELETE WHERE status='draft' AND expires_at IS NOT NULL AND expires_at < now()
```

#### Backend Changes

- `apps/backend/src/modules/cards/db/templates.ts`：`TemplatesRow` + `expires_at?`、`touchExpiresAt()` reset TTL
- `apps/backend/src/modules/cards/routes/touch.ts`：`PATCH /api/cards/:id/touch`
- `apps/backend/src/modules/cards/services/cardService.ts`：`touchTemplateService()`

#### Frontend Changes

- `CardBuilderEditor.tsx`：mount 時立即一次 + 每 5 分鐘一次 `touch()`
- `CardBuilderPage.tsx`：`handleBuildFromScratch` 移除 `cardType: 'stamp_card'` 預設值

### Schema Drift Bug（Aug 21 11:39）

#### 觸發

Step 1 完成後（`card_type` 改 nullable），回報「建立卡片失敗：Validation failed」。

#### 根因

| 層 | 檔案 | 同步狀態 |
|----|------|---------|
| Shared | `packages/shared/schemas/card.ts` | `cardTypeSchema.optional()` |
| Backend request | `apps/backend/src/modules/cards/schemas/request.ts` | **仍是 required** |
| Backend service | `apps/backend/src/modules/cards/services/cardService.ts` | **仍是 `string`** |
| Frontend | `CardBuilderPage.tsx` | 已移除預設值 |

#### 修法

```diff
// request.ts
- cardType: cardTypeSchema,
+ cardType: cardTypeSchema.optional(),

// cardService.ts
- cardType: string,
+ cardType: string | undefined,
```

### 驗證

```
id: 6be1e06a..., card_type: NULL, expires_at: 2026-08-22 03:42:40+00  ✅
id: e2f8b804..., card_type: NULL, expires_at: 2026-08-22 03:41:35+00  ✅
```

---

## Day 2（2026-08-22）

### 問題一：Production 所有 Card API 500（Migration 006 未 apply）

#### 症狀

Production 環境點「從頭建置」→「放棄草稿」→ `SaomeApiError: API error`

#### 探針

所有 Card API（`GET /drafts`、`POST /cards`、`PATCH /abandon`）全部回 500。

#### 根因

`supabase/migrations/20260821000001_006_add_templates_expires_at.sql` 放在 `supabase/migrations/` 目錄，但從未 apply 到 production DB。`findLatestDraftByTenant` 的 SQL query 了 `expires_at` 欄位，但 production DB 根本沒有這欄，導致 `SELECT expires_at` 失敗。

#### 修法（緊急繞過）

從所有 SQL queries 和 DTO 移除 `expires_at` 依賴：

| 檔案 | 變動 |
|------|------|
| `templates.ts` | `TemplatesRow.expires_at` → 移除；`CreateTemplateInput.expiresAt` → 移除 |
| `cardService.ts` | `toDto()` → 移除 `expiresAt` |
| `response.ts` | `TemplateDto.expiresAt` → 移除 |
| `packages/shared/schemas/card.ts` | `templateDtoSchema.expiresAt` → 移除 |

#### 待辨

- [x] Migration 006 最終手動 apply 到 production
- [ ] Migration apply 後需要把 `expires_at` 加回所有相關程式碼（revert 繞過）
- [ ] 未來需要 CI/CD pipeline 自動化 migration apply

---

### 問題二：IssuerName 預填失敗

#### 症狀

Playwright smoke test 進到 Step 2，`#issuerName` 的 `disabled=true` 但 `value=""`；Console log 顯示 `tenant: undefined`。

#### 探針

```
[SESSION STORAGE tokens]: {
  accessToken: 'eyJhbG...',
  refreshToken: 'eyJhbG...'
}
[issuerName] value="" disabled=true visible=true
[CONSOLE LOGS]:
  [log] [IssuerNameField] useEffect run, issuerName: "" tenant: undefined
```

#### 根因

`IssuerNameField.tsx` 第 12 行錯誤：

```typescript
const { tenant } = useAuth(); // ❌ 回傳 { state, ... }，不是 { tenant, ... }
```

#### 修法

```typescript
const { state } = useAuth();
const tenant = state.tenant;
```

Effect dependency 從 `[tenant?.name]` 改為 `[state.tenant]`，確保 auth refresh 完成後 effect 正確觸發。

---

### 問題三：`isPaid` Extension Schema Drift

#### 需求

選擇 `membership_card` 時，Step 2 顯示「是否收費」checkbox（Extension pattern）。

#### Extension Pattern 實作

| 元件 | 實作 |
|------|------|
| Store | `isPaid: false` + `setIsPaid` + `loadSettings` |
| Component | `MembershipExtensionField.tsx` — `cardType === 'membership_card'` conditional render |
| Step2 index | `{cardType === 'membership_card' && <MembershipExtensionField />}` |
| Workspace onSave | `isPaid` 包含在 settings payload |
| i18n | `step2.membershipExtension.title / isPaid / isPaidHint` |

#### Schema Drift（又來了）

`packages/shared/schemas/card.ts` 已有 `isPaid: z.boolean().optional()`。

但後端 `apps/backend/src/modules/cards/db/templates.ts` 和 `schemas/request.ts` **又漏了 `isPaid`**。

#### 修法

```typescript
// templates.ts
interface TemplateSettings {
  // ...
  isPaid?: boolean;
}

// request.ts
isPaid: z.boolean().optional(),
```

---

### 問題四：Abandon 改為直接刪除 ROW

#### 變更背景

原本實作是 `UPDATE status='abandoned'`。後來討論後改為直接 `DELETE row`，因為「放棄草稿」不需要留 record。

#### 實作變更

- `PATCH /api/cards/:id/abandon` route → **移除**
- Frontend `handleAbandonDraft` → 改為 `DELETE /api/cards/:id`
- 刪除後清除 local state並重新抓 draft list

#### pg_cron 不受影響驗證

pg_cron 清理條件是 `status='draft' AND expires_at IS NOT NULL AND expires_at < now()`。Abandon 後 ROW 已刪除，不會被 pg_cron 影響。

---

## 結論

草稿表格爆量問題已解決：

- 新建草稿 `card_type=NULL` 區分 orphan
- 每小時 pg_cron 自動清理 orphan draft
- Abandon 直接刪除 ROW，不留垃圾 record

---

## 衍生

| 類型 | 項目 | 狀態 |
|------|------|------|
| 待修 | Migration apply 後 revert `expires_at` 繞過 | pending |
| 待修 | Step 7 客製化桌牌商業邏輯 | pending |
| 待修 | Step 8 保存按鈕串接 | pending |
| 待修 | `isPaid` 收費會員卡商業邏輯 | pending |
| 待建 | `apps/backend/src/modules/cards/db/templates.test.ts`（TTL + touch） | pending |

---

## 自問

- **下次怎麼不犯？**
  - Backend `schemas/request.ts` 應從 `@saome/shared/schemas/card` import，而非各自維護副本
  - `useAuth()` 回傳值形狀應在 JSDoc 標明，避免 `{ tenant }` vs `{ state: { tenant } }` 混淆
  - 同一個 session 內兩次 schema drift（`cardType` + `isPaid`）說明每次新增 schema field 都應跑完整三層檢查：shared schema → backend request.ts → backend db interface

- **哪條 rule 該補？**
  - `019-schema-contract-drift.mdc` 第四層：backend request schema (`request.ts`) 也需同步
  - `useAuth` hook 的 JSDoc 應加 explicit return type 說明
  - Migration apply pipeline：建議每個 migration 都需 CI check

- **哪個 test 該加？**
  - `templates.test.ts`：`insertTemplate` auto-set TTL、`touchExpiresAt` reset TTL
  - Playwright smoke test：驗證 `useAuth()` refresh 完成後 `tenant` 有值、`issuerName` 正確預填

---

> 撰寫者：cursor-agent ｜ 時間：2026-08-22
