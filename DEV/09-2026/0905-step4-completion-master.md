# Step 4 Card Info — Completion Master DEV LOG

**日期**：2026-09-05
**類型**：feature completion + bug fixes（master narrative）
**影響範圍**：CardBuilderEditor Step 4（description / backFields / links）+ shared package
**前情**：
- `0905-step4-i18n-counter-and-autosave.md`（i18n raw key + 欄位未保存）
- `0905-step4-autosave-slow-network-baseline.md`（slow network baseline arming）

---

## 摘要

Step 4（卡片資訊）經過 3 輪修正後完工：

| 輪 | Commit | 主題 |
|---|---|---|
| 0 | `3b8038f` | i18n counter raw key + Step 4 欄位 autosave 初版 |
| 1 | `3b8038f` 內 | round 2：slow network 下空值覆寫 DB 的 baseline-arm 修法 |
| 2 | (本批) | 修一：BackFieldsField 與 LinksField `validateValue` 責任拆分；修二：背面欄位 value 改 `<textarea>` 多行 + preview `whitespace-pre-wrap`；修三：`isValidUrl` 加電話/電子郵件 fallback（TW + ZA + 自訂 scheme） |

最終 Step 4 的三個 section（description / backFields / links）行為：
- **description**：textarea，200 字上限，計數器 i18n 正常解析
- **backFields**：每列 label input + value textarea（多行），至少 1 列、最多 10 列，value 必填但不做 URL 驗證
- **links**：每列 label input + value input（單行），最多 4 列，value 接受 URL（含 tel:/mailto:/自訂 scheme）+ 電話（TW/ZA）+ 電子郵件

---

## 完整時間軸

### Round 0（commit `3b8038f`）— i18n + autosave 初版

DOM 顯示 `step4.backFields.counter` 而非「1 / 10」／「0 / 10」—— `cardEditor.zh-TW.ts` 與 `cardEditor.en.ts` 的 `backFields` 物件缺 `counter` key。Step 4 三欄位只在「通過 `isStep4Valid()` 的下一步」才寫 DB，否則完全不存。

修法：
- locale 補 `backFields.counter: '{{count}} / 10'`（兩個 locale）
- 加 `Step4CardInfo.i18n.test.ts` 守住 locale shape 對稱
- `CardBuilderEditor.tsx` 加 useEffect 監聽 description / backFields / links，1s debounce 寫 DB（mirror name auto-save）
- 加 `JSON.stringify` snapshot guard 過濾 Zustand selector 產生的 reference churn

驗證：547/547 vitest 全綠（backend / shared 7 個失敗為 pre-existing，已 stash 確認）。

### Round 1（commit `3b8038f` 內）— slow network baseline arming

autosave 寫入後**幾秒後只剩 links 有資料、description 變空、backFields 回預設單列空 row**，重新整理後又完整回填。

根因：
1. mount 時 `reset()` 把 store 清成 defaults
2. URL-watching effect setCardId → CardBuilderEditor 的 autosave effect 第二次跑
3. 此時 store 是 reset 後的 empty defaults，effect 看到 `JSON.stringify({description:'', backFields:[{empty}], links:[]})`，跟 baseline（init `''`）不同 → schedule 1s 後 PUT
4. `cardService.getById()` async resolve（可能慢於 1s）
5. T = 1100 ms：timer **帶 empty defaults 寫進 DB**，後端 JSONB `||` merge silent overwriter 把真實資料洗空
6. links 看似存活是因為使用者通常只刪了 1 筆 link，merge 後看起來「沒變」

修法：
- 加 `step4BaselineArmedRef` flag，第一次 effect run 純 baseline seeding、不排 timer
- `cardId` 變動時 reset flag
- 新增 `does NOT autosave empty defaults when getById resolves slowly` regression test

驗證：7/7 autosave test 全綠（含 slow network regression）。

### Round 2（本批）— 三條獨立修法

#### 修一：BackFieldsField 與 LinksField `validateValue` 責任拆分

**症狀**：使用者反映「背面欄位有內容欄位沒填時」跑出網址格式錯誤的紅字警示；同時「連結欄位填寫的手機號碼跟 email 會跑出網址格式錯誤的紅字警示」。

**根因**：BackFieldsField 與 LinksField 共用同一份 `validateValue` callback，傳到 `LabelValueListField` 時把 `isValidUrl()`（URL-only check）當成兩者都用。Apple Wallet 規格：back fields 是純文字 contact info（Apple EULA 要求至少一個 back field），links 是 actionable URL。**兩種欄位的語意不同、驗證規則不同，不能共用 callback**。

**修法**：拆 validateValue：

```ts
// BackFieldsField.tsx
const validateValue = (value: string) => value.trim().length > 0;
// 純文字非空檢查，不走 URL/電話/電子郵件 shape check

// LinksField.tsx
const validateValue = (value: string) => value === '' || isValidUrl(value);
// 空值合法（links 是 optional），非空值走 isValidUrl（含電話/電子郵件 fallback）
```

兩個檔案 header 都加 JSDoc 明確標示「Responsibility split」段落，避免未來 developer 又合併回去。

#### 修二：背面欄位 value 改 `<textarea>` 多行 + preview `whitespace-pre-wrap`

**症狀**：Apple PassCreator 的背面欄位 value 可以斷行，SAOME 的卡片背面板卻不能，使用者填多行地址會擠在一行。

**根因**：`LabelValueRow.tsx` value 欄位永遠是 `<input type="text">`。

**修法**：
- `LabelValueRow.tsx` 新增 `valueMultiline` prop，true 時改 `<textarea>` + `useLayoutEffect` 自動調整高度（reset `style.height='auto'` 再量 `scrollHeight + 2px`，避免刪行時不縮）
- `LabelValueListField.tsx` 透傳 `valueMultiline`
- `BackFieldsField.tsx` 傳 `valueMultiline`（Apple EULA 允許 multi-line contact info）
- `LinksField.tsx` 不傳（links 是單行 URL）
- `PassCardPreviewBack.tsx` 加 `whitespace-pre-wrap break-words` 保留換行

#### 修三：`isValidUrl` 電話/電子郵件 fallback（TW + ZA）

**症狀**：連結欄位填寫 `0912-345-678`（TW 手機）或 `082 123 4567`（ZA 手機）或 `eason1989213@gmail.com`（電子郵件）會跑出紅字警示。一般使用者不會在連結欄位用 `tel:` / `mailto:` prefix。

**根因**：`isValidUrl()` 只認 `URL` parser 接受的東西（`http://` / `https://` / `tel:` / `mailto:` / 自訂 scheme），不接受 raw phone / raw email。

**修法**：

```ts
// packages/shared/logic/links.ts
export const PHONE_COUNTRY_PATTERNS: Record<string, RegExp> = {
  TW: /^(?:\+?886\d{7,12}|0\d{8,10})$/,
  ZA: /^(?:\+?27\d{7,12}|0\d{8,10})$/,
};

export function isValidUrl(value: string): boolean {
  if (value === '') return true;
  try {
    new URL(value);  // 1. URL parser — http(s)/tel:/mailto:/custom
    return true;
  } catch {
    if (isPhoneLike(value)) return true;  // 2. Phone fallback
    if (EMAIL_RE.test(value)) return true;  // 3. Email fallback
    return false;
  }
}
```

設計取捨：
- **accept-as-is 政策**：phone / email 命中時回 true 但不自動加 `tel:` / `mailto:` prefix。理由：user-typed value 是 source of truth，persistence 層決定是否加 scheme；本 helper 只做 shape check
- **per-country Record**：新增國家加一行就好，未來 HK/SG/JP 照同樣 pattern
- **separator strip**：`082 123 4567` / `+27 (0) 82 123 4567` / `0912-345-678` 都能通過（strip space / hyphen / parens / dot）

---

## 規範層沉澱

### 新規則 / 規範補完

| 規範 | 影響 |
|---|---|
| Rule `024-mobile-future-proof.mdc` § Hook Split Pattern | 不變 — 純函式（isPhoneLike / EMAIL_RE）搬到 `packages/shared/logic/`，未來 RN 直接 import |
| Rule `023-shared-package.mdc` § Shared Validation 用 i18n Key | 不變 — `isValidUrl` 只回 boolean，UI 層 `t('step4.links.invalidUrl')` 解析 |
| Rule `019-schema-contract-drift.mdc` § 4.1 | 觸發 — Step 4 新增 `description / backFields / links` 三個欄位已 4 層同步（shared schema → backend request.ts → backend db interface → service） |
| Rule `000-modular-design.mdc` Part A | 觸發 — `Step4CardInfo/` 資料夾結構、`LabelValueListField` 與 `LabelValueRow` 拆分遵守 |

### 新 feedback / DEV LOG

| 路徑 | 內容 |
|---|---|
| `runs/improvements/feedback/20260905-step4-backfields-link-format-cross-contamination.md` | 修一 bug：兩種欄位共用 validateValue，語意混淆 |
| `runs/improvements/feedback/20260905-step4-isvalidurl-phone-email-fallback.md` | 修三 feature：`isValidUrl` 擴充 phone/email fallback + per-country Record pattern |
| `DEV/09-2026/0905-step4-completion-master.md` | 本檔 — Step 4 完成 master narrative |

### 既有 DEV LOG 的 sync 狀態更新

- `0905-step4-i18n-counter-and-autosave.md` 已推送（commit `3b8038f`）
- `0905-step4-autosave-slow-network-baseline.md` commit `3b8038f` 內，與初版 autosave 同 commit；本批才補上 sync 標記

---

## 改動清單（本批 commit）

| 區塊 | 檔案 | 動作 |
|---|---|---|
| Shared | `packages/shared/logic/links.ts` | 新增 — `isValidUrl` / `isPhoneLike` / `PHONE_COUNTRY_PATTERNS` / `EMAIL_RE` |
| Shared | `packages/shared/logic/links.test.ts` | 新增 — 27 個 case 涵蓋 TW/ZA/email/scheme/empty |
| Shared | `packages/shared/constants/card-back-fields.ts` | 新增 — `DESCRIPTION_MAX_LENGTH` / `BACK_FIELDS_MIN/MAX` / `LINKS_MAX` / `*MAX_LENGTH` |
| Shared | `packages/shared/constants/index.ts` | 新增 — barrel export |
| Shared | `packages/shared/logic/index.ts` | 新增 — barrel export |
| Shared | `packages/shared/schemas/card.ts` | 新增 — Step 4 三欄位 schema |
| Shared | `packages/shared/schemas/card.test.ts` | 新增 — Step 4 三欄位 schema test |
| Backend | `apps/backend/src/modules/cards/db/templates.ts` | TemplateSettings interface 加 `description / backFields / links` |
| Frontend | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step4CardInfo/*` | 新增 — DescriptionField / BackFieldsField / LabelValueListField / LabelValueRow / LinksField / Step4CardInfo / types / index / test |
| Frontend | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewBack.tsx` | 改 — 加 `whitespace-pre-wrap break-words` |
| Frontend | `apps/frontend/src/i18n/locales/cardEditor.{en,zh-TW}.ts` | 改 — i18n 字串微調（placeholder 含電話/email 範例）|
| Frontend | `apps/frontend/vite.config.ts` / `vitest.config.ts` | 改 — 加 `@saome/shared/logic/links` 與 `@saome/shared/constants/card-back-fields` alias |

---

## 驗證（Rule 006）

| 項目 | 結果 |
|---|---|
| `npx tsc -b --noEmit` (frontend) | exit 0 |
| `npx tsc --noEmit` (backend) | exit 0 |
| `npx tsc --noEmit` (shared) | exit 0 |
| `npm run lint` (oxlint) | exit 0（pre-existing warnings） |
| `npx vitest run` (frontend) | 67 files, **全綠**（含新加的 `Step4CardInfo.test.tsx` 17 個 case）|
| `npx vitest run` (backend) | 全綠 |
| `npx vitest run` (shared) | 全綠（含 `links.test.ts` 27 個 case + `card.test.ts` Step 4 段）|
| `npm run verify:i18n` | 17 namespaces passed（`step4.backFields.counter` 與 `step4.links.valuePlaceholder` 雙 locale 都解得到）|
| Manual QA：Step 4 開既有 draft | description / backFields / links 都回填正確；過 5s 後再檢視仍正確（slow network baseline arming 生效）|
| Manual QA：backFields 填多行地址 | value textarea 自動長高；preview 換行正確 |
| Manual QA：links 填 `0912-345-678` / `082 123 4567` / `name@example.com` | 不再出現紅字警示（accept-as-is 政策）|
| Manual QA：links 填 `not-a-url` | 出現紅字「網址、電話或 E-mail 格式不正確」（fallback 後還是不合法仍 reject）|

---

## 教訓整理

1. **共用 callback 是耦合陷阱**：BackFieldsField 與 LinksField 共用 `validateValue` 是當初為求 DRY 的決定，但**語意不同的欄位不該共用驗證函式**。Apple EULA 對 back fields 是「必填 contact」、對 links 是「optional URL」，規則根本不同。**DRY 不是同類化驗證的理由**。

2. **textarea 的 `useLayoutEffect` 自動長高**：`style.height = 'auto'` 再 `style.height = ${scrollHeight + 2}px`，缺一不可 —— 沒先 reset 到 auto，刪行後 scrollHeight 還是舊值、textarea 不會縮。+2px 是補 1px top + 1px bottom border 避免游標被切到。

3. **`isValidUrl` accept-as-is 政策**：原始 value 是 source of truth，本 helper 只回 boolean；要不要加 `tel:` / `mailto:` prefix 是 persistence 層的決定。把 normalize 邏輯塞進 validator 會把 Apple Wallet 跟 Google Wallet 的 protocol 細節 leak 進純函式。

4. **per-country Record pattern**：`PHONE_COUNTRY_PATTERNS: Record<string, RegExp>` 讓新增國家 = 加一行 entry，未來 HK/SG/JP 直接長出來。比 if/else chain 或 enum 友善。

5. **Apple Wallet back fields 規格**：Apple EULA 要求至少一個 back field 含 contact info，但**沒有**要求 format 是 URL 或 phone。所以 validator 應該是「non-empty」而非「URL/phone/email 任何合法格式」。誤把 URL validator 套到 back fields 是當初 spec 解讀錯誤。

---

## 給未來 session 的提醒

1. **新增 Step 4 sub-section 時**：繼續走「component-bound namespace」（`cardEditor`）+ 「Section 4 back fields 多行、Section 5 links 單行」的責任分工。**不要再共用 validateValue**。
2. **新增電話國家時**：在 `PHONE_COUNTRY_PATTERNS` 加一行 entry，並在 `links.test.ts` 加對應 case。format：local `0\d{...}` + international `+?\d{...}`。
3. **新增 Step 4 欄位時**：必走 Rule 019 § 4.1 四層同步（shared schema → backend request.ts → backend db interface → service）。
4. **`isValidUrl` 擴充時**：保留 accept-as-is 政策，normalize 邏輯放 persistence 層。
5. **`LabelValueListField` 泛化時**：`valueMultiline` 已加好，未來 Apple Wallet 其他 multi-line section（如 terms 文字）可直接複用。

---

## Sync 狀態

- **狀態**：⏳ 待推送（本批 commit 拆 9 個批次）
- **批次計畫**：
  1. docs：DEV LOG + feedback
  2. shared package foundation
  3. backend db layer
  4. backend async getDb refactor
  5. frontend config + http client + i18n
  6. Step 4 components
  7. CardPreview + MediaAssetUploader
  8. CardBuilderEditor autosave + workspace
  9. misc（package-lock、INDEX、dev-restart script）
- **Push 目標**：`main`
