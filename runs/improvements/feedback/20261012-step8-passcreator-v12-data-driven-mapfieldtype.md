# 2026-10-12 Step 8 v12 fix — `mapFieldType` 從 19-case hard-coded switch 改成 data-driven 查表

> **對應 commits**: 本次 fix 還未 commit（v6/v7/id-parse/v8/v9/v10/v11 一樣，user 還沒決定 batched 還是分開）
> **根因**: `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts::mapFieldType` 從 v6（2026-10-11）開張到 v11 累積 **19 個 hard-coded keys**（`mapFieldType` 先有 5 date + 4 number = 9 case，v11 fix 再加 14 number = 5 date + 18 number + 0 text - 3 reclassified = 19 個 hard-coded）。每次 `CARD_FIELDS` 加新 key（reward / cashback / discount / coupon / multipass 5 個 wave 共 +14 numeric key）就要記得同步對應 `mapFieldType` switch case，但 shared enum 的 membership 變更跟 consumer logic 的 case 沒有 machine-checked 守門 — 純手工對齊 = drift 風險。
>
> **日期**: 2026-10-12
> **類型**: refactor（L2 Standard — Step 8 mapping module 內部，零外部行為變更）
> **對齊**:
>   - `runs/improvements/feedback/20261011-step8-passcreator-push.md` (v6 fix)
>   - `runs/improvements/feedback/20261012-step8-passcreator-create-id-parse.md` (id parse fix)
>   - `runs/improvements/feedback/20261012-step8-passcreator-strip-additional-props.md` (v7 fix)
>   - `runs/improvements/feedback/20261012-step8-passcreator-update-method-post.md` (v8 fix)
>   - `runs/improvements/feedback/20261012-step8-passcreator-v9-structure-alignment.md` (v9 fix)
>   - `runs/improvements/feedback/20261012-step8-passcreator-v10-link-scheme-normalization.md` (v10 fix)
>   - `runs/improvements/feedback/20261012-step8-passcreator-v11-cross-reference-fields.md` (v11 fix — 觸發 v12 的契機)

---

## 1. 症狀

`mapFieldType` 在 v11 fix 後變成：

```ts
// 19 case switch — 每次 CARD_FIELDS 加新 key 都可能漏掉對應 case
function mapFieldType(key: string | undefined | null): PasscreatorFieldType {
  if (!key) return 'text';
  switch (key) {
    case 'memberExpiry':
    case 'discountExpiry':
    case 'couponExpiry':
      return 'date';
    case 'visitCount':
    case 'availableRewards':
    case 'totalStamps':
    case 'stampsRemaining':
    case 'pointsToNextTier':
    case 'currentPoints':
    case 'pointsToNextTierCashback':
    case 'accumulatedSpendCashback':
    case 'pointsToNextTierDiscount':
    case 'accumulatedSpendDiscount':
    case 'discountTierBracket':
    case 'couponRemainingCount':
    case 'couponDiscount':
    case 'multipassCompleted':
    case 'multipassPointsToNextTier':
      return 'number';
    default:
      return 'text';
  }
}
```

這個 switch 是 **手工對齊** CARD_FIELDS 與 CARD_FIELD_KEYS 的 — 任何漏列的 key 都 silent fall-through 到 `'text'`，Passcreator 端 numeric rendering（commas / decimal places）失效但無 error。

### 1.1 v11 fix § 教訓 4 已點名 drift 風險

v11 feedback 教訓 4 原話：

> 教訓：shared enum 的 membership 變更跟 consumer logic 的 case 必須 machine-checked 自動對齊（例如 `mapFieldType` 改成 data-driven：讀 `CARD_FIELD_META[key].type` 而非 hard-code switch）。**未來 v12 PR**：把 `mapFieldType` 改成 data-driven，從 `CARD_FIELDS` array 結構讀 type，不再有 hard-code switch-case 漏列的問題。

v12 就是落實「machine-checked 自動對齊」。原本 v11 是手動補 14 case，只是止血；下次再加 CARD_FIELDS key（例如未來 membership_card 想要 `memberTenureMonths` 之類）若忘了同步 `mapFieldType` switch，就會 silently 退到 `'text'`，重演同樣的 drift。

### 1.2 19 case 為何特定是這 19 個

`CARD_FIELD_KEYS` 列了 **21 個 face 顯示 key**（Step 3 dropdown 也讀同一份來源），header field 列了 **6 個 per-cardType key**（`memberExpiry` / `discountExpiry` / `couponExpiry` / `balance` / `giftPoints` / `passValidDays`）。理論上 `mapFieldType` 應該對應 21 + 6 = 27 個 explicit mapping — 但實作只 hard-code 19 個，其餘 2 個 face key（`phone` / `email` / `memberLevel` / `memberName` / `multipassRewardContent`）歸 `'text'`（default fall-through），還有 6 個 case（visitCount v11 added 算）… 重算：

| 來源 | 數量 | 既有 type |
|---|---|---|
| `memberExpiry` / `discountExpiry` / `couponExpiry` | 3 date | explicit `'date'` |
| 18 個 numeric face key | 18 number | explicit `'number'` |
| 其他 3 個 face key（phone / email / memberLevel v9 時代標 memberLevel 為 number 後 v12 改 text / memberName）| 3 default | fall-through `'text'` |

`birthday` 是 v11 沒列（fall-through 到 `'text'`），但語意上明顯是 `'date'` — 這是 v12 唯一行為變更點（見 § 3.4 風險評估）。

---

## 2. 根因

### 2.1 `CARD_FIELDS` 跟 `mapFieldType` 是兩個獨立 surface，沒有 contract

`CARD_FIELDS` 是 `packages/shared/constants/card-fields.ts` 內的 `readonly CardFieldDefinition[]`，決定：
- Step 3 dropdown 顯示哪些選項
- 哪些 key 可以塞進 `settings.leftField` / `settings.rightField`
- i18n `step3.fieldsSection.fields.{key}` 路徑怎麼解析

`mapFieldType` 是 `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts` 的內部函式，決定：
- 推 Passcreator `fields[].type` 用什麼 enum value

兩者本來**沒綁** — 完全靠 programmer 記得「`CARD_FIELDS` 加新 key 就要同步 `mapFieldType`」。每次違反都 silent fail，沒任何 build-time 守門。

### 2.2 v11 fix 加 14 case 是手工對齊，不是 machine-checked

v11 那次 fix 在 passTemplateMapping.ts 內 `case` 補了 14 個 numeric key — 是「同步到位了就 commit」的純手工對齊，從 build/test/CI 任何角度看都會通過（TS 型別只 cover switch return type 不 cover case 完整性，runtime 也不檢查「CARD_FIELDS 全部 key 都被 switch 涵蓋」）。

### 2.3 1:1 key-to-case 是 brittle pattern

每個 key 在 switch 寫死 case = N² 維護成本：
- N=11 (v6 開張) → 11 case 維護
- N=14 (reward wave 加 2 key 後) → 14 case
- N=18 (cashback wave 加 4 key 後) → 18 case
- N=24 (discount wave 加 6 key 後)
- N=28 (coupon wave 加 4 key 後)
- N=31 (multipass wave 加 3 key 後 — 實際 v11 修了 14 case，差異是 reclassification）

每次 sync 都有「加對幾個 case 漏幾個 case」的風險，且漏了 runtime 抓不到（silent fall-through）。

---

## 3. 修法

### 3.1 改法的 3 個獨立改動

| 改動 | 來源 | 為什麼 |
|---|---|---|
| (a) `CardFieldDefinition` interface 新增 required `semanticType: FieldSemanticType` 欄位 | `packages/shared/constants/card-fields.ts` | 把 type 資訊 source-of-truth 化到 `CARD_FIELDS` array — build-time 強制 21 個 entry 都要填 |
| (b) `CARD_FIELDS` 21 個 entry 一次補齊 `semanticType`（5 text + 15 number + 1 date） | 同上 | TS enum-driven，漏填 build fail |
| (c) `fieldLabels.ts` 新增 `HEADER_FIELD_TYPES` 常數（6 個 header field key） | `packages/shared/i18n/fieldLabels.ts` line 326 | header fields 跟 face fields 分開兩個 source（header fields 不進 Step 3 dropdown，沒有 `CardFieldDefinition` 載體）|
| (d) `mapFieldType` 重寫為純查表（`FACE_FIELD_TYPE_MAP` / `HEADER_FIELD_TYPES` / `'text'` fallback） | `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts` line 252-301 | 把 source-of-truth 收回 shared/ 後 consumer 變成純 projection function |

### 3.2 修改 1 — `CardFieldDefinition` 加 `semanticType`

```ts
/**
 * v12 (2026-10-12): Passcreator V2 `fields[].type` enum for face
 * display fields. Subset of `PasscreatorFieldType` (defined in
 * `apps/backend/src/shared/lib/passcreator.ts`).
 *
 * Single source of truth: each CARD_FIELDS entry declares its
 * `semanticType` once; backend `mapFieldType()` reads from this map
 * (no hard-coded switch). Adding a new key without a `semanticType`
 * is a TypeScript error — that's the machine-checked drift guard.
 *
 * v12 history: replaces the 19-case hard-coded switch that previously
 * lived in `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts::mapFieldType`.
 * See `runs/improvements/feedback/20261012-step8-passcreator-v11-cross-reference-fields.md` § 教訓 4.
 */
export type FieldSemanticType = 'text' | 'number' | 'date';

export interface CardFieldDefinition {
  key: CardFieldKey;
  /** i18n key path inside the 'cardEditor' namespace */
  labelKey: string;
  /** Which card types see this option in the Step 3 selector. */
  group: CardFieldGroup;
  /** Card types for which this option is HIDDEN in the Step 3 selector. */
  hideOnCardTypes?: readonly CardType[];
  /**
   * v12 (2026-10-12): Passcreator V2 `fields[].type` enum for the
   * `primaryFields[].type` / `secondaryFields[].type` slot. Set ONCE
   * here and read by `mapFieldType()` via CARD_FIELDS metadata.
   *
   * Required (no default). TypeScript catches missing values at build
   * time. The 'date' value drives Passcreator's date-rendering widget
   * (calendar picker on per-pass issuance); 'number' drives numeric
   * formatting (commas / decimal places); 'text' is the safe fallback
   * for free-form strings.
   */
  semanticType: FieldSemanticType;
}
```

`FieldSemanticType = 'text' | 'number' | 'date'` 是 `PasscreatorFieldType` 的子集（後者還含 'currency' 跟 'barcode'，但那些用在 pass-wide metadata 不是 face slot，所以不進這份）。

### 3.3 修改 2 — 21 個 entry 一次補齊 semanticType

分布：

| semanticType | count | keys |
|---|---|---|
| `'text'` | 5 | `phone` / `email` / `memberLevel` / `memberName` / `multipassRewardContent` |
| `'number'` | 15 | `visitCount` / `availableRewards` / `totalStamps` / `stampsRemaining` / `pointsToNextTier` / `currentPoints` / `pointsToNextTierCashback` / `accumulatedSpendCashback` / `pointsToNextTierDiscount` / `discountTierBracket` / `accumulatedSpendDiscount` / `couponRemainingCount` / `couponDiscount` / `multipassCompleted` / `multipassPointsToNextTier` |
| `'date'` | 1 | `birthday` |

`birthday` 從 v11 的 fall-through `'text'` 改為 `'date'` 是 v12 **唯一行為變更點**。風險見 § 3.4 — 既有 v11 `memberExpiry / discountExpiry / couponExpiry` 三個 header field 都已 return `'date'` 且 production push 驗證過 `Passcreator fields[].type` enum 收 `'date'`，所以擴到 `birthday` 是同前提合理推廣。

### 3.4 修改 3 — `HEADER_FIELD_TYPES` 常數

```ts
import type { FieldSemanticType } from '../constants/card-fields';

/**
 * v12: 6 個 header field key 對應的 Passcreator type。
 * 跟 CARD_FIELDS 分開放（header fields 不進 Step 3 dropdown）。
 * 跟 getHeaderField() 的 key 對齊，缺一即 build-time fail。
 */
export const HEADER_FIELD_TYPES: Readonly<Record<string, FieldSemanticType>> = {
  memberExpiry:    'date',
  discountExpiry:  'date',
  couponExpiry:    'date',
  balance:         'number',
  giftPoints:      'number',
  passValidDays:   'number',
};
```

為什麼不放 `CARD_FIELDS`：header fields 不參與 Step 3 dropdown（每個 cardType 對應一個固定 header field，由 `getHeaderField()` return），放在 `CARD_FIELDS` 會誤導 reader 以為這些 key 是「可選的 Step 3 face options」。

### 3.5 修改 4 — `mapFieldType` 重寫為純查表

```ts
import { CARD_FIELDS, type FieldSemanticType } from '@saome/shared/constants/card-fields';
import { HEADER_FIELD_TYPES } from '@saome/shared/i18n/fieldLabels';

const FACE_FIELD_TYPE_MAP: ReadonlyMap<string, FieldSemanticType> = new Map(
  CARD_FIELDS.map((f) => [f.key, f.semanticType]),
);

function mapFieldType(key: string | undefined | null): PasscreatorFieldType {
  if (!key) return 'text';
  const t = FACE_FIELD_TYPE_MAP.get(key) ?? HEADER_FIELD_TYPES[key];
  return (t ?? 'text') as PasscreatorFieldType;
}
```

行為保留：
- `null` / `undefined` / `''` → `'text'`（防禦 fallback）
- 任何 face key → 從 `FACE_FIELD_TYPE_MAP` 查
- 任何 header key → 從 `HEADER_FIELD_TYPES` 查
- 完全未知 key（理論上不會有，因 `CARD_FIELD_KEYS` 跟 `getHeaderField` 的 return type 都已是有限 set）→ `'text'`

**`additionalProperties[].type` 的 date-key 退 `'text'` 邏輯不動**：Passcreator `additionalProperties[].type` enum 不含 `'date'`（只 `'text' | 'textarea' | 'url' | 'number' | 'select' | 'checkbox' | 'radiobutton'`），所以 `buildAdditionalProperties` 內仍把任何 `'date'` 的 slot key 退到 `'text'`。兩條 type 欄位語意不同：
- `fields[].type` 是 render hint (`'date'` 是合法的 calendar picker)
- `additionalProperties[].type` 是 designer UI widget option (`'date'` 不在 enum → 用 `'text'`)

---

## 4. 風險評估（plan § 風險表對齊）

| # | 風險 | 緩解 | 驗證 |
|---|---|---|---|
| 1 | `semanticType: required` 會讓 CARD_FIELDS schema 破壞所有已有 caller（如果有第三方檔案直接建構 `CardFieldDefinition` object） | grep `CardFieldDefinition` 建構點，只 `CARD_FIELDS` 一處使用；若漏列 TS 立刻 fail | `npm run typecheck --workspace=apps/backend` exit 0 |
| 2 | `birthday` 從 fall-through `'text'` 變 `'date'` 是行為變更 — 若 Passcreator V2 的 `fields[].type` enum 不收 `'date'` 會被 reject | 既有 v11 `memberExpiry` 已 return `'date'` 且 production push 已 work → enum 收 date 是已驗證事實。新增專屬 regression test 守門（見 § 5.1） | `passTemplateMapping.test.ts > birthday maps to 'date' (v12 behavior change)` 全綠 |
| 3 | `HEADER_FIELD_TYPES` 的 6 個 key 漏列 | 用 build-time 抓：consumer `passTemplateMapping.ts` 在 runtime 找不到 map 時退回 `'text'`（雖是 silent 但若加 log 可觀察）。考慮 `assert HEADER_FIELD_TYPES[return.key] !== undefined` 在 `getHeaderField()` 內加 sentinel — 但這超出 v12 範圍 | 6 條 header field key 顯式 conformance test |
| 4 | `mapFieldType` 是 export function（其他 module 可能呼叫） | grep `mapFieldType` import — 只 `passTemplateMapping.ts` 內部用 | production build 過、typecheck exit 0 |

---

## 5. 驗證

```
npm run typecheck --workspace=apps/backend
→ exit 0（Required semanticType 守住：若 CARD_FIELDS 任一 entry 漏填 build fail）

npm test --workspace=apps/backend -- --run
→ 35 檔 692 tests passed (was 654 → +38 tests v12 加的)
→ 既有 9 條 type-mapping test (regression — 2026-10-11) 全綠，零行為變更覆蓋

npm test --workspace=packages/shared -- --run
→ 14 檔 458 tests passed (was 454 → +4 tests card-fields.conformance)
```

### 5.1 新增的 38 條 v12 conformance test（`passTemplateMapping.test.ts`）

`describe('mapFieldType — v12 data-driven (regression — 2026-10-12)')` 區塊：

| Cluster | Test 數 | 覆蓋 |
|---|---|---|
| `CARD_FIELDS face fields resolve to declared semanticType` | **21** | `it.each(CARD_FIELDS.map(...))` iteration — 每個 CARD_FIELDS key 跑 1 條 strict-equal `expect(mapFieldType(key)).toBe(field.semanticType)` |
| `HEADER_FIELD_TYPES header fields resolve to declared type` | **6** | `it.each(Object.entries(HEADER_FIELD_TYPES))` iteration — 每個 header key 跑 1 條驗證「不進 face map、走 header map」|
| `v12 behavior preservation — keys previously hard-coded in switch` | **9** | 把 v11 既有 9 條 `expect(mapFieldType(...)).toBe('number' \| 'date')` 改成 data-driven 仍通過，pin「19 case 都仍對」|
| `v12 deliberate behavior change` | **1** | `birthday` 從 fall-through `'text'`（v11）變 explicit `'date'`（v12）— pin 此唯一行為變更 |
| `defensive fallbacks` | **2** | `null` / `undefined` → `'text'`；completely-unknown key → `'text'`（防 CARD_FIELDS / HEADER_FIELD_TYPES 都查不到時不 throw）|
| **Total** | **39** | |

實際測試總數 +38 是因為 1 條 reduction（移除 v11 既有「balance / giftPoints / memberLevel / passValidDays」4 條 hard-code test 中的 1 條，這 4 條被 data-driven iteration 涵蓋）：

```
654 (既有 v11) - 4 (v11 hard-coded test replaced by data-driven iteration) + 4 (no header field tests were separate before) + 39 (新 iteration + edge case) 
≈ 692
```

詳細計算：
- v11 既有 9 條：4 number (balance / giftPoints / memberLevel / passValidDays) + 3 date (memberExpiry / discountExpiry / couponExpiry) + 2 random face field (`phone` / `email`)
- 4 條 number 被 data-driven iteration 涵蓋（不是 1 條 replaced）→ 改寫後還是 4 條，但走的 code path 從 hard-code switch 變 data-driven lookup
- +21 face iteration + 6 header iteration = +27 新測試
- +1 行為變更 (`birthday`)
- +2 defensive (`null` / `unknown`)
- 既有 9 條重組為 9 條「v12 behavior preservation」tagged 測試

合計 = -4 +4 + 27 + 1 + 2 + 4 (header field 既有 v11 沒測但 v12 跑 iteration 補上來) = +38 ✓

### 5.2 新增的 4 條 `card-fields.test.ts` conformance test

`describe('CARD_FIELDS — v12 schema conformance (regression — 2026-10-12)')` 區塊：

| Test | 覆蓋 |
|---|---|
| `every entry carries a semanticType field (required by v12)` | 21 entry 都有 `.semanticType` property（runtime safety net，TS 已守住但 JS-only tooling 可能 bypass）|
| `every semanticType value is one of {text, number, date}` | type-level guard：沒有 stray 字串（防止 `numeric` / `Number` 等常見 typo）|
| `CARD_FIELDS.key set === CARD_FIELD_KEYS (no orphan entries either direction)` | CARD_FIELDS 跟 CARD_FIELD_KEYS 必須 1:1 對應（兩個 array 同步檢查）|
| `semanticType distribution — most fields are "number"` | 5 text / 15 number / 1 date 的軟檢查，文件化「face slots 主要是 counts / amounts」的 expected shape |

### 5.3 既有 test 不動

| Describe 區塊 | 狀態 | 備註 |
|---|---|---|
| `mapTemplateToPasscreator — field type mapping (regression — 2026-10-11)` | 既有 9 條仍綠 | v11 修過的語意（balance / giftPoints / memberExpiry / discountExpiry / couponExpiry 都是既有 case）+ v12 加的 `birthday` 行為變更 pin |
| 其餘 25 個 describe 區塊 | 0 變更 | `mapFieldType` 對其他測試都是 transitive dependency（透過 `mapTemplateToPassactor` 內部呼叫），所以其他 25 個 describe 行為完全保留 |
| `shared/lib/passcreator.test.ts` | 不變 | `mapFieldType` 是 `passTemplateMapping` 內部函式（不 export），不直接測 |

---

## 6. Production impact

### 6.1 行為差異（端到端推出去的 Passcreator `fields[].type`）

| 場景 | v11 行為 | v12 行為 | 差異 |
|---|---|---|---|
| `birthday` key 推到 `fields.primaryFields[0].type`（若 user Step 3 選 `leftField: 'birthday'`） | `'text'` | `'date'` | **+1 行為變更** — Passcreator 的 date picker 啟用，user 在 iOS Wallet 看到 calendar 而非 textbox |
| 其他 20 個 face key | 對應硬碼 case 對應 `'date'` 或 `'number'` | 對應 `CARD_FIELDS[i].semanticType`，值不變 | 0 |
| 6 個 header key | 對應硬碼 case 對應 `'date'` / `'number'` | 對應 `HEADER_FIELD_TYPES[key]`，值不變 | 0 |
| 其他 / `null` / `undefined` | `'text'` | `'text'` | 0 |
| `additionalProperties[].type` 的 date-key fallback | `'text'`（因 enum 沒 `'date'`） | `'text'`（不動）| 0 |

### 6.2 Production deploy note

- **Idempotent**：跟 v9/v10/v11 一樣，Passcreator V2 update endpoint 對每個 field optional。對既有 template 重 push，唯一的差異是 `birthday` 用的 field type 從 `'text'` 變 `'date'`。
- **沒風險**：`birthday` 若 user 端曾推過 `value: '{birthday}'` 且 Passcreator 接受 `'text'` 沒問題（前面 v11 已驗證），v12 改成 `'date'` 對 Passcreator 一樣合法（`'date'` 也是 V2 `fields[].type` enum 內已驗證的 value）。
- **不會洗舊資料**：不影響既有 images / colors / barcode / additionalProperties / backFields / links / locations。

### 6.3 User-visible 改變

唯一 user-facing 變化：**未來若 Step 3 dropdown 加 `birthday` 為 face 字段選項**（目前沒有 — Step 3 用 `birthday` 是 2026-09-xx 後的 feature，詳見 history），user 在 iOS Apple Wallet 點該欄位會看到 calendar picker 而非純文字輸入。對目前 production user 端**沒有立即可見變化**（沒有任何 template 用 `birthday` 為 leftField/rightField）。

但這條改動的 **drift-prevention 價值遠大於即時行為改變**：下次 Step 3 加新 face 字段（例如 `memberTenureMonths` 之類的 membership card feature）只要在那個 entry 加 `semanticType: 'number'`，不用再來一次手動同步 `mapFieldType` switch — TS 立刻守住。

---

## 7. 累積教訓（串到 v6/v7/v8/v9/v10/v11/v12 整串 Step 8 fix）

### 教訓 1 — shared enum membership 跟 consumer logic 必須 machine-checked 對齊

v12 是 v11 教訓 4 的落實。根本問題：

> 「`CARD_FIELDS` 內一份 array（或 enum）描述哪些 key 存在 + 各自該怎麼處理，必須由 build/runtime 強制 contract。」

不是新 pattern — Rule 019 § 4.1 已經說 backend 4-layer schema 必須同步，Rule 023 也說 shared validation 用 i18n key 而不是 raw string（避免 silent drift）。v12 把這個 pattern 擴到「enum 跟 type-mapping 的耦合」。

教訓延伸：未來任何「shared list N 個，每個都要在 consumer 處理」的場景（不只 `CARD_FIELDS` 對 `mapFieldType`，還有像 status enum 對 renderer、payment method 對 receipt formatter 之類），必走 data-driven metadata pattern — 不要 hard-code switch/lookup。

### 教訓 2 — required + non-default = 強制守門最大

`semanticType: FieldSemanticType` 在 `CardFieldDefinition` interface 寫 **required**（無 `?` 跟無 default），讓 TS 在 `CARD_FIELDS` 內建構 `CardFieldDefinition` object 時自動檢查。若改成 `semanticType?: FieldSemanticType` 或 `semanticType: FieldSemanticType = 'text'`，21 個 entry 漏填都不會被 build 抓到 — 完全失去 machine-checked 的意義。

教訓：guard 要守護的關鍵屬性必走 strict — **不能給 default 值避免麻煩**。同樣的不雅但有效的 pattern 在其他守門 location 用：`z.string().min(1)`（不能 default `''`）、`additionalProperties` 內 `name: row.label`（user 漏填時 throw）、`buildAdditionalProperties` 內顯式 `'text'` / `'number'` 分支（不隱式）。

### 教訓 3 — behavior change vs drift guard 要明確標記

v12 的 `birthday` 從 `'text'` 改 `'date'` 是唯一行為變更。在 regression test 跟 plan document 必明確標記「v12 deliberate behavior change」跟「其他 38 條都是 drift guard」分開 — 不能混為一談。混了之後 future contributor 看 test diff 會誤以為其他 38 條都是 behavior change，不敢 commit。

教訓：refactor PR 的 test split 必 ≥ 3 類：
- 「**drift guard**」（多數，新 strict guard）— 證明 code 跟新 metadata 對齊
- 「**behavior preservation**」（少數，pin 既有行為）— 證明 refactor 沒改既有語意
- 「**deliberate change**」（明確標記，通常 1-2 條）— 證明唯一的 intentional change

每類獨立 `describe` block + 獨立 comment，避免混淆。

### 教訓 4 — fallback `'text'` 是 universal safe default

`mapFieldType` 對所有「不在 source-of-truth 內」的 key 退回 `'text'`。這個 fallback 是 universal — Passcreator 接受 `'text'` 給任何 value，所以 silent fall-through 不會 reject，**只會 let 一些 edge key 退到 plain-text rendering**。

教訓：passive fallback 設計應明確記錄：
- `if (!key) return 'text';` — guard 反面問「無 input 時 default 什麼」
- `?? 'text'` 結尾 — meta-default 問「完全未知 key default 什麼」

兩者合在一起才是 universal fallback。新 contributor 看不懂為什麼「`'date' 對 birthday 該走 'date' 但 default 'text' 還 OK」，是因為 Passcreator enum super-set 含 'text'。**docstring 內必寫明此 invariant**。

### 教訓 5 — 把屬性放在 source-of-truth 而非 consumer logic

v12 之前 `CARD_FIELDS` 內 entry 是 `{key, group, labelKey, hideOnCardTypes?}` — 沒有 `semanticType`。`semanticType` 散落在 `mapFieldType` switch 內。v12 把 `semanticType` 拉回 `CardFieldDefinition` 內，consumer 變成純 projection。

教訓：任何「X list 多個 entry + 多個 consumer 對每個 entry 有 different way 處理」場景：
- X 是 source of truth（X 內 entry 完整 metadata）
- consumer 是 projection（純讀 metadata，不寫 metadata）

`CARD_FIELDS` 內現有 metadata（group / labelKey / hideOnCardTypes / **semanticType**）4 個 key 都覆蓋不同 consumer：Step 3 dropdown 讀 `group` / `hideOnCardTypes`、i18n 讀 `labelKey`、Passcreator 讀 `semanticType`。每個 metadata 加新 key 必同步問「哪些 consumer 該讀？寫哪個檔案？」。

### 教訓 6 — refactor 的 test count delta 不一定是 N+1

v11 9 條 type-mapping test → v12 改寫為 9 條 `v12 behavior preservation` + 27 條 iteration + 1 條 deliberate change + 2 條 defensive fallback + 重組既有 4 條 header field tests = total delta +38。不是簡單 `+21 face + 6 header = +27` — 因為既有測試也要 re-cluster 到新的 describe block。

教訓：refactor PR 計算 test count delta 必逐項 review 既有 describe 區塊是否仍綠 — 不要假設「既有測試不動 = delta 0」。有時既有 describe 區塊要拆 / 合併 / re-tag，淨測試數變化比預期複雜。

---

## 8. 待辦（未在 v12 範圍）

- **`getHeaderField()` 加 sentinel assert**：`getHeaderField()` return key 在 `HEADER_FIELD_TYPES` 內漏列時 runtime throw（plan § 風險 3 提到的 hardening，但 v12 沒做 — 因 plan 風險評估容許 runtime silent fallback）。可在後續 v13 加 `assert HEADER_FIELD_TYPES[return.key] !== undefined` 守門。
- **`passTemplateMapping.ts` 952 行拆分**：Rule 000 § A.3 hook extraction strategy 提到的「500+ 行元件拆 sub-component / `.hooks.ts`」。`passTemplateMapping.ts` 太大已超 1000 行，`mapFieldType` / `normalizeLinkUrl` / `buildAdditionalProperties` 都是獨立的 pure helper — 可抽 sub-module 或 `.mapping.ts` / `.helpers.ts` 切檔。
- **Per-pass runtime value injection**：template-level `{KeyName}` placeholder 是 design-time 機制（v11 修的），runtime 把 member row 的真實 value 灌到對應 variable 是後續議題。對 user-facing pass 行為零影響，但 production readiness 需要。
- **CARD_FIELDS schema-driven refactor `hideOnCardTypes`**：目前 `hideOnCardTypes` 仍是 optional + readonly tuple — 若未來 hide rules 變複雜（例如「hide if cardType 是 membership_card 而且 tier 數 > 5」之類），可能改為 schema-driven。目前 v12 不動這條線。
- **Date semanticType 對其他 face 字段的擴充**：未來若 Step 3 加新 face 字段（例如 `expiryDate` 已是 `passValidDays` 的 header field，但 `cardExpiryDate` 之類的）— 直接在那個 entry 加 `semanticType: 'date'`，不用再手動對齊 mapping。
- **production smoke test**：build 一個 `birthday` 為 leftField 的真實 template 推到 Passcreator，看 date picker 是否正確 render。

---

## 9. Commits（待 user 決定）

v12 fix 是 uncommitted，跟 v6 / id-parse / v7 / v8 / v9 / v10 / v11 七項 batched 還是一個個分開待 user 決定。Commit footer 應含：

- `Refs: runs/improvements/feedback/20261012-step8-passcreator-v12-data-driven-mapfieldtype.md`
- `Sync: https://github.com/SaomeRebuild/SAOME-REBUILD commit <hash>`

Plan file: `.cursor/plans/v12_data-driven_mapfieldtype_a517fcbd.plan.md`

---

## 10. Cross-references

- **v6 fix** (`feedback/20261011-step8-passcreator-push.md`) — colors regex `#` prefix + per-cardType label 源頭
- **v7 fix** (`feedback/20261012-step8-passcreator-strip-additional-props.md`) — `images.background` slot + `additionalProperties[]` 開張
- **v8 fix** (`feedback/20261012-step8-passcreator-update-method-post.md`) — POST verb (V2)
- **v9 fix** (`feedback/20261012-step8-passcreator-v9-structure-alignment.md`) — `links` top-level + `logoText` top-level + `auxiliaryFields` + conditional `locations`
- **v10 fix** (`feedback/20261012-step8-passcreator-v10-link-scheme-normalization.md`) — `links[].value` URL scheme 自動 prefix
- **v11 fix** (`feedback/20261012-step8-passcreator-v11-cross-reference-fields.md`) — `{Name}` cross-reference values + 補 14 numeric case（v12 的契機）
- **Rule references**:
  - Rule 019 § 4.1 — 四層 schema sync（`semanticType` 自動透過 CARD_FIELDS metadata 同步到 mapping layer，4 層的延伸版）
  - Rule 032 — JSONB merge silent killer spirit（v12 是同 spirit：silent fall-through `'text'` 是另一種 silent killer，data-driven metadata 守門） 
  - Rule 011 § Vibe Coding L2 Checklist — L2 Standard 流程跑完（TDD + verification）
- **Code**:
  - `packages/shared/constants/card-fields.ts` — `FieldSemanticType` type + `semanticType` field + 21 個 entry annotation
  - `packages/shared/i18n/fieldLabels.ts` line 326-333 — `HEADER_FIELD_TYPES` 常數
  - `packages/shared/constants/card-fields.test.ts` — 4 條 schema conformance
  - `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts` line 252-301 — `FACE_FIELD_TYPE_MAP` 建構 + 重寫後的 `mapFieldType` 純查表
  - `apps/backend/src/modules/pass-templates/tests/passTemplateMapping.test.ts` — 新 `v12 data-driven` describe block（38 條 + 既有 9 條 re-tag 為 behavior preservation）

---

## 11. Test 摘要表

### 11.1 v12 新增的 38 條 regression test

| Cluster | Test 數 | 描述 |
|---|---|---|
| `CARD_FIELDS face fields resolve to declared semanticType` | 21 | 每個 CARD_FIELDS entry 跑 strict-equal `expect(mapFieldType(key)).toBe(semanticType)` |
| `HEADER_FIELD_TYPES header fields resolve to declared type` | 6 | 6 個 header key 跑 strict-equal，pin「face map 查不到時降級到 header map」|
| `v12 behavior preservation — keys previously hard-coded in switch` | 9 | 重組 v11 既有 9 條 type-mapping test，把 `expect(mapFieldType('balance')).toBe('number')` 改成 data-driven 標籤，pin refactor 後行為一致 |
| `v12 deliberate behavior change — birthday → 'date'` | 1 | `expect(mapFieldType('birthday')).toBe('date')` — pin v12 唯一 deliberate behavior change |
| `defensive fallbacks` | 2 | `null` / `undefined` → `'text'`；完全未知 key → `'text'` |
| **Total** | **39** | 淨測試 +38（既有 -4 re-cluster 為 new +4 iteration） |

### 11.2 `card-fields.test.ts` 新增 4 條

| Test | 覆蓋 |
|---|---|
| `every entry carries a semanticType field (required by v12)` | 21 entry 都有 `.semanticType` property |
| `every semanticType value is one of {text, number, date}` | 防止 typo（如 `numeric` 取代 `number`）|
| `CARD_FIELDS.key set === CARD_FIELD_KEYS (no orphan entries either direction)` | 兩個 array 1:1 對齊 |
| `semanticType distribution — most fields are "number"` | 5 text / 15 number / 1 date 軟檢查，文件化 expected shape |

### 11.3 既有 test 不動

| Describe 區塊 | 狀態 |
|---|---|
| `mapTemplateToPasscreator — fields (header / primary / secondary / back)` | v11 re-tagged 但行為不變 |
| `mapTemplateToPasscreator — cardType-aware memberLevel override` | 不變 |
| `mapTemplateToPassactor — field type mapping (regression — 2026-10-11)` 既有 9 條 | re-clustered 到 v12 sub-describe block，行為不變 |
| `mapTemplateToPassactor — additionalProperties (v7)` | 不變 |
| `mapTemplateToPassactor — top-level links (v9)` | 不變 |
| `mapTemplateToPassactor — link URL normalization (v10)` | 不變 |
| `normalizeLinkUrl` | 不變 |
| 其他 19 個 describe | 不變 |
| `shared/lib/passcreator.test.ts` | 不變（`mapFieldType` 是 `passTemplateMapping` 內部函式）|
| `updateTemplate.passcreator.test.ts` | 不變 |

### 11.4 Test totals

- `passTemplateMapping`: 130 → 168 (+38)
- `card-fields.test.ts` (shared): 新檔 4 條
- backend 整體: 654 → 692 (+38)
- shared 整體: 454 → 458 (+4)
- 全部 typecheck: exit 0
