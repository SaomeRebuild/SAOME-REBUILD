# Coupon Step 6 沒有回填 — Backend Schema Drift 反饋報告

> 2026-09-19 ~ 2026-09-20 Rule 019 § 4.1 Layer 2 + Layer 3 schema drift 完整 trace。

## TL;DR

Coupon card Step 6 的 4 個欄位（couponDiscountType / couponDiscountAmount / couponDiscountPercent / couponIssueCount）前端 PUT 到後端時被 zod **靜悄悄丟掉**（zod 預設 `.object()` 行為是 `.strip()`），DB 沒收到，使用者 reload 後 store 退回 initialState 預設——**「設定沒回填」**。

Root cause：Rule 019 § 4.1 Layer 2（`apps/backend/src/modules/cards/schemas/request.ts`）+ Layer 3（`apps/backend/src/modules/cards/db/templates.ts::TemplateSettings`）**完全缺 coupon 4 個欄位**。Shared schema（Layer 1）有加，但後端 stub 沒同步。

修法：commit `aa884e1 fix(backend): coupon card 4-layer schema sync + constants wire-up`——補上 Layer 2 + Layer 3 + 6 條 defensive conformance test + 21 條 structural conformance test。

## 為什麼這條 bug 嚴重

| 影響面 | 細節 |
|---|---|
| 業務功能 | Coupon card **完全不能用**——使用者填完設定 save 後，reload 全沒了 |
| User trust | 使用者填的設定「看起來有保存」（按 Next 後 UI 顯示成功），但 reload 後消失 → 「為什麼 SAOME 不儲存我的設定？」 |
| Detection cost | **typecheck / lint / vitest 全綠**——只有從前端 → wrangler dev → Supabase 完整鏈才重現 |
| 既有事故 | 這是 Rule 019 § 4.1 Layer 2 + Layer 3 同步漏洞的第 5 次重現（register / CardBuilder / discount / membership / coupon）|

## 時間軸

| 時間 | 動作 |
|---|---|
| 2026-09-19 06:30 ~ 08:00 | 落地 CouponCardLogic + store setter + i18n + Step 3 group isolation + autosave |
| 2026-09-19 18:00 | user review：coupon 設定「按 Next 後 reload → 沒回填」 |
| 2026-09-19 18:30 | **debug 開始** |
| 2026-09-19 18:45 | 確認後端 schema-conformance test 沒 fail（**既有 test 完全沒覆蓋 coupon 欄位**）|
| 2026-09-19 19:00 | 確認前端 shared schema (`packages/shared/schemas/card.ts`) 有 coupon 4 欄位 |
| 2026-09-19 19:15 | **找到 root cause**：後端 `apps/backend/src/modules/cards/schemas/request.ts::templateSettingsSchema` 沒有 coupon 4 欄位 |
| 2026-09-19 19:30 | 確認後端 `apps/backend/src/modules/cards/db/templates.ts::TemplateSettings` 也沒有 coupon 4 欄位 |
| 2026-09-19 19:45 | 確認 zod 預設 `.object()` 行為是 `.strip()`——遇到 schema 沒宣告的 key 靜悄悄丟掉 |
| 2026-09-19 20:00 | 確認前端 PUT body 確實帶 coupon 欄位（透過 wrangler dev → 觀察 request body）|
| 2026-09-19 20:30 | 落地 Layer 2 + Layer 3 修法 + 6 條 defensive conformance test + 21 條 structural conformance test |
| 2026-09-19 21:00 | `npm test --workspace=apps/backend` 276 passed（含 27 條新 schema-conformance test）|
| 2026-09-20 02:57 | commit `aa884e1 fix(backend): coupon card 4-layer schema sync + constants wire-up` |

## Debug 過程詳記

### Step 1：症狀描述

User 回報：
> 「coupon card step 6 我設定好後按 Next，重新編輯這張卡，store 完全沒 hydrate coupon 欄位，又回到預設」

### Step 2：排除前端 bug

前端 `loadSettings` 的 sanitization 看起來正確：

```ts
// CardBuilderEditor.store.ts
couponDiscountAmount: (() => {
  const raw = resolved?.couponDiscountAmount;
  if (raw === null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= COUPON_AMOUNT_MIN) {
    return raw;
  }
  return state.couponDiscountAmount;   // ← 懷疑永遠走這條
})(),
```

→ 懷疑 `resolved?.couponDiscountAmount` 永遠是 undefined。

### Step 3：確認 backend 沒收到

wrangler dev → log → POST `/api/cards/<id>` 帶的 settings blob：

```json
{
  "settings": {
    "couponDiscountType": "amount_off",
    "couponDiscountAmount": 50,
    "couponDiscountPercent": null,
    "couponIssueCount": 3,
    // ... 其他既有欄位 ...
  }
}
```

→ 前端確實送 coupon 4 欄位。

### Step 4：確認 DB 收到什麼

Supabase Dashboard → 看 `templates.settings` row：

```json
{
  // ... 其他既有欄位 ...
  // 沒有 couponDiscountType
  // 沒有 couponDiscountAmount
  // 沒有 couponDiscountPercent
  // 沒有 couponIssueCount
}
```

→ DB 沒收到 coupon 4 欄位。

### Step 5：確認 zod 行為

寫個 isolated test：

```ts
const schema = z.object({
  a: z.string(),
  b: z.number(),
});
const result = schema.parse({ a: 'x', b: 1, c: 'dropped' });
// result = { a: 'x', b: 1 }
// c 被靜悄悄丟掉，沒有 throw、沒有 warning
```

→ 確認 zod `.object()` 預設是 `.strip()` 行為。

### Step 6：找到 root cause

打開 `apps/backend/src/modules/cards/schemas/request.ts::templateSettingsSchema`：

```ts
export const templateSettingsSchema = z.object({
  // ... 既有欄位 ...
  // 沒有 couponDiscountType
  // 沒有 couponDiscountAmount
  // 沒有 couponDiscountPercent
  // 沒有 couponIssueCount
});
```

打開 `apps/backend/src/modules/cards/db/templates.ts::TemplateSettings`：

```ts
export interface TemplateSettings {
  // ... 既有欄位 ...
  // 沒有 couponDiscountType
  // 沒有 couponDiscountAmount
  // 沒有 couponDiscountPercent
  // 沒有 couponIssueCount
}
```

→ **Rule 019 § 4.1 Layer 2 + Layer 3 完全缺 coupon 4 欄位**。

### Step 7：為什麼既有 schema-conformance 沒抓到

`apps/backend/src/modules/cards/tests/schema-conformance.test.ts` 既有測試比對的是「local templateSettingsSchema vs shared templateSettingsSchema 的 field set 一致」：

```ts
// 既有 test
it('registrationPayloadSchema fields match', () => { ... });
// ... 19 個其他 schema conformance test ...
// 沒有 coupon card 的 schema conformance test
```

→ 既有 conformance test **從來沒覆蓋 coupon card**——這是 test coverage gap。

### Step 8：為什麼 typecheck 沒抓到

TypeScript：

```ts
// 前端
cardService.update(cardId, {
  settings: {
    couponDiscountType,
    couponDiscountAmount,
    couponDiscountPercent,
    couponIssueCount,
  },
});
```

→ 通過 typecheck，因為前端 `TemplateSettings` interface 從 shared schema 來，shared schema 有 coupon 4 欄位。

但**後端 stub 沒 sync**——前端 PUT body 的 coupon 4 欄位**型別**沒問題，但**後端 runtime schema 不知道這些 key**。

### Step 9：為什麼 vitest 沒抓到

既有 vitest conformance test 沒覆蓋 coupon card 的 schema field。**測試覆蓋率 gap**。

## 修法（commit `aa884e1`）

### Layer 2 — backend request schema

```ts
// apps/backend/src/modules/cards/schemas/request.ts
import {
  COUPON_AMOUNT_MIN,
  COUPON_PERCENT_MIN,
  COUPON_PERCENT_MAX,
  COUPON_ISSUE_COUNT_MIN,
} from '@saome/shared/constants';

// 在 templateSettingsSchema 內加 4 個 coupon 欄位
couponDiscountType: z.enum(['amount_off', 'percent_off']).nullable().optional(),
couponDiscountAmount: z.number().min(COUPON_AMOUNT_MIN).finite().nullable().optional(),
couponDiscountPercent: z
  .number()
  .int()
  .min(COUPON_PERCENT_MIN)
  .max(COUPON_PERCENT_MAX)
  .nullable()
  .optional(),
couponIssueCount: z
  .number()
  .int()
  .min(COUPON_ISSUE_COUNT_MIN)
  .finite()
  .nullable()
  .optional(),
```

### Layer 3 — backend db interface

```ts
// apps/backend/src/modules/cards/db/templates.ts
export interface TemplateSettings {
  // ... 既有 fields ...
  couponDiscountType?: 'amount_off' | 'percent_off' | null;
  couponDiscountAmount?: number | null;
  couponDiscountPercent?: number | null;
  couponIssueCount?: number;
}
```

### Constants wire-up

所有 hard-coded literal 改為 import：

| Hard-coded | 改為 |
|---|---|
| `z.number().min(1)` | `z.number().min(COUPON_AMOUNT_MIN)` |
| `z.number().int().min(1).max(100)` | `z.number().int().min(COUPON_PERCENT_MIN).max(COUPON_PERCENT_MAX)` |
| `z.number().int().min(1)` | `z.number().int().min(COUPON_ISSUE_COUNT_MIN)` |

### 6 條 defensive conformance test

```ts
// apps/backend/src/modules/cards/tests/schema-conformance.test.ts
describe('templateSettingsSchema — coupon card defensive conformance (2026-09-20)', () => {
  it('rejects couponDiscountAmount at COUPON_AMOUNT_MIN - 0.01', () => {
    expect(templateSettingsSchema.safeParse({ couponDiscountAmount: COUPON_AMOUNT_MIN - 0.01 }).success).toBe(false);
  });
  it('accepts couponDiscountAmount at COUPON_AMOUNT_MIN', () => {
    expect(templateSettingsSchema.safeParse({ couponDiscountAmount: COUPON_AMOUNT_MIN }).success).toBe(true);
  });
  it('rejects couponDiscountPercent at COUPON_PERCENT_MAX + 1', () => {
    expect(templateSettingsSchema.safeParse({ couponDiscountPercent: COUPON_PERCENT_MAX + 1 }).success).toBe(false);
  });
  it('accepts couponDiscountPercent at COUPON_PERCENT_MIN', () => {
    expect(templateSettingsSchema.safeParse({ couponDiscountPercent: COUPON_PERCENT_MIN }).success).toBe(true);
  });
  it('accepts couponIssueCount = 999_999 (no upper cap per user decision)', () => {
    expect(templateSettingsSchema.safeParse({ couponIssueCount: 999_999 }).success).toBe(true);
  });
  it('accepts couponDiscountAmount = 999_999 (no upper cap per user decision)', () => {
    expect(templateSettingsSchema.safeParse({ couponDiscountAmount: 999_999 }).success).toBe(true);
  });
});
```

### 21 條 structural conformance test

既有「local vs shared schema field set 一致」邏輯擴充：

```ts
describe('schema-conformance (Rule 019 § 4.1) — coupon card fields (2026-09-20)', () => {
  // 21 條 structural test，逐一比對 shared schema 跟 backend schema 的 field 列表
});
```

## Verification

- typecheck：`tsc -b apps/backend --noEmit` exit 0
- vitest：`npm test --workspace=apps/backend` 276 passed across 18 files
- vitest schema-conformance：118/118 PASS（91 baseline + 21 structural + 6 defensive）

## 教訓

### 教訓 1：Rule 019 § 4.1 不是 optional check

每次新增 Step 6 card type sub-module 都觸發同 pattern：
1. shared schema 加欄位
2. 前端 store 加 setter
3. 後端 schema 漏加（**這次又是這條**）
4. 既有 schema-conformance 沒覆蓋新欄位（**這次又是這條**）
5. typecheck / lint / 既有 vitest 全綠（**沒有任何 warning**）
6. user review 才發現（**只能靠 user 抓**）

**修法**：

| # | Action | 時機 |
|---|---|---|
| 1 | 共享 schema 加欄位 | feature 設計階段 |
| 2 | 立刻同步 backend Layer 2 + Layer 3 + Layer 4 | **同 PR**（不要延後）|
| 3 | 跑 schema-conformance | commit 前必跑 |
| 4 | 加新欄位的 defensive conformance test | **commit 前必跑**（min-0.01 reject, min accept, max+1 reject, max accept）|
| 5 | 加新欄位的「無上限」pin test（如適用）| 若 user decision 是「無上限」，要 pin `999_999` accept |

### 教訓 2：schema-conformance test 應該在每個新欄位都加

既有 schema-conformance test 只覆蓋既有欄位，**新欄位要手動加 structural test**。這是 manual gate，不是自動 gate。

**修法（後續）**：

未來新增任何 shared schema field 時，`schema-conformance.test.ts` 必跑 `npm test --workspace=apps/backend`，確認既有 structural test 還過。若新欄位**沒對應**的 backend Layer 2 + Layer 3，**typecheck 會 catch**——只要前端 PUT body 用新欄位，且 shared schema 跟 backend schema 不對齊，`schema-conformance.test.ts` 的 structural test 會 fail。

但 typecheck 抓不到「**前端使用 + 後端 schema 沒加**」這個 drift case，因為前端 `TemplateSettings` interface 是 import 自 shared schema，shared schema 是 source of truth。

**最終修法**：把「新增 schema field」綁到「跑 schema-conformance test 確認 1+2 層 field set 對齊」——若「shared schema 有 X，但 backend schema 沒有 X」，**schema-conformance test 必須 fail**（既有 test 應該已經覆蓋這個 case）。

### 教訓 3：zod `.object()` 預設 `.strip()` 是 silent killer

`z.object({ a, b }).parse({ a: 1, b: 2, c: 3 })` 回 `{ a: 1, b: 2 }`——`c` 被靜悄悄丟掉。

**修法**：未來新欄位時，可以改成 `.strict()`（遇到 unknown key throw）而非 `.strip()`。但這是 breaking change——既有 client 可能送 schema 沒預期的 metadata。

**暫時修法**：保留 `.strip()`（向後相容），靠 schema-conformance test 抓 drift。

### 教訓 4：cross-package contract drift 需要「local + shared」雙 schema 對齊測試

SAOME 跨 frontend / backend / shared 三 package，schema drift 是 top-3 root cause（前 2 是 bug-7 deploy 漏 migration、bug-4c backend env misconfig）。

**修法**：把 Rule 019 § 4.1 升級成 **MANDATORY pre-commit hook**：

```bash
# .cursor/hooks/pre-commit
npm run check:schema-conformance --workspace=apps/backend
```

若 fail，**拒絕 commit**。

（這條下次再加，先把當下 bug 修好。）

## 觸發關鍵字

「coupon」、「coupon_card」、「Step 6 coupon」、「backend schema drift」、「zod strip」、「後端 schema 沒加」、「回填失敗」、「loadSettings 沒 hydrate」必引。

## 參照

- `.cursor/rules/019-schema-contract-drift.mdc` § 4.1 — 四層同步鐵律（這次沒過的 rule）
- `runs/improvements/feedback/20260731-register-autofill-schema-drift.md` — register 表單三連環同 pattern
- `runs/improvements/feedback/20260822-card-builder-draft-abandon-full-trace.md` — CardBuilder `isPaid` extension 同 pattern
- `runs/improvements/feedback/20260919-coupon-preview-hardcoded-discount-no-i18n.md` — coupon preview 4 bugs（sibling bug，2026-09-19）
- `apps/backend/src/modules/cards/schemas/request.ts` — Layer 2 修法範例
- `apps/backend/src/modules/cards/db/templates.ts` — Layer 3 修法範例
- `apps/backend/src/modules/cards/tests/schema-conformance.test.ts` — 自動 conformance test 範例
- `packages/shared/constants/coupon-card.ts` — single source of truth
- commit `aa884e1` — fix(backend): coupon card 4-layer schema sync + constants wire-up