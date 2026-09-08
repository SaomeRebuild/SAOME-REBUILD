# Step 6 Reward Card 邏輯完工 DEV LOG：dispatcher 分流、per-tier 編輯器、單位 prefix 修補

## Metadata

- 日期：2026-09-09
- 範圍：CardBuilder Step 6（reward_card 的獎勵邏輯）
- 目標：
  1. 完成 Step 6 dispatcher 對 `reward_card` 的分流（StampCardLogic 是 sibling）
  2. 落地 points-driven reward tier 編輯器（最多 5 個 tier；earningMode 為 card-wide；earn rate 為 per-tier）
  3. 修補 `RewardTierRewardValueField` 的 prefix/suffix 單位 bug（與其他 3 個 sub-field 同源）
- 相關 feedback：
  - 本次 prefix/suffix 修補對齊的 3 個 sibling DOM path：`StampCardLogic/MaxDiscountAmountField`、`StampCardLogic/RewardValueField`、`StampCardLogic/AccrualThresholdField`

## 問題與根因

Step 6 在 2026-09-07 已落地 `stamp_card` / `multipass` 兩種卡型（見 `DEV/09-2026/0907-step6-stamp-card-logic-completion.md`），但 dispatcher 對 `reward_card` 是 ComingSoon placeholder。

| 挑戰 | 解法 |
|---|---|
| `reward_card` 與 `stamp_card` 都是「獎勵折抵」邏輯，但 mu-plugins 結構不同 | 新開 `RewardCardLogic` sub-module 平行於 `StampCardLogic`，由 `Step6CardLogic` dispatcher 分流 |
| reward_card 是 points-driven，最多 5 個 reward tier；earningMode 與 stamp 的 accrualMode 對應但數值不同 | 新開 `packages/shared/constants/reward-card.ts` 提供 `EARNING_MODES = ['based_on_points','based_on_visits','based_on_spending']`、`MAX_REWARD_TIERS=5`、`THRESHOLD_*`、`POINTS_PER_VISIT_MIN` 等常數；reward tier shape 透過 `RewardTierShape` interface 提供給 frontend store + backend schema |
| earningMode 是 card-wide policy，但 earn RATE（每 visit 多少點、每消費多少點）應該 per-tier 才合理 | 2026-09-09 mixed refactor：`EarningModeField` 移到 `RewardCardLogic` 頂層（單一 card-wide 值，模式切換清空所有 per-tier earn rate）；`PointsPerVisitField` / `PointsPerSpendField` 留在每個 `RewardTierRow` 內，每個 tier 可設定不同 earn rate |
| `RewardTierRewardValueField` 單位渲染在 input 之後（"50 元"、"50 R"），視覺讀成「值 + 單位」黏在一起 | 把 unit `<span>` 移到 `<input>` 之前；DOM 順序變 `[unit][input]`，符合 NT$50 / R50 / %10 的貨幣/百分比慣例；同源 sibling（`StampCardLogic/MaxDiscountAmountField`、`RewardValueField`、`AccrualThresholdField`）同樣修過 |

### `earningMode` 為何從 per-tier 搬回 top-level（mixed refactor）

中間有個短暫 refactor 把 `earningMode` 放到 `rewardTiers[i].earningMode`，發現這個設計有兩個問題：

1. 同一張卡 5 個 tier 的 earningMode 99% 應該相同（per-card policy），放 per-tier 等於強迫使用者重複選 5 次
2. 模式切換（visit ↔ spend）的副作用（清空所有 earn rate field）難以表達 — 跨 tier 必須 iterate

因此 2026-09-09 採 mixed 設計：

| 維度 | 位置 | 理由 |
|---|---|---|
| `earningMode` | top-level（`templateSettings.earningMode`）| card-wide policy |
| `pointsPerVisit` / `pointsPerSpendAmount` / `pointsPerSpendPoints` | per-tier（`rewardTiers[i].*`）| 每個 tier 可有不同 earn rate（如 tier-1 = 1 visit = 1 pt，tier-2 = 1 visit = 2 pt）|

這個混合 shape 反映 mu-plugins `passcreator-reward-card.php` 的真實業務：card policy 是「拜訪集點」，但不同 tier 給不同點數。

## 實作內容

### 1. 新檔案結構

```
apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step6CardLogic/RewardCardLogic/
├── RewardCardLogic.tsx              ← sub-module composer (EarningModeField + RewardTierList + Preview)
├── RewardCardLogic.types.ts         ← 8 個 component props + EarningMode re-export
├── RewardCardLogic.stories.tsx      ← Storybook
├── RewardCardLogic.test.tsx         ← composer smoke test
├── RewardCardLogicPreview.tsx       ← live scenario preview (第一個 tier 的湊句)
├── RewardCardLogicPreview.test.tsx
├── index.ts                         ← barrel
├── EarningModeField.tsx             ← 3-option radio（CARD-WIDE，2026-09-09 mixed refactor）
├── EarningModeField.test.tsx
├── RewardTierList.tsx               ← list container + 新增/上限按鈕
├── RewardTierList.test.tsx
├── RewardTierRow.tsx                ← 7 個 sub-field composer
├── RewardTierNameField.tsx          ← text input (tier name)
├── RewardTierThresholdField.tsx     ← number input (point threshold)
├── RewardTierRewardTypeField.tsx    ← select (amount_off / percent_off)
├── RewardTierRewardValueField.tsx   ← number input (reward value) ← **本次 prefix fix**
├── RewardTierRewardValueField.test.tsx  ← +3 條 DOM-order regression
├── RewardTierMaxDiscountField.tsx   ← conditional: percent_off only（ZAR prefix / TWD suffix 已對齊）
└── RewardTierMaxDiscountField.test.tsx

packages/shared/constants/reward-card.ts   ← EARNING_MODES + MAX_REWARD_TIERS + RewardTierShape + 上下界
```

### 2. shared schema / constant / store 四層對齊（Rule 019 § 4.1）

| 層 | 檔案 | 新增內容 |
|---|---|---|
| 1 | `packages/shared/schemas/card.ts::templateSettingsSchema` | 新增 `earningMode` enum + `rewardTiers` array（max 5，含 8 個 per-tier field）|
| 2 | `apps/backend/src/modules/cards/schemas/request.ts` | mirror step 1（同步 4 層 binding）|
| 3 | `apps/backend/src/modules/cards/db/templates.ts::TemplateSettings` | 介面同步新增 `earningMode` + `rewardTiers` |
| 4 | backend service | 透過 `TemplateSettings` 介面自動同步 |
| shared | `packages/shared/constants/reward-card.ts`（new）| `EARNING_MODES`、`MAX_REWARD_TIERS=5`、`RewardTierShape` interface、threshold / earn rate 上下界 |
| shared barrel | `packages/shared/constants/index.ts` | `export * from './reward-card'` |

### 3. Store 變更（`CardBuilderEditor.store.ts`）

- 新增 state slice：`earningMode: EarningMode | null`、`rewardTiers: Array<RewardTierShape & { id: string }>`、default `[]`
- 新增 setters：
  - `setEarningMode(mode)` — 切換模式時**清空所有 per-tier earn rate field**（避免 visit 模式的 `pointsPerVisit` 殘留到 spend 模式）
  - `addRewardTier()` — 在 `MAX_REWARD_TIERS=5` 內 append 空 tier；超限為 no-op
  - `removeRewardTier(id)` — filter 掉該 id
  - `updateRewardTier(id, patch)` — partial patch；切換 `rewardType` 時清空 `rewardValue` + `maxDiscountAmount`
  - `sortRewardTiers()` — `threshold` 升冪排序
- `loadSettings` defensive read：top-level `earningMode` 缺失時，從 `rewardTiers[0].earningMode`（舊 contract）hoist 並 promote 到 top-level；下次 save 時就只剩 top-level

### 4. `CardBuilderEditorWorkspace.tsx` save block

- `isStep6Valid()` 新增 `earningMode !== null` + `rewardTiers.length ≥ 1` + 每個 tier identity 完整（name + threshold + rewardType + rewardValue）檢查
- per-tier earn rate 檢查依 card-wide `earningMode` 動態決定：
  - `based_on_visits` → 每個 tier 的 `pointsPerVisit ≥ 1`
  - `based_on_spending` → 每個 tier 的 `pointsPerSpendAmount > 0` + `pointsPerSpendPoints ≥ 1`
  - `based_on_points` → 不需 per-tier earn rate field
- save block：`onSave(cardId, { ..., earningMode, rewardTiers })`，`rewardTiers` 經 `sanitizedRewardTiers` 處理（移除舊 contract 的 per-tier `earningMode`，避免 schema drift）

### 5. i18n namespace 對齊（Rule 023）

- 在既有 `cardEditor` namespace 下新增 `step6.reward.*` key tree（**沒新開 namespace**，與 Step 6 stamp 一致）
- zh-TW / en 同步：
  - `intro` / `introHint`（reward-card-specific hero 文字，與 stamp 區隔）
  - `tier.*`（`tiersTitle` / `tiersHint` / `addTier` / `removeTier` / `maxTiersReached`）
  - `tier.nameTitle` / `thresholdTitle` / `rewardTypePlaceholder` / `rewardTypeTitle` / `rewardValueTitle` / `rewardValueAmountPlaceholder` / `rewardValuePercentPlaceholder` / `rewardValueAmountUnitTWD` / `rewardValueAmountUnitZAR` / `rewardValuePercentUnit` / `rewardValueRequiredError` / `rewardValueTooLargeError`
  - `tier.maxDiscountTitle` / `maxDiscountPlaceholder` / `maxDiscountHelper` / `maxDiscountOptional` / `maxDiscountUnitTWD` / `maxDiscountUnitZAR`
  - `preview.tierUnknown`

### 6. `RewardTierRewardValueField` prefix/suffix 修補（本次重點）

**Bug**：`<input>` 之後渲染 unit `<span>` → DOM 為 `[input][unit]`，視覺讀成「50元」/「50 R」黏在一起。

**Fix**：

```diff
- <div className="flex items-center gap-2">
-   <input ... />
-   {unitLabel && <span>{unitLabel}</span>}
- </div>
+ <div className="flex items-center gap-2">
+   {unitLabel && <span>{unitLabel}</span>}
+   <input ... />
+ </div>
```

**新增 regression test**（`RewardTierRewardValueField.test.tsx`）：
- `amount_off + TWD`：斷言 `firstElementChild.tagName === 'SPAN'` 且 text 為 `rewardValueAmountUnitTWD`，`lastElementChild.tagName === 'INPUT'`
- `amount_off + ZAR`：同上，unit 為 `rewardValueAmountUnitZAR`（"R"）
- `percent_off`：同上，unit 為 `rewardValuePercentUnit`（"%"）

DOM-order assertion 確保未來 refactor 不會意外改回 suffix。

### 7. `RewardTierMaxDiscountField` 雙單位策略（既有設計）

這個 sibling 採更細緻的策略（2026-09-09 mixed refactor）：
- ZAR（南非蘭特）：prefix `R 50`（貨幣慣例）
- TWD（zh-TW 中文）：suffix `50 元`（中文慣例）

兩個 prefix span + 一個 input + 一個 suffix span 並存於同一 row，使用 `unitPrefix` / `unitSuffix` 兩個 boolean gate 決定是否渲染。這是 sibling 與 `RewardTierRewardValueField`（雙 currency 都用 prefix）的差異，但兩者都符合「視覺讀起來不會黏在一起」的目標。

## 驗證

| 檢查 | 結果 |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | exit 0 |
| `npx tsc -p tsconfig.node.json --noEmit` | exit 0 |
| `RewardTierRewardValueField.test.tsx` | 13/13 passed（含 3 條新增 prefix regression） |
| Step 6 整個 suite | 16 files / 178 tests passed |
| i18n verify | `cardEditor.{zh-TW,en}` 同步，無 raw key |

## 後續注意事項

1. **未來加 Step 6 field 必同步 4 層 + frontend save block**：見 `0907-step6-stamp-card-logic-completion.md` § 後續注意事項 1（rule 019 第五層 frontend save block 議題）

2. **`MAX_REWARD_TIERS=5` 是 hard cap**：當前 backend zod 接受 `max(5)`；前端 `RewardTierList.addRewardTier` 在 length === 5 時 disable 按鈕。**任何改這個常數必同步 frontend store + backend schema**。

3. **`setEarningMode` 清空 per-tier earn rate**：這是「防止 stale data leak across modes」的核心保護。任何繞過 `setEarningMode` 直接改 `earningMode` 的程式路徑必須自己承擔清空責任（目前只有 `loadSettings` defensive read 路徑會這麼做，並已 hoist legacy `tier[0].earningMode`）。

4. **`loadSettings` 的 legacy tier[0].earningMode hoist**：舊 contract（per-tier earningMode）的 DB row 在 load 時會 hoist 到 top-level，下次 save 就只剩 top-level。**不要移除這段 defensive code**，否則舊資料會 silent drift。

5. **`RewardTierRewardValueField` 的 prefix 策略**：本次 fix 對 TWD 與 ZAR 一律 prefix。若未來想對齊 `RewardTierMaxDiscountField` 的「TWD suffix / ZAR prefix」中文貨幣慣例，可參考其 `unitPrefix` / `unitSuffix` pattern。

## 規範層影響

| 規範 | 動作 | 原因 |
|---|---|---|
| `000-modular-design.mdc` § A.1 | 對齊 | `RewardCardLogic` 採 L2 業務元件資料夾結構，13 個檔案 + barrel |
| `019-schema-contract-drift.mdc` § 4.1 四層 binding | 重申 | reward_card 是新功能，schema / store / backend db interface / backend service 四層必同步 |
| `frontend/023-shared-package.mdc` | 對齊 | `reward-card.ts` 在 `packages/shared/constants/`；業務邏輯（`RewardTierShape` interface、`Earning_MODES` 常數）全在 shared |
| `frontend/024-mobile-future-proof.mdc` | 對齊 | `loadSettings` defensive hoist 屬於純函式邏輯；components 內無業務邏輯 |
| `frontend/025-vibe-coding-l2-checklist.mdc` § 1 i18n | 對齊 | `step6.reward.*` key tree 在既有 `cardEditor` namespace，沒新開 namespace（與 Step 6 stamp 一致）|
| `003-tdd-integration.mdc` | 對齊 | 16 個 reward-card test files 全綠，含 3 條 prefix regression |
| `006-verification.mdc` | 對齊 | typecheck + test + i18n verify 全綠才 ship |

## 變更檔案

```
?? packages/shared/constants/reward-card.ts                                                       # new
M  packages/shared/constants/index.ts                                                              # +export './reward-card'
M  packages/shared/schemas/card.ts                                                                 # +earningMode + rewardTiers (zod)
M  packages/shared/schemas/cardBuilder.ts                                                          # (no change — cardTypeExtensions wired through)

M  apps/backend/src/modules/cards/db/templates.ts                                                  # TemplateSettings +earningMode +rewardTiers
M  apps/backend/src/modules/cards/schemas/request.ts                                               # mirror step 1

M  apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.ts     # +earningMode + rewardTiers slice + 5 setters + loadSettings defensive hoist
M  apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorWorkspace.tsx                              # isStep6Valid + save block
M  apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorWorkspace.step6-integration.test.tsx      # +reward_card round-trip regression

M  apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step6CardLogic/Step6CardLogic.tsx       # +reward_card dispatcher branch
M  apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step6CardLogic/Step6CardLogic.test.tsx  # +reward_card dispatcher test

?? apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step6CardLogic/RewardCardLogic/  # new sub-module (13 files)

M  apps/frontend/src/i18n/locales/cardEditor.en.ts                                                 # +step6.reward.*
M  apps/frontend/src/i18n/locales/cardEditor.zh-TW.ts                                              # +step6.reward.*
```

---

## 衍生觀察

### 待處理

1. **`PassCardPreview` 對 reward_card 的 balance preview**：`0908-balance-preview-feature.md` 已對齊 reward_card 的「餘額 / 200元」pill，但 reward tier 湊句（preview.tierUnknown）目前還沒接 DB；後續 tier 邏輯上線後接上即可。
2. **`RewardCardLogicPreview` 顯示「第一個 tier」**：UI 設計與 stamp 一致（單句湊句），但 reward 5 個 tier 場景下，使用者可能想看「下一個即將達成的 tier」或「全部 tier 列表」。待 PM 確認需求再實作。

### 觀察但不處理

1. **`earningMode` 三選（points/visits/spending）目前 frontend 只後兩者有 sub-field**：`based_on_points` 是「自訂條件」（任務、推薦等）的 escape hatch，前端不對應任何 per-tier earn rate field；使用者選 `based_on_points` 後 store 不會自動產生 earn rate 設定，僅靠 backend 邏輯（外部系統）計算點數。**這是設計上的 intentional blank**，不是 bug。
2. **`sanitizedRewardTiers` 在 save block 移除 per-tier `earningMode` key**：舊 contract 的 row load 後，下次 save 會自動 sanitize。若想保持 backward-compatible save（保留 legacy field），可改為「保留但加 `// legacy` 註解」。目前選擇「下次 save 就只送新 contract」是更乾淨的策略。
