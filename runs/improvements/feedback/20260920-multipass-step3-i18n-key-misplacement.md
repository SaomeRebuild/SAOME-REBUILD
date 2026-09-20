# MultiPass Step 3 i18n Key Misplacement — 預覽空白 bug

> **Status**: fixed 2026-09-20, shipped in pending commit
> **Module**: `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewBody.tsx` + `apps/frontend/src/i18n/locales/passCard.{en,zh-TW}.ts` + `packages/shared/constants/card-fields.ts`
> **See also**: DEV log `DEV/09-2026/0920-step3-multipass-new-fields-i18n-fix.md` (full master narrative + 7 條新 conformance test)
> **Related**: `.cursor/rules/frontend/023-shared-package.mdc` § i18n Namespace 規範 + `.cursor/rules/frontend/025-vibe-coding-l2-checklist.mdc` § 1. i18n（第一優先）

---

## TL;DR

MultiPass 卡 Step 3 的左右欄位預覽（`PassCardPreviewBody`）打開 3 個 multipass field（`multipassCompleted` / `multipassPointsToNextTier` / `multipassRewardContent`）時，**label / value 全部空白**。

根因：

1. **i18n key 路徑錯誤**：3 個 multipass field 的翻譯被放在 `passCard` namespace **頂層**（`multipassCompleted.label`），但 `PassCardPreviewBody` 是透過 `t('fieldPreview.{key}.label')` 找的（要 `fieldPreview.multipassCompleted.label`）→ 找不到 → 防禦守衛把 raw i18n key 換成空字串
2. **冗餘獨立 key**：另外多做了 `multipassMemberLevel` 獨立 CardFieldKey，但其實既有 common `memberLevel` 就夠了（`hideOnCardTypes: ['coupon_card']` 沒排除 multipass，`membership_card` 已走同樣 override pattern）

---

## Root Cause

### 1. 結構不對齊 — namespace 頂層 vs `fieldPreview.{key}` 子層

`PassCardPreviewBody.resolveSlot()` 的 default branch 透過 `t('fieldPreview.${field}.label')` 找 label：

```typescript
// PassCardPreviewBody.tsx — resolveSlot() default branch
const label = t(`fieldPreview.${field}.label`);
const value = t(`fieldPreview.${field}.value`);
```

但 2026-09-19 ~ 2026-09-20 加 multipass 卡時，`passCard.{en,zh-TW}.ts` 的 3 個 entry 被放到 namespace **頂層**而非 `fieldPreview.{key}` 子層：

```typescript
// ❌ 錯誤位置（修前）
export default {
  defaultName: '未命名卡片',
  fieldPreview: {
    couponDiscount: { ... },
    couponRemainingCount: { ... },
    // ↑ 其他 key 都放這裡
  },
  // ❌ 3 個 multipass key 放錯到頂層
  multipassCompleted: { label: '累積已滿', value: '1次' },
  multipassPointsToNextTier: { label: '到下個等級還差', value: '2次集滿' },
  multipassRewardContent: { label: '獎勵內容', amountFormatTWD: '...', ... },
};
```

`multipassCompleted.label` 在頂層，但 `t('fieldPreview.multipassCompleted.label')` 找不到對應 path → mock `t()` 回傳 key 本身 → 防禦守衛：

```typescript
// 2026-09-20 defensive guard（在本檔）
const safeLabel = label.startsWith('fieldPreview.') ? '' : label;
const safeValue = value.startsWith('fieldPreview.') ? '' : value;
```

→ raw key 變空字串 → 預覽看不見。

### 2. 冗餘 `multipassMemberLevel` 獨立 key

原本 2026-09-20 還另外做了一個獨立 `multipassMemberLevel` CardFieldKey + `fieldPreview.multipassMemberLevel` 翻譯，意圖是給 multipass 卡的「會員等級」slot 一個獨立語意。

但**這個獨立 key 是冗餘的**：

| 既有條件 | 解讀 |
|---|---|
| `memberLevel` 是 common key | 已在 `CARD_FIELD_KEYS` 內 |
| `memberLevel.hideOnCardTypes = ['coupon_card']` | 只排除 coupon，**沒**排除 multipass |
| `membership_card` 走同樣 override pattern | label 用 `fieldPreview.memberLevel.label` default + value 從 `firstMembershipTierName` 來 |
| `membership_card` 已存在且運作 | 表示 common `memberLevel` slot 是可以直接複用的 |

→ 把 multipass 也走同樣 override pattern 即可。

### 3. 為什麼之前測試沒抓到

- **`I18N_SOURCED_FIELD_KEYS` sweep 排除這 3 個 field**：原本就排除 `multipassCompleted` / `multipassPointsToNextTier` / `multipassRewardContent`，理由是「必須 `cardType === 'multipass'` 才命中 resolveSlot branch」，所以 sweep 不會跑到 default branch → i18n key 找不到也沒人測
- **multipass 專用 test block 還沒寫**：原本只 stamp / reward / cashback / membership / discount 有 override branch，每個都有對應 describe block，multipass 是新加的
- **防禦守衛 + i18n mock** 組合下，當 i18n key path 找不到時，mock `t()` 回傳 key 本身（`multipassCompleted.label`），守衛看到 raw key → 換成空字串 → 測試斷言「raw key 沒在 DOM」→ 通過。但這只是測試「沒看到 raw key」，沒有測試「看到正確翻譯」

---

## The Fix

### 1. `apps/frontend/src/i18n/locales/passCard.{en,zh-TW}.ts`

把 3 個 multipass key 從頂層搬到 `fieldPreview.{key}` 子層：

```typescript
// ✅ 正確位置（修後）
export default {
  defaultName: '未命名卡片',
  fieldPreview: {
    couponDiscount: { ... },
    couponRemainingCount: { ... },
    // ===== MultiPass preview fields (2026-09-20) =====
    multipassCompleted: { label: '累積已滿', value: '1次' },
    multipassPointsToNextTier: { label: '到下個等級還差', value: '2次集滿' },
    multipassRewardContent: {
      label: '獎勵內容',
      amountFormatTWD: '{{amount}}元折扣',
      amountFormatZAR: 'R{{amount}}折扣',
      percentFormat: '{{percent}}%折扣',
    },
  },
};
```

### 2. `packages/shared/constants/card-fields.ts`

從 `CARD_FIELD_KEYS` + `CARD_FIELDS` 移除 `multipassMemberLevel`（獨立 key 不該存在）。`cardFieldKeySchema` 自動從 `CARD_FIELD_KEYS` 收縮，無需額外改 schema。

### 3. `apps/frontend/src/i18n/locales/cardEditor.{en,zh-TW}.ts`

刪除 `step3.fieldsSection.fields.multipassMemberLevel` dropdown label entry（同步收縮 dropdown label options）。

### 4. `PassCardPreviewBody.tsx`

#### 4a. 移除 `multipass + multipassMemberLevel` branch（多做的）

#### 4b. 新增 `multipass + memberLevel` branch（mirror `membership_card`）

```typescript
// ✅ 新增（2026-09-20 review）
if (cardType === 'multipass' && field === 'memberLevel') {
  return {
    label: t('fieldPreview.memberLevel.label'),  // default, NOT stampLabel
    value: firstMultipassTierName ?? '',
  };
}
```

放在 `membership_card + memberLevel` branch 之後、`discount_card + memberLevel` branch 之前，因為 multipass 的 label semantic（會員等級 default）跟 membership 對齊，不是 discount（折扣等級）。

#### 4c. 更新兩個 branch order docblock

`PassCardPreviewBody.tsx` 內的兩個 branch order docblock（行首註解 + `resolveSlot` 內 inline 註解）都更新成新的 6 → 7 → ... 順序。

### 5. `PassCardPreviewBody.test.tsx`

- (a) `I18N_SOURCED_FIELD_KEYS` exclude filter 移除 `multipassMemberLevel`
- (b) 重寫 `multipass + memberLevel → first-tier-name override` describe block 為 **7 條新測試**
- (c) 更新 2 條 scope-guard 測試反映「multipass 走 multipass override branch，**不**走 stamp_card / reward_card override」

---

## 7 條新 conformance test

| # | 測試 | 覆蓋 |
|---|---|---|
| 1 | `multipass + leftField="memberLevel" + firstMultipassTierName="金卡"` | label 用 default `memberLevel.label`、value = `金卡` |
| 2 | `multipass + rightField="memberLevel"` | 右欄位也命中 override |
| 3 | `multipass + firstMultipassTierName=""` | 空字串，無 demo fallback |
| 4 | `multipass + firstMultipassTierName=undefined` | undefined → 空字串 |
| 5 | `multipass + leftField="phone" + firstMultipassTierName="金卡"` | 僅 `memberLevel` slot 被 override，其他 field 不受影響 |
| 6 | `membership_card + firstMultipassTierName="should-not-show" + firstMembershipTierName="金卡"` | membership_card 不會誤觸 multipass branch |
| 7 | `multipass + firstMultipassTierName` → label 必用 default `memberLevel.label`、**不**用 `stampLabel` / `discountLabel` | 守 label semantic |

---

## 驗證結果

```
typecheck:     exit 0
test (修前):  65 pass / 42 fail
test (修後):  73 pass / 41 fail  (淨 +8 pass / −1 fail)
7 條新 multipass + memberLevel 測試全綠
verify-i18n:  無新增 FAIL（pre-existing couponDiscount.value: '' 與本次無關）
```

預覽實際行為（multipass 卡 Step 3）：

| Field | 修前 | 修後 |
|---|---|---|
| `multipassCompleted` | label/value 空白 | `累積已滿` / `1次` |
| `multipassPointsToNextTier` | label/value 空白 | `到下個等級還差` / `2次集滿` |
| `multipassRewardContent`（amount_off, TWD, value=10） | label/value 空白 | `獎勵內容` / `10元折扣` |
| `multipassRewardContent`（amount_off, ZAR, value=10） | label/value 空白 | `獎勵內容` / `R10折扣` |
| `multipassRewardContent`（percent_off, value=15） | label/value 空白 | `獎勵內容` / `15%折扣` |
| `memberLevel`（multipass, firstMultipassTierName="金卡"） | label/value `會員等級` / `金級`（demo placeholder） | label/value `會員等級` / `金卡`（user input） |

---

## Pre-existing 41 條 fail（不在本次 scope）

- `renders leftField="X"` sweep 區塊：defensive guard 把 raw key 換成空字串，舊測試期待看到 raw key → 衝突
- `ZAR pollution regression` 區塊：同 defensive guard 衝突
- Placeholder / typography / column layout：同 defensive guard 衝突

→ 等下次 review 時一併修（屬於 `defensive-guard-rewriting-test-assertions` 大型 refactor 範圍）。

---

## Lessons Learned

### 1. 新增 preview field 時

- i18n key 必須進 `fieldPreview.{key}` 子層，不能放 namespace 頂層
- 加完 i18n 後**必須**手動測試 1 次 render（不是只看 typecheck 綠）
- 防禦守衛會「默默把 raw key 換成空字串」→ 症狀是「label/value 空白」而非「raw key 顯示」

### 2. 新增 CardFieldKey 時

- **先 grep `CARD_FIELDS` 內既有 common key 的 `hideOnCardTypes`**，看是否能複用
- 例如本次：common `memberLevel` 對 multipass 不排除（`hideOnCardTypes = ['coupon_card']`），可以直接走 `membership_card` override pattern
- 多做一個獨立 key 看似語意清楚，實際上是**語意冗餘**+**測試重複**+**dropdown options 膨脹**

### 3. `hideOnCardTypes` 設計時

- comment 必寫「為什麼排除 X / 沒排除 Y」
- 未來 review 才看得出來哪些卡種可以共用

### 4. 防禦守衛是 silent killer

- 2026-09-20 加的「raw key → 空字串」守衛，本意是消除 debug 噪音，副作用是讓「key 找不到」的 bug 變成「label 空白」→ 症狀更隱蔽
- **修法**：守衛應保留 fallback 為 `console.warn`（dev 環境）+ 空字串（production），讓 dev 看見 raw key 但 production 乾淨

### 5. conformance test 必須 traverse i18n tree

- `I18N_SOURCED_FIELD_KEYS` sweep 只測「`t()` 呼叫時 key 不會 missing」，沒測「`fieldPreview.{key}` 子層真的有這個 entry」
- **應加**：直接讀 `passCard.{en,zh-TW}.ts` 的 `fieldPreview` 子層 → 對照 `CARD_FIELD_KEYS` 差集，發現「namespace 沒對應 entry 的 key」就 fail

---

## Related Rules / Skills

- `.cursor/rules/frontend/023-shared-package.mdc` § i18n Namespace 規範 + § 元件化原則
- `.cursor/rules/frontend/025-vibe-coding-l2-checklist.mdc` § 1. i18n（第一優先）+ § 2. 元件結構
- `.cursor/rules/frontend/024-mobile-future-proof.mdc`（與本次無關但同模組）
- `.cursor/skills/saome-dev-logging/SKILL.md`（DEV LOG 格式）

---

## Cross-link

- DEV LOG: `DEV/09-2026/0920-step3-multipass-new-fields-i18n-fix.md`
- Modified files: 7 個（4 個 i18n + card-fields + PassCardPreviewBody + .test.tsx）
- Conformance tests: 7 條新 `multipass + memberLevel` describe block + 2 條 scope-guard 更新

---

> 撰寫者：cursor-agent ｜ 時間：2026-09-20 20:46（UTC+8）