# Step 4 BackFields vs Links 驗證 Cross-Contamination

> Date: 2026-09-05
> Session: Step 4 plan 修一
> Scope: `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step4CardInfo/BackFieldsField.tsx` + `LinksField.tsx` + `LabelValueListField.tsx` + `Step4CardInfo.test.tsx`
> Related: `runs/improvements/feedback/20260905-step4-isvalidurl-phone-email-fallback.md`（修三,相關 feature）

## 背景

Step 4（卡片資訊）有三個 section：description、backFields、links。前兩個都是「Label + Value row」的 UI 結構，於是抽了 `LabelValueListField` 共用 component。為了 DRY，**驗證邏輯 `validateValue` callback 也共用**——同一個 `isValidUrl()` 函式同時套用在 backFields 與 links。

兩個 user-observed symptom（同一個 root cause）：

1. **背面欄位有內容欄位沒填時** → 跑出網址格式錯誤的紅字警示。例：使用者填 label="地址"、value="" → 出現「網址、電話或 E-mail 格式不正確」。
2. **連結欄位填寫的手機號碼跟 email 會跑出網址格式錯誤的紅字警示**。例：使用者填 label="客服電話"、value="0912-345-678" → 出現同樣紅字警示。

兩個症狀看似不同（前者是 backFields、後者是 links），但**根因都是「兩種欄位用同一個 validator」**。

## 根因分析

### Apple Wallet 規格差異

| 欄位 | Apple Wallet 用途 | 驗證規則 |
|---|---|---|
| backFields | 純文字 contact info（地址、客服時段、EULA 條文） | 「non-empty」即可 |
| links | actionable URL（網站、客服熱線連結、客服信箱） | 必須是 URL（含 phone scheme / email scheme）|

**Apple EULA 要求**：每張 Wallet 票卡至少要有一個 back field 含聯絡資訊（電話、email、地址皆可）。**沒有**要求 format 是 URL。

### 程式碼層面

```tsx
// ❌ 共用 validator（commit 修一前）
// LabelValueListField 把同一個 callback 套到 backFields 跟 links
function validateValue(value: string): boolean {
  return value === '' || isValidUrl(value);
}
```

問題：
- 對 **backFields**：使用者在 Section 4 填 label="地址"、value="" → `isValidUrl('')` → 空值合法，**理論上不應該錯**。但若 value 是純文字（非 URL）例如「台北市信義區忠孝東路 4 段 1 號」→ `isValidUrl()` 回 false → 出現紅字
- 對 **links**：使用者填 `0912-345-678` → `isValidUrl('0912-345-678')` 原本只認 URL parser → 失敗 → 紅字

### 為什麼當初共用

`LabelValueListField` 抽 component 時**誤以為兩種欄位驗證邏輯相同**（「非空或合法 URL」）。事實上：

| 維度 | backFields | links |
|---|---|---|
| 必填 | 是（Apple EULA） | 否（optional section）|
| 格式 | 純文字 | URL（含 tel:/mailto:/scheme）|
| 非空時 validator | `value.trim().length > 0` | `isValidUrl(value)` |

**兩種欄位的驗證規則根本不同，共用 callback 是誤判**。

## 修法

### 拆 validateValue

```tsx
// ✅ BackFieldsField.tsx
// Apple EULA mandates a contact row, but the runtime render accepts any
// non-empty text (prose, address, raw phone digits, etc.). Do NOT pipe
// `isValidUrl()` here — back fields are not URLs.
const validateValue = (value: string) => value.trim().length > 0;

// ✅ LinksField.tsx
// For links, value is optional — empty is OK; non-empty must parse.
const validateValue = (value: string) => value === '' || isValidUrl(value);
```

兩個檔案 header 都加 JSDoc 明確標示「Responsibility split」段落，避免未來 developer 又合併回去。

### i18n 錯誤訊息分流

兩個欄位需要**不同的**錯誤訊息（即使現在 value 重疊）：

```ts
// backFields 錯誤訊息
step4.backFields.required: '每一組的內容為必填'  // 純空值錯誤

// links 錯誤訊息
step4.links.invalidUrl: '網址、電話或 E-mail 格式不正確'  // 非空但格式錯誤
```

i18n 上保留兩個獨立 key，避免日後改 error message 又互相污染。

### 測試矩陣

新增 5 個 case（`Step4CardInfo.test.tsx`）：

| 場景 | 預期 |
|---|---|
| backFields 有值「just a note」（純文字非 URL） | `step4.backFields.required` 不顯示、`step4.links.invalidUrl` 不顯示 |
| backFields value 為空 + showValidation | `step4.backFields.required` 顯示 |
| links 為 `https://x.com` + showValidation | 兩個錯誤訊息都不顯示 |
| links 為 `not-a-url` + showValidation | `step4.links.invalidUrl` 顯示 |
| links 為 `tel:+1234567890` + showValidation | `step4.links.invalidUrl` 不顯示（scheme 合法）|

最後一個 case 鎖定：未來若有人改 `isValidUrl()` 把 tel: 拔掉，這條 test 會抓到。

## 衍生修正 — 同步修二的 textarea 責任拆

### 修二摘要

`LabelValueRow` 同時存在「input vs textarea」兩種渲染。`LabelValueListField` 加 `valueMultiline` prop 透傳，BackFieldsField 傳 `valueMultiline={true}`，LinksField 不傳（links 仍單行）。

| 欄位 | 渲染 |
|---|---|
| backFields value | `<textarea>` + `useLayoutEffect` 自動長高 |
| links value | `<input type="text">` |

兩種行為完全獨立，validator 拆分是第一步、UI 拆分是第二步——兩步配套但各自 commit。

## 改動清單

| 檔案 | 動作 |
|---|---|
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step4CardInfo/BackFieldsField.tsx` | 改 — `validateValue` 改 non-empty check；header 加 Responsibility split JSDoc |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step4CardInfo/LinksField.tsx` | 改 — `validateValue` 改 `value === '' || isValidUrl(value)`；header 加 Responsibility split JSDoc |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step4CardInfo/Step4CardInfo.test.tsx` | 改 — 新增 back fields 多行 textarea case + 5 個 validator split case |

## 設計取捨整理

### 為什麼完全拆 callback 而非加 flag

| 選項 | 後果 | 決定 |
|---|---|---|
| A. **完全拆 callback**（兩個檔案各自定義） | 各自語意清晰，未來不會誤改 | 採 |
| B. `validateValue(value, { multiline })` 帶 context flag | 同一個 callback 但需要 context 分支，邏輯耦合 | 拒 |
| C. 用 enum `ValidateMode.NonEmptyOnly` / `ValidateMode.Url` | 引入新 abstraction，over-engineering | 拒 |

callback signature 不變，兩個檔案各自的 `validateValue` function expression 自由定義未來規則。Apple EULA 規則變動時，backFields 改 callback 就好，不會牽動 links。

### 為什麼不做「URL 或文字都接受」超寬鬆驗證

| 選項 | 後果 | 決定 |
|---|---|---|
| A. **保留 Apple Wallet 規格分離**（back fields = text, links = URL） | 對齊 Apple PassKit spec，未來 RN 化時規格不變 | 採 |
| B. 兩個欄位都接受任意非空字串 | 把 Apple EULA 規格解讀過頭；違反 PassKit spec | 拒 |

back fields 接受任意非空文字（包括多行地址、聯絡時段）對使用者更友善，但**不應該**期待 Apple Wallet 把任意文字渲染成可點擊的電話或 email——這是 links 的職責。

## 驗證（Rule 006）

| 項目 | 結果 |
|---|---|
| `npx tsc -b --noEmit` (frontend) | exit 0 |
| `npm run lint` (oxlint) | exit 0（pre-existing warnings）|
| `npx vitest run Step4CardInfo.test.tsx` | 17 passed / 0 failed（+5 從 12）|
| Manual QA：backFields 填純文字「台北市信義區忠孝東路 4 段」 | 不出現紅字；autosave 寫進 DB；preview `whitespace-pre-wrap` 換行 |
| Manual QA：links 填 `0912-345-678` | （修三之後）不出現紅字 |
| Manual QA：links 填 `not-a-url` | 出現紅字「網址、電話或 E-mail 格式不正確」|

## 規範層影響

| 規範 | 影響 |
|---|---|
| Rule `000-modular-design.mdc` Part A.2 | 觸發 — 主組件 ≤ 100 行是 hard rule，但**同類化不同語意的 callback 是違反 SRP 的耦合**，應該早點拆 |
| Rule `022-component-reuse.mdc` | 觸發（隱性）— **DRY 不等於同類化驗證**，語意不同的欄位不要為了 DRY 共用 callback |

## 給未來 session 的提醒

1. **共用 component 的 callback 時，先驗證語意是否真的相同**：Apple Wallet 的「back fields 純文字」與「links URL」是 spec 上的差異，不是 implementation detail。**共用 callback 是把 spec 差異埋進實作**。
2. **新增 Step 4 sub-section 時**：不要直接複製 `BackFieldsField` 整個檔案再改 callback。要先確認這個 section 是「純文字」（back fields pattern）還是「URL」（links pattern），對應呼叫正確的 validator source。
3. **i18n 錯誤訊息分獨立 key**：即使兩個欄位現在共用同一句中文翻譯，未來 i18n locale 變動時（例如日文、英文）會需要不同措辭。**共用翻譯 key 是 i18n drift 風險**。

## Sync 狀態

- **狀態**：⏳ 待推送（本批 commit Step 4 components batch 內）
- **相依**：修三 `isValidUrl` phone/email fallback（讓 links 接受電話/email，否則拆 callback 後 links 仍會錯）
