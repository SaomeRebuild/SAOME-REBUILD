# Multipass Tier Max Discount Amount — 4-Layer Schema Drift Fix

**Date**: 2026-09-21 (discovered 2026-09-21, fixed same day)
**Severity**: SEV-2 (field saves silently, no 500, but data loss)
**Category**: Rule 019 § 4.1 schema drift

---

## 問題

Step 6 Multipass 卡片編輯器中，`MultipassTierMaxDiscountAmountField`（PR-6，2026-09-20 建立）輸入的值**沒有被儲存，也沒有回填**。

使用者症狀：輸入「最高折抵金額」後，離開再回來，輸入框是空的。

---

## Root Cause

PR-6 在 2026-09-20 建立時，**只建立了 UI 元件**，但**4 層 schema 同步（Rule 019 § 4.1）全部漏掉**：

| 層 | 位置 | 狀態 | 說明 |
|---|---|---|---|
| Layer 1 | `packages/shared/schemas/card.ts::multipassTiers[*]` | ❌ 漏 | zod schema 沒有 `maxDiscountAmount` |
| Layer 2 | `apps/backend/src/modules/cards/schemas/request.ts::multipassTiers[*]` | ❌ 漏 | backend request schema 也沒加 |
| Layer 3 | `apps/backend/src/modules/cards/db/templates.ts::TemplateSettings.multipassTiers[*]` | ❌ 漏 | TypeScript interface 也沒加 |
| Layer 4 | `apps/frontend/src/.../CardBuilderEditorWorkspace.tsx::sanitizedMultipassTiers` | ❌ 漏 | PUT serializer 沒序列化 |
| Loader | `apps/frontend/src/.../CardBuilderEditor.store.ts::sanitizeMultipassTiers` | ❌ 漏 | 沒讀 `obj.maxDiscountAmount` |

前端 store 的 `MultipassTierShape` 類型（從 `packages/shared/constants/multipass-card.ts` 匯入）**已經有** `maxDiscountAmount`，`updateMultipassTier` setter 也處理了這個 patch。但其他 4 層全部漏掉。

結果：
1. 使用者輸入 → `updateMultipassTier(tierId, { maxDiscountAmount: 50 })` → Zustand 正確儲存 ✅
2. autosave PUT → `sanitizedMultipassTiers` mapper **沒有** `maxDiscountAmount` → 欄位沒出去
3. 即使有出去 → backend zod schema **strip unknown field**（`.object()` 預設行為）→ 欄位被靜靜刪掉，**沒有 error**
4. DB 從來沒收到這個欄位 → 回填時 loader 不讀 `obj.maxDiscountAmount` → 輸入框是空的

關鍵：`||` operator merge 的 silent-overwrite 特性（Rule 032），zod strip unknown 的 silent 特性，加上 4 層 drift = **完全靜默的資料流失**。

---

## 為什麼 Vitest 沒抓到

- 現有 `schema-conformance.test.ts` 有 `multipassTiers[*]` 相關測試，但**沒有測 `maxDiscountAmount`**
- Conformance test 只測 `name`/`stampsNeeded`/`rewardType`/`rewardValue` + PR-5 的 threshold 欄位
- PR-6 測試從缺

---

## Fix（2026-09-21）

### Layer 1 — shared zod schema

**`packages/shared/schemas/card.ts`**：
在 `multipassTiers[*]` zod schema 加：
```typescript
maxDiscountAmount: z.number().min(0).nullable().optional(),
```

對齊 `stamp_card.maxDiscountAmount` 欄位（Layer 1 已有）。

### Layer 2 — backend request schema

**`apps/backend/src/modules/cards/schemas/request.ts`**：
同步加相同欄位。

### Layer 3 — backend DB interface

**`apps/backend/src/modules/cards/db/templates.ts`**：
在 `TemplateSettings.multipassTiers[*]` interface 加：
```typescript
maxDiscountAmount?: number | null;
```

### Layer 4 — frontend serializer

**`apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorWorkspace.tsx`**：
在 `sanitizedMultipassTiers` mapper 加：
```typescript
maxDiscountAmount: tier.maxDiscountAmount,
```

### Loader

**`apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.ts`**：
在 `sanitizeMultipassTiers` 加 defensive parse + 寫入 `trimmed.push`。

### Tests

**`apps/backend/src/modules/cards/tests/schema-conformance.test.ts`**：
加 8 條 PR-6 conformance test（null/0/正數/負數/undefined/完整 round-trip shared+local）。

---

## 預防

Rule 025 § L2 元件 checklist 這次沒跑。PR-6 元件建立時：

- [ ] Layer 1 shared zod schema ✅（這次漏了）
- [ ] Layer 2 backend request schema ✅（這次漏了）
- [ ] Layer 3 backend db interface ✅（這次漏了）
- [ ] Layer 4 frontend serializer ✅（這次漏了）
- [ ] Loader ✅（這次漏了）
- [ ] Conformance tests ✅（這次漏了）
- [ ] smoke test ✅（i18n 有，schema 沒有）

---

## 為什麼是 4 層 drift 而非 1 層

Rule 019 § 4.1 的「4 層」是：
1. shared zod schema（contract）
2. backend request schema（contract mirror）
3. backend DB type（contract implementation）
4. frontend serializer（application output）

`MultipassTierShape`（Layer 0）已經有 `maxDiscountAmount`，所以前端 store + component 正確。但 4 層 contract 漏了 → value 從來沒離開過前端。
