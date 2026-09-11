# Step 6 Cashback Card 邏輯完工 DEV LOG：第三個 card-type-specific sub-module

## Metadata

- 日期：2026-09-11
- 範圍：CardBuilder Step 6（cashback_card 現金回饋卡的回饋邏輯）
- 目標：
  1. 完成 Step 6 dispatcher 對 `cashback_card` 的分流（StampCardLogic + RewardCardLogic 的 sibling）
  2. 落地 tier-based % cashback 編輯器（最多 5 個 tier；每個 tier = name + thresholdSpend + cashbackPercent 三欄）
  3. 修補「threshold=0 顯示空 input 讓使用者以為 input 被吞掉」的可訪問性 bug
- 相關 feedback：本 DEV LOG 同時描述 `runs/improvements/INDEX.md` 內 Step 6 系列的延伸（dispatcher 已落地 3 個 sub-module）
- Plan ref：Step 6 CashbackCardLogic 2026-09-11

## 問題與根因

Step 6 在 2026-09-07 落地 `stamp_card` / `multipass`（見 `0907-step6-stamp-card-logic-completion.md`），2026-09-09 落地 `reward_card`（見 `0909-step6-reward-card-dev-log.md`）。Step 6 dispatcher 對 `cashback_card` 仍是 ComingSoon placeholder。

### Cashback 卡跟 stamp / reward 的結構差異

| 維度 | stamp_card | reward_card | cashback_card（本 PR）|
|---|---|---|---|
| 觸發 | 拜訪 / 消費 | 拜訪 / 消費 / 點數 | **只有消費**（永遠 spend-driven）|
| 中間媒介 | 印章 | 點數 | **沒有**（結果就是 % rebate）|
| Tier 結構 | 5 tier × 印章 grid | 5 tier × points-threshold + earn rate | **5 tier × threshold → %** |
| threshold 語義 | 印章格數 | 兌換所需點數 | **累計消費門檻**（0 = 預設 tier，人人有）|
| 上限機制 | N/A | `maxDiscountAmount`（cap'd discount）| **N/A**（cashback 是 % rebate，永遠不 cap）|

最簡單的 Step 6 sub-module：每個 tier 是一條 flat rule「累計消費 → 回饋%」，沒有 earning-mode 開關、沒有 point accrual、沒有 rewardType/rewardValue。

### 為什麼 threshold=0 是 legitimate value（不是 unset placeholder）

| 情境 | stamp_card | reward_card | cashback_card |
|---|---|---|---|
| threshold = 0 | 不可能（印章至少 1 格）| 不可能（兌換至少要 1 點）| **可能**：人人享有的基礎回饋（"不限消費金額享 1% 現金回饋"）|
| threshold > 0 | N 印章 = 1 集點 | N 點 = 1 兌換 | 累計消費 N 元 → X% 回饋 |

threshold=0 是「default tier」（給所有會員、沒消費門檻）的設計，這是 cashback 跟其他兩個 sub-module 的關鍵語意差異。

### Bug：threshold=0 顯示空 input 讓使用者以為 input 被吞掉

**Round 1 實作**：`<input value={thresholdSpend === 0 ? '' : thresholdSpend}>` — 空值時 input 顯示空白，但 store 仍是 0。

**症狀**：使用者看到「輸入 0」placeholder 但打 0 卻被 React re-render 洗掉（store 寫 0 → input 顯示空 → 使用者以為 input 拒絕接受）。

**Round 2 修法**：

```diff
- <input value={thresholdSpend === 0 ? '' : thresholdSpend} />
+ <input value={String(thresholdSpend)} />
+ {/* Helper text below input explains "0 = no threshold, everyone qualifies" */}
+ <p>{t('step6.cashback.tier.thresholdHelper')}</p>
```

並新增 `thresholdHelper` i18n key 在 zh-TW / en 同步解釋語意，讓 placeholder 消失時使用者仍看得懂。

## 實作內容

### 1. 新檔案結構

```
apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step6CardLogic/CashbackCardLogic/
├── CashbackCardLogic.tsx                    ← sub-module composer (CashbackTierList + Preview)
├── CashbackCardLogic.types.ts               ← 6 個 component props + CashbackCardLogicProps
├── CashbackCardLogic.stories.tsx            ← Storybook (7 個 story: Empty / WithValidationErrors / DefaultTierOnly / MultiTier × 3 currencies / MaxTiersCap)
├── CashbackCardLogic.test.tsx               ← composer smoke test (3 scenarios)
├── CashbackCardLogicPreview.tsx             ← live scenario preview (first tier 的湊句)
├── CashbackCardLogicPreview.test.tsx
├── index.ts                                 ← barrel
├── CashbackTierList.tsx                     ← list container + 新增/上限按鈕 (max 5)
├── CashbackTierList.test.tsx
├── CashbackTierRow.tsx                      ← 3 個 sub-field composer + Remove 按鈕
├── CashbackTierRow.test.tsx
├── CashbackTierNameField.tsx                ← text input (tier name, max 40 chars)
├── CashbackTierNameField.test.tsx
├── CashbackTierThresholdField.tsx           ← number input (thresholdSpend, currency-aware, 0 allowed)
├── CashbackTierThresholdField.test.tsx      ← threshold=0 input value 顯示 regression
├── CashbackTierPercentField.tsx             ← number input (cashbackPercent 1-100, integer)
└── CashbackTierPercentField.test.tsx

packages/shared/constants/cashback-card.ts   ← MAX_CASHBACK_TIERS=5 + CashbackTierShape + 上下界
```

### 2. shared schema / constant / backend 四層對齊（Rule 019 § 4.1）

| 層 | 檔案 | 新增內容 |
|---|---|---|
| 1 | `packages/shared/schemas/card.ts::templateSettingsSchema` | 新增 `cashbackTiers` array（max 5，含 3 個 per-tier field：`name` 1..40 / `thresholdSpend` ≥0 / `cashbackPercent` 1..100 int）|
| 2 | `packages/shared/schemas/cardBuilder.ts::cardTypeExtensions.cashback_card` | 新增 `cashback_card` extension（同樣 `cashbackTiers` array 結構）|
| 3 | `apps/backend/src/modules/cards/schemas/request.ts::templateSettingsSchema` | mirror step 1（同步 4 層 binding）|
| 4 | `apps/backend/src/modules/cards/db/templates.ts::TemplateSettings` | 介面同步新增 `cashbackTiers` |
| shared | `packages/shared/constants/cashback-card.ts`（new）| `MAX_CASHBACK_TIERS=5`、`CASHBACK_TIER_NAME_MAX_LENGTH=40`、`CASHBACK_PERCENT_MIN=1` / `MAX=100`、`CASHBACK_THRESHOLD_MIN=0` / `MAX=999_999_999`、`CashbackTierShape` interface |
| shared barrel | `packages/shared/constants/index.ts` | `export * from './cashback-card'` |

### 3. Store 變更（`CardBuilderEditor.store.ts`）

- 新增 state slice：`cashbackTiers: Array<CashbackTierShape & { id: string }>`、default `[]`
- 新增 setters：
  - `addCashbackTier()` — 在 `MAX_CASHBACK_TIERS=5` 內 append 空 tier（name='', thresholdSpend=0, cashbackPercent=1）；超限為 no-op
  - `removeCashbackTier(id)` — filter 掉該 id（不 auto-refill）
  - `updateCashbackTier(id, patch)` — partial patch；guard：
    - `name` slice 到 `CASHBACK_TIER_NAME_MAX_LENGTH`
    - `thresholdSpend` reject < 0（allow 0 as legitimate default），cap 到 `CASHBACK_THRESHOLD_MAX`
    - `cashbackPercent` reject < 1 or > 100，整數化
  - `sortCashbackTiers()` — `thresholdSpend` 升冪排序（threshold=0 在最前）
- `loadSettings` defensive read：array 形態 defensive parse（missing 欄位降級為 default），sort by `thresholdSpend` ASC

### 4. `Step6CardLogic` dispatcher 擴充

- 新增 `if (cardType === 'cashback_card')` 分支（平行於既有 `reward_card` / `stamp_card` / `multipass`）
- dispatcher hero 文字用 `step6.cashback.intro` + `step6.cashback.introHint`（與 reward-card-specific 同源設計）
- 測試更新：
  - 從 `cashback_card → ComingSoon` 改為 `cashback_card → CashbackCardLogic`
  - 新增 `renders the Step 6 cashback-card-specific intro hero text for cashback_card`

### 5. `CardBuilderEditorWorkspace.tsx` save block + validation

- `isStep6Valid()` 新增 `cashback_card` 分支 → `isCashbackStep6Valid()`：
  - `cashbackTiers.length ≥ 1`
  - 每個 tier：`name.trim() !== ''` + `0 ≤ thresholdSpend ≤ 999_999_999` + `1 ≤ cashbackPercent ≤ 100` 且 `Number.isInteger`
- save block：`onSave(cardId, { ..., cashbackTiers })`，`cashbackTiers` 經 `sanitizedCashbackTiers` 處理：
  - strip `id`（UI-only React key，不在 contract）
  - sort by `thresholdSpend` ASC（threshold=0 first）

### 6. i18n namespace 對齊（Rule 023）

- 在既有 `cardEditor` namespace 下新增 `step6.cashback.*` key tree（**沒新開 namespace**，與 Step 6 stamp + reward 一致）
- zh-TW / en 同步：
  - `intro` / `introHint`（cashback-card-specific hero 文字）
  - `tiersTitle` / `tiersHint` / `addTier` / `removeTier` / `maxTiersReached`
  - `tier.nameTitle` / `namePlaceholder` / `nameCounter` / `nameRequiredError`
  - `tier.thresholdTitle` / `thresholdHelper` / `thresholdUnitTWD` (元/NT$) / `thresholdUnitZAR` (R) / `thresholdPlaceholder` / `thresholdInvalidError` / `thresholdZeroHint`
  - `tier.percentTitle` / `percentPlaceholder` / `percentUnit` / `percentRequiredError` / `percentInvalidError` / `percentTooLargeError`
  - `preview.tierUnknown` / `preview.noThreshold` / `preview.withThreshold`
  - `validation.tierRequired` / `tierNameRequired` / `thresholdInvalid` / `percentInvalid`

### 7. Currency-aware 渲染（沿用 RewardCardLogic 既有 pattern）

`CashbackTierThresholdField` + `CashbackCardLogicPreview` 都走同樣 currency-aware 渲染：

| 幣別 | locale | 單位位置 | 範例 |
|---|---|---|---|
| TWD | zh-TW | suffix | 「累計消費 1000元」 |
| TWD | en | prefix | 「Cumulative Spend NT$1000」 |
| ZAR | any | prefix | 「Cumulative Spend R1000」 |

preview 模板：
- threshold=0 → `step6.cashback.preview.noThreshold`：「Earn 5% cashback on every purchase」/「不限消費金額享 5% 現金回饋」
- threshold>0 → `step6.cashback.preview.withThreshold`：「Spend NT$1000 to earn 5% cashback」/「累計消費滿 1000元 享 5% 現金回饋」

### 8. Step6 Integration Test 擴充（`CardBuilderEditorWorkspace.step6-integration.test.tsx`）

新增 7 條現金回饋情境：

| # | 場景 | 預期 |
|---|---|---|
| 1 | `cashbackTiers` 空 | Next disabled |
| 2 | tier name 為空 | Next disabled |
| 3 | threshold=0 + name + valid percent | Next **enabled**（default tier 是 legitimate）|
| 4 | 多個 tier 已排序 ASC | Next enabled |
| 5 | cashbackPercent < 1 | Next disabled |
| 6 | cashbackPercent > 100 | Next disabled |
| 7 | `handleNext` save 時排序 + strip id | `cashbackTiers` 傳出時已排序且無 `id` |

同時更新既有 4 條 stamp / reward 測試：`cashbackTiers: []`（cashback 對 stamp / reward 不適用，永遠送空 array）

並把「Next button is ALWAYS enabled for non-stamp card types」改名為「...ComingSoon card types」，改用 `membership_card` 測試（cashback 已落地、不再是 ComingSoon）。

### 9. Store 測試擴充（`CardBuilderEditor.store.test.ts`）

新增 Cashback Card Logic state describe block：

- `addCashbackTier` × 2 條（append / 5-tier cap）
- `removeCashbackTier` × 2 條（by id / 不 auto-refill）
- `updateCashbackTier` × N 條（name slice / threshold range / cashbackPercent range / integer rounding）
- `loadSettings` defensive × 1 條（sort by threshold ASC）
- `reset()` × 1 條（回到空 array）

## 跟現有 sub-module 的差異速查表

| 設計決策 | stamp_card | reward_card | cashback_card |
|---|---|---|---|
| Tier 上限 | MAX_STAMP_TIERS=5 | MAX_REWARD_TIERS=5 | MAX_CASHBACK_TIERS=5 |
| Tier 必填欄位數 | 4 | 8 | **3**（最少）|
| 跨 tier 共有 policy | stampAccrualMode | earningMode（card-wide）| **無**（cashback 沒有 mode 切換）|
| threshold=0 合法性 | ❌ | ❌ | ✅（default tier）|
| Per-tier earn rate | pointsPerVisit / pointsPerSpend | pointsPerVisit / pointsPerSpendAmount + pointsPerSpendPoints | **無**（結果就是 %）|
| 上限 cap 機制 | N/A | maxDiscountAmount（% 才需要）| **無**（cashback 永遠不 cap）|
| Dispatcher hero 文字 | step6.intro / step6.introHint | step6.reward.intro / introHint | **step6.cashback.intro / introHint** |

## 為什麼 cashback 故意設計成 Step 6 最簡單 sub-module

| 理由 | 說明 |
|---|---|
| mu-plugins cashback-tier 結構本來就最簡單 | 只有 name + threshold + percent 三欄 |
| 使用者 mental model 直接 | 「花多少 → 退多少%」不需要 mode 切換 |
| 跟 stamp / reward 形成教學梯度 | 先看完 stamp 的 4 欄、再看 reward 的 8 欄、最後看 cashback 的 3 欄 |

未來若產品要擴充 cashback（例如「指定星期幾額外加碼」），**不要**塞進 cashback tier 結構 — 應另開 Step 6 sub-module（例如 `CashbackCardLogic.BonusDay`），保持 cashback tier 維持「3 欄最小契約」。

## 驗證

### TypeScript

```bash
cd apps/frontend
npx tsc -b --noEmit   # exit 0
```

### Vitest

```bash
cd apps/frontend
npm test -- CashbackCardLogic
# 預期：10 個 cashback-related test file 全綠（含 Step6CardLogic dispatcher + Step6 integration）
```

### i18n smoke test

```bash
npm run verify:i18n
# 預期：無 raw key；step6.cashback.* 全部 resolve 到 zh-TW / en 翻譯
```

### 完工時的卡型分流一覽（Step 6 dispatcher）

| cardType | 渲染的 sub-module | 實作日期 |
|---|---|---|
| `null`（未選） | `Step6CardLogicComingSoon` | 2026-09-07 |
| `stamp_card` | `StampCardLogic` | 2026-09-07 |
| `multipass` | `StampCardLogic`（共用）| 2026-09-07 |
| `reward_card` | `RewardCardLogic` | 2026-09-09 |
| **`cashback_card`** | **`CashbackCardLogic`** | **2026-09-11（本 PR）**|
| 其他（`membership_card` 等） | `Step6CardLogicComingSoon` | 待實作 |

## 後續注意事項（future invariants）

1. **未來加 cashback field 必同步 4 層**：shared schema → backend request → backend db interface → service（Rule 019 § 4.1）
2. **未來加 cashback i18n key 必同步 zh-TW / en**（Rule 023 全中文 / 全英文紀律）
3. **`thresholdSpend = 0` 的合法語意不可丟**：未來 refactor 不准把 `threshold > 0` 改成硬性要求，否則會破壞「人人享有的基礎回饋」商業語意
4. **cashback tier 維持 3 欄最小契約**：未來擴充（例如 bonus day、限定 category）應開 sub-sub-module，不要污染 tier shape
5. **Step 6 dispatcher 已是 3 個 sub-module + ComingSoon**：未來加新 card type 走同樣 pattern（`Step6CardLogic.tsx` 加 if 分支 + `Step6CardLogic.test.tsx` 加 dispatch 測試）

## Commit 規劃（本 PR 採分批策略）

| Batch | 主旨 | 涵蓋檔案 |
|---|---|---|
| 1 | shared contract | `packages/shared/constants/cashback-card.ts` (NEW) + `packages/shared/constants/index.ts` + `packages/shared/schemas/{card,cardBuilder}.ts` |
| 2 | backend mirror | `apps/backend/src/modules/cards/db/templates.ts` + `apps/backend/src/modules/cards/schemas/request.ts` |
| 3 | i18n | `apps/frontend/src/i18n/locales/cardEditor.{zh-TW,en}.ts` |
| 4 | frontend store + dispatcher | `CardBuilderEditor.store.{ts,test.ts}` + `Step6CardLogic.{tsx,test.tsx}` |
| 5 | frontend workspace | `CardBuilderEditorWorkspace.tsx` + `step6-integration.test.tsx` |
| 6 | CashbackCardLogic L2 module | 17 個 NEW 檔案（含 stories + 9 個 test file）|
| 7 | docs / feedback | 本 DEV LOG + `runs/improvements/INDEX.md` |

每批 commit 都自帶 typecheck + test 通過驗證；最後 push 完 `git log --oneline origin/main..HEAD` 應為 7 個 commit。

---

## 同 session 的其他 dev log

- `runs/improvements/feedback/20260911-hyperdrive-query-spike-investigation.md`：Hyperdrive 87% query 撞 free plan quota 的 diagnose_only 調查（6 個互相疊加的架構性 multiplier；屬於後續 fix session 的 backlog；本批只 commit 調查報告，不動 production code）
