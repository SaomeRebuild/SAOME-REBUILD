# Step 6 Stamp Card 邏輯完工 DEV LOG：dispatcher、6 個 sub-field、round-trip 修補

## Metadata

- 日期：2026-09-07
- 範圍：CardBuilder Step 6（stamp_card / multipass 的蓋章邏輯）
- 目標：
  1. 建立 Step 6 dispatcher + 6 個 sub-field 的模組化結構
  2. shared schema / store / 後端 schema / db interface 四層同步對齊
  3. **修補 save block 漏送 accrual threshold 欄位的 round-trip bug**
- 相關 feedback：
  - `runs/improvements/feedback/20260907-step6-save-block-threshold-fields-omitted.md`（本次 round-trip bug）
  - `runs/improvements/feedback/20260904-stamp-grid-feature.md`（既有 stamp_grid_rows 鋪墊）

## 問題與根因

Step 6 是 SAOME 的「集點卡邏輯」步驟，介接 mu-plugins 既有 `_stamp_accrual_type`（per_stamp / per_visit / per_spend）與 `_stamp_reward_tiers_json`（reward_type, reward_value, max_discount_amount）。SAOME-REBUILD 的挑戰在於：

| 挑戰 | 解法 |
|---|---|
| 多卡種 dispatcher | `Step6CardLogic` 依 `cardType` 分流；stamp_card / multipass 進 `StampCardLogic`，其他卡種 ComingSoon |
| 4 個 reward field + 4 個 threshold field 共 9 個 | 共用 zod schema + store 一次到位，但 Step 6 dispatch 把 reward / threshold 分屬 6 個 sub-field |
| **handleNext save block 只送 5 個欄位** | 漏送 4 個 accrual threshold（`stampsPerVisit*` / `stampsPerSpend*`）—— 本次修補的核心 |

### Save Block Round-Trip Bug（2026-09-07）

實作 Step 6 的 save block 時，`useCardBuilderStore.getState()` 解構只取 5 個欄位（`stampAccrualMode, rewardName, rewardType, rewardValue, maxDiscountAmount`），但 `loadSettings` 早已支援讀回 4 個 threshold。**這是一種「store 寫了、DB 沒寫、loadSettings 讀不到」的 silent drift**：

- 使用者填 per_visit 模式 → 輸入 3 次拜訪換 2 個章
- 點下一步 → `handleNext` 只送基本 5 欄位
- DB 收到 `stampAccrualMode: 'per_visit'` 但**沒有任何 threshold 數字**
- 重整頁面 → `loadSettings` 讀不到 threshold → store 留 null → UI 顯示空欄位

此 bug 的觸發條件是「使用者從 Step 6 走到下一步」，**任何完成 Step 6 的 draft 都會中招**。直到 2026-09-07 我們在 `runs/decisions` 旁看到 DB JSON 才發現。

## 實作內容

### Step 6 dispatcher + sub-field（2026-09-07）

1. **新檔案結構**：
   ```
   apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step6CardLogic/
   ├── Step6CardLogic.tsx                    ← dispatcher (73 行)
   ├── Step6CardLogicComingSoon.tsx          ← placeholder for non-stamp
   ├── Step6CardLogic.types.ts
   ├── Step6CardLogic.test.tsx               ← dispatcher smoke test
   ├── Step6CardLogic.stories.tsx            ← Storybook
   ├── index.ts                              ← barrel
   └── StampCardLogic/
       ├── StampCardLogic.tsx                ← composes 6 sub-fields
       ├── StampAccrualModeField.tsx
       ├── RewardNameField.tsx
       ├── AccrualThresholdField.tsx         ← conditional: per_visit / per_spend
       ├── RewardTypeField.tsx
       ├── RewardValueField.tsx
       ├── MaxDiscountAmountField.tsx        ← conditional: percent_off
       ├── StampCardLogicPreview.tsx         ← live scenario preview
       └── *.test.tsx + *.stories.tsx        ← 6 個 sub-field + preview 各一份
   ```
2. **schema 四層對齊（Rule 019 § 4.1）**：
   - Layer 1: `packages/shared/schemas/card.ts::templateSettingsSchema` —— 新增 4 個 threshold field + Step 6 base field 文件化
   - Layer 2: `apps/backend/src/modules/cards/schemas/request.ts::templateSettingsSchema` —— 同步 4 個 threshold
   - Layer 3: `apps/backend/src/modules/cards/db/templates.ts::TemplateSettings` 介面 —— 同步
   - Layer 4: backend service 用 `TemplateSettings` 介面，自動同步
3. **shared constants**: 新檔 `packages/shared/constants/stamp-card.ts`，包含 `ACCRUAL_MODES`, `REWARD_TYPES`, `REWARD_NAME_MAX_LENGTH=40`, `MAX_DISCOUNT_AMOUNT_MAX=1_000_000`, threshold 上下界等常數
4. **cardTypeExtensions**: 新增 stamp_card / multipass 的 extension schema 入口（`packages/shared/schemas/cardBuilder.ts`）
5. **i18n**: 新增 Step 6 namespace keys（zh-TW + en），涵蓋 title / intro / 每個 field label / 錯誤訊息

### Round-trip Fix（2026-09-07 22:36）

1. **檔案 `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorWorkspace.tsx`**：
   - `handleNext` Step 6 save block（lines 322-348）解構新增 4 個 threshold
   - `onSave(cardId, { ...9 fields... })` 補齊
   - `console.log` 加入 4 個 threshold 欄位
2. **`CardBuilderEditorWorkspace.step6-integration.test.tsx`**：
   - 修正既有 `'handleNext calls onSave with Step 6 fields when cardId exists'` 測試：原本用 `per_visit` 但**沒設 threshold**，會被 `isStep6Valid()` 擋下 → 改用 `per_stamp`（無 threshold requirement）
   - 新增 2 條 regression 測試：
     - `'handleNext forwards stampsPerVisitCount + stampsPerVisitStamps for per_visit mode'`
     - `'handleNext forwards stampsPerSpendAmount + stampsPerSpendStamps for per_spend mode'`

### `ConfirmAbandonDraftDialog` 防誤觸（2026-09-07）

| 動作 | 原因 |
|---|---|
| 新增 `apps/frontend/src/components/ui/dialog/ConfirmAbandonDraftDialog.test.tsx` | 確認對話框在 draft abandon 前必詢問 |
| `ConfirmAbandonDraftDialog.tsx` 行為更新 | shadcn `Dialog` 對應 React Portal + overlay 行為 |

## 驗證

- TypeScript：`npx tsc -b --noEmit` 通過（無錯誤輸出）
- Lint：`npm run lint` 通過；新檔案無新增 warning
- Unit test（CardBuilderEditor 目錄）：438 passed（31 test files, 37s）
  - Step 6 integration：`11 tests` 全綠（新增 3 條 round-trip regression）
  - Step 6 sub-fields：每個 sub-field 各自 test
- i18n：新增 key 在 zh-TW / en locale 同步，無 raw key

## 後續注意事項

1. **未來新增 Step 6 field 必同步四層**：
   - shared schema `templateSettingsSchema`
   - backend request schema
   - backend db interface (`TemplateSettings`)
   - backend service 自動隨介面同步
   - frontend store + setter
   - `handleNext` save block 必須明確 `useCardBuilderStore.getState()` 解構新增 field
   - locale (zh-TW + en)
   - loadSettings defensive coercion (若需 IFF)

2. **本次修補的 stack**：原本只是「save block 漏 4 個欄位」，但完整的 stack 包含：
   - schema（已有）
   - store（已有 setter）
   - loadSettings defensive read（已有）
   - save block → onSave → DB（**本次修**）
   - 後端 zod 接受（已有）
   - DB JSONB merge（已有 `||` operator）
   - 後端 echo back（已有）

   沒修任一環節都會 silent drift。本次修的就是「save block → onSave」這個被遺漏的環節。

3. **`ConfirmAbandonDraftDialog`** 已加測試，未來若改為 prompt 行為或加 reason field，需同步更新測試 + Dialog 文件。

## 規範層影響

| 規範 | 動作 | 原因 |
|---|---|---|
| `.cursor/rules/frontend/023-shared-package.mdc` § i18n Namespace 規範 | 對齊中 | Step 6 新增 i18n key 在既有 `cardEditor` namespace，沒新開 namespace（correct decision） |
| `003-tdd-integration.mdc` | 對齊 | round-trip regression 屬 L2 critical user flow |
| Rule 019 § 4.1 四層 binding | 重申 | 這次發現「save block 不在四層裡」是 Rule 沒覆蓋的盲點；未來需擴 Rule 019 § 4.1 加 § frontend save block 是隱性第五層 |
