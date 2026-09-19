# Backend Mirror for Coupon Card 完工 DEV LOG：4 層 Schema 同步 + Constants wire-up

## Metadata

- 日期：2026-09-20
- 範圍：Rule 019 § 4.1 四層 schema 同步漏洞修補（Layer 2 + Layer 3 補上 coupon 4 個欄位）+ constants wire-up（hard-coded literals 改為 import from shared/constants/coupon-card）+ 6 條 defensive conformance test
- 目標：
  1. 補上 backend `templateSettingsSchema`（Layer 2）的 4 個 coupon 欄位
  2. 補上 backend `TemplateSettings` interface（Layer 3）的 4 個 coupon 欄位
  3. 把 hard-coded literals（`min(1)`、`max(100)`、`Number.isInteger`）改為 import from `packages/shared/constants/coupon-card.ts`
  4. 6 條 defensive conformance test pin 死 schema 跟 constants 同步
  5. 自動驗證 schema-conformance 1+2 層 field set 一致（21 條 structural + 6 條 defensive = 27 條新 test）
- Commit：`aa884e1 fix(backend): coupon card 4-layer schema sync + constants wire-up`
- Plan ref：backend_mirror_for_coupon_schema_constants_wire-up_4190faf4.plan.md
- 對應 Rule：`.cursor/rules/019-schema-contract-drift.mdc` § 4.1（Backend Request Schema 第四層）

## 問題與根因

### 症狀

使用者填完 coupon card Step 6（couponDiscountType / couponDiscountAmount / couponDiscountPercent / couponIssueCount），按「下一步」送出 PUT，DB 確實收到 `settings` JSONB blob，**但 reload 後前端 store 沒 hydrate coupon 欄位**——全部退回 initialState 預設（type='amount_off', amount=null, percent=null, count=1）。

### Root cause：Rule 019 § 4.1 Layer 2 + Layer 3 漏了 coupon 4 個欄位

| 層 | 檔案 | 2026-09-19 前狀態 | 為什麼漏 |
|---|---|---|---|
| 1（shared schema）| `packages/shared/schemas/card.ts` | ✅ 已加 coupon 4 欄位 | Step 6 coupon card editor 實作當下 commit |
| 2（backend request）| `apps/backend/src/modules/cards/schemas/request.ts` | ❌ **缺** | 只 commit 了 shared schema，沒想到後端 stub 也得同步加 |
| 3（backend db interface）| `apps/backend/src/modules/cards/db/templates.ts` | ❌ **缺** | 同上 |
| 4（backend service 參數型別）| `apps/backend/src/modules/cards/services/cardService.ts` | ✅ 自動 via `Partial<TemplateSettings>` | 不需改 |

當 PUT 進後端時：

```
前端 PUT body:
{
  "settings": {
    "couponDiscountType": "amount_off",
    "couponDiscountAmount": 50,
    "couponDiscountPercent": null,
    "couponIssueCount": 3,
    // ... 既有 fields ...
  }
}

→ 後端 zod 解析:
templateSettingsSchema = z.object({
  // 沒有 couponDiscountType
  // 沒有 couponDiscountAmount
  // 沒有 couponDiscountPercent
  // 沒有 couponIssueCount
  // ... 既有 fields ...
}).strict(false)  // 預設是 .strip()
```

Zod 預設 `.object()` 行為是 **`.strip()`**：遇到 schema 沒宣告的 key，**靜悄悄丟掉**，不 throw、不 warning、不 trigger constraint。

→ DB 收到的 `settings` JSONB blob **完全沒有 coupon 子鍵**。

→ 再 reload，前端 `loadSettings(template.settings)`：

```ts
couponDiscountType: (() => {
  const raw = resolved?.couponDiscountType;
  if (raw === 'amount_off' || raw === 'percent_off') return raw;
  return state.couponDiscountType;   // ← 永遠 fallback 到 initialState
})(),
```

`resolved.couponDiscountType` 是 undefined → fallback 到 `state.couponDiscountType`（initialState = 'amount_off'）。使用者看到的永遠是預設值，「設定沒回填」。

### 為什麼 typecheck 跟 lint 沒抓到

- TypeScript：`cardService.update(cardId, { settings: { couponDiscountType, ... } })` 通過，因為前端 `TemplateSettings` interface（coupon 4 個欄位已經 shared export）有宣告。
- Lint：oxlint 沒 rule 檢查「後端 schema vs shared schema 同步」。
- vitest：既有 `schema-conformance.test.ts` **沒**覆蓋 coupon 欄位——conformance test 寫的是 shared vs backend field set 比對，但當時 backend Layer 2 還沒加 coupon，conformance test 也不存在（conformance test 是這次 PR 才補的）。

### 對齊既有事故

- 2026-07-31 register autofill schema drift：`tenants` table 缺 `email` / `mobile` / `website` 三欄，後端 `insertTenant` 沒欄位可寫。同 pattern——schema 加了但對應實作端沒同步。
- 2026-08-22 CardBuilder `cardType` optional drift + `isPaid` extension drift：Rule 019 § 4.1 第四層同步漏洞的 sibling case。

## 實作內容

### 1. 修 Layer 2 — `apps/backend/src/modules/cards/schemas/request.ts`

```ts
import {
  // ... 既有 imports ...
  COUPON_AMOUNT_MIN,
  COUPON_PERCENT_MIN,
  COUPON_PERCENT_MAX,
  COUPON_ISSUE_COUNT_MIN,
} from '@saome/shared/constants';

// 在 templateSettingsSchema 內加：
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

### 2. 修 Layer 3 — `apps/backend/src/modules/cards/db/templates.ts`

```ts
export interface TemplateSettings {
  // ... 既有 fields ...
  // ===== Coupon (2026-09-19) =====
  couponDiscountType?: 'amount_off' | 'percent_off' | null;
  couponDiscountAmount?: number | null;
  couponDiscountPercent?: number | null;
  couponIssueCount?: number;
}
```

### 3. Constants wire-up（hard-coded literals → imports）

| Hard-coded literal | 改為 |
|---|---|
| `z.number().min(1)` | `z.number().min(COUPON_AMOUNT_MIN)` |
| `z.number().int().min(1).max(100)` | `z.number().int().min(COUPON_PERCENT_MIN).max(COUPON_PERCENT_MAX)` |
| `z.number().int().min(1)` | `z.number().int().min(COUPON_ISSUE_COUNT_MIN)` |

理由：Rule 019 § 4.1 single source of truth。後端 schema 跟前端 store 必須共用同一份常數（`packages/shared/constants/coupon-card.ts`），否則「前端 store 拒絕 0.5、後端 schema 拒絕 0.5」這種 implicit drift 又會出現。

### 4. Defensive conformance tests（+6 條）

| # | Test | 覆蓋 |
|---|---|---|
| 1 | `safeParse({ couponDiscountAmount: COUPON_AMOUNT_MIN - 0.01 })` → `success: false` | MIN - 0.01 必須被拒（防 hard-coded `.min(1)` 偷改成 `.min(0)`）|
| 2 | `safeParse({ couponDiscountAmount: COUPON_AMOUNT_MIN })` → `success: true` | MIN 本身必須通過 |
| 3 | `safeParse({ couponDiscountPercent: COUPON_PERCENT_MAX + 1 })` → `success: false` | MAX + 1 必須被拒（防 hard-coded `.max(100)` 偷改成 `.max(999)`）|
| 4 | `safeParse({ couponDiscountPercent: COUPON_PERCENT_MIN })` → `success: true` | PERCENT_MIN 必須通過 |
| 5 | `safeParse({ couponIssueCount: 999_999 })` → `success: true` | 「無上限」決策的 pin（user decision 2026-09-19，999_999 必須通過）|
| 6 | `safeParse({ couponDiscountAmount: 999_999 })` → `success: true` | 「無上限」決策的 pin（user decision 2026-09-19）|

### 5. Schema-conformance 自動驗證（+21 條 structural）

`apps/backend/src/modules/cards/tests/schema-conformance.test.ts` 既有「shared schema vs backend schema field set 一致」邏輯，補上 coupon 4 個欄位的 structural 對齊測試：

```ts
describe('schema-conformance (Rule 019 § 4.1) — coupon card fields (2026-09-20)', () => {
  it('local templateSettingsSchema has the 4 coupon fields', () => { ... });
  it('shared templateSettingsSchema has the 4 coupon fields', () => { ... });
  it('field sets match exactly (no missing, no extra)', () => { ... });
  // ... 21 條 structural test
});
```

加 6 條 defensive test，共 +27 條新 test。

## Verification

- typecheck：`tsc -b apps/backend --noEmit` exit 0
- vitest：`npm test` 276 passed across 18 files（既有 + 新 27 條 schema-conformance）
- vitest schema-conformance：118/118 PASS（91 baseline + 21 structural + 6 defensive）

## 教訓

### 教訓 1：Rule 019 § 4.1 不是 optional check

之前的 register / CardBuilder / discount card / membership card 都觸發過四層同步漏洞。每次都是「shared schema 加了，但 backend Layer 2/3 沒同步」。**這條 rule 不是「看了就會過」，是「commit 前必跑 schema-conformance test」**。

**修法**：未來新增任何 Step 6 card type sub-module 時：
1. 先在 `packages/shared/schemas/card.ts` 加欄位 + constants
2. **立刻**同步補 backend Layer 2（`request.ts::templateSettingsSchema`）+ Layer 3（`db/templates.ts::TemplateSettings`）
3. 跑 `npm run test --workspace=apps/backend` 確認 `schema-conformance` 通過
4. 寫**新欄位的 defensive conformance test**（MIN-0.01 reject / MIN accept / MAX+1 reject / MAX accept）

### 教訓 2：constants wire-up 不是 nice-to-have，是必做

Hard-coded `min(1)` 跟 import `COUPON_AMOUNT_MIN` 看起來沒差。但**前端 store 的 `setCouponDiscountAmount` 用 `COUPON_AMOUNT_MIN`，後端 schema 也用 `COUPON_AMOUNT_MIN`**——任何一邊改常數，另一邊自動跟上。

如果兩邊都 hard-coded，未來「把下限從 1 改成 5」就會漏一邊（典型 P0：前端 store 允許 5，但後端 schema 拒絕 → 使用者輸 5 → 400 錯誤）。

### 教訓 3：zod `.object()` 預設 `.strip()` 是 silent killer

`z.object({ a, b }).parse({ a: 1, b: 2, c: 3 })` 回 `{ a: 1, b: 2 }`——`c` 被靜悄悄丟掉。沒有 throw、沒有 warning、沒有 console.error。

**修法**：未來任何 schema 新增 field 時，**必跑 conformance test 驗證 1+2 層 field set 一致**。這條已在 `schema-conformance.test.ts` 內自動驗證。

### 教訓 4：「無上限」決策要 pin test

coupon 的 `couponDiscountAmount` 跟 `couponIssueCount` 都 user decision 2026-09-19 明確「無上限」。但「無上限」很容易被「為了安全」偷加 `.max(9999)` 或 `.max(Number.MAX_SAFE_INTEGER)`。

**修法**：test 5 + 6 明確 pin `safeParse({ 999_999 })` 必須通過。未來改 user decision 才會 fail。

## 參照

- `.cursor/rules/019-schema-contract-drift.mdc` § 4.1 — 四層同步鐵律
- `.cursor/rules/019-schema-contract-drift.mdc` § 6 — DB CHECK constraint vs zod enum 同步
- `runs/improvements/feedback/20260919-coupon-step6-no-backfill-backend-schema-drift.md` — Bug-5 完整 trace（user-visible 症狀 + repro steps）
- `runs/improvements/feedback/20260822-card-builder-draft-abandon-full-trace.md` — `isPaid` extension drift 同 pattern
- `runs/improvements/feedback/20260731-register-autofill-schema-drift.md` — register 表單三連環同 pattern
- `apps/backend/src/modules/cards/schemas/request.ts` — Layer 2 修法範例
- `apps/backend/src/modules/cards/db/templates.ts` — Layer 3 修法範例
- `apps/backend/src/modules/cards/tests/schema-conformance.test.ts` — 自動 conformance test
- `packages/shared/constants/coupon-card.ts` — single source of truth
- commit `aa884e1` — fix(backend): coupon card 4-layer schema sync + constants wire-up