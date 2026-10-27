# Decision：拜訪次數槽位改送「數值+單位」打包字串，預覽與 Wallet 共用同一個 formatter

## 背景

`visitCount`（拜訪次數）是 **common 槽位**——每一種卡種都可以綁定它。Wallet 上的讀者是「這個數字代表什麼」，而不是「這個數字是什麼幣別」。裸數字 `5` 對讀者沒有任何意義：這是 5 次消費？5 個點？5 元？

編輯器預覽**已經**顯示 `5 次` / `5 times`（`passCard.{zh-TW,en}.ts::fieldPreview.visitCount.value` 的靜態字串），但 Wallet 上顯示的是**裸數字**。也就是說：**預覽承諾的東西，Wallet 沒有兌現**。

### 現況（已驗證）

| 位置 | 現況 | 問題 |
|---|---|---|
| `packages/shared/logic/passFieldFormatter.ts::FACE_FIELD_METRIC` | `visitCount: 'visitCount'` | 送裸數字（`0` / `n`），沒有單位 |
| `packages/shared/constants/card-fields.ts` | `visitCount.semanticType = 'number'` | 值一旦變成打包字串，舊模板宣告 `number` 會**整包 400** |
| `apps/frontend/.../passCardPreviewSlot.ts` | 走 default 分支讀 i18n 靜態字串 | 預覽與 Wallet 是**兩個來源**，可以各自漂移 |

折扣等級線（2026-10-27，`runs/decisions/2026-10-27-pass-holder-spend-and-discount-tier.md`）已經把整個形狀建好了：`spendTier.ts` formatter + semanticType 降級 + `DISCOUNT_TYPE_DOWNGRADED_FIELDS` 400 fallback。本次沿用同一形狀。

---

## 選項與決定

### 決定一：單位字寫在 shared logic leaf module，不進 shared/i18n 字典

| 候選 | 行為 | 結果 |
|---|---|---|
| A | 單位放 `shared/i18n/` 字典（`visitCount.unit` = `次` / `times`） | 後端與前端要**各自**解析語言再拼接；後端解析模板語言、前端解析 app locale，兩個輸入不同 → 拼接點不同就會漂移 |
| B | 單位放 `passCard.{zh-TW,en}.ts`（現況） | 兩個 locale 各一份完整字串，單位改一次要改兩個檔案；且與 Wallet 毫無關聯 |
| **C（採用）** | 新增 `packages/shared/logic/visitCount.ts::formatVisitCount(count, language)` | 純函式，輸入語言輸出完整字串；後端與前端呼叫**同一個函式**，不可能漂移 |

**決定：C。**

這是 `logic/spendTier.ts::formatTierAmount` 的既有先例：「數值+單位」是 **display logic**，不是 UI 文案。放在 shared logic 還有兩個好處：React Native 直接複用（Rule 024），以及未來加語系會是**編譯錯誤**（exhaustive switch）而不是 runtime 的 `undefined`。

### 決定二：`visitCount.semanticType` 由 `number` 降為 `text`，並把降級集合改名

值變成打包字串後，模板端必須宣告 `text`，否則 Passcreator 會拒絕。

**決定：降級。** 與 2026-10-26 的 `∞` sentinel、2026-10-27 的三個折扣槽位是**同一個安全模式**：runtime 要送的值決定模板端宣告什麼型別。

同時把 `DISCOUNT_TYPE_DOWNGRADED_FIELDS` 改名為 **`TYPE_DOWNGRADED_TEXT_FIELDS`**。舊名字說「discount」，但 `visitCount` 是 common 欄位——名字會變得**主動誤導**。新名字描述這個集合**是什麼**：值是 text payload、而舊的 `number` 模板會拒絕它。

### 決定三：預覽與 Wallet 共用同一個 formatter

編輯器預覽改為 `formatVisitCount(VISIT_COUNT_PREVIEW_VALUE, templateLanguage)`。

**label 仍走 i18n**（label 跟的是 app locale），**value 走 shared formatter**（value 跟的是模板語言）。這與折扣槽位完全同一形狀。

i18n 字典裡的 `fieldPreview.visitCount.value` **移除**——保留它就是保留第二個來源，那正是漂移的來源。

demo 數字（`5`）住在 `packages/shared/constants/visitCountPreview.ts`，沿用 `balancePreview.ts` / `discountPreviewAmounts.ts` 的「preview demo 值住 shared/constants」慣例。

### 決定四：不動 metric 與 DB

`snapshot.metrics.visitCount` 維持整數，snapshot schema 不改，**不新增 migration**。

理由：metric 是**帳務事實**（拜訪了幾次），「次」是**顯示單位**。把單位混進 metric 會讓 snapshot 的 schema 變成語言相關（`'5 次'` vs `5`），而 snapshot 是要跨語言、跨模板存檔的帳本資料。

### 決定五：事件 PATCH 路徑必須帶模板語言

`applyPassEvent` 的 sync target 原本**沒有** `language` / `currency`。事件 PATCH 因此落到 formatter 的 `zh-TW` 預設——一張英文卡的**初次發行**寫 `5 times`，**事件更新**卻寫 `5 次`。同一張卡的兩個請求形狀不同，這正是共用 formatter 想避免的事。

**決定：`PassEventSyncTarget` 加 `language` / `currency`，`applyPassEvent` 轉傳。** 這跟 2026-10-27 折扣線補上 `discountTier` 是同一個道理：PATCH 路徑必須重現發行路徑的每一個輸入。

`discountTier` 本身**仍留待 Scanner 計畫**（需要 tier ladder + spend 解析，非本次範圍）。

---

## 影響

| 影響 | 對象 |
|---|---|
| Shared | 新增 `packages/shared/logic/visitCount.ts`（formatter + 測試）<br>新增 `packages/shared/constants/visitCountPreview.ts`（demo 值）<br>`packages/shared/logic/passFieldFormatter.ts` — `FACE_FIELD_METRIC` 移除 `visitCount`、新增拜訪次數分支、`language` 提升到函式層級<br>`packages/shared/constants/card-fields.ts` — `visitCount` 降級為 `text`、`DISCOUNT_TYPE_DOWNGRADED_FIELDS` → `TYPE_DOWNGRADED_TEXT_FIELDS`<br>`packages/shared/package.json` — 新增 2 條 exports |
| Backend | `apps/backend/src/shared/lib/passcreator/v3-pass.ts` — CREATE + PATCH 兩條 400 fallback 改用新集合名<br>`apps/backend/src/modules/pass-templates/services/passValueService.ts` — `PassEventSyncTarget` 加 `language` / `currency` |
| Frontend | `apps/frontend/.../CardPreview/passCardPreviewSlot.ts` — 拜訪次數走 shared formatter<br>`apps/frontend/src/i18n/locales/passCard.{zh-TW,en}.ts` — 移除 `fieldPreview.visitCount.value` |
| 設定 | `apps/backend/vitest.config.ts` / `apps/frontend/vitest.config.ts` / `apps/frontend/vite.config.ts` — 新增 `@saome/shared/logic/visitCount` + `@saome/shared/constants/visitCountPreview` 顯式別名（Rule 016 九個 surface 同步）|
| DB | **無** — 不新增 migration，不改既有欄位 |

### 已知限制

1. **既有模板必須重推 Step 8 才會顯示拜訪次數。** 在此之前 runtime 靠 400 fallback 保護：其他槽位照常同步，拜訪次數槽位留空（degraded）。**影響面比折扣槽位大**——`visitCount` 是 common 欄位，所有綁了它的模板都算。
2. **Scanner 消費事件後重算拜訪次數尚未實作。** `runs/plans/2026-10-24-pass-scanner-event-semantics.md` 仍 blocked。本次只處理註冊時的格式。
3. **其他計數槽位未一併處理。** `availableRewards`（「2 次」）/ `totalStamps` / `stampsRemaining` / `currentPoints`（「23點」）/ `couponRemainingCount` 目前皆非 runtime metric 或另有語意，逐一另案處理。

### Out of scope

- 不做 Scanner 事件消費。
- 不做既有模板的 bulk PATCH 補發。
- 不改其他計數槽位的單位。

---

## 參照

- `runs/decisions/2026-10-27-pass-holder-spend-and-discount-tier.md` — 折扣等級線（本計畫沿用同一形狀）
- `runs/decisions/2026-10-26-pass-unlimited-expiry-slot.md` — `∞` sentinel（同一個「runtime 值決定模板型別」安全模式）
- `packages/shared/logic/spendTier.ts` — `formatTierAmount`（本計畫的 formatter 先例）
- `runs/plans/2026-10-27-visit-count-unit-display.md` — 本次實作計畫
