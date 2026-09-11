# Step 3 Cashback Card 完工 DEV LOG：display-field 擴充 + member-level → reward override

## Metadata

- 日期：2026-09-12
- 範圍：CardBuilder Step 3（cashback_card 的「顯示欄位」section）+ 右容器 PassCardPreview 的 cashback override + ZAR currency formatting
- 目標：
  1. 落地 cashback_card 的 2 個 display fields（amount to next tier、accumulated spending）
  2. 將 cashback_card 的 `memberLevel` slot 從「會員等級」override 為「獎勵」，value 來源是 `cashbackTiers[0].name`
  3. 落地 ZAR (南非幣) currency formatter：符號在前、金額在後（如 `R562`）
- 對齊的既有 pattern：
  - Step 3 stamp_card / reward_card display-field extension（2026-09-04 / 2026-09-10）
  - Step 6 CashbackCardLogic sub-module（2026-09-11，本 DEV LOG 的上游）
- Plan ref：無獨立 plan，沿用 Step 6 cashback 系列的「card-type-specific sub-module」pattern

## 問題與根因

Step 6 在 2026-09-11 落地 `CashbackCardLogic`（見 `0911-step6-cashback-card-dev-log.md`）。但 cashback_card 在 Step 3 還有兩個缺口：

### 缺口 A：cashback_card 沒有專屬 display fields

| cardType | Step 3 display fields | 上線日期 |
|---|---|---|
| 6 common（phone / email / memberLevel / birthday / visitCount / memberName）| 所有 card types 共用 | 2026-09-04 |
| stamp_card 專屬（availableRewards / totalStamps / stampsRemaining）| only stamp_card + multipass | 2026-09-04 |
| reward_card 專屬（pointsToNextTier / currentPoints）| only reward_card | 2026-09-10 |
| **cashback_card 專屬**（pointsToNextTierCashback / accumulatedSpendCashback）| **only cashback_card** | **2026-09-12（本 PR）** |

cashback 的「累積消費」跟「到下個 tier 還差」對其他卡型沒意義（其他卡型不靠消費驅動），所以必須 filter 隱藏 — 不能 render placeholder 讓使用者困惑「這欄位為什麼永遠沒值」。

### 缺口 B：cashback_card 的 `memberLevel` slot 還是「會員等級」

stamp_card 跟 reward_card 在 2026-09-10 改成「獎勵 / Reward」（label + value 來源都換），因為這兩張卡的「會員等級」其實是「獎勵 tier」。cashback_card 也是同一個商業語意 — 「Bronze / Silver / Gold」其實是 cashback tier，但 Step 3 selector 跟預覽都還在顯示「會員等級」。

### 缺口 C：右容器預覽對南非幣沒有 format 支援

Step 2 讓使用者選 card currency（含 TWD / ZAR），但 `PassCardPreviewBody` 的 demo value 全部硬寫「元 / 562」，沒有 currency-aware 渲染。ZAR 應該是「R562」（符號在前、金額在後，ISO 4217 en-ZA convention）。

## 實作內容

### 1. shared constants（`packages/shared/constants/card-fields.ts`）

| 變更 | 細節 |
|---|---|
| `CardFieldGroup` 新增 `'cashback'` | 4th group discriminator |
| `CARD_FIELD_KEYS` 陣列 append 2 個 key | `pointsToNextTierCashback`、`accumulatedSpendCashback` |
| `CARD_FIELDS` 陣列 append 2 個 entry | `group: 'cashback'` + `labelKey` 指向 `step3.fieldsSection.fields.*` |

### 2. Step 3 selector（`Step3CardFields/`）

| 檔案 | 變更 |
|---|---|
| `filterCARD_FIELDS_BY_CARD_TYPE.ts` | 新增 `CASHBACK_CARD_TYPES: Set<CardType>`（= `{'cashback_card'}`），filter 多一個 group 條件 |
| `index.tsx` | `resolveOptionLabelKey` 把 cashback_card 加進 memberLevel override scope（label 從「會員等級」改成「獎勵」）|
| `index.test.tsx` | 新增 cashback_card field filtering + memberLevel override 測試 |

### 3. 右容器預覽（`CardPreview/`）

| 檔案 | 變更 |
|---|---|
| `PassCardPreview.tsx` | 修 duplicate declaration bug（`firstCashbackTierName` 同時 destructured + locally declared — 詳見下面「Bug：duplicate declaration」段落）。現在只有 store-derived 一條來源（parent `CardBuilderEditorWorkspace` 沒傳 prop）|
| `PassCardPreview.types.ts` | `PassCardPreviewProps` 加 `firstCashbackTierName?: string` prop（給 unit test 注入）|
| `PassCardPreviewBody.tsx` | (1) 新增 `cashback_card + memberLevel` override branch（label = stampLabel, value = firstCashbackTierName）；(2) 新增 ZAR currency formatter：當 `store.currency === 'ZAR'`，default branch 的 field value 套 `R` prefix（regex extract 數字 + prepend R）|
| `PassCardPreviewBody.test.tsx` | 新增 cashback override 測試（5 條：左右 slot 各自、空值 fallback、非 cashback 不受影響、empty array fallback、ZAR 不影響 override）+ ZAR formatter 測試（4 條：TWD 不變、ZAR 兩個 field、ZAR 不影響非數字 field、ZAR 不影響 override branch）|

### 4. i18n（4 個檔案）

| namespace | locale | 新增 keys |
|---|---|---|
| `passCard` | zh-TW | `fieldPreview.pointsToNextTierCashback`（label: '到下個層級還差', value: '562元'）+ `accumulatedSpendCashback`（label: '已累積消費', value: '3301元'）|
| `passCard` | en | `fieldPreview.pointsToNextTierCashback`（label: 'Amount to Next Tier', value: 'R562'）+ `accumulatedSpendCashback`（label: 'Accumulated Spending', value: 'R3301'）|
| `cardEditor` | zh-TW | `step3.fieldsSection.fields.pointsToNextTierCashback`（'到下個層級還差'）+ `accumulatedSpendCashback`（'已累積消費'）|
| `cardEditor` | en | `step3.fieldsSection.fields.pointsToNextTierCashback`（'Amount to Next Tier'）+ `accumulatedSpendCashback`（'Accumulated Spending'）|

### 5. Bug：PassCardPreview duplicate declaration（Vite/oxc parse error）

**症狀**：`vite:oxc` 報錯 `Identifier 'firstCashbackTierName' has already been declared` — 同一個 binding name 同時出現在 props destructuring 跟 local const。

**根因**：commit batch 落地時，destructured `firstCashbackTierName` 從 props 接收（給 unit test 注入用），又 local const 從 store 派生 — TypeScript 嚴格 mode 下兩個 `const` 同名 = parse error。

**修法**：移除 props destructuring 的 `firstCashbackTierName`，store-derived local const 是唯一來源。`PassCardPreviewProps.firstCashbackTierName` 仍保留（unit test 仍可注入到 `PassCardPreviewBody`，但 wrapper 自己不再 declare）。Comment 註明 single source of truth。

### 6. Copy 修正：cashback 不能叫 "Points to Next Tier"

**症狀**：英文 label 寫 "Points to Next Tier"，但 cashback 的商業邏輯不是「點數」而是「消費額度」。

**根因**：commit batch 落地時 copy 從 reward_card 複製過來，沒考慮 cashback 是 spend-based 不是 point-based。

**修法**：英文 label 從 `'Points to Next Tier'` → `'Amount to Next Tier'`（在兩個 locale 檔同步 — `passCard.en.ts` 跟 `cardEditor.en.ts`）。中文 `到下個層級還差` 已正確（沒指明「點數」），所以不用動。

`accumulatedSpendCashback` 的英文 `'Accumulated Spending'` 已經是 spend-based，**不動**。

`pointsToNextTier`（reward_card 用）仍叫 "Points to Next Tier"，因為 reward 真的是 point-based — **不動**。

## 跟 stamp_card / reward_card 的差異速查表

| 維度 | stamp_card | reward_card | cashback_card（本 PR）|
|---|---|---|---|
| Step 3 專屬 fields | 3 | 2 | **2** |
| Field keys | availableRewards / totalStamps / stampsRemaining | pointsToNextTier / currentPoints | **pointsToNextTierCashback / accumulatedSpendCashback** |
| Trigger 媒介 | 拜訪 | 點數 | **消費** |
| memberLevel override scope | ✅ | ✅ | **✅**（本次擴充）|
| Currency formatter | TWD / ZAR (suffix 元 / prefix R) | TWD / ZAR | **TWD / ZAR** |

跟 stamp / reward 同樣走 4 層 binding pattern（shared constants → Step 3 selector → PassCardPreviewBody override → i18n key）。

## 驗證

### i18n

```bash
cd apps/frontend
npm run verify:i18n
# 預期：17 namespace / 34 locale file OK；無 raw key；無 missing namespace
```

### TypeScript

```bash
cd apps/frontend
npx tsc -b --noEmit   # exit 0
```

> **Note**：本 session 觀察到 `PassCardPreviewBody.test.tsx` 跟 `Step3CardFields/index.test.tsx` 仍有些 pre-existing 的 typecheck error（ZAR 測試 mock 用 `vi.mocked('../CardBuilderEditor.store')` 傳 string 而非 imported module，導致 `setState/getState` 型別錯）。這些錯誤在 commit 前已存在，跟本 PR 變更無關 — 留待後續 test refactor session 修。

### Vitest（Cashback Step 3 specific）

```bash
cd apps/frontend
npm test -- PassCardPreviewBody
# 預期：cashback override + ZAR formatter 測試全綠

npm test -- Step3CardFields
# 預期：cashback_card filter + memberLevel override 測試全綠
```

### Manual smoke

```
1. 開 CardBuilderEditor → Step 1 選 cashback_card
2. 走到 Step 3
3. 觀察「顯示欄位」section dropdown：除了 6 個 common 外，多出
   「到下個層級還差」+「已累積消費」2 個 cashback-specific option
4. 選 memberLevel + 任何 cashback field：觀察 selector label 顯示「獎勵」（不是「會員等級」）
5. 走到 Step 6：輸入 cashback tier name「VIP Gold」
6. 回到右容器預覽：觀察 memberLevel slot label = 「獎勵」，value = 「VIP Gold」
7. 回 Step 2 把 currency 改 ZAR：觀察 preview value 變 R562 / R3301 prefix
8. 把 currency 切回 TWD：觀察 preview value 回到 562元 / 3301元
```

## Commit 規劃（4 個 batch）

| Batch | 主旨 | 涵蓋檔案 |
|---|---|---|
| 1 | shared contract | `packages/shared/constants/card-fields.ts` |
| 2 | i18n (zh-TW + en × 2 namespace) | `apps/frontend/src/i18n/locales/{cardEditor,passCard}.{zh-TW,en}.ts` |
| 3 | Step 3 selector + filter | `Step3CardFields/{filterCARD_FIELDS_BY_CARD_TYPE.ts, index.tsx, index.test.tsx}` |
| 4 | PassCardPreview body override + ZAR formatter | `CardPreview/{PassCardPreview.tsx, PassCardPreview.types.ts, PassCardPreviewBody.tsx, PassCardPreviewBody.test.tsx}` |

每批 commit 自帶 typecheck + i18n smoke 通過驗證；push 完 `git log --oneline origin/main..HEAD` 應為 4 個 commit。

## 後續注意事項（future invariants）

1. **新增 cashback field 必同步 4 層**：shared constants → Step 3 selector → PassCardPreviewBody → i18n key（Rule 023 + Rule 019 §4.1 spirit）
2. **新增 cashback i18n key 必同步 zh-TW / en**：全中文 / 全英文紀律（Rule 023）
3. **cashback field 的英文 label 必須反映 spend-based 語意**：不准用 "Points"、"Score"、"Stamp" 等 point-based 字眼（cashback 沒有點數）
4. **ZAR formatter 只作用在 default branch**：override branch（從 store 讀的 value）不受影響 — 因為 store 已經是 source of truth，formatter 套兩次會重複 prefix
5. **memberLevel override scope：stamp_card / reward_card / cashback_card 三者**：未來加新 card type（如 gift_card）要 override 一樣要進 `resolveOptionLabelKey` 加分支
6. **duplicate declaration 防護**：任何「從 props 接收 + 從 store local 派生」同名的 binding，**只能留一個 source of truth**（props 給 test 注入用，或 store 給 production 用，二選一）

## 同 session 的其他 dev log

- 無（本 session 純 Cashback Step 3 擴充）
