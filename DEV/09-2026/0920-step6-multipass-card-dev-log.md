# Step 6 Multipass Card 開發紀錄：PR-1 至 PR-5 完整 DEV LOG

## Metadata

- 日期：2026-09-19 ～ 2026-09-20
- 範圍：CardBuilder Step 6（multipass_card 多通卡的邏輯編輯器）+ 5 個 sub-components
- 目標：
  1. PR-1：建立 MultipassCardLogic sub-module 資料夾結構 + 基礎 4 個 sub-fields
  2. PR-2：Store 層整合（multipassTiers + setters + loadSettings）+ schema 四層對齊
  3. PR-3：MultipassCardLogic 拆分為獨立 sub-module（脫離 StampCardLogic 共同體）
  4. PR-4：新增 stampsNeeded 複製警告 UI（duplicate detection + 2-pass algorithm）
  5. PR-5：新增卡片層級 `multipassAccrualMode` 三選一 radio + per-tier 門檻輸入框
  6. PR-5 Fix：獎勵值允許 0 + ZAR 幣別前綴 R 靠左布局

---

## PR-1（2026-09-19）：MultipassCardLogic 基礎結構

### 背景

Step 6 dispatcher（2026-09-07 完工）在 `multipass_card` 分支仍使用 `StampCardLogic` 共同處理。隨著 Step 6 陸續拆分出 Reward / Cashback / Membership / Discount 為獨立 sub-module，multipass 需要自己的獨立模組。

multipass 卡的特徵：

| 維度 | 說明 |
|---|---|
| 多 tier 上限 | 最多 5 個 tier |
| stampsNeeded = 0 | **合法**：歡迎禮「辦卡立刻送」 semantics |
| stampsNeeded 與 Step 3 無關 | 多通卡可跨多張實體卡累積，與 stampGridRows × 5 完全解耦 |
| 每 tier 有獨立的 stampsNeeded + rewardType + rewardValue | 與 StampCardLogic 的 card-wide 共享 reward 不同 |

### 實作

新資料夾結構（PR-1）：

```
Step6CardLogic/MultipassCardLogic/
├── index.ts                                          ← barrel
├── MultipassCardLogic.tsx                            ← 主組件（2 sub-components，auto-add defense）
├── MultipassCardLogic.types.ts                       ← 5 個 component props
├── MultipassCardLogic.test.tsx                       ← composer smoke test
├── MultipassCardLogic.stories.tsx                   ← Storybook
├── MultipassTierList.tsx                           ← tier 列表 + 新增按鈕（max=5）
├── MultipassTierList.test.tsx                       ← 5 tests（新增/上限/empty state）
├── MultipassTierRow.tsx                           ← 單個 tier row（5 sub-fields）
├── MultipassTierNameField.tsx                      ← tier 名稱輸入框（40 字計數）
├── MultipassTierNameField.test.tsx
├── MultipassTierStampsNeededField.tsx              ← ★ 多通卡獨有：stamps to unlock
├── MultipassTierStampsNeededField.test.tsx
├── MultipassTierRewardTypeField.tsx                ← amount_off / percent_off radio
├── MultipassTierRewardTypeField.test.tsx
├── MultipassTierRewardValueField.tsx               ← 條件 render（amount → 金額；percent → 1-100）
└── MultipassTierRewardValueField.test.tsx
```

核心設計決策（PR-1）：

- **`MultipassCardLogic.tsx`**：組成 2 個 sub-component（`<MultipassTierList />`），auto-add useEffect 守 `multipassTiers.length === 0` → `addMultipassTier()`。這是防禦性機制：當 store 被外部污染（如 malformed DB row 導致 loadSettings seed 了 0 個 tier）時，UI 仍顯示至少 1 row。
- **`MultipassTierList.tsx`**：迭代 `multipassTiers` 陣列，每個元素 render 一個 `<MultipassTierRow />` + 最下方「新增獎勵級距」按鈕。`addMultipassTier` 在 `multipassTiers.length < MAX_MULTIPASS_TIERS(5)` 時啟用。`removeMultipassTier` 會在陣列變空時自動補 1 個 default tier（永遠 ≥ 1 row）。
- **`MultipassTierRow.tsx`**：2-col grid（name + stampsNeeded 在 row 1；rewardType + rewardValue 在 row 2）。Mobile 垂直堆疊。

---

## PR-2（2026-09-19）：Store 整合 + Schema 四層對齊

### 背景

MultipassCardLogic 元件已可 render，但 store（`CardBuilderEditor.store.ts`）還沒有 `multipassTiers` 的 state field + setters，後端 schema 也缺對應欄位。

### Store 新增欄位

`CardBuilderEditor.store.ts` 新增：

```typescript
// State fields
multipassTiers: Array<MultipassTierShape & { id: string }>

// Setters
addMultipassTier()
removeMultipassTier(tierId: string)
updateMultipassTier(tierId: string, patch: Partial<MultipassTierShape>)
setMultipassAccrualMode(mode: MultipassAccrualMode | null)

// init()
multipassTiers: [{ id: 'default-multipass-tier', name: '', stampsNeeded: 0, rewardType: null, rewardValue: null }]
```

### MultipassTierShape 定義

```typescript
// packages/shared/constants/multipass-card.ts
interface MultipassTierShape {
  name: string;             // 1-40 chars
  stampsNeeded: number;      // 0 (歡迎禮) or 1..999
  rewardType: 'amount_off' | 'percent_off' | null;
  rewardValue: number | null;
}
```

### Schema 四層對齊（Rule 019 § 4.1）

| 層 | 檔案 | 內容 |
|---|---|---|
| 1 | `packages/shared/schemas/card.ts` | `templateSettingsSchema.multipassTiers` array + `multipassAccrualMode` enum |
| 2 | `apps/backend/src/modules/cards/schemas/request.ts` | Backend mirror |
| 3 | `apps/backend/src/modules/cards/db/templates.ts` | `TemplateSettings` interface |
| 4 | `schema-conformance.test.ts` | 自動驗證 1+2 層 field set 一致 |

---

## PR-3（2026-09-19）：MultipassCardLogic 拆分為獨立 Sub-Module

### 背景

PR-1/2 的 MultipassCardLogic 是在 StampCardLogic 共同處理時期的過渡設計。隨著 StampCardLogic 獨立化（2026-09-07），multipass 也需要從 `StampCardLogic` 分支出來。

### 與 StampCardLogic 的差異

| 維度 | StampCardLogic | MultipassCardLogic（本 PR）|
|---|---|---|
| 數量 | 單一 card-wide reward | 最多 5 個 tier |
| stampsNeeded | 無（card-wide 的 stampGridRows × 5 是另一個概念）| **有**（每 tier 獨立）|
| stampsNeeded = 0 語意 | 無 | **合法**（歡迎禮）|
| rewardType | card-wide | **per-tier** |
| rewardValue | card-wide | **per-tier** |
| Accrual mode | card-wide radio（per_stamp/per_visit/per_spend）| **card-wide radio** + **per-tier threshold**（PR-5 新增）|

### Step 6 Dispatcher 整合

`Step6CardLogic.tsx` 新增 `multipass_card` 分支：

```typescript
case 'multipass_card':
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <MultipassCardLogic showValidation={showValidation} />
    </div>
  );
```

---

## PR-4（2026-09-19）：stampsNeeded 複製警告 UI

### 背景

使用者可以在同一張多通卡設定多個 tier，但若兩個 tier 的 `stampsNeeded` 相同（例如兩個 tier 都設定需要 10 個印章才能解鎖），則「達到 10 個印章時該解鎖哪個 tier」在邏輯上不明確。需要在 UI 上給予警告，但**不阻擋**儲存（使用者可能有特殊用途）。

### 實作

**`MultipassTierList.tsx` 新增 2-pass duplicate detection algorithm**：

```typescript
// 第一次 pass：計算每個 stampsNeeded 的出現次數
const counts = new Map<number, number>();
for (const tier of multipassTiers) {
  if (tier.stampsNeeded == null) continue;
  counts.set(tier.stampsNeeded, (counts.get(tier.stampsNeeded) ?? 0) + 1);
}

// 第二次 pass：每個 row 帶重複次數（或 null）
const result = new Map<string, number | null>();
for (const tier of multipassTiers) {
  const count = counts.get(tier.stampsNeeded) ?? 0;
  result.set(tier.id, count > 1 ? tier.stampsNeeded : null);
}
```

**`MultipassTierStampsNeededField.tsx`**：接收 `duplicateStampsNeeded` prop，當值非 null 時在 label 右側顯示 `AlertTriangleIcon` + tooltip（i18n key：`step6.multipass.tier.stampsNeededDuplicateWarning`）。

**`MultipassTierRow.tsx`**：從 list 的 `duplicateStampsNeededByRow` Map 查詢並傳給 `MultipassTierStampsNeededField`。

### 為什麼 stampsNeeded = 0 也參與 duplicate detection

兩個 tier 都設 stampsNeeded=0（都想要歡迎禮）在邏輯上同樣不明確。警告 UI 一致性地對所有重複（包括 0）顯示，不做特殊處理。

---

## PR-5（2026-09-20）：multipassAccrualMode + Per-tier 門檻輸入框 + 兩項 Fix

### 背景

Multipass 多通卡需要有「印章累積方式」的設定——與 StampCardLogic 的 `stampAccrualMode` 概念相同，但 StampCardLogic 的門檻是 card-wide 的（所有 tier 共用同一組 per_visit / per_spend threshold），而 multipass 需要 **per-tier 的門檻**（每個 tier 有各自不同的門檻）。

User 在 session 中確認：「在大規則下每個 tier 有細微可控制的邏輯」——所以 mode 是 card-wide（統一的操作模式），但 thresholds 是 per-tier（每個 tier 可微調）。

### 實作 1：`MultipassAccrualModeField`（卡片層級 Radio Group）

新增 `MultipassAccrualModeField.tsx`：三選一 radio group（基於蓋章 / 基於拜訪 / 基於消費），Pattern A（Radio Card，`:has(:checked)` driven selected state，與 `StampAccrualModeField` 完全對稱）。

- `per_stamp`：手動蓋章（無 threshold inputs）
- `per_visit`：來訪自動（N 次拜訪換 M 個印章）
- `per_spend`：消費自動（消費 N 元換 M 個印章）

Store 新增 `multipassAccrualMode: MultipassAccrualMode | null`，預設 `null`。

### 實作 2：`MultipassTierAccrualThresholdField`（每個 Tier 的門檻輸入框）

新增 `MultipassTierAccrualThresholdField.tsx`：條件 render，根據 `multipassAccrualMode` 決定是否顯示，以及顯示哪一組：

| `multipassAccrualMode` | 顯示 | 輸入框 |
|---|---|---|
| `null` / `per_stamp` | 不顯示 | — |
| `per_visit` | `perVisitCount` + `perVisitStamps` | 「N 次拜訪 = M 個印章」|
| `per_spend` | `perSpendAmount` + `perSpendStamps` | 「消費 N 元 = M 個印章」（currency-aware）|

**per_visit 輸入框**：
- `perVisitCount`（拜訪次數）：integer ≥ 1
- `perVisitStamps`（獲得印章數）：integer ≥ 1
- 條件：兩個都要填，否則 showValidation=true 時顯示紅色錯誤

**per_spend 輸入框**：
- `perSpendAmount`（消費金額）：positive number ≥ 0.01，currency-aware
- `perSpendStamps`（獲得印章數）：integer ≥ 1
- ZAR 幣別：`R` 前綴在左側（南非當地慣例：符號在金額前）
- TWD 幣別：`元` 後綴在右側

**切換 mode 不清除門檻**：使用者從 `per_visit` 切到 `per_spend`，原本輸入的拜訪門檻值保留在 store，UI 隱藏（下次切回來還在）。

### 實作 3：`MultipassTierRow` Layout 更新（PR-5 Render Order）

`MultipassTierRow.tsx` 新增 `MultipassTierAccrualThresholdField` 在 `stampsNeeded` 與 `rewardType`之間，佔 `md:col-span-2`（全寬），layout 變成 3 行：

```
Row 1: [Tier Name]  [Stamps Needed]
Row 2: [Per-tier Accrual Threshold — full width]
Row 3: [Reward Type]  [Reward Value]
```

`MultipassCardLogic.tsx` render order：`MultipassAccrualModeField` → `MultipassTierList`（mirror StampCardLogic：StampAccrualModeField → StampTierList）。

### Fix #1：rewardValue = 0 應該合法（★ PR-5 Fix）

原始實作：

```typescript
// ❌ PR-4 之前：value === null || value <= 0 → 顯示錯誤
```

使用者反饋：某些 tier 可以設定「沒有優惠」（等於 0 = 該 tier 不給任何折扣）。這跟 stampsNeeded = 0（歡迎禮）是不同的語意。

修法：`MultipassTierRewardValueField.tsx` 改為：

```typescript
// ✅ PR-5 Fix: 只有 value === null 才顯示錯誤
const showError = showValidation && value === null;
```

Store setter `updateMultipassTier` 仍然拒絕 `≤ 0`（zod `z.number().positive()` 是後端防衛）。但前端 UI input 可以自由輸入 0——若使用者提交，後端 zod 會 reject → 400，UX 為該欄位單獨顯示紅色邊框。

### Fix #2：ZAR 幣別的 R 前綴靠左（★ PR-5 Fix）

使用者反饋：若用戶選擇 ZAR 為卡片貨幣，R（前綴）要在輸入框左側，因為南非當地慣例是「R50」而非「50 R」。

| 幣別 | 語言 | 佈局 | 範例 |
|---|---|---|---|
| ZAR | zh-TW | 前綴 `R` 在左 | `R[_____]` |
| ZAR | en | 前綴 `R` 在左 | `R[_____]` |
| TWD | zh-TW | 後綴 `元` 在右 | `[_____]元` |
| TWD | en | 後綴 `NT$` 在右 | `[_____]NT$` |
| % | any | 後綴 `%` 在右 | `[_____]%` |

修法：`MultipassTierRewardValueField.tsx` 新增 `unitPrefix` / `unitSuffix` 分支邏輯 + `paddingClass`：

```typescript
const unitPrefix = isAmount && isZAR ? t('step6.multipass.tier.rewardValueAmountUnitZAR') : '';
// → 'R'
const paddingClass = unitPrefix ? 'pl-12' : 'pr-12'; // 前綴 → 左側 padding；其餘 → 右側 padding
```

---

## Schema 與 Constants 同步

`packages/shared/constants/multipass-card.ts` 作為所有 bounds 的 single source of truth：

| 常數 | 值 | 說明 |
|---|---|---|
| `MAX_MULTIPASS_TIERS` | 5 | tier 上限 |
| `MULTIPASS_TIER_NAME_MAX_LENGTH` | 40 | tier 名稱上限 |
| `MULTIPASS_STAMPS_NEEDED_MIN / _MAX` | 0 / 999 | stampsNeeded 範圍 |
| `MULTIPASS_REWARD_TYPES` | `['amount_off', 'percent_off']` | rewardType enum |
| `MULTIPASS_ACCRUAL_MODES` | `['per_stamp', 'per_visit', 'per_spend']` | accrual mode enum |
| `MULTIPASS_STAMPS_PER_VISIT_MIN` | 1 | perVisitCount 下限 |
| `MULTIPASS_STAMPS_PER_SPEND_MIN` | 0.01 | perSpendAmount 下限 |

### 4-layer Sync（Rule 019 § 4.1）

| 層 | 檔案 | 新增內容 |
|---|---|---|
| 1 | `packages/shared/schemas/card.ts` | `multipassTiers[]` + `multipassAccrualMode` + per-tier 4 個 threshold fields |
| 2 | `packages/shared/schemas/cardBuilder.ts` | `cardTypeExtensions.multipass.*` |
| 3 | `apps/backend/src/modules/cards/schemas/request.ts` | Backend mirror |
| 4 | `apps/backend/src/modules/cards/db/templates.ts` | `TemplateSettings` interface |
| 5 | `apps/backend/src/modules/cards/tests/schema-conformance.test.ts` | 自動驗證 1+2 層 field set 一致 |

---

## i18n 新增翻譯

`cardEditor.zh-TW.ts` + `cardEditor.en.ts` 新增 `step6.multipass.*` 區塊：

| 分類 | Key 前綴 | 說明 |
|---|---|---|
| Section titles | `step6.multipass.intro` / `tiersTitle` / `tiersHint` | 卡片邏輯說明 + 級距列表標題 |
| Accrual mode | `step6.multipass.accrualModeTitle` / `accrualModeDescription` | Radio group 標題 |
| Mode options | `step6.multipass.modes.{per_stamp,per_visit,per_spend}.label/helper` | 三個 mode 的標題 + 說明 |
| Tier common | `step6.multipass.tier.*` | name / stampsNeeded / rewardType / rewardValue / threshold fields |
| Per-visit threshold | `step6.multipass.tier.perVisitTitle` / `perVisitVisitsLabel` / `perVisitStampsLabel` | per_visit 模式下的門檻標題 + 標籤 |
| Per-spend threshold | `step6.multipass.tier.perSpendTitle` / `perSpendAmountLabelTWD` / `perSpendAmountLabelZAR` / `perSpendStampsLabel` | per_spend 模式下的門檻標題 + ZAR prefix 標籤 |
| Reward value units | `step6.multipass.tier.rewardValueAmountUnitZAR` (= `R`) / `rewardValueAmountUnitTWD` (= `元`) / `rewardValuePercentUnit` (= `%`) | PR-5 Fix #2：currency-aware units |
| Error messages | `step6.multipass.tier.accrualThresholdRequiredError` / `rewardValueRequiredError` / `nameRequiredError` / `stampsNeededDuplicateWarning` | 各欄位驗證錯誤 |

---

## 測試覆蓋

| 檔案 | 測試內容 | 測試數 |
|---|---|---|
| `MultipassCardLogic.test.tsx` | Composer smoke + render order（PR-5 render-before-tierlist conformance）+ auto-add defense | 5 |
| `MultipassTierList.test.tsx` | 新增 tier / 上限 cap / empty state auto-fill | 5 |
| `MultipassTierStampsNeededField.test.tsx` | 0 合法 + warning icon（PR-4）+ red border validation | 10 |
| `MultipassTierRewardValueField.test.tsx` | amount_off / percent_off 條件 render + 0 合法（PR-5 Fix）+ ZAR 前綴 / TWD 後綴（PR-5 Fix）+ red border | 10 |
| `MultipassTierRewardTypeField.test.tsx` | Radio mutual exclusion + type switch clears rewardValue | 10 |
| `MultipassTierNameField.test.tsx` | 40-char counter + required error | 10 |
| `MultipassTierAccrualThresholdField.test.tsx` | per_visit / per_spend / null-mode 條件 render + currency-aware ZAR prefix | 10 |
| `MultipassAccrualModeField.test.tsx` | 三選一 radio + Pattern A `:has()` selected state + no cross-contamination with stamp card | 10 |
| `MultipassTierRow.test.tsx` | 5 sub-fields 渲染 + remove 按鈕 | 10 |
| **Total** | | **~80 tests** |

---

## 衍生議題

1. **`MultipassTierMaxDiscountAmountField`（PR-6 待實作）**：`MultipassCardLogic.types.ts` 已宣告 `MultipassTierMaxDiscountAmountFieldProps`，用於 `percent_off` 模式下每個 tier 的最大折扣金額上限。StampCardLogic 有 `MaxDiscountAmountField`，multipass 尚未對齊。
2. **Tier 順序 UI**：`sortMultipassTiers` 只在 save 時自動呼叫（按 stampsNeeded ASC），UI 列表順序隨新增順序。可加 drag-and-drop 或自動 sort。
3. **Preview chain**：`PassCardPreviewBody` 尚未接收 multipass 欄位（stampsNeeded、rewardValue 等）。需要在 `PreviewWrapper` 加上 Multipass preview rendering。

---

## Post-PR-5 Fixes（2026-09-20）

### Fix #3：`multipassAccrualMode` save-side gap（★ 不回填根因）

**根因**：`handleNext` Step 6 的 `onSave` payload 漏掉了 `multipassAccrualMode`。`multipassAccrualMode` 有被正確解構（`CardBuilderEditorWorkspace.tsx:864`）、有 console.log 輸出，但 **`onSave` settings 物件從未包含它**，所以每次點「下一步」都把 `multipassAccrualMode` 靜默丟掉。

**Load 側（回填）狀態**：store 的 `loadSettings` 在 `CardBuilderEditor.store.ts:3367` 已正確處理 `multipassAccrualMode`，所以從 DB 讀回來是對的。問題只出在 save 側。

**修法**：

```typescript
// CardBuilderEditorWorkspace.tsx:1028
// BEFORE
multipassTiers:
  cardType === 'multipass' ? sanitizedMultipassTiers : undefined,

// AFTER
multipassTiers:
  cardType === 'multipass' ? sanitizedMultipassTiers : undefined,
// 2026-09-20: also persist card-wide accrual mode
multipassAccrualMode:
  cardType === 'multipass' ? multipassAccrualMode : undefined,
```

Load 側不需改動（已正確）。

### Fix #4：`級距名稱` → `會員等級` 文案修正

**根因**：`MultipassTierNameField` 標籤 i18n key `step6.multipass.tier.nameTitle` 在 `cardEditor.zh-TW.ts` 寫成「級距名稱」而非「會員等級」。`MultipassTierNameField` 是每個會員等級的命名，「級距」在中文語境中更接近 financial tier（金額區間），而非 loyalty tier（會員等級）。

**修法**：`cardEditor.zh-TW.ts` + `cardEditor.en.ts` 的 `step6.multipass.tier.*` 同步更新：

| 檔案 | Key | 改前 | 改後 |
|---|---|---|---|
| zh-TW | `nameTitle` | 級距名稱 | 會員等級 |
| zh-TW | `namePlaceholder` | 例如：新戶禮 / VIP 回饋 / 滿 5 次再訪 | 例如：銅卡 / 銀卡 / 金卡 |
| zh-TW | `nameRequiredError` | 請輸入級距名稱 | 請輸入會員等級 |
| en | `nameTitle` | Tier name | Member Level |
| en | `namePlaceholder` | e.g. Welcome gift / VIP reward / 5-visit bonus | e.g. Bronze / Silver / Gold |
| en | `nameRequiredError` | Please enter a tier name | Please enter a member level |

---

## Verification

- typecheck：tsc -b apps/frontend/tsconfig.app.json --noEmit exit 0
- typecheck：tsc -b apps/backend --noEmit exit 0
- frontend tests：npx vitest run apps/frontend ~1371+ passed
- backend tests：npm test 276+ passed
- i18n smoke：npm run verify:i18n OK（17 namespaces / 34 locale files，無 raw key）
- schema-conformance：91+ tests passed（backend）

## 參照

- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step6CardLogic/MultipassCardLogic/` — MultipassCardLogic sub-module 完整實作
- `packages/shared/constants/multipass-card.ts` — Single source of truth for limits
- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step6CardLogic/StampCardLogic/` — 對稱實作（card-wide accrual mode + card-wide threshold）
- `DEV/09-2026/0907-step6-stamp-card-logic-completion.md` — Step 6 dispatcher 歷史
- `DEV/09-2026/0918-step6-discount-card-dev-log.md` — sibling（discount_card 是同一個 session 的相鄰實作）
