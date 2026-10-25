# Decision：無限期卡片的到期欄位改送 `∞` sentinel（runtime 覆寫 + 模板欄位型別降級）

## 背景

「無限期」的卡（會員終身卡、沒有效期的優惠券 / 折扣卡）在 Wallet 上拿不到 `∞` 顯示。

2026-10-26 的觀察（Wallet 實機 + Passcreator V3 API 規格）確認這是**兩處缺陷疊加**的結果，缺一不可：

### 缺陷一 — 模板端：到期 slot 被宣告成 `date` 型別

`apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts::mapTemplateToPasscreator()` 透過 `mapFieldType()` 決定 Passcreator `fields.headerFields[].type`，而 `HEADER_FIELD_TYPES` 是從 `packages/shared/constants/headerSlots.ts::HEADER_SLOT_KIND_SPECS[].valueType` 推導出來的。到期 slot（`memberExpiry` / `discountExpiry` / `couponExpiry`）的 `valueType` 是 `date`，所以三種到期欄位一律被推成 `'date'`。

Passcreator 的 `date` 型欄位**不接受非日期字串**。所以就算 runtime 硬塞 `∞`，上游也會整包拒絕。

### 缺陷二 — Runtime 端：無到期日時「省略欄位」

`packages/shared/logic/passFieldFormatter.ts::formatPassValues()` 在 `snapshot.expiryDate === null` 時原本**整個欄位省略不送**：

```ts
case 'member_expiry':
case 'discount_expiry':
case 'coupon_expiry': {
  const formatted = formatPasscreatorDateTime(snapshot.expiryDate);
  if (formatted !== null) {
    properties[spec.passcreatorKey] = formatted;   // ← null 時整個欄位不進 properties
  }
  break;
}
```

但 Passcreator 的 per-pass 更新語意是 **PATCH = 只更新你提供的欄位**（POST 才會刪除未提供的資料）。所以「省略」不是「清空」，而是「**保留上游現有的舊值**」。

結果：把一張已發行的「固定到期日」卡改成「無限期」再重新推送時，舊的到期日會**永遠留在持卡人的 Wallet 上**，而且連 read-back 驗證都不會發現（因為沒送出就沒得比對，`verified: true` 反而蓋掉 stale）。

### 已驗證的前提

- Passcreator V2 `fields.*[].type` enum = `text | date | number | currency | barcode`；`additionalProperties[].type` enum **不含 date**（到期 slot 走 `buildAdditionalProperties()` 時本來就轉成 `text`，這部分不需改）。
- 到期日只在 `registered` 事件寫入（`packages/shared/logic/passValueCalculator.ts::reducePassValues` 只在 `case 'registered'` 設 `expiryDate`），所以持卡人的到期狀態在註冊後凍結 → 沒有「原本有日期、後來變無限」的 runtime 漂移，模板端的型別判定只需要看模板本身。
- `PasscreatorPassValues.properties` 的 key 就是 `memberExpiry` / `discountExpiry` / `couponExpiry`，與模板 `headerFields[0].key` 同一組 key。

---

## 選項與決定

### 決定一：runtime 送 `∞`，而不是省略欄位

| 候選 | 行為 | 結果 |
|---|---|---|
| A（原本） | 無到期日時省略該欄位 | PATCH 保留上游舊值 → stale 日期留在 Wallet，且 read-back 驗不到 |
| B（**採用**） | 無到期日時寫入 `∞` sentinel | PATCH 真的覆蓋掉舊值 → Wallet 顯示 `∞` |
| C | 送空字串 `''` | 上游多半視為 invalid value → 整包 400，連其他欄位都同步不到 |
| D | 改用 POST 送全欄位 | POST 會**刪除未提供的欄位**（名稱、電話、條碼都會被清掉）→ 不可接受 |

**決定：B。**

理由：PATCH 的「省略 = 保留」語意是這條鏈的根因，而「送值」是唯一能真正清掉舊值的手段。至於送什麼值 —— `∞`（U+221E INFINITY）而不是 `''` 或 `never`：

1. **與前端預覽既有顯示一致**。`passCardPreviewSlot.ts` 的會員 / 優惠券到期欄位本來就顯示 `∞`，`∞` 是 SAOME 既有的「無限期」視覺語彙。
2. **Wire 安全**。`JSON.stringify` 不會轉義非 ASCII，`∞` 會原樣送到 Passcreator；反之若用 `\u221e` 跳脫序列，某些 HTTP 中間層會再跳脫一次。
3. **不需要 migration、不需要 DB 改動**。sentinel 只活在 runtime payload 裡，不是資料庫欄位。

同時把 sentinel 收斂成單一常數 `packages/shared/constants/headerSlots.ts::UNLIMITED_EXPIRY_VALUE`，讓三個消費端共用一份真值：runtime formatter（寫入）、模板推送（型別決策）、前端預覽（顯示）。舊的寫法是三份各自維護的字面量 —— 這正是「編輯器顯示 `∞`、Wallet 顯示舊日期」這類漂移的來源。

### 決定二：到期 slot 的模板型別用「所有 holder context 都成立」判定

新增純函式 `packages/shared/logic/passExpiry.ts::resolveExpirySlotGuaranteesDate(cardType, settings)`，回傳「這個 template 是否**保證每一位**持卡人都有到期日」。判定為真 → 到期 slot 維持 `'date'`；為假 → 降級為 `'text'`（這樣上游才接受 `∞`）。

**為什麼不能用單一 context 判定？**

會員卡的付費級距（`monthly` / `yearly`）是 **holder 層級**的資料，不是 template 層級的：付費會員的到期日由持卡人當下凍結的 tier snapshot 決定，而免費會員沒有 tier。同一張 template 上，付費會員有到期日、免費會員沒有。

如果只看單一 context（例如只看「有 durationType 的付費會員」），會得到 `true` → template 把到期 slot 宣告成 `date` → 但免費會員註冊後 runtime 送出 `∞` → 上游整包 400（而且連餘額、點數都同步不到）。這是把「單一 context 的結論」誤當成「template 的性質」。

所以判定必須對**所有可能的 holder context** 都成立：

- `membership_card` → 檢查 `{durationType: null}`（免費）、`{durationType: 'monthly'}`、`{durationType: 'yearly'}` 三種
- 其他卡種 → 到期設定是 card-wide 的，單一 context（`{}`）即可

「所有 context 都成立」這個方向的失敗模式是**安全的**：判定失準只會讓欄位型別從 `date` 降級成 `text`，`text` 同時接受日期字串與 `∞`；反過來（誤判成保證有日期）才會造成 500 級的同步失敗。

判定本身委派給既有的 `resolveExpiryDate()`，所以天數必須為正、日期必須是合法 ISO 日期這些規則不需要重複實作；設定損壞時自然降級為「不保證」（= 安全方向）。

### 決定三：上游 400 時退回不帶 `∞` 重試（runtime 保險）

`apps/backend/src/shared/lib/passcreator/v3-pass.ts::updatePassValues()` 送出前先記錄 payload 內哪些 key 是 sentinel；若上游回 **400**（且 payload 內確實有 sentinel），就去掉這些 key **重試一次**，讓餘額 / 點數等其餘欄位仍能落地，並在結果上標 `degraded: true`。

**為什麼需要這一層？** tenant 把已發行的卡從「無限期」改成「固定到期日」再重新推送之後，template 會變成 `date` 型別，但**舊持卡人**的 snapshot 仍是 null → runtime 送出 `∞` → 上游 400。沒有這層 fallback，那一次同步會整包失敗（餘額、點數也一起卡住）。有了它，最壞情況退化成「到期欄位維持原狀，其他欄位照常同步」，並且呼叫端可從 `degraded` 旗標得知這件事。

fallback 只在 400 時觸發（非 400 一律原樣往上拋），且只在 payload 內**確實含 sentinel** 時才觸發 —— 避免把跟 sentinel 無關的上游錯誤誤判成型別問題。

### 決定四：pass-level 的 `expirationDate` 維持省略

`formatPassValues()` 的 pass-level `result.expirationDate` 在無到期日時**仍然省略**。理由：「pass 本身不設到期」與「header 到期欄位顯示 `∞`」是兩個不同語意；pass-level 欄位省略在 POST 語意下才有「刪除」效果，而這裡是 PATCH，省略等於保留舊值 —— 但 pass-level 到期日對「無限期」卡本來就不該存在任何舊值需要清（無限期卡從未被設過 pass 級到期日），所以省略是安全的。

---

## 影響

| 影響 | 對象 |
|---|---|
| Shared | `packages/shared/constants/headerSlots.ts` — 新增 `UNLIMITED_EXPIRY_VALUE = '∞'`（單一真值）<br>`packages/shared/logic/passExpiry.ts` — 新增 `resolveExpirySlotGuaranteesDate()`<br>`packages/shared/logic/passFieldFormatter.ts` — 無到期日時寫 `∞`（取代省略） |
| Backend | `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts` — 到期 slot 在非 guaranteed-dated 時降級為 `'text'`<br>`apps/backend/src/shared/lib/passcreator/v3-pass.ts` — 400 fallback + `degraded` 旗標<br>`apps/backend/src/shared/lib/passcreator/v3-pass-types.ts` — `PassUpdateResult.degraded?: boolean`（backend-only 型別） |
| Frontend | `apps/frontend/.../CardPreview/passCardPreviewSlot.ts` — 折扣卡 fallback 由 `'—'` 改為 `∞`；會員 / 優惠券的字面量改用 shared constant |
| DB | **無變更**（不新增 migration，不碰 Rule 035） |
| 顯示變更 | 折扣卡「無到期日」的預覽顯示由 `—` 變成 `∞`。這是刻意的：Wallet 上實際顯示的是 `∞`，編輯器預覽要跟 Wallet 一致 |

### 既有卡片的行為

**不做事後回溯**。已經發行的卡不會因為這次改動自動變成 `∞` —— 持卡人必須由 tenant 重新推送 Step 8（template 端），runtime 才會在下一次 PATCH 時送出 `∞`。計畫明確排除 retroactive 重新推送。

### 已知限制

1. **模板未重新推送前，舊 template 仍是 `date` 型別** → runtime 會撞上上游 400 → 由 fallback 降級處理（其他欄位同步，到期欄位維持原狀）。要在 Wallet 上看到 `∞`，tenant 必須重新推送。
2. **`degraded: true` 目前只寫在 `PassUpdateResult` 上**，呼叫端（backend service）尚未把它轉成對使用者可見的提示。可列為後續 work item。
3. **會員卡的判定保守**：只要 template 沒有明確設定到期模式（`membershipExpiryMode`），`resolveExpirySlotGuaranteesDate` 就回 `false` → 到期 slot 降級為 `'text'`。`text` 型別在 Wallet 上仍能正常顯示日期字串，所以對顯示沒有負面影響，但模板的欄位型別描述不再反映「日期」語意。

### Out of scope

- 不動 `expiration.validityInDays` 模板區塊（per-pass `expirationDate` 已足夠）。
- 不做「到期日改成固定值」的 retroactive 重新推送。
- 不改 pay / 結帳鏈路（非 critical chain 變動，僅 Pass 呈現層）。
