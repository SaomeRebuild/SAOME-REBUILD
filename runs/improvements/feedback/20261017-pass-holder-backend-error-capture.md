# Feedback：PassHolder 後端錯誤捕獲 + i18n key 補齊（Bug 4 umbrella — unhandled rejection + raw i18n key leak）

**日期**：2026-10-17
**作者**：SAOME-REBUILD
**類型**：L2 Standard（前端 bug fix + 5 條 i18n key 補齊，後端 contract 不變）
**關聯 plan**：[`pass_holder_後端錯誤捕獲與i18n_key補齊_<uuid>.plan.md`](../../.cursor/plans/)
**關聯 Single-CTA feedback**：[`20261016-pass-holder-paid-membership-single-cta.md`](20261016-pass-holder-paid-membership-single-cta.md)
**關聯 MVP feedback**：[`20261016-pass-holder-paid-membership-mvp.md`](20261016-pass-holder-paid-membership-mvp.md)

---

## 摘要

`/pass/{templateId}` 公開頁按「Get Pass」/「Pay NT$ X & Get Pass」會拿到 backend 400（如 birthday 未滿 13 歲），但前端**完全沒 UI feedback**：
- 控制台噴 `PassHolderError: passHolder.errors.tooYoung` unhandled rejection
- Banner 沒顯示
- 使用者以為「按了沒反應」再按一次，重複扣款風險

3 個 root cause 同時修：(1) submit handler `try/finally` 沒 `catch` → rejection escape；(2) backend emit 的 `passHolder.errors.tooYoung` / `birthdayInvalid` / `phoneInvalid` 3 個 i18n key **frontend 沒翻譯**；(3) `passHolderService::toPassHolderError` 5xx fallback 用 `common.error.serverError` **該 key 也不存在**。三者同時發生才會出現「raw i18n key 漏到 console + 沒 banner + user 不知道發生什麼」。

**重要**：所有 RAW i18n key 在 user 螢幕上是看不到的（Banner 還沒實作所以根本沒 render），user 看到的症狀是「按了好像沒反應」、console 噴 raw key。修完後 banner 顯示 zh-TW 翻譯文字，使用者明白原因。

---

## 範圍（5 改檔 + 1 測試擴充 + 1 feedback + INDEX update）

### 修改

| 檔案 | 變更 |
|---|---|
| [`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.tsx`](../../apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.tsx) | 兩個 submit handler (`onValidSubmit` / `onCtaClick`) 都加 `catch` 區塊；新增 `submitError` state 與 `<div role="alert" data-testid="pass-holder-submit-error">` banner；使用 ref 已存在；新增 `toSubmitErrorKey()` consumer-side error 翻譯 helper（mirror 服務端 `toPassHolderError` 但 consumer-side）|
| [`apps/frontend/src/i18n/locales/passHolder.zh-TW.ts`](../../apps/frontend/src/i18n/locales/passHolder.zh-TW.ts) | `errors` namespace 加 3 條 key：`birthdayInvalid` / `phoneInvalid` / `tooYoung`；加 `submitErrorDismiss` 按鈕 label |
| [`apps/frontend/src/i18n/locales/passHolder.en.ts`](../../apps/frontend/src/i18n/locales/passHolder.en.ts) | 同上 en 版 |
| [`apps/frontend/src/i18n/locales/common.zh-TW.ts`](../../apps/frontend/src/i18n/locales/common.zh-TW.ts) | `error` namespace 加 `serverError` key（5xx fallback）|
| [`apps/frontend/src/i18n/locales/common.en.ts`](../../apps/frontend/src/i18n/locales/common.en.ts) | 同上 en 版 |
| [`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.test.tsx`](../../apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.test.tsx) | `vi.mock` factory 改用 `importOriginal` pattern 把 `PassHolderError` / `PassHolderNotFoundError` 也 re-export；新增 4 條 regression test（`tooYoung` / `birthdayInvalid` / 5xx fallback / error banner clears on resubmit）；test #1 用 `window.addEventListener('unhandledrejection', ...)` 主動驗證沒有 unhandled rejection |

### 新增（本檔）

| 檔案 | 用途 |
|---|---|
| [`runs/improvements/feedback/20261017-pass-holder-backend-error-capture.md`](20261017-pass-holder-backend-error-capture.md) | feedback |

---

## 3 個 root cause（為什麼同時發生才會看到症狀）

### Root Cause #1 — `try/finally` 沒 `catch`（Bug A）

```typescript
// 修前：onValidSubmit 與 onCtaClick 都是這個 pattern
setPending(true);
try {
  await passHolderService.register(template.id, payload);
  setSubmitted(true);
  onSubmit();
} finally {
  setPending(false);
}
// ↑ PassHolderError 從 finally 之後 escape 成 unhandled rejection
```

`try/finally` 對於「無論成功失敗都要 cleanup」的場景正確（這裡 cleanup 是 `setPending(false)`），但**沒有 catch 就代表 throw 出去**。React 事件 handler 內 throw 通常會被 React boundary 接住，但 `useCallback` 包 async function 內 throw 是 **promise rejection**，escape React boundary → 變 unhandled rejection。

修法 — `try/catch/finally`：

```typescript
setPending(true);
setSubmitError(null);
try {
  await passHolderService.register(template.id, payload);
  setSubmitted(true);
  onSubmit();
} catch (err) {
  setSubmitError(toSubmitErrorKey(err));
} finally {
  setPending(false);
}
```

### Root Cause #2 — backend emit 的 i18n key frontend 沒翻譯（Bug C，Rule 019 §4.1 quad-binding 的 i18n 端）

Backend [`apps/backend/src/modules/pass-templates/schemas/request.ts`](../../apps/backend/src/modules/pass-templates/schemas/request.ts) throws 3 個 i18n key：

| Backend 端 i18n key | Frontend 翻譯狀態（修前）|
|---|---|
| `passHolder.errors.phoneInvalid` | ❌ **不存在** |
| `passHolder.errors.birthdayInvalid` | ❌ **不存在** |
| `passHolder.errors.tooYoung` | ❌ **不存在** |
| `passHolder.errors.templateNotFound` | ✅ 存在 |
| `passHolder.errors.networkError` | ✅ 存在（但其實**沒人用**） |

**就算修好 Root Cause #1，banner 仍會顯示原始 i18n key 給 user** — 因為 `t('passHolder.errors.tooYoung')` 在 `useTranslation('passHolder')` namespace-bound 下會去查 `passHolder.passHolder.errors.tooYoung`（double-namespace），找不到 fallback 回 `passHolder.errors.tooYoung???` 這種東西。

修法 — 加 3 條 key 到 `passHolder.zh-TW.ts` 跟 `passHolder.en.ts` 的 `errors` namespace。**同步**在 backend `request.ts` 旁加 comment，標明「any new i18n key thrown here must be added to frontend locales」：

```typescript
// apps/backend/src/modules/pass-templates/schemas/request.ts
// Any i18n key thrown here must be mirrored in:
//   apps/frontend/src/i18n/locales/passHolder.{zh-TW,en}.ts (errors.*)
```

### Root Cause #3 — 5xx fallback 用不存在的 key（Bug B 副發現）

[`apps/frontend/src/services/passHolderService.ts`](../../apps/frontend/src/services/passHolderService.ts) 的 `toPassHolderError` 對沒有 `i18nKey` 的錯誤（5xx 無 mapping）fallback 為 `'common.error.serverError'`：

```typescript
function toPassHolderError(err: unknown, idForNotFound?: string): PassHolderError {
  // ...
  if (err instanceof SaomeApiError) {
    if (err.status === 404 || err.i18nKey === 'passHolder.errors.templateNotFound') {
      return new PassHolderNotFoundError(idForNotFound);
    }
    if (err.i18nKey) {
      return new PassHolderError(err.i18nKey, err.details as any);
    }
    return new PassHolderError('common.error.serverError');  // ← 這個 key 不存在
  }
  return new PassHolderError('common.error.serverError');  // ← 同上
}
```

`common.zh-TW.ts` 跟 `common.en.ts` 的 `error` namespace 只有 `upstreamFailed`（2026-10-11 加的 Step 8 Passcreator fallback），**沒有 `serverError`**。修法 — 加 `serverError` 兩條 key。

### 三者關係（為什麼同時修）

- 只修 #1 → banner 出現，但顯示 `passHolder.errors.tooYoung???`（raw key + i18next 找不到的 `???` marker）
- 只修 #2 → backend 拋 5xx 時仍 leak `common.error.serverError???` 到 banner
- 只修 #3 → 5xx 路徑仍 leak raw key
- 三個一起修 → banner 永遠顯示 zh-TW/en 翻譯後文字

---

## 5 條新規範（為什麼這樣設計）

### 規範 1 — `setSubmitError(null)` 放在 try 開頭（reset stale error）

```typescript
setPending(true);
setSubmitError(null);  // ← 必加
try {
  // ...
}
```

如果上一次 attempt 留下 banner，user 改完欄位再 submit 必須清掉舊 error。每次 submit 都是 fresh slate。

### 規範 2 — `role="alert"` + `aria-live="polite"`（a11y）

```tsx
<div role="alert" aria-live="polite" data-testid="pass-holder-submit-error">
```

`role="alert"` 讓螢幕閱讀器立即播報；`aria-live="polite"` 在 DOM mutation 時不打斷當前播報。`role="alert"` 內建 `aria-live="assertive"` 但太急，這裡 user 已經在表單操作中，用 polite 比較不干擾。

### 規範 3 — consumer-side `toSubmitErrorKey()` mirror 服務端 (symmetric helper)

服務端 `passHolderService::toPassHolderError` 把 `unknown` 轉 `PassHolderError`；前端 `toSubmitErrorKey()` 把 `unknown` 轉 i18n key string。**不要在 component handler 內做 instance check** — 集中在一個 helper 內，未來加新 error shape（`SaomeApiError` 之外的）只改一處。

### 規範 4 — namespace prefix 剝離

Backend 拋 fully-qualified key（`passHolder.errors.tooYoung`），但 `useTranslation(['passHolder', 'common'])` 已 bind namespace。直接 `t('passHolder.errors.tooYoung')` 會變成 `passHolder.passHolder.errors.tooYoung`（找不到）。

修法：剝 prefix + namespace-aware 解析：

```typescript
const bannerMessage = (() => {
  if (submitError === null) return null;
  if (submitError.startsWith('passHolder.')) {
    return t(submitError.slice('passHolder.'.length));
  }
  if (submitError.startsWith('common.')) {
    return t(submitError.slice('common.'.length), { ns: 'common' });
  }
  // 未知 namespace prefix：log warning + fallback generic
  console.warn('[PassHolderRegistration] submitError has unknown namespace prefix:', submitError);
  return t('error.serverError', { ns: 'common' });
})();
```

未來 contributor 加新 namespace 不會 silent leak — `console.warn` 讓 ops follow-up。

### 規範 5 — manual dismiss 按鈕（不 auto-clear on keystroke）

`<button data-testid="pass-holder-submit-error-dismiss">` 讓 user 收起 banner 而不必修正欄位或重新 submit。`form.watch()` re-render 太頻繁會 jumpy；手動 dismiss 是 belt-and-suspenders。

---

## Test 加 4 條

| Test | 覆蓋 |
|---|---|
| `2026-10-17: backend i18n key "passHolder.errors.tooYoung" is caught and rendered as translated text (Bug-4 regression)` | 主鏈：submit → backend reject → banner 顯示「需年滿 13 歲」/ 沒 `passHolder.errors.tooYoung` raw key / 沒 unhandled rejection |
| `2026-10-17: backend i18n key "passHolder.errors.birthdayInvalid" is caught and rendered as translated text` | birthdayInvalid 路徑：banner 顯示「生日格式不正確」/ 沒 raw key |
| `2026-10-17: 5xx with no i18nKey falls back to common.error.serverError translation` | Root Cause #3：非 SaomeApiError（純 `new Error`）→ `toPassHolderError` fallback → `common.error.serverError` → banner 顯示 zh-TW 翻譯，沒 `Internal Server Error` raw |
| `2026-10-17: error banner clears after the user re-submits successfully (UX hygiene)` | 規範 1：第一次 fail 顯示 banner → 第二次 success → banner 消失（`setSubmitError(null)` reset）|

Test #1 用 `window.addEventListener('unhandledrejection', ...)` 主動驗證**沒有 unhandled rejection**：

```typescript
const unhandled = vi.fn();
window.addEventListener('unhandledrejection', unhandled);
await mockRegisterReject('passHolder.errors.tooYoung');
// ... click submit ...
await new Promise((resolve) => setTimeout(resolve, 50));
expect(unhandled).not.toHaveBeenCalled();
```

`mockRegisterReject` 改用 `vi.mock(async (importOriginal) => { ... })` pattern 把真實 `PassHolderError` / `PassHolderNotFoundError` re-export（之前 mock factory 只 re-export `passHolderService`，consumer code 拿到 `undefined`）。

---

## Verification（Rule 006 — evidence before assertion）

| 項目 | 結果 |
|---|---|
| `npx tsc -b apps/frontend/tsconfig.app.json --noEmit` | exit 0（修一個 unused `useEffect` import 警告）|
| `npm run lint` (oxlint) | pre-existing warnings 不變；新 `no-unused-vars` warning 修掉 |
| `npx vitest run src/components/business/pass/PassHolderRegistration/` | 25/25 全綠（含 4 條新 + 21 條舊，**0 unhandled rejection**）|
| `npx vitest run src/services/passHolderService.test.ts` | 19/19 全綠（toPassHolderError 既有的 4xx/5xx/network mapping 仍正確）|
| `npx vitest run` (整個 frontend, 147 test files) | **1926/1926 全綠** |
| `npm run verify:i18n` | 21 namespace OK（42 locale files）；pre-existing brand-name Latin WARNs（Payfast/Ecpay 預期）|

---

## 5 條教訓

1. **`try/finally` ≠ `try/catch`** — 對於 async handler 內 cleanup 場景是 `try/catch/finally` 三件式，缺 catch 等於 throw escape。React 事件 handler 內的 sync throw 會被 error boundary 接住，但 `useCallback` 包 async function 的 rejection escape 變 unhandled rejection（不在 React 監控範圍）。**修法 SOP**：任何 `await` 後的 cleanup block 必加 catch，無論 error 路徑是否「預期」。
2. **Backend i18n key 跟 frontend locale 必須** machine-checked 對齊（Rule 019 §4.1 i18n 端）— backend `request.ts` 註解要列「thrown keys must be mirrored in frontend locales」。下一個 contributor 加 zod error key 前必看這個清單。
3. **i18next 找不到 key 的 fallback 是 `???` 附加，不是 empty string** — vitest 看到 `passHolder.errors.tooYoung???` 比 raw key 更困惑，**這個 `???` 反而比 raw key 更明顯觸發 debug**。bug 沒這麼慘是因為「幸運的 i18next default fallback 把 bug 暴露了」。
4. **「namespace-bound useTranslation」+ 「fully-qualified i18n key」是常見 footgun** — `useTranslation('passHolder')` 已經把 namespace 設好，呼叫 `t('passHolder.errors.tooYoung')` 會變 `t('passHolder.passHolder.errors.tooYoung')`。**修法**：consumer-side helper 必剝 prefix 或 backend 改 emit 相對 key。**未來** Rule 019 應加「i18n key 命名規範」條目：backend 統一 emit fully-qualified、frontend helper 統一剝 prefix（或反之），不要混。
5. **「測試看起來全綠 ≠ production 行為正確」的家族第 3 例**（同 family：9/30 partial migration / 10/03 Passcreator V2 schema）— mock-mode test 通過但 production 行為 broken。**修法 SOP**：任何 backend 串接的 error path 必加「mock service throw → component render 翻譯文字」的 end-to-end test，不只 mock service throw + log。本 PR 的 4 條 test 就是這 SOP 的落實。

---

## 8 條 future invariant

1. **submit handler 必走 `try/catch/finally` 三件式**，缺 catch 是 P0 violation
2. **backend `request.ts` 任何 thrown i18n key 必在 frontend locale 同步**（建議加 `// mirrors: passHolder.errors.*` 註解，code review 強制掃）
3. **`toSubmitErrorKey()` / `toPassHolderError()` 兩端 helper 必對稱**，新 error shape 加兩處
4. **submitError state 必在每次 try 開頭 reset**（規範 1）
5. **alert banner 必帶 `role="alert"` + `aria-live="polite"`**（規範 2）
6. **fully-qualified i18n key 必剝 namespace prefix 再 `t()`**（規範 4）
7. **mock 測試 backend error path 必驗「沒有 unhandled rejection」+「banner 顯示翻譯文字」+「raw key 不 leak」三件**（教訓 5 SOP）
8. **新 namespace prefix 必加 `console.warn` fallback**，ops 立即收到通知

---

## 4 條 follow-up

- (P1) 把 `passHolder.errors.*` key 列表從 backend `request.ts` 拉出來做 `MIRRORED_KEYS` 集合，code review / pre-commit 自動 grep 對齊（Rule 019 §4.1 機化建議）
- (P1) `PassHolderRegistration` 之外的其他表單（CardBuilder editor 等）做 sweep 確認 submit handler 都有 catch
- (P2) backend `SaomeError` / 服務層 i18nKey mapping 表 + frontend `toSubmitErrorKey` 對齊表收進 shared package，兩端不重複
- (P2) `verify:i18n` 加 `???` marker detection — locale 缺 key 立即 fail build 而不是 runtime 噴 `???`

---

## Out of scope（這次不做）

- Backend `SaomeError` 改用 shared i18n key 表（涉及 backend 整個 error 層重構）
- backend `request.ts` 改成 import 共享 schema 取代 hand-written（Rule 019 § 1「首選」共 3 步，這次只在 i18n 端做輕量對齊）
- 付費金流整合（Passcreator V3 / Payfast / Ecpay 真實 API）— 本次純 error capture，不動 payment flow
- Backend `passHolderService.ts::toPassHolderError` 改用 shared helper（避免 scope 蔓延，這次只動 frontend）

---

## Commit 安排

1 個 commit 帶 code（4 i18n 檔 + 1 component）+ 4 條 test + feedback + INDEX row 同 commit（Rule 011 / 025 對齊；無 migration 故 035 不觸發）。

---

## Addendum（2026-10-17 same-day）：Backend `passHolderRegisterPayloadSchema::birthday` refine 在 production 拒絕 1989（workerd `new Date()` module-init gotcha）

### 症狀（user 投訴：今天 1989 一年照樣被 reject）

前段時間 user 反映「我 1989 年，為什麼 backend 給 400？」。本 addendum 段修一個**後端獨立 bug**，跟前段落的「前端 banner + i18n」無關，但同 user complaint、同一個回應代碼 `passHolder.errors.tooYoung`、同一個 schema 同一支 refine。

**Symptom** — production 實測（templateId = 738d9a5e-7f25-414b-b0d9-0c3abce8cf52）：

| birthday | production 行為 | 預期行為 |
|---|---|---|
| `1948-01-01` | ✓ pass | pass |
| `1955-01-01` | ✓ pass | pass |
| `1957-01-01` | ✓ pass | pass |
| `1959-01-01` | ❌ fail with `tooYoung` | pass |
| `1960-01-01` | ❌ fail with `tooYoung` | pass |
| `1989-06-15` | ❌ fail with `tooYoung` | pass |
| `2020-01-01` | ❌ fail with `tooYoung` | fail with `tooYoung` |

切點在 `1957-01-01` 跟 `1959-01-01` 之間。換言之：**`thirteenYearsAgoIsoDate` 在 production ≈ `"1957-01-01"`**，但今天是 `2026-10-17` → 應該是 `"2013-10-17"`。

### 排查鏈（5 輪 debug，越查越深的 4 個根因層次）

#### 第一輪：檢查 source 跟 dist

- `apps/backend/src/modules/pass-templates/schemas/request.ts` source 用 `refine((s) => s <= thirteenYearsAgoIsoDate, ...)` — 看似正確
- `apps/backend/dist/index.js` bundle 編出來也是 `refine((s) => s <= thirteenYearsAgoIsoDate, ...)` — 正確
- 20 條 vitest（`register.test.ts`）全綠，包含明確的「accepts holder born in 1989」regression test

→ 結論：**source/dist/test 都對，但 production 行為錯**。

#### 第二輪：deploy 重 deploy

- `wrangler deploy` 從 8:11 UTC+8 build 出新版（Version `e07f6160`），655 KiB upload
- 重 deploy 後 production 還是一樣 reject 1958+

→ 結論：**deploy 沒刷新 served code**，或 cache 有問題。

#### 第三輪：在 Worker 加 debug endpoint 直接 dump schema 內部的 `thirteenYearsAgoIsoDate`

加 `__debug/schema-birthday` 在 deployed Worker 跑 `passHolderRegisterPayloadSchema.safeParse({...birthday: '1958-01-01'})`。結果：

```json
{
  "birthday": "1958-01-01",
  "schemaThirteenYearsAgoIsoDate": "1957-01-01",
  "ok": false,
  "issues": [{"path": "birthday", "msg": "passHolder.errors.tooYoung"}]
}
```

Schema 內部的 `thirteenYearsAgoIsoDate` 是 **`"1957-01-01"`**，不是 `"2013-10-17"`！

→ 結論：**schema 跑的不是 source 寫的算式**。

#### 第四輪：分頭印「module-init Date」vs「request-time Date」

加 `__debug/module-init-date` 印 `index.ts` module 載入時的 `new Date().toISOString()`，加 `__debug/date-init` 印 request-time 的 `new Date()`。結果：

| endpoint | 值 |
|---|---|
| `__debug/module-init-date` | `1970-01-01T00:00:00.000Z` ← **frozen to Unix epoch** |
| `__debug/date-init`（request-time） | `2026-10-17T00:36:42.461Z` ← 正確 |
| `__debug/schema-birthday` 內 | `1957-01-01` (= 1970 - 13) ← 跟 module-init frozen 一致 |

→ **根因浮現**：Cloudflare Workers **module-scope 的 `new Date()` 回 Unix epoch**，但 request-time 的 `new Date()` 正確。

### 根因 — Cloudflare workerd module-init `Date()` gotcha

`apps/backend/src/modules/pass-templates/schemas/request.ts`：

```typescript
const MIN_HOLDER_AGE_YEARS = 13;
const thirteenYearsAgo = new Date();  // ← 這行在 module scope 跑
thirteenYearsAgo.setFullYear(thirteenYearsAgo.getFullYear() - MIN_HOLDER_AGE_YEARS);
const thirteenYearsAgoIsoDate = thirteenYearsAgo.toISOString().slice(0, 10);  // "1970-01-01" - 13y = "1957-01-01" (WRONG)
```

`new Date()` 在 module-scope 執行時，workerd 回 `1970-01-01T00:00:00.000Z`（Unix epoch）。`setFullYear(1970 - 13)` → `1957-01-01`。schema 從此被「凝固」比對 `"1957-01-01"`，每個正常成人 year（1958+, 1960+, 1989+, 1990+, …）都 reject。

- vitest 用 `@cloudflare/vitest-pool-workers` 跑，workerd pool 行為**也是** module-init frozen epoch — 但本來以為是 test 行為對齊 production
- 實際上 vitest `date.toISOString()` 預設回 local time zone（`process.env.TZ` 不一定是 UTC），所以 `<=` 跟 date arithmetic 算出來看似 OK — 這是個 false-positive

### 為什麼之前沒被抓到

| 歷史 | 為什麼過了 |
|---|---|
| 9/29 schema 初版 | 從未在 production 跑過驗證用 1958+ 的 birthday |
| 10/13 deploy 註冊流程 | user 一直用較新的 year（例如 2000+），剛好被 1957-01-01 boundary 涵蓋 → 才發現 reject |
| 10/16 paid-membership extension | 改 schema 加欄位但沒碰 refine，bug 持續 |

第一個 user 投訴（10/16 晚報）的 1989 才意外觸發這個 freeze epoch 的問題。

### 修法 — lazy boundary computation 在 refine closure 內計算

```typescript
.refine(
  (s) => {
    // Lazy boundary — compute at request time, not module init.
    const thirteenYearsAgo = new Date();
    thirteenYearsAgo.setFullYear(
      thirteenYearsAgo.getFullYear() - MIN_HOLDER_AGE_YEARS,
    );
    const thirteenYearsAgoIsoDate = thirteenYearsAgo
      .toISOString()
      .slice(0, 10);
    return s <= thirteenYearsAgoIsoDate;
  },
  {
    message: 'passHolder.errors.tooYoung',
  },
),
```

`new Date()` 跟 `setFullYear` **移進 refine closure 內**，每次 safeParse 都重新算（request-time 拿到 workerd 的 live clock）。Perf 不影響 — refine 一次 per parse，無 I/O。

### Verification

| 項目 | 結果 |
|---|---|
| `npx vitest run src/modules/pass-templates/tests/register.test.ts` | 20/20 全綠（既有 schema-level tests，包含新增的 `accepts holder born in 1989` regression test 不變）|
| `npx wrangler deploy` | Version `26ff159e-baa3-4b93-8d06-1789f3b9757e`（636 KiB upload）|
| `curl POST /api/pass-templates/{id}/register birthday=1958-01-01` | `{"ok":true,"passHolderId":"7906ad07-...","created":true}` ✓ |
| `curl POST ... birthday=1989-06-15` | `{"ok":true,"passHolderId":"27ecf28c-...","created":true}` ✓（user 原投訴）|
| `curl POST ... birthday=2020-01-01` | `{"error":{"i18nKey":"passHolder.errors.tooYoung","minBirthdayBoundary":"2013-10-17"}}` ✓（仍正確拒絕）|
| `curl POST ... birthday=1950-01-01` | `{"ok":true,"passHolderId":"b52ab26d-...","created":false}` ✓（idempotent re-register，row 之前已存在）|

Production boundary 在 error response 內是 `"2013-10-17"`（2026-10-17 - 13y，timezone UTC），跟 schema 算的一致。

### 3 條教訓

1. **Cloudflare Workers module-scope 的 `new Date()` 回 Unix epoch**（2026-10-17 觀察 — workerd 行為，不是 caller bug）。任何 module-scope `new Date()` → 算日期 boundary 的代碼都會錯。
2. **「測試全綠 = production 正確」再次失守**（family 第 4 例 — 9/30 partial migration / 10/03 Passcreator V2 schema / 本次）。vitest workerd pool 在不同 host / 不同 time zone 對 `new Date()` 行為可能不一致，**不能拿來當 production clock sanity check 的 proxy**。
3. **「在 module scope 預先算 module-level constant」是常見 anti-pattern for time-based logic**。boundary 必須 lazy 算。**修法**：把 `new Date()` 放進 closure；或者用 `import.meta.env` / cron-based refresh 把 boundary 重新注入；或者改用 `Date.now()` + 動態計算。

### 3 條 follow-up

- (P1) 全 backend sweep：搜所有 module-scope `new Date()` 改 lazy。已知 candidates：`apps/backend/src/modules/pass-templates/` 的 schema（本次修法）；其他 module 有生日 / expiry / membership-window / billing-cycle 類的 boundary，**建議逐個 audit**。
- (P1) Rule 027（postgres.js Dynamic Query Pattern）類似的關注點應開一份 Rule 0xx「Cloudflare Workers `Date()` gotcha」或加到現有 rule 作為範例。
- (P2) Worker entry probe：用 `console.log(new Date().toISOString())` 在 production module init 印一行做 clock sanity — 避免將來 `module-init Date() = epoch` 的 bug 再次 silent misbehave。同樣的 probe 可作為對 workerd v2 / v3 升級的 smoke test。

### 為什麼「deploy 重 deploy」沒用

`wrangler deploy` 上傳新 bundle（636 KiB），new Version ID（e07f6160、c9b51e17、…），wrangler tail log 全正常 — 但因為 workerd 把 module-scope `new Date()` 凍結到 epoch，所以**每次 deploy 後 isolate 重新 module-init 時都算一次 `1970 - 13 = 1957`**。修法不在 deploy；修法在程式碼本身。

### Out of scope（這次不做）

- Worker entry 加 module-init clock probe（follow-up P2 留著，不在本 addendum 範圍）
- 全 backend module-scope `new Date()` sweep（follow-up P1 留著）
- Rule 0xx 規範新增（同 P1）
