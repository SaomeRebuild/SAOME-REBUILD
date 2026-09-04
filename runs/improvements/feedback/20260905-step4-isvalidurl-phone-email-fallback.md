# Step 4 isValidUrl Phone/Email Fallback + Per-Country Record Pattern

> Date: 2026-09-05
> Session: Step 4 plan 修三
> Scope: `packages/shared/logic/links.ts` + `packages/shared/logic/links.test.ts` + `apps/frontend/vite.config.ts` + `apps/frontend/vitest.config.ts` + `apps/frontend/src/i18n/locales/cardEditor.{zh-TW,en}.ts`
> Related: `runs/improvements/feedback/20260905-step4-backfields-link-format-cross-contamination.md`（修一,backFields/Links validator 拆分）

## 背景

Step 4 plan 修三承接修一：

- **修一** 把 `BackFieldsField` 與 `LinksField` 的 `validateValue` 拆開（back fields 純文字、links URL）
- **修二** 把 backFields value 改 `<textarea>` 多行
- **修三** 把 `isValidUrl()` 擴充 phone / email fallback（TW + ZA + 自訂 scheme）

user-observed symptom：

> 「連結欄位填寫的手機號碼跟 email 會跑出網址格式錯誤的紅字警示，值到改寫成 `tel:` 或 `mailto:`，可是一般使用者不會這樣填欄位」

實測的 3 種失敗：

| 使用者輸入 | 原本結果 | 預期 |
|---|---|---|
| `0912-345-678`（TW 手機）| 紅字「網址格式不正確」| 合法（accept-as-is）|
| `082 123 4567`（ZA 手機）| 紅字 | 合法 |
| `eason1989213@gmail.com`（email）| 紅字 | 合法 |
| `tel:+1234567890` | 合法（既有）| 合法 |
| `mailto:a@b.com` | 合法（既有）| 合法 |
| `not-a-url` | 紅字（既有）| 紅字 |

一般使用者不會在連結欄位用 `tel:` / `mailto:` prefix。Apple Wallet 雖然在 `relevantDate` / `webServiceURL` 接受 raw phone / email，但 Apple PassKit spec 文件對 wallet 端 raw 值渲染有彈性，所以前端 validator 不應該要求 prefix。

## 根因

`isValidUrl()` 原本只認 URL parser：

```ts
// 修三前
export function isValidUrl(value: string): boolean {
  if (value === '') return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}
```

漏了三個 case：
1. **Raw phone**：使用者輸入 `0912-345-678`，`new URL()` 拋錯 → false
2. **Raw email**：`eason1989213@gmail.com`，`new URL()` 拋錯 → false
3. **國碼前綴的電話**：`+886 912 345 678`，空格讓 `new URL()` 拋錯 → false（即使沒空格也是電話不是 URL）

Apple Wallet 與 Google Wallet 在 Section 5（連結區）會把 raw phone / raw email 渲染成可點擊的 dialer / mail client 入口——所以 **validator 接受 raw phone / raw email 是符合 spec 的**。

## 修法

### per-country Record pattern

```ts
export const PHONE_COUNTRY_PATTERNS: Record<string, RegExp> = {
  /** Taiwan — local 0-prefix (landline 02-08, mobile 09), international +886. */
  TW: /^(?:\+?886\d{7,12}|0\d{8,10})$/,
  /** South Africa — local 0-prefix (mobile 06/07/08, landline 01-05), international +27. */
  ZA: /^(?:\+?27\d{7,12}|0\d{8,10})$/,
  // Future: HK: /.../, SG: /.../, JP: /.../
};
```

新增國家 = 加一行 entry。比 if/else chain、enum、switch case 都友善。

### Separator normalization

```ts
const PHONE_SEPARATOR_STRIP = /[\s\-().]/g;

export function isPhoneLike(raw: string): boolean {
  if (raw === '') return false;
  const cleaned = raw.replace(PHONE_SEPARATOR_STRIP, '');
  for (const pattern of Object.values(PHONE_COUNTRY_PATTERNS)) {
    if (pattern.test(cleaned)) return true;
  }
  return false;
}
```

支援的輸入：
- `082 123 4567`（空格分隔）
- `+27 (0) 82 123 4567`（parens 圍 drop-zero）
- `0912-345-678`（hyphen）
- `082.123.4567`（dot）

### Email fallback

```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

RFC-5322-lite，故意 permissive。理由：權威驗證在 server-side；前端不該擋掉非 ASCII 或 edge-case 地址。

### 完整 isValidUrl

```ts
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

### Accept-as-is 政策（重要設計決定）

`isValidUrl('082 123 4567')` 回 **true**，但**不**自動加 `tel:` prefix。理由：

- **User-typed value 是 source of truth**：使用者打了什麼就存什麼，validator 不擅自改字串
- **Protocol 細節屬於 persistence 層**：Apple Wallet vs Google Wallet 對 raw phone / raw email 的渲染規則不同；要不要加 `tel:` / `mailto:` 是 server-side 決策
- **Accept-as-is 讓 caller 自己決定**：未來若要做「按了連結才加 scheme」，可以在 button onClick 動態組裝，validator 保持單純

### i18n placeholder 更新

原本 placeholder 是「https://example.com」（只暗示 URL），改成列舉三種合法格式：

```ts
// 修三前
valuePlaceholder: 'https://example.com'

// 修三後
valuePlaceholder: 'https://example.com 或 0912-345-678 或 name@example.com'
```

使用者開瀏覽器看 placeholder 就知道欄位接受這三種輸入。

i18n error message 也同步更新：

```ts
// 修三前
invalidUrl: '網址格式不正確'

// 修三後（zh-TW）
invalidUrl: '網址、電話或 E-mail 格式不正確'

// 修三後（en）
invalidUrl: 'Invalid URL, phone, or email'
```

## 測試矩陣（27 case）

`packages/shared/logic/links.test.ts` 新增 27 個 case，分 7 個 describe block：

| Block | 案例 |
|---|---|
| web URLs | `https://example.com` / `http://...` / query/fragment / subdomain |
| Apple Wallet link types | `tel:+1234567890` / `mailto:user@example.com` |
| empty / unfilled | `''` 回 true |
| phone fallback (TW + ZA) | ZA mobile / ZA separator / ZA international / ZA parens / ZA landline / TW mobile / TW hyphen / TW landline / TW international |
| email fallback | simple / subdomain / plus tag / dots / 拒無 @ / 拒無 TLD |
| unparseable strings | `not-a-url` / `foo bar baz` / URL 含空格 / `:` / US phone `+1-555-123-4567`（不在 PHONE_COUNTRY_PATTERNS 內）/ `12345` |
| isPhoneLike 直接 | empty / 註冊國家 / 未知國碼 |
| PHONE_COUNTRY_PATTERNS 拓展 contract | TW + ZA 存在 / 每個 entry 是 RegExp / 不自動加 `tel:` |

**關鍵 test case（防止未來迴歸）**：

```ts
// US phone 應該被拒（不在 PHONE_COUNTRY_PATTERNS 內）
it('rejects US phone number +1-555-123-4567 (not in PHONE_COUNTRY_PATTERNS)', () => {
  expect(isValidUrl('+1-555-123-4567')).toBe(false);
});

// 不自動加 tel: 前綴
it('does not auto-prefix tel:/mailto: (accept-as-is policy)', () => {
  const raw = '0821234567';
  expect(isValidUrl(raw)).toBe(true);
  expect(raw.startsWith('tel:')).toBe(false);
});
```

第一個 test 守住「未來加新國家時，不會因為預設 regex 太寬鬆而誤放行所有國際電話」。
第二個 test 守住「accept-as-is 政策」。

## 改動清單

| 檔案 | 動作 |
|---|---|
| `packages/shared/logic/links.ts` | 新增 — `isValidUrl` + `isPhoneLike` + `PHONE_COUNTRY_PATTERNS` + `EMAIL_RE` |
| `packages/shared/logic/links.test.ts` | 新增 — 27 case |
| `apps/frontend/vite.config.ts` | 改 — 加 `@saome/shared/logic/links` alias |
| `apps/frontend/vitest.config.ts` | 改 — 加 `@saome/shared/logic/links` alias（vitest alias 與 vite alias 獨立，見 Rule 016 § 7 surface）|
| `apps/frontend/src/i18n/locales/cardEditor.zh-TW.ts` | 改 — `links.valuePlaceholder` 改列舉三種輸入；`links.invalidUrl` 加「電話或 E-mail」|
| `apps/frontend/src/i18n/locales/cardEditor.en.ts` | 改 — 同上（en）|

## 設計取捨整理

### 為什麼 per-country Record 而非單一 mega-regex

| 選項 | 後果 | 決定 |
|---|---|---|
| A. **`PHONE_COUNTRY_PATTERNS: Record<string, RegExp>`** | 新增國家 = 一行 entry；可單獨 test 某國；regex 內部獨立不互相干擾 | 採 |
| B. 單一 mega-regex `/^(?:TW_RE|ZA_RE|...)$/` | 難維護；新增國家要重組整個 regex；難以單獨 test | 拒 |
| C. switch / if-else chain | 無法靜態列舉所有國家；新增國家要改 if-else；test 不方便 | 拒 |

### 為什麼 accept-as-is 而非自動 normalize

| 選項 | 後果 | 決定 |
|---|---|---|
| A. **accept-as-is**（`082 123 4567` 直接存） | persistence 層決定是否加 `tel:`；protocol-agnostic | 採 |
| B. 自動 normalize 成 `tel:+27821234567` | 把 Apple Wallet vs Google Wallet 的 protocol 差異 leak 進 validator；前端擅自改 user input | 拒 |
| C. 拒絕 raw phone、要求 `tel:` prefix | 使用者體驗差；spec 也允許 raw | 拒 |

### 為什麼手寫 regex 而非用 `libphonenumber-js`

| 選項 | 後果 | 決定 |
|---|---|---|
| A. **手寫 regex**（per-country）| 0 依賴；可控；可針對 SAOME 業務情境優化（mobile + landline 合併）| 採 |
| B. `libphonenumber-js` | 多 200KB；對 RN bundle 不友善；mobile + landline 分離複雜度對 validator 無意義 | 拒 |
| C. `google-libphonenumber` | 同樣太重；WASM 不適合 workerd / RN runtime | 拒 |

## 驗證（Rule 006）

| 項目 | 結果 |
|---|---|
| `npx tsc -b --noEmit` (shared) | exit 0 |
| `npx tsc -b --noEmit` (frontend) | exit 0 |
| `npm run lint` (oxlint) | exit 0（pre-existing warnings）|
| `npx vitest run packages/shared/logic/links.test.ts` | 27 passed / 0 failed |
| Manual QA：links 填 `0912-345-678` | 不出現紅字 |
| Manual QA：links 填 `082 123 4567` | 不出現紅字 |
| Manual QA：links 填 `+27 82 123 4567` | 不出現紅字 |
| Manual QA：links 填 `eason1989213@gmail.com` | 不出現紅字 |
| Manual QA：links 填 `not-a-url` | 出現紅字「網址、電話或 E-mail 格式不正確」 |
| Manual QA：links 填 `+1-555-123-4567`（US phone）| 出現紅字（US 不在支援名單）|

## 規範層影響

| 規範 | 影響 |
|---|---|
| Rule `023-shared-package.mdc` § Shared Validation 用 i18n Key | 觸發（隱性）— `isValidUrl` 只回 boolean，UI 層 `t('step4.links.invalidUrl')` 解析，符合「shared 內不放 i18n 字串」紀律 |
| Rule `024-mobile-future-proof.mdc` | 觸發 — `links.ts` 完全 RN-friendly（無 DOM / Node-only API），未來 RN 直接 import |
| Rule `016-config-and-tsconfig-discipline.mdc` | 觸發 — 新加 alias 必須同步到 `vite.config.ts` + `vitest.config.ts` 兩個 surface（已加）|

## 給未來 session 的提醒

1. **新增電話國家時**：在 `PHONE_COUNTRY_PATTERNS` 加一行 entry，regex pattern 形狀是 `(?:\+?{countryCode}\d{7,12}|0\d{8,10})`（local + international），並在 `links.test.ts` 加對應 case 至少 2 個（local + international with separators）。
2. **加更嚴格的 phone validation 時**：手寫 regex 不適合處理「真實電話號碼存在性」驗證（哪些號碼段已分配）。若未來要做此層驗證，獨立 layer 處理；`isPhoneLike` 只負責「shape 是否合理」。
3. **Apple Wallet 規格變動時**：若 spec 變更（例如要求所有連結必須帶 scheme），`isValidUrl` 改為「拒絕 raw phone / raw email」。但這條改動要 cross-check Wallet `relevantDate` 與 `webServiceURL` 渲染規則。
4. **`accept-as-is` 是 policy 而非 bug**：未來若覺得「Apple Wallet 在某些機型不渲染 raw phone」，加 normalization helper 而非改 `isValidUrl`，保持 validator shape-only。

## Sync 狀態

- **狀態**：⏳ 待推送（本批 commit shared package foundation batch 內）
- **相依**：修一 `BackFieldsField` / `LinksField` validator 拆分（讓 links 走 `isValidUrl` 的新 fallback 邏輯）
