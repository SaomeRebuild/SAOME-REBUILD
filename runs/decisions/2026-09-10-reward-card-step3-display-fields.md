# Decision：Reward Card Step 3 顯示欄位擴充（到下一階還差 / 已累積點數）

## 背景

Reward Card 在 Step 6 已經完成 `RewardTierRow` 級距系統（最多 5 組門檻 + 獎勵規則 + per-tier earning rate），但 Step 3「顯示欄位」目前對 reward_card 來說缺乏 points 相關欄位，使用者無法在卡片正面顯示「到下一階還差 X 點」「已累積 X 點」等關鍵訊息。

`packages/shared/constants/card-fields.ts::CARD_FIELDS` 是 Step 3 欄位的 single source of truth，目前只有 `common`（6 個）與 `stamp`（3 個，僅 stamp_card / multipass）兩組。reward_card 缺少對應的 `reward` 群組。

需要決定的事：

1. **新增 2 個 reward group 欄位（pointsToNextTier / currentPoints），是否需要 DB migration？**
2. **新欄位作用範圍：只 reward_card，還是含 multipass？**
3. **預覽值（value）採靜態 demo 還是動態計算？**

## 選項與決定

### 問題 1：是否需要 DB migration？

| 選項 | 評估 |
|---|---|
| A. 新增 migration，新增 column `pointsToNextTier` / `currentPoints` | ❌ 違反既有設計 — `leftField` / `rightField` 是共用 JSONB column，本來就能存任意 CardFieldKey。新增 column 等於把「顯示欄位」概念從 enum 拆成具體欄位，跟既有 stamp / common 架構分歧 |
| B. 沿用既有 `leftField` / `rightField` JSONB column，擴充 enum 即可 | ✅ enum-driven architecture，schema 已是單一 source of truth（`CARD_FIELD_KEYS` → `cardFieldKeySchema` 自動 derive） |

**決定**：選 B。零 DB migration，純前端 enum 擴充。

理由：

- `leftField: CardFieldKey` 是 zod enum column，擴充 enum 不需動 DB schema
- backend 4-layer sync（Layer 1 shared constant → Layer 2 zod schema → Layer 3 db template interface → Layer 4 service signature）自動 conform，因為型別全部從 `CARD_FIELD_KEYS` 推導
- Migration 風險 = 0（沒有「已套用但未 commit」的 partial state）

### 問題 2：作用範圍

| 選項 | 評估 |
|---|---|
| A. 只在 `reward_card` 顯示（與 `REWARD_CARD_TYPES = new Set(['reward_card'])` 對齊） | ✅ 與 Step 6 `RewardTierRow` dispatcher 對齊（`Step6CardLogic.tsx` 也只給 `reward_card`） |
| B. 含 multipass | ❌ multipass 是「多通卡」概念（多張 stamp_card 集合），不是 reward_card 概念。硬塞會誤導使用者 |

**決定**：選 A。scope 限定 `reward_card`，與 stamp / common 群組的 filter pattern 一致。

### 問題 3：預覽值（i18n 內 fieldPreview.{key}.value）

| 選項 | 評估 |
|---|---|
| A. 靜態 demo（"123點" / "23點"，i18n 寫死） | ✅ 與 phone / email / visitCount 等既有 demo 欄位對齊，這些欄位未來都會由 PassCreator 從 member row 提供，目前都是 demo |
| B. 動態計算（從 store / RewardTierRow 拿 tier[0] 的 threshold 算差值） | ❌ 過早複雜化 — RewardTierRow 第一列的 tier 在使用者還沒設定前是空物件，會需要 fallback chain + 多層 store coupling |

**決定**：選 A。靜態 demo，與既有 pattern 對齊。

注意：使用者原始 query 提到「Label & Value 為 到下一階還差: 123點 / 已累積點數: 23點」，且 Label 來源應該是 Step 6 RewardTierRow 的 `tier.name`（"oijo"）。實作確認這次只動 dropdown option label 跟 preview demo value 的 i18n 寫死；**Step 6 RewardTierRow 的 name 輸入框不動**。如果未來要把 tier.name 串到 preview value（例如顯示「到下一階還差 oijo 的 100 點」），是另一個 plan 的範疇。

## 影響

### 程式碼

| 層 | 檔案 | 變更 |
|---|---|---|
| shared constant | `packages/shared/constants/card-fields.ts` | CardFieldGroup 加 `'reward'`；CARD_FIELD_KEYS 加 `pointsToNextTier` / `currentPoints`；CARD_FIELDS 加 2 筆 entry |
| shared schema | `packages/shared/schemas/card.ts` | **無需改**（`cardFieldKeySchema = z.enum([...CARD_FIELD_KEYS])` 自動 derive） |
| backend request | `apps/backend/src/modules/cards/schemas/request.ts` | **無需改**（從 shared 自動 conform） |
| backend db | `apps/backend/src/modules/cards/db/templates.ts` | **無需改**（`TemplateSettings.leftField/rightField` 型別是 `CardFieldKey`） |
| filter helper | `apps/frontend/.../Step3CardFields/filterCARD_FIELDS_BY_CARD_TYPE.ts` | 加 `REWARD_CARD_TYPES` 與對應 filter 分支 |
| i18n | `apps/frontend/src/i18n/locales/{cardEditor,passCard}.{zh-TW,en}.ts` | 各加 2 個 dropdown label + 2 個 preview label/value |
| preview body | `apps/frontend/.../CardPreview/PassCardPreviewBody.tsx` | **無需改**（`resolveSlot` default branch 用 `t(\`fieldPreview.${field}.label\`)` 動態讀取） |
| test | `apps/frontend/.../Step3CardFields/index.test.tsx` | 加新 describe block + 修正既有 conditional-visibility 斷言（reward_card 從 7 → 9 options）|
| test | `apps/backend/.../tests/schema-conformance.test.ts` | 加 5 條 conformance test |

### DB / Migration

**無 DB migration** — `leftField` / `rightField` 是既有 JSONB column，zod enum 自動接受新 enum value。

### 既有行為不受影響

- stamp_card / multipass 仍顯示 10 options（6 common + 3 stamp）
- 非 stamp / 非 reward cardType 仍顯示 7 options（6 common）
- Step 6 `RewardTierRow` 不動
- 既有 stamp_card 的「會員等級 → 獎勵」覆寫邏輯不動

### 既有的 stamp_card 「會員等級 → 獎勵」覆寫規則 vs reward_card

| cardType | memberLevel dropdown label | 既有 / 新 |
|---|---|---|
| stamp_card | 「獎勵」/ Reward | 既有覆寫（2026-09-10 stamp card refactor）|
| reward_card | 「會員等級」/ Member Level | **保持原樣** — reward card 不觸發覆寫 |
| 其他 | 「會員等級」/ Member Level | 不觸發覆寫 |

這個分離是刻意的：stamp card 的 memberLevel 概念其實是「單一 reward tier 的 name」（Step 6 透過 `rewardName` 輸入）；reward card 的 memberLevel 是真正的會員等級（與多 tier 系統無關）。兩個語意不同，UI 上必須分開。

### Schema contract drift 風險

已驗證 4 層同步：

- Layer 1：`CARD_FIELD_KEYS` — ✅ 新 key 在此
- Layer 2：`packages/shared/schemas/card.ts::cardFieldKeySchema` — ✅ 自動 derive
- Layer 3：`apps/backend/.../db/templates.ts::TemplateSettings.leftField/rightField` — ✅ 型別 `CardFieldKey` 自動 conform
- Layer 4：`apps/backend/.../schemas/request.ts` — ✅ import 自 shared，自動 conform

Conformance test（apps/backend/.../schema-conformance.test.ts § Step 3 reward_card）已新增 5 條斷言，包含：

1. `cardFieldKeySchema` 接受新 key
2. shared schema 的 leftField / rightField 接受新 key
3. local schema 的 leftField / rightField 接受新 key
4. `cardFieldKeySchema` 拒絕未知 key（drift guard）
5. full templateSettings round-trip 通過
