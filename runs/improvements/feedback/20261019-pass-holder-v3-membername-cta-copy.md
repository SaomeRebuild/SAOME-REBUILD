# Pass Holder V3 — 3 個 bug fix bundle（memberName 欄位 + CTA 平台 icon + Tips 副本）

**日期**：2026-10-19
**作者**：SAOME-REBUILD agent session
**scope**：L2 Standard（3 改 backend + 4 改 frontend + 5 條 conformance test + 2 條 i18n key update）
**plan**：[fix_membername_v3_payload_+_cta_platform_icons_4a8409dd.plan.md](../../../.cursor/plans/fix_membername_v3_payload_+_cta_platform_icons_4a8409dd.plan.md)

---

## Summary

3 個獨立但 user-visible 同 family（holder pass 在錢包 App 內的呈現品質）的 bug fix bundle：

| # | Bug | 修法 |
|---|---|---|
| 1 | V3 payload holder name 欄位是 `data.name`，但 template primaryFields[0].key 是 `memberName` — `data.name` 不會解析 `{memberName}` placeholder，rendered pass 永遠空白 | `passcreator.ts` 把 V3 create body 的 `name: holder.name` 改 `memberName: holder.name`；同步 capture script fixture |
| 2 | 下載按鈕不分平台 — iPhone / Android / Desktop user 都看到同一個「下載 .pkpass」CTA 跟同一個 URL，user 無法分辨哪個按鈕對應哪個錢包 App | `PassHolderDownloadButton` 重構：拆 `pickPrimaryCtaType()` + `pickPrimaryHref()` + icon lookup，3 種平台各 render 對應 icon (Apple / Smartphone / Download) + label + href |
| 3 | Android Tips 副本只說「請先安裝 Passwallet 再點下載」，沒提到「首次會被引導安裝」這個 UX 訊息，user 看到 Play Store 跳轉以為是 bug | `passHolder.{zh-TW,en}.ts` 的 `passwalletReminder.body` 直接 replace 成新副本（涵蓋 Play Store 引導安裝是正常現象）|

---

## Symptom

### 1. V3 payload memberName 漂移

User 報：「我下載 Pass 到 Apple Wallet 後，打開卡片，會員名稱欄位是空白的。明明我註冊時有填名字。」

後端 log 確認 `registerService.attemptIssuance` 成功，V3 response `data.identifier` / `data.downloadPage` / `data.iPhoneUri` / `data.androidUri` / `data.barcodeValue` 都正常。`pass_holders.pass_identifier` / `iphone_uri` / `android_uri` 都寫進 DB。

但用戶在 Apple Wallet 打開 pass，**holder name 欄位是空字串**。

### 2. CTA 平台 icon 漂移

User 報：「為什麼 iPhone 跟 Android 看到的下載按鈕都一樣？我以為是同一個東西。」

實際行為：

| Platform | Primary CTA 顯示 | Primary CTA href | Secondary CTA 顯示 | Secondary CTA href |
|---|---|---|---|---|
| iOS Safari | 下載圖示 + 「加入 Apple 錢包」 | `iPhoneUri` (.pkpass) | Smartphone 圖示 + 「下載 .pkpass」 | `downloadPage` |
| Android Chrome | 下載圖示 + 「加入 Apple 錢包」 | `androidUri` (Google Wallet deeplink) | Smartphone 圖示 + 「下載 .pkpass」 | `downloadPage` |
| Desktop | 下載圖示 + 「加入 Apple 錢包」 | `downloadPage` (universal) | Smartphone 圖示 + 「下載 .pkpass」 | `downloadPage` |

3 個 platform 的**Primary CTA 都是同一個 Download 圖示 + 同一個 label**，只有 href 不同。User 看到 iPhone 上顯示「下載 .pkpass」icon，內心會想「等等，這是 .pkpass 還是 Apple Wallet？」。

### 3. Tips 副本漂移

User 報：「為什麼 Android 點了加入錢包按鈕，跳到 Play Store？這是 bug 嗎？」

實際上 V3 對 Android user 的標準路徑是：

1. User 點「加入 Google 錢包」CTA → 開 `androidUri` (Google Wallet deeplink)
2. Android 裝置若無 Passwallet → Google Wallet 偵測 → 跳 Play Store 安裝 Passwallet（這是 Passcreator 文件的官方路徑）
3. User 安裝 Passwallet → 再點 CTA → 真的加進 Google Wallet

但舊 Tips 副本是：「iPhone 內建 Apple 錢包可直接加入。Android 用戶請先安裝 Passwallet App，再點上方「下載 .pkpass」開啟。」完全沒提「**首次會被自動引導安裝**」這個 UX 訊息，user 看到 Play Store 跳轉就以為是 bug。

---

## Root cause

### 1. V3 wire shape vs template placeholder key 不對齊

- **V3 wire shape**：`data.{templateId, name, phone, birthday, email}`（`name` 欄位給 holder 名字）
- **SAOME template primaryFields[0].key**：`memberName`（v12-followup 2026-10-12 改成 `memberName`，不是 `name`）
- **Passcreator placeholder 解析規則**：template 的 `primaryFields[]` / `additionalProperties[]` 各自宣告一個 `key`（placeholder address），Passcreator 收到 V3 create body 時根據這個 key 把 body 內對應欄位的值填進 pass。`{memberName}` placeholder 只看 `data.memberName`，**不看 `data.name`**。

兩者 mismatch → `{memberName}` placeholder 永遠解析不到值 → rendered pass 空白。

### 2. CTA 渲染沒分平台

`PassHolderDownloadButton` v3-contract-fix 後的 `pickDownloadUri()` helper 已經處理 URI 的 UA 分流（iOS → iPhoneUri / Android → androidUri / Desktop → downloadPage），但**渲染層的 icon + label 沒跟著分流**。所有 platform 都 render 同一個 `<Download />` icon 跟「加入 Apple 錢包」label。

兩個 helper 沒分開：

- **URI 選擇**（哪個 URL）：`pickDownloadUri()` 已對
- **icon + label 選擇**（哪個視覺呈現）：沒做

修法是把 URI 選擇拆成 `pickPrimaryCtaType()`（純 platform 偵測） + `pickPrimaryHref()`（URI fallback chain），icon 跟 label 用 ctaType 走 lookup table。

### 3. Tips 副本沒覆蓋「首次引導」訊息

`passwalletReminder.body` 是 10/19 寫 `PassHolderPassDownload` 時從別處 copy 過來的舊版副本，只提到「請先安裝 Passwallet 再點下載」，沒提到「首次會被自動引導安裝到 Play Store」這個**被 V3 自動觸發**的 UX 流程。

---

## Fix

### 1. V3 payload `name` → `memberName`

[`apps/backend/src/shared/lib/passcreator.ts:1322-1334`](../../apps/backend/src/shared/lib/passcreator.ts) line 1322-1334：

```ts
// Before:
data: {
  templateId: passcreatorTemplateId,
  name: holder.name,
  phone: holder.phone,
  birthday: holder.birthday,
  email: holder.email,
},

// After:
data: {
  templateId: passcreatorTemplateId,
  // v3-fix-2026-10-19: SAOME template mapping emits `memberName` as
  // `primaryFields[0].key` for `membership_card` (and the matching
  // `additionalProperties[]` entry for any cardType that has a
  // membership-style field slot). Passcreator resolves the
  // `{memberName}` placeholder against this body field name.
  memberName: holder.name,
  phone: holder.phone,
  birthday: holder.birthday,
  email: holder.email,
},
```

`PassIssueHolderData.name` docblock 補上「**mapped to `data.memberName` on V3 wire**」備註。

同步 [`apps/backend/scripts/capture-passcreator-v3.cjs:110`](../../apps/backend/scripts/capture-passcreator-v3.cjs) line 110 的 fixture source-of-truth（capture script 跟 wire shape drift 等同 production drift — 跟之前 V3 contract fix 的 capture script SOP 同源道理）。

### 2. CTA 平台 icon 拆分

[`apps/frontend/src/components/business/pass/PassHolderPassDownload/PassHolderDownloadButton.tsx`](../../apps/frontend/src/components/business/pass/PassHolderPassDownload/PassHolderDownloadButton.tsx) 重構：

新增 `pickPrimaryCtaType(userAgent): 'apple' | 'android' | 'universal'` helper（純 platform 偵測）跟 `pickPrimaryHref(issuance, ctaType)`（URI fallback chain），icon 跟 label 用 ctaType 走 lookup table：

| ctaType | Icon | Label (zh-TW) | Label (en) | href 來源 |
|---|---|---|---|---|
| `'apple'` | `<Apple />` | `加入 Apple 錢包` | `Add to Apple Wallet` | `iPhoneUri` ?? `downloadPage` |
| `'android'` | `<Smartphone />` | `加入 Google 錢包`（**新 i18n key**）| `Add to Google Wallet`（**新 i18n key**）| `androidUri` ?? `downloadPage` |
| `'universal'` | `<Download />` | `下載 .pkpass` | `Download .pkpass` | `downloadPage` ?? `iPhoneUri` ?? `androidUri` |

Primary CTA 加 `data-cta-type="apple|android|universal"` attribute，方便 test 驗證 + 將來 debug 看 DOM 知道走哪個分支。

Secondary CTA 永遠 render Smartphone icon + 「下載 .pkpass」+ `downloadPage`（universal fallback source — device misdetection 的 escape hatch）。

新增 i18n key：
- `passHolder.download.androidWallet`（zh-TW）：「加入 Google 錢包」
- `passHolder.download.androidWallet`（en）：「Add to Google Wallet」

**為什麼不叫「加入 Passwallet」**：SAOME 沿用 Passcreator 文件的官方措辭，CTA 實際行為 user-agent detection 把 Android user 帶到 `passwallet.page.link`（Passcreator 的官方路徑），但**user-visible brand** 用「Google 錢包」對齊 Passcreator 文件描述。屬於 copy decision，可在未來 session 改。

### 3. Tips 副本 refresh

[`apps/frontend/src/i18n/locales/passHolder.zh-TW.ts`](../../apps/frontend/src/i18n/locales/passHolder.zh-TW.ts) line 86 修 `passwalletReminder.body`：

```ts
// Before:
body: 'iPhone 內建 Apple 錢包可直接加入。Android 用戶請先安裝 Passwallet App，再點上方「下載 .pkpass」開啟。',

// After:
body: '如果 Android 裝置沒有 Passwallet，首次安裝卡片時會被引導至 Play 商店安裝 Passwallet，這是正常現象。安裝後再點上方按鈕即可加入錢包。',
```

[`apps/frontend/src/i18n/locales/passHolder.en.ts`](../../apps/frontend/src/i18n/locales/passHolder.en.ts) line 89 修對應英文：

```ts
// Before:
body: 'iPhone has Apple Wallet built-in. Android users should install Passwallet first, then tap "Download .pkpass" above to open it.',

// After:
body: 'If your Android device does not have Passwallet installed, the first install will guide you to the Play Store to get Passwallet — this is normal. After installing, tap the button above again to add to your wallet.',
```

---

## Verification

| 驗證項 | 指令 | 結果 |
|---|---|---|
| Typecheck (backend) | `npx tsc --noEmit -p apps/backend/tsconfig.json` | exit 0 |
| Typecheck (frontend) | `npx tsc --noEmit -p apps/frontend/tsconfig.app.json` | exit 0 |
| Backend test (target) | `npx vitest run apps/backend/src/shared/lib/passcreator.test.ts` | **81/81 passed**（+2 v3-fix wire-shape conformance：① happy path `data.memberName` 重命名驗證 / ② capture fixture `v3-create-success.json` 對齊 wire shape 驗證）|
| Frontend test (target) | `npx vitest run src/components/business/pass/PassHolderPassDownload` | （待 verification 階段跑）|
| i18n smoke | `npm run verify:i18n` | 21 namespace OK |
| Capture script syntax | `node -c apps/backend/scripts/capture-passcreator-v3.cjs` | syntax OK |
| Backend full sweep | `npm test --workspace=apps/backend` | （待 verification 階段跑）|
| Frontend full sweep | `npm test --workspace=apps/frontend` | （待 verification 階段跑）|

---

## 教訓

### 1. **Capture script 是 fixture source-of-truth**（Rule 衍生）

V3 wire shape 跟 capture script 的 `data` 區塊**必同步**。Capture script drift 會導致未來重跑 `node apps/backend/scripts/capture-passcreator-v3.cjs` 時，新 fixture 跟 production wire shape 不一致 → 拿來做 live capture conformance test 的 fixture 是錯的 → mock-vs-live drift 又會重演（SAOME 第 N+1 次同 family 教訓）。

修法 SOP（已存在，但本 session 落實到具體改檔）：

1. 任何 V3 create body 欄位 rename / 新增 / 刪除 → 必同步 `passcreator.ts::issuePass` + `capture-passcreator-v3.cjs::makeV3CreateBody` + 2 條 conformance test（① happy path 直接 pin ② capture fixture pin 對齊）
2. 把這個 SOP 寫進 `capture-passcreator-v3.cjs` 的 docblock 開頭（已寫）— capture script = fixture source-of-truth，這是 self-documenting code

### 2. **CTA icon 跟 URI 選擇應該分兩個 helper**

`pickDownloadUri()` 一個 helper 處理了「URI 選擇」（iOS → iPhoneUri / Android → androidUri / Desktop → downloadPage），但**渲染層的 icon + label 沒分**。所有 platform 看到同一個 Download icon + 同一個 label。

正確的拆分是：

- `pickPrimaryCtaType(userAgent): 'apple' | 'android' | 'universal'` — 純 platform 偵測，獨立於 URI 內容
- `pickPrimaryHref(issuance, ctaType): string | null` — 平台對應的 URI fallback chain

Icon 跟 label 用 ctaType 走 lookup table（用 switch 顯式列舉），不用 ternary chain 在 JSX 內塞。這樣：

- iPhone user 永遠看到 Apple icon（即使 backend 沒回 iPhoneUri，UI 還是 Apple 視覺）
- Test 可以用 `data-cta-type` attribute 精準驗證每個 platform 走哪個 branch
- 未來加新 platform（例如 watchOS / Wear OS）只需擴 ctaType union + 3 個 helper

### 3. **Tips 副本必 cover 自動觸發的 UX 流程**

舊 `passwalletReminder.body` 只描述手動流程（先裝 App 再下載），沒描述 Passcreator **自動**觸發的 Play Store 引導安裝流程。User 看到預期外的跳轉會以為是 bug。

修法 SOP：任何「user 會看到預期外行為」的 UX 流程，副本必明確說「**這是正常現象**」。SAOME 之前在 register flow 也有類似 bug（Chrome autofill 把 contact name 灌進 email input 寫進 DB），修法是前端加 clear effect — 但**副本層也該 cover**這個可能性，不能只靠 code 擋。

### 4. **`data-cta-type` attribute 是測試 + debug 的金本位**

為 primary CTA 加 `data-cta-type="apple|android|universal"` attribute 的好處：

- **Test**：4 條新 conformance test 可以直接 `toHaveAttribute('data-cta-type', 'apple')` 驗證 platform 分流，不依賴 DOM SVG icon 結構（lucide-react 改版 SVG 結構會破 test）
- **Debug**：未來 user 報「我看到奇怪的按鈕」時，DevTools 一眼看到 `data-cta-type='universal'` 就知道 UA 沒被識別，問題在 detection；`data-cta-type='apple'` 但 href 是 downloadPage 就知道 iPhoneUri 沒填，問題在 backend

---

## Future invariants

| ID | Invariant | 來源 |
|---|---|---|
| v3-fix-2026-10-19-a | V3 create body holder name 欄位必為 `data.memberName`（不是 `data.name`）| Task 1 |
| v3-fix-2026-10-19-b | `apps/backend/scripts/capture-passcreator-v3.cjs::makeV3CreateBody` 必跟 production wire shape 同步 | Task 1.2 + 教訓 1 |
| v3-fix-2026-10-19-c | `PassHolderDownloadButton` 的 ctaType 跟 href 必分兩個 helper（`pickPrimaryCtaType` + `pickPrimaryHref`）| Task 2 + 教訓 2 |
| v3-fix-2026-10-19-d | iOS / Android / Desktop 三種 platform 必 render 對應 icon (Apple / Smartphone / Download) + 對應 label | Task 2.1 |
| v3-fix-2026-10-19-e | `passHolder.download.androidWallet` i18n key 必存在於 zh-TW + en | Task 2.2 |
| v3-fix-2026-10-19-f | `passwalletReminder.body` 必包含「首次安裝會被引導」UX 訊息（zh-TW + en 兩檔同步）| Task 3 |

---

## Follow-up

| 優先 | 項目 | 備註 |
|---|---|---|
| P0 | Production smoke test（Playwright `/pass/{templateId}` 完整 flow）— verify rendered pass 真的有 holder name + 3 platform CTA icon 各 render 對應 + Tips 副本在 zh-TW / en 正確顯示 | Rule 005 + Rule 036 |
| P1 | 對 83d3139a 等 production row 主動重 register 補 identifier + URIs（COALESCE 已經保護舊欄位不 wipe，per 10/19 partial update fix）| 跟 `feedback/20261019-pass-holder-v3-partial-update-bug.md` follow-up #P1 同源 |
| P1 | Android CTA label 從「Google 錢包」改「Passwallet」（如要 100% 對齊實際 URL 行為）— 屬於 copy decision，本 session scope 外 | Task 2.2 註解 |
| P1 | 把 capture script 跟 production wire shape 的同步檢查加進 CI gate（pre-commit 或 PR check）| Rule 衍生 — fixture vs production drift 是 SAOME 永恆的 family |
| P2 | 抽 CTA icon 跟 label 的 lookup table 為共用 component（未來 watchOS / Wear OS / etc.） | Task 2.1 教訓 2 |
| P2 | `data-cta-type` attribute 加進 E2E smoke test 驗證 3 platform 都正確 render | Task 2.1 教訓 4 |
| P2 | Rule 040 「Live capture is mandatory」正式從草案 → rule（capture-passcreator-v2 + v3 都已實證） | 草案於 2026-10-18 feedback |

---

## scope

- **Backend 改檔**：`apps/backend/src/shared/lib/passcreator.ts`（V3 payload + docblock）
- **Backend 改檔（fixture source-of-truth）**：`apps/backend/scripts/capture-passcreator-v3.cjs`（v3-create-success + v3-create-error 兩處的 `data` 區塊）
- **Backend 改檔（test）**：`apps/backend/src/shared/lib/passcreator.test.ts`（既有 happy path + non-ASCII 測試改 pin 新欄位 + 2 條 v3-fix 新 test）
- **Frontend 改檔**：`apps/frontend/src/components/business/pass/PassHolderPassDownload/PassHolderDownloadButton.tsx`（重構為 ctaType + primaryHref 雙 helper + icon lookup + `data-cta-type` attribute）
- **Frontend 改檔（test）**：`apps/frontend/src/components/business/pass/PassHolderPassDownload/PassHolderPassDownload.test.tsx`（既有 3 條 user-agent test 補 `data-cta-type` + 4 條新 platform-icon conformance test + 1 條 body assertion）
- **Frontend 改檔（i18n）**：`apps/frontend/src/i18n/locales/passHolder.{zh-TW,en}.ts`（新 `download.androidWallet` key + `passwalletReminder.body` 副本 refresh）
- **新增 feedback**：`runs/improvements/feedback/20261019-pass-holder-v3-membername-cta-copy.md`（本檔）
- **改 INDEX**：`runs/improvements/INDEX.md`（append 1 row）

**commit 安排**：1 個 commit 帶 code + test + i18n + feedback + INDEX row 同 commit（Rule 011 / 025 對齊；無 migration 故 Rule 035 不觸發）。
