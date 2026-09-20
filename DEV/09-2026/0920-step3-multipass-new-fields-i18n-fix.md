# Step 3 MULTIPASS 新欄位 — i18n Key Misplacement 修正 DEV LOG

## Metadata

- **日期**：2026-09-20
- **範圍**：CardBuilder Step 3（multipass 卡的左右欄位下拉 + preview chain）
- **commit hash**：本機未 commit（修法 + DEV LOG 同 PR 待 commit）
- **規則 / skill 觸發**：
  - `.cursor/rules/frontend/023-shared-package.mdc` § i18n Namespace 規範
  - `.cursor/rules/frontend/025-vibe-coding-l2-checklist.mdc` § 1. i18n（第一優先）
  - `saome-dev-logging/SKILL.md`（本檔依此格式撰寫）

---

## 症狀

> 「MultiPass 卡的左右欄位預覽全部顯示空白」——使用者開啟 multipass 卡、Step 3 選擇「累積已滿」「到下個等級還差」「獎勵內容」任一欄位，預覽（PassCardPreviewBody）的 label/value 都看不見（防禦守衛把 raw i18n key 換成空字串）。

- **環境**：dev（wrangler dev + Vite dev）
- **觸發條件**：Step 1 選 `multipass` → Step 3 選擇 3 個 multipass 欄位 → 預覽顯示空白
- **觀察到的錯誤**：預覽 label / value 渲染為空字串（不是 raw key，也沒有翻譯）
- **預期 vs 實際**：
  - 預期：`累積已滿 / 1次`、`到下個等級還差 / 2次集滿`、`獎勵內容 / 10元折扣`
  - 實際：label / value 全部空白（防禦守衛 fallback 觸發）

---

## 探針 / 重現

怎麼讓未來的自己**重做一次**這個 bug：

1. `wrangler dev` + `npm run dev` 啟動前後端
2. 登入 → Dashboard → 建立新卡片 → Step 1 選 `multipass`
3. Step 3 「左欄位」/「右欄位」dropdown 開啟，看到「累積已滿」「到下個等級還差」「獎勵內容」三個選項（這層 OK，因為 `step3.fieldsSection.fields.{key}` i18n key 在 `cardEditor.{en,zh-TW}.ts` 已有 entry）
4. 選「累積已滿」→ 預覽左欄位 label/value 應該顯示 `累積已滿 / 1次`，實際是空白

DOM 觀察：label / value `<span>` 渲染了空字串（`textContent === ''`）。
不是 raw key 也沒有翻譯 → 防禦守衛 fallback 生效。

### 防禦守衛（`PassCardPreviewBody.tsx` 內）

```typescript
// 2026-09-20 defensive guard: if `t()` returns the same string it
// was given (i.e. the translation key was not found in the locale),
// fall back to an empty string instead of leaking the raw i18n key
// path into the preview. This catches future schema drift where a new
// display field is added to the dropdown but its i18n entry is
// forgotten.
const label = t(`fieldPreview.${field}.label`);
const value = t(`fieldPreview.${field}.value`);
const safeLabel = label.startsWith('fieldPreview.') ? '' : label;
const safeValue = value.startsWith('fieldPreview.') ? '' : value;
```

> 這條守衛是 2026-09-20 的最近一輪加的，本來是看到 raw key 變成 debug 噪音 → 直接守成空字串。守衛跑出來 = i18n key path 有問題。

---

## 根因

> **`multipassCompleted` / `multipassPointsToNextTier` / `multipassRewardContent` 三個 i18n key 被放在 `passCard` namespace 頂層，但 `PassCardPreviewBody` 是透過 `t('fieldPreview.{key}.label')` 找的 —— 找不到觸發防禦守衛 → 空字串。**

### 詳細分析

#### 1. 結構不對齊

`apps/frontend/src/i18n/locales/passCard.{en,zh-TW}.ts` 在 2026-09-19 ~ 2026-09-20 的 multipass 卡建立當下，加了 3 個 entry，但放在 **namespace 頂層** 而非 `fieldPreview.{key}` 子層：

```typescript
// ❌ 錯誤位置（修前，2026-09-19 ~ 2026-09-20）
export default {
  defaultName: '未命名卡片',
  fieldPreview: {
    couponDiscount: { ... },
    couponRemainingCount: { ... },
    // ↑ 其他 key 都放在這裡
  },
  // ❌ 3 個 multipass key 放錯到這裡
  multipassCompleted: { label: '累積已滿', value: '1次' },
  multipassPointsToNextTier: { label: '到下個等級還差', value: '2次集滿' },
  multipassRewardContent: {
    label: '獎勵內容',
    amountFormatTWD: '{{amount}}元折扣',
    amountFormatZAR: 'R{{amount}}折扣',
    percentFormat: '{{percent}}%折扣',
  },
};
```

`PassCardPreviewBody.resolveSlot()` 的 default branch 用的是：

```typescript
const label = t(`fieldPreview.${field}.label`);   // ← 找 fieldPreview.multipassCompleted.label
const value = t(`fieldPreview.${field}.value`);   // ← 找 fieldPreview.multipassCompleted.value
```

這兩條 path 都 miss —— key 實際放在 `multipassCompleted.label`（頂層）而非 `fieldPreview.multipassCompleted.label`。`t()` fallback 到 key 本身（mock）或回空字串（真 i18n）→ 防禦守衛把 mock key 也守成空字串。

#### 2. `multipassMemberLevel` 獨立 key 是多做的

原本 2026-09-20 還另外做了一個獨立的 `multipassMemberLevel` CardFieldKey + `fieldPreview.multipassMemberLevel` 翻譯，意圖是給 multipass 卡的「會員等級」slot 一個獨立語意。

但**這個獨立 key 是冗餘的**：

| 既有條件 | 解讀 |
|---|---|
| `memberLevel` 是 common key | 已在 `CARD_FIELD_KEYS` 內 |
| `memberLevel.hideOnCardTypes = ['coupon_card']` | 只排除 coupon，**沒**排除 multipass |
| `membership_card` 走同樣 override pattern | label 用 `fieldPreview.memberLevel.label` default + value 從 `firstMembershipTierName` 來 |
| `membership_card` 已存在且運作 | 表示 common `memberLevel` slot 是可以直接複用的 |

→ 把 multipass 也走同樣 override pattern（label = `fieldPreview.memberLevel.label`、value = `firstMultipassTierName ?? ''`）即可，不需要獨立 `multipassMemberLevel` CardFieldKey。

#### 3. 為什麼之前測試沒抓到

- **`I18N_SOURCED_FIELD_KEYS` sweep 排除這 3 個 field**（修前 test 已經排除 `multipassCompleted` 等 3 個 key，理由是「必須 `cardType === 'multipass'` 才命中 resolveSlot branch」，所以 sweep 不會跑到 default branch）
- **multipass 專用 test block 還沒寫**（原本只 stamp / reward / cashback / membership / discount 有 override branch，每個都有對應 describe block，multipass 是新加的）
- **防禦守衛 + i18n mock** 組合下，當 i18n key path 找不到時，mock `t()` 回傳 key 本身（`multipassCompleted.label`），守衛看到 raw key → 換成空字串 → 測試斷言「raw key 沒在 DOM」→ 通過。但這只是測試「沒看到 raw key」，沒有測試「看到正確翻譯」。

---

## 修法

### 1. `apps/frontend/src/i18n/locales/passCard.{en,zh-TW}.ts`

把 3 個 multipass key 從頂層搬到 `fieldPreview.{key}`：

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

### 4. `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewBody.tsx`

#### 4a. 移除 `multipass + multipassMemberLevel` branch

舊 branch（多出）：

```typescript
// ❌ 刪除（2026-09-20 review）
if (cardType === 'multipass' && field === 'multipassMemberLevel') {
  return {
    label: t('fieldPreview.multipassMemberLevel.label'),
    value: firstMultipassTierName ?? '',
  };
}
```

#### 4b. 新增 `multipass + memberLevel` branch（mirror `membership_card`）

```typescript
// ✅ 新增（2026-09-20 review）
// MultiPass override (2026-09-20): reuses the existing common
// `memberLevel` key (no dedicated `multipassMemberLevel` is needed).
// Mirrors the membership_card pattern above:
//   label = default `fieldPreview.memberLevel.label` ("會員等級" /
//           "Member Level") — NOT stampLabel (multipass is a tier-
//           identity card, not a reward card)
//   value = `firstMultipassTierName ?? ''` (the FIRST row of
//           `multipassTiers`, store-driven via Step 6
//           `MultipassTierNameField`).
if (cardType === 'multipass' && field === 'memberLevel') {
  return {
    label: t('fieldPreview.memberLevel.label'),
    value: firstMultipassTierName ?? '',
  };
}
```

#### 4c. 更新兩個 branch order docblock

`PassCardPreviewBody.tsx` 的兩個 branch order docblock（行首註解 + `resolveSlot` 內 inline 註解）都更新成新的 6 → 7 → ... 順序。

### 5. `PassCardPreview.types.ts` / `PreviewWrapper.types.ts` / `CardBuilderEditorPreview.tsx`

更新 `firstMultipassTierName` JSDoc + derivation comment：

```typescript
/**
 * 2026-09-20 multipass card — First multipass tier name from the editor
 * store (Step 6 `multipassTiers[0].name`). Surfaced as the preview
 * `value` for the COMMON `memberLevel` slot when `cardType === 'multipass'`
 * (PassCardPreviewBody applies the multipass override branch — mirrors
 * the `membership_card` pattern). ...
 *
 * Note: the original 2026-09-20 implementation used a dedicated
 * `multipassMemberLevel` CardFieldKey + a `fieldPreview.multipassMemberLevel`
 * translation. After 2026-09-20 review, the dedicated key was found
 * redundant: the common `memberLevel` slot already exists in the dropdown
 * (its `hideOnCardTypes: ['coupon_card']` does NOT exclude multipass), and
 * mirroring the `membership_card` override pattern keeps the label semantic
 * consistent. Removed the dedicated key.
 */
firstMultipassTierName?: string;
```

### 6. `PassCardPreviewBody.test.tsx`

#### 6a. `I18N_SOURCED_FIELD_KEYS` exclude filter 移除 `multipassMemberLevel`

```typescript
// 修前：filter 把 multipassMemberLevel 也排除
// 修後：只剩 multipassCompleted / multipassPointsToNextTier / multipassRewardContent
//  仍排除（這些是 cardType-gated，sweep 不會跑到 default branch）
```

#### 6b. 重寫 `multipass + memberLevel → first-tier-name override` describe block 為 7 條新測試

| # | 測試 | 覆蓋 |
|---|---|---|
| 1 | `multipass + leftField="memberLevel" + firstMultipassTierName="金卡"` | label = `fieldPreview.memberLevel.label`、value = `金卡` |
| 2 | `multipass + rightField="memberLevel"` | 右欄位也命中 override |
| 3 | `multipass + firstMultipassTierName=""` | 空字串，無 demo fallback |
| 4 | `multipass + firstMultipassTierName=undefined` | undefined → 空字串 |
| 5 | `multipass + leftField="phone" + firstMultipassTierName="金卡"` | 僅 `memberLevel` slot 被 override，其他 field 不受影響 |
| 6 | `membership_card + firstMultipassTierName="should-not-show" + firstMembershipTierName="金卡"` | membership_card 不會誤觸 multipass branch |
| 7 | `multipass + firstMultipassTierName` → label 必用 default `memberLevel.label`、**不**用 `stampLabel` / `discountLabel` | 守 label semantic |

#### 6c. 更新 2 條 scope-guard 測試

`PassCardPreviewBody.test.tsx` 內 2 條原本寫「multipass 不該走 stamp_card / reward_card override」的測試，更新為「multipass 走 multipass override branch，**不**走 stamp_card / reward_card override」。

---

## 驗證結果

### typecheck

```
$ npx tsc -b --noEmit
exit 0, 無錯誤
```

### `PassCardPreviewBody.test.tsx`

| 階段 | pass / fail |
|---|---|
| HEAD | 65 pass / 42 fail |
| 修完 | 73 pass / 41 fail |
| 淨變化 | +8 pass / −1 fail |

- **7 條新 `multipass + memberLevel` 測試全綠**
- 1 條原本因「multipass 走 stamp_card override」誤判而 fail 的測試，現在 fail 是因為「multipass 該走 multipass override」是預期行為 → 修成對的測試

### `verify-i18n`

```
$ npm run verify:i18n
pre-existing FAIL: couponDiscount.value: ''（與本次無關）
無新增 FAIL
```

### 預覽實際行為（multipass 卡 Step 3）

| Field | 修前 | 修後 |
|---|---|---|
| `multipassCompleted` | label/value 空白 | `累積已滿` / `1次` |
| `multipassPointsToNextTier` | label/value 空白 | `到下個等級還差` / `2次集滿` |
| `multipassRewardContent`（amount_off, TWD, value=10） | label/value 空白 | `獎勵內容` / `10元折扣` |
| `multipassRewardContent`（amount_off, ZAR, value=10） | label/value 空白 | `獎勵內容` / `R10折扣` |
| `multipassRewardContent`（percent_off, value=15） | label/value 空白 | `獎勵內容` / `15%折扣` |
| `memberLevel`（multipass, firstMultipassTierName="金卡"） | label/value `會員等級` / `金級`（demo placeholder） | label/value `會員等級` / `金卡`（user input） |

---

## 衍生

### 影響範圍

| 檔案 | 改動 |
|---|---|
| `apps/frontend/src/i18n/locales/passCard.{en,zh-TW}.ts` | 3 個 multipass key 從頂層搬到 `fieldPreview.{key}` |
| `apps/frontend/src/i18n/locales/cardEditor.{en,zh-TW}.ts` | 刪除 `step3.fieldsSection.fields.multipassMemberLevel` dropdown label |
| `packages/shared/constants/card-fields.ts` | 從 `CARD_FIELD_KEYS` + `CARD_FIELDS` 移除 `multipassMemberLevel` |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewBody.tsx` | 移除 `multipass + multipassMemberLevel` branch；新增 `multipass + memberLevel` branch；更新兩個 branch order docblock |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreview.types.ts` | 更新 `firstMultipassTierName` JSDoc |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/PreviewWrapper/PreviewWrapper.types.ts` | 同上 |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorPreview.tsx` | 更新 derivation comment |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewBody.test.tsx` | (a) `I18N_SOURCED_FIELD_KEYS` exclude filter 移除 `multipassMemberLevel`；(b) 重寫 `multipass + memberLevel` describe block 為 7 條；(c) 更新 2 條 scope-guard 測試 |

### Prop chain 沒斷

`firstMultipassTierName` 仍從 `store.multipassTiers[0].name` → `CardBuilderEditorPreview` 派生 → `PreviewWrapper` → `PassCardPreview` → `PassCardPreviewBody`。只是現在驅動的是 common `memberLevel` slot（不是 `multipassMemberLevel` 獨立 slot）。

### 剩餘 `multipassMemberLevel` 字串

只出現在 6 個檔案的 JSDoc 註解，紀錄「原本有獨立 key → 移除」的歷史脈絡（code archaeology），不影響 runtime。

### 預先存在的 41 條 fail（不在本次 scope）

- `renders leftField="X"` sweep 區塊：defensive guard 把 raw key 換成空字串，舊測試期待看到 raw key
- `ZAR pollution regression` 區塊：同 defensive guard 衝突
- Placeholder / typography / column layout：同 defensive guard 衝突

→ 等下次 review 時一併修（屬於 `defensive-guard-rewriting-test-assertions` 大型 refactor 範圍）。

---

## 自問

### 下次怎麼不犯？

- ✅ **新增 preview field 時**：i18n key 必須進 `fieldPreview.{key}` 子層，不能放 namespace 頂層
- ✅ **新增 CardFieldKey 時**：先 grep `CARD_FIELDS` 內既有 common key 的 `hideOnCardTypes`，看是否能複用（如 `memberLevel` 對 multipass 不排除）
- ✅ **`hideOnCardTypes` 設計時**：comment 必寫「為什麼排除 X / 沒排除 Y」（未來 review 才看得出來哪些卡種可以共用）

### 哪條 rule 該補？

- `.cursor/rules/frontend/025-vibe-coding-l2-checklist.mdc` § 1. i18n 已有強調「flat key 結構」、「對照既有範例」，但沒強調「必須放 `fieldPreview.{key}` 子層」 → 可考慮補一條 sub-bullet
- `.cursor/rules/frontend/023-shared-package.mdc` § 命名規則已有 namespace 規範，但 `fieldPreview.*` 這個 i18n contract 沒寫成 rule（目前只是 convention） → 可考慮補一個 contract 文件

### 哪個 test 該加？

- ✅ `PassCardPreviewBody.test.tsx` `I18N_SOURCED_FIELD_KEYS` sweep 已存在，但**沒有 assertion「defensive guard 不能隨便開啟」** → 應加一條「所有 i18n-sourced key 必須存在於 `fieldPreview.{key}` path」的 conformance test（直接 iterate `passCard.zh-TW.ts` 的 `fieldPreview` 子層 → 對照 `CARD_FIELD_KEYS` 差集）
- ✅ 「`memberLevel` slot 的 multipass override branch」需要獨立 describe block（已加，7 條）
- ❌ 「共用 `memberLevel` 而非獨立 key」的設計決策沒寫進 schema conformance test → 可考慮加一條「`multipassMemberLevel` MUST NOT appear in `CARD_FIELD_KEYS`」的 negative test

### 後續追的事項

- 把 `I18N_SOURCED_FIELD_KEYS` sweep 改成 conformance test：直接讀 `passCard.{en,zh-TW}.ts` 對 `CARD_FIELD_KEYS` 逐個驗證
- 41 條 pre-existing fail（defensive guard 衝突）大改：把測試從「期待 raw key」改成「期待翻譯」或「期待空字串」
- `multipassMemberLevel` 字串清乾淨（6 個檔案的 JSDoc）

---

> 撰寫者：cursor-agent ｜ 時間：2026-09-20 20:46（UTC+8）