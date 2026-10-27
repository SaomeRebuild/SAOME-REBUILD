# Decision：折扣卡的消費金額與當前等級落地到 `pass_holders`，Wallet 折扣槽位改送「數值+單位」字串

## 背景

折扣卡的 Wallet 顯示槽位**永遠是空的**。2026-10-27 對 production 資料庫與 repo 的實查確認，這是**四個獨立缺陷疊加**的結果，缺一不可。

### 缺陷一 — 等級從未被解析

`templates.settings.discountTiers[]` 是折扣卡的級距階梯（名稱 / 門檻消費 / 折扣百分比），但整個 repo **沒有任何一行程式碼讀取它**來決定持卡人現在在哪一級。

### 缺陷二 — 消費金額沒有可查詢的欄位

累積消費只存在 `pass_holders.pass_values_snapshot` 的 JSONB 裡（`metrics.spendAccumulated`）。沒有獨立欄位 → 無法查詢、無法索引、報表只能做 JSONB 取值。

### 缺陷三 — 槽位值從未送出

`packages/shared/logic/passFieldFormatter.ts::FACE_FIELD_METRIC` 只映射 4 個數值 metric（`visitCount` / `currentPoints` / `accumulatedSpendCashback` / `accumulatedSpendDiscount`）。`memberLevel` / `discountTierBracket` / `pointsToNextTierDiscount` **不在表內 → 從未送出 → Wallet 恆空**。

而 `accumulatedSpendDiscount` 雖然在表內，送出的是**裸數字**（`0`）—— 一個沒有單位的數字，讀者不知道是元還是蘭特。

### 缺陷四 — 欄位型別會擋下「數值+單位」字串

三個折扣槽位原本宣告 `semanticType: 'number'`（`packages/shared/constants/card-fields.ts`），`mapFieldType()` 因此把它們推成 Passcreator `type: 'number'`。但它們的值必須是帶單位的字串（`10元` / `NT$ 10` / `R10` / `2%`）。

Passcreator 會**用模板宣告的欄位型別驗證 per-pass 值**。這不是推測——repo 已經踩過同型事故：2026-10-26 的 `∞` sentinel 決策（`runs/decisions/2026-10-26-pass-unlimited-expiry-slot.md`）記錄了 `date` 型欄位拒絕非日期字串、**整包 400**，連同一個 payload 裡的餘額 / 點數都一起停擺。`number` 型拒絕 `"10元"` 是完全同型的問題。

---

## 選項與決定

### 決定一：消費金額採 `pass_holders.spend_amount` 欄位，與 snapshot 同句寫入

| 候選 | 行為 | 結果 |
|---|---|---|
| A | 只留 JSONB 裡的 `metrics.spendAccumulated` | 查詢要 JSONB 取值；無法索引；本次要新增的欄位還是得加 |
| B | 抽成 `events` 的一種 | 消費金額不是事件，是事件的**衍生結果**（現有 ledger 沒有 spend 事件，Scanner 仍 blocked） |
| **C（採用）** | 加 `spend_amount NUMERIC(18,4) NOT NULL DEFAULT 0`，**與 snapshot 同一句 UPDATE** 寫入 | 欄位可查詢可索引；且與來源**結構上不可能漂移** |

**決定：C。**

同句寫入是關鍵：`spend_amount` 與 `pass_values_snapshot->'metrics'->'spendAccumulated'` 是**同一個事實**。分成兩句 UPDATE 會留下「crash 在兩句之間」的視窗，讓欄位與自己的來源不一致——一個會和自己的來源說謊的欄位，比沒有這個欄位更糟。

### 決定二：等級不進 `pass_values_snapshot`

`pass_values_snapshot` 有一個契約：**它是 `pass_events` 帳本的 fold**，由 `reducePassValues` 重放得出。等級**不是事件的函數**——它依賴模板的級距階梯（tenant 可以隨時改），而階梯不在帳本裡。把等級放進那個 JSONB，會讓 reducer 必須懂模板設定才能重現同一個結果。

**決定：等級有自己的欄位**（`current_tier_name` / `current_tier_percent`），由**服務層**寫入——那是唯一同時持有「解析後的等級」與「持卡人 id」的地方。

### 決定三：等級解析對齊 legacy `saome_pe_discount_resolve_tier`

legacy（`mu-plugins/SAOME-Passcreator-Engine/modules/passcreator-discount-card.php:219-275`）的演算法是：門檻升冪排序後，取**最後一個門檻 ≤ 累積消費**的級別為當前級；下一級是**第一個門檻 > 累積消費**的級別；差額 `max(0, next.threshold - spend)`，沒有下一級則為 0。

**決定：完全對齊 legacy。** 理由是遷移安全——同一張卡在舊 plugin 簽發與新系統簽發，必須解析出同一個等級。tenant 可能在中途遷移，等級語意不能因為換系統而改變。

實作放在 `packages/shared/logic/spendTier.ts::resolveSpendTier`，是純函式，Web 與 React Native 共用。

### 決定四：送「數值+單位」打包字串，單位位置依**模板語言**

| 語言 | 幣別 | 輸出 |
|---|---|---|
| zh-TW | TWD | `10元`（單位後綴） |
| en | TWD | `NT$ 10`（單位前綴） |
| 任何 | ZAR | `R10`（蘭特符號不隨語言變） |

單位位置跟的是**模板的語言**（Step 2 的 `settings.language`），不是讀者的 locale——一張卡受眾由模板決定。

這與 coupon / multipass 的既有 i18n 慣例一致（`amountFormatTWD` / `amountFormatZAR` / `percentFormat` 三個 key 分開，就是因為單位位置隨語言而變）。

**新 formatter，不重用 `logic/currency.ts::formatCurrency`。** 後者輸出 `NT$1,000`（含千分位、不分 locale），是**金額帳面**的語意；折扣槽位是「小額差額的顯示」，兩者不同。而且 `formatCurrency` 已被 coupon / gift-card / reward 的 backFields 路徑使用，改它會讓那些路徑一起回歸。

### 決定五：三個折扣槽位的欄位型別由 `number` 降級為 `text`

承載「數值+單位」字串的槽位，欄位型別必須是 `text`——`number` 型會拒絕字串。

**決定：降級。** 這與 2026-10-26 的 `∞` 決定是**同一個安全模式**：runtime 要送的值決定模板端宣告什麼型別。

三個槽位（`pointsToNextTierDiscount` / `discountTierBracket` / `accumulatedSpendDiscount`）的 `semanticType` 由 `'number'` 改為 `'text'`。`memberLevel` 本來就是 `text`，不動。

### 決定六：既有模板要重推 Step 8，並補 400 fallback

已發布的模板仍宣告 `number`。在 tenant 重推之前：

- **PATCH 路徑**：上游 400 → 去掉那幾個 key 重試一次 → 其他欄位照常同步，結果標 `degraded: true`（沿用 `∞` sentinel 的既有做法）。
- **CREATE 路徑**：上游 400 → 去掉那幾個 key 重試一次 → **卡照樣發出來**（到期日、餘額都完整），只是折扣槽位留空。

兩個路徑的降級集合**合併**成一組，所以同時踩到兩個條件的 payload 也只多花一次 round trip。

**為什麼 CREATE 也要 fallback？** 這裡比 PATCH 嚴重得多：沒有 fallback 的話，一張舊模板的折扣卡**根本發不出來**，持卡人連卡都沒有。少幾個槽位，遠比完全沒有卡好。

**決定：兩個路徑都補 fallback。**

### 決定七：client 不得指定等級

等級完全由**伺服器**從「模板階梯 + 持卡人累積消費」推導。請求 payload 不接受任何 tier / tierName / 欄位值。

理由與既有會員級距、禮品卡金額同源：client 能指定自己的等級，就等於 client 能自己報一個 tenant 從未開過的級別。

---

## 影響

| 影響 | 對象 |
|---|---|
| Shared | 新增 `packages/shared/logic/spendTier.ts`（解析 + 格式化 + 測試）<br>`packages/shared/logic/passFieldFormatter.ts` — 折扣槽位分支、`FACE_FIELD_METRIC` 移除 `accumulatedSpendDiscount`<br>`packages/shared/constants/card-fields.ts` — 3 個槽位降級為 `text`、新增 `DISCOUNT_TYPE_DOWNGRADED_FIELDS`<br>`packages/shared/constants/discountPreviewAmounts.ts` — demo 值改為數字<br>`packages/shared/i18n/fieldLabels.ts` — 修掉兩個未使用變數（前端嚴格 tsconfig 才會暴露）|
| Backend | `apps/backend/src/modules/pass-templates/db/passHolders.ts` — 3 個新欄位、snapshot 同句寫 `spend_amount`、新增 `updatePassHolderCurrentTier`<br>`apps/backend/src/modules/pass-templates/services/passRegistrationService.ts` — 解析等級 + 落地 + 餵 formatter<br>`apps/backend/src/modules/pass-templates/services/passValueService.ts` — PATCH 路徑帶同一組 tier / currency / language<br>`apps/backend/src/shared/lib/passcreator/v3-pass.ts` — PATCH + CREATE 兩條 400 fallback |
| Frontend | `apps/frontend/.../CardPreview/passCardPreviewSlot.ts` — 折扣金額改用同一個 formatter，帶模板語言<br>`apps/frontend/.../CardPreview/PassCardPreviewBody.tsx` — 從 store 讀模板語言<br>`apps/frontend/.../TemplateCard/TemplateCardPreview.tsx` — 用卡片自己的語言 |
| DB | `supabase/migrations/20261027000001_030_add_pass_holder_spend_and_tier.sql` — 3 個欄位 + 2 個 partial index + `spend_amount` 回填 |
| 設定 | `apps/backend/vitest.config.ts` / `apps/frontend/vitest.config.ts` / `apps/frontend/vite.config.ts` — 新增 `@saome/shared/logic/spendTier` 顯式別名（Rule 016 九個 surface 同步）|

### 已知限制

1. **既有模板必須重推 Step 8 才會顯示折扣槽位。** 在此之前 runtime 靠 400 fallback 保護：其他欄位照常同步，折扣槽位留空。這與 `∞` sentinel 的處置一致（tenant 主動重推，非後端自動改上游模板）。
2. **Scanner 消費事件後重算等級尚未實作。** `runs/plans/2026-10-24-pass-scanner-event-semantics.md` 仍 blocked。本次只在註冊時寫等級；Scanner 上線後需要在消費事件路徑重用同一個 `resolveSpendTier`。
3. **現金回饋卡（`cashback_card`）的等級未實作。** `cashbackTiers` 形狀相同、resolver 可共用，但欄位語意（回饋 % vs 折扣 %）與 label 不同，另案處理。
4. **既有 3 筆折扣持卡人的 Wallet 不做 bulk PATCH。** DB 欄位會在他們下次註冊時補齊；Wallet 上的舊 pass 沿用 `passValueBackfill` 的既定政策（重推需人工受控 + read-back 驗證）。

### Out of scope

- 不改現金回饋卡的等級語意。
- 不做 Scanner 事件。
- 不自動重推既有模板（上游模板的變更必須由 tenant 觸發，與 `∞` 決定一致）。
