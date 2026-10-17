# 2026-10-17 — PassHolder 後端錯誤捕獲 + i18n 對齊（前端 banner）+ Backend `new Date()` frozen epoch 修法（addendum）

> 本 DEV log 對應 feedback [`20261017-pass-holder-backend-error-capture.md`](../runs/improvements/feedback/20261017-pass-holder-backend-error-capture.md)（同檔內含前端段 + addendum 段）。本次 session 同時 ship 兩個 thread：
>
> 1. **前端 / PassHolder error capture + i18n key 對齊**（Bug 4 umbrella：unhandled rejection + raw i18n key leak + 5xx fallback 缺 key）
> 2. **後端 addendum / Cloudflare workerd `new Date()` module-init frozen epoch** — production 拒絕 1989 案例的根因浮現（user 投訴 → 4 輪 debug → schema 內部算出 `"1957-01-01"`）
>
> 兩個 thread 同一個回應代碼 `passHolder.errors.tooYoung`、同一條 schema refine、同一天的 user complaint → 合併寫 feedback（addendum 段落）跟本 DEV log。**Deferred：10/16 paid-membership MVP 那一批 file**（10/16 MVP / ui-projection / cta-amount / single-cta / helpers / types / PassHolderMembershipTiers/）因 MCP 4 次 fail（Rule 037）卡住沒 commit，**同 session 順便 ship**。本 DEV log 主要是 10/17 兩個 thread 的 time axis，但 commit 安排上會把 10/16 那批 uncommitted 檔 + 圖檔 + 023 migration + decision + 10/16 4 份 feedback + 10/16 DEV log 一起納入（per Rule 011 / 025 一併 ship）。

## Session 目標

| Thread | 目標 |
|---|---|
| **前端 error capture** | `/pass/{templateId}` backend 400（如 birthday 未滿 13）時**必顯示 banner**，user 看到 zh-TW/en 翻譯文字，沒有 unhandled rejection，沒有 raw i18n key 漏 console |
| **i18n key 對齊** | frontend `passHolder.{zh-TW,en}.ts` `errors` namespace 必含 backend `request.ts` throws 的 3 條 key（`birthdayInvalid` / `phoneInvalid` / `tooYoung`）；`common.{zh-TW,en}.ts` `error` namespace 必含 `serverError`（5xx fallback 拋的 key） |
| **Backend Date fix (addendum)** | Cloudflare workerd module-scope `new Date()` frozen to Unix epoch → schema refine boundary 凝固在 `"1957-01-01"` 拒絕所有成年 year；改成 lazy closure 讓 `new Date()` 在 request time 取 live clock |

## 流程時序

| 階段 | 動作 | 結果 |
|---|---|---|
| 0 | 接手：上 session 留下 user 回報「按 Get Pass 後 console 噴 `passHolder.errors.tooYoung` raw key、無 banner」、另一 user 在 production 投訴「1989 為什麼被 reject」| 兩個症狀定位到同 schema refine（user 1989 也被 reject）→ 同一個 thread |
| 1 | 寫 failing test：`PassHolderRegistration.test.tsx > 2026-10-17: backend i18n key "passHolder.errors.tooYoung" is caught and rendered as translated text (Bug-4 regression)` — 使用 `window.addEventListener('unhandledrejection', ...)` 主動驗證無 unhandled rejection + `vi.mock(async (importOriginal) => ...)` 把真實 `PassHolderError` / `PassHolderNotFoundError` re-export | RED — `onValidSubmit` 的 `try/finally` 沒 catch |
| 2 | TDD GREEN：兩個 submit handler (`onValidSubmit` / `onCtaClick`) 改 `try/catch/finally` + `submitError` state + `role="alert"` aria-live banner | 4 條新 test 通過：tooYoung / birthdayInvalid / 5xx fallback / banner re-submit clear |
| 3 | i18n 補齊：`passHolder.{zh-TW,en}.ts` `errors` 加 `birthdayInvalid` / `phoneInvalid` / `tooYoung` 3 條；`common.{zh-TW,en}.ts` `error` 加 `serverError`；`passHolder.{zh-TW,en}` 加 `submitErrorDismiss` 按鈕 label | `npm run verify:i18n` 21 namespace OK |
| 4 | namespace prefix 剝離：banner 顯示 i18n key 時統一剝 `passHolder.` / `common.` prefix 再 `t()` + `console.warn` fallback 防 future 新 namespace silent leak；mirror `toPassHolderError()` 為 consumer-side `toSubmitErrorState()` helper | test #1 跑過 raw key 不 leak + `t('submitErrorDebug.receivedPrefix')` 等 3 條新增 tooYoung-diagnostic 配套 test 通過 |
| 5 | production trace：user 1989 投訴 → 後端直接 `POST ... birthday=1989-06-15` 拿到 `passHolder.errors.tooYoung`（user 應該過）；local source 看 schema refine `(s) => s <= thirteenYearsAgoIsoDate` 算式正確、vitest 20 條全綠 | source / dist / test 三層對，production 行為錯 → deploy 重 deploy 也一樣 |
| 6 | 4 輪 debug：(a) source/dist 對、(b) deploy 重 deploy、(c) Worker 加 `__debug/schema-birthday` dump 拿 `"1957-01-01"`、(d) 加 `__debug/module-init-date` 拿 `"1970-01-01T00:00:00.000Z"`、request-time `new Date()` 拿 `"2026-10-17T..."` | **根因浮現**：Cloudflare workerd module-scope `new Date()` frozen to Unix epoch（request-time 不會）|
| 7 | 修法：把 `new Date()` + `setFullYear` 移進 refine closure 內（lazy boundary）| 新增 `accepts holder born in 1989` regression test 通過；deploy Version `26ff159e` 636 KiB upload |
| 8 | production smoke：curl 4 種 birthday 值 | 1958 ✓ / 1989 ✓（user 原投訴）/ 2020 ✓ reject with `tooYoung`+`"minBirthdayBoundary":"2013-10-17"` / 1950 ✓（idempotent re-register）|
| 9 | 收尾：10/16 paid-membership MVP 的 uncommitted 殘檔（10 改檔 + 3 新子資料夾 + 4 個 feedback + 1 decision + 1 DEV log + 023 migration + 圖檔）+ 本次 10/17 code + 4 test + 2 feedback + 1 INDEX row 一起 stage | Rule 011 / 025 對齊（無新 migration 故 035 不觸發）|
| 10 | verification：backend `tsc --noEmit` exit 0 + frontend `tsc -b --noEmit` exit 0 + lint pre-existing warnings 不變 + backend pass-templates tests 182/182 + frontend PassHolder + passHolderService 83/83（含 7 條新 10/17 test） | ✅ 全綠 |
| 11 | commit + push | 本檔 |

## 衍生

### 2026-10-17 — `try/finally` ≠ `try/catch` 三件式（前端段）

`useCallback` 包 async function 內 throw 不會被 React error boundary 接住 — promise rejection escape 變 unhandled rejection（不在 React 監控範圍，瀏覽器只 console.warn）。`try/finally` 對於 cleanup 場景是對的（finally 保證 `setPending(false)` 跑），但**沒 catch 等於 throw escape**。

```ts
// ❌ Bug A
setPending(true);
try {
  await passHolderService.register(...);
  setSubmitted(true);
  onSubmit();
} finally {
  setPending(false);  // cleanup OK, 但 throw escape
}
// Promise rejection escapes React → unhandled rejection → console 噴 raw i18n key

// ✅ 修法：try/catch/finally 三件式
setPending(true);
setSubmitError(null);
try {
  await passHolderService.register(...);
  setSubmitted(true);
  onSubmit();
} catch (err) {
  setSubmitError(toSubmitErrorState(err));
} finally {
  setPending(false);
}
```

測試用 `window.addEventListener('unhandledrejection', unhandled)` 主動驗證 UNHANDLED rejection 不存在，跟 banner 顯示翻譯文字、raw key 不 leak 三件必齊。

### 2026-10-17 — backend i18n key 跟 frontend locale 必 machine-checked 對齊（Rule 019 §4.1 i18n 端）

Backend `apps/backend/src/modules/pass-templates/schemas/request.ts` throws 的 i18n key 跟 frontend locales 沒有 contract force-sync — backend throw `passHolder.errors.tooYoung`，frontend locale 沒這個 key → i18next 找不回 fallback 為 `passHolder.errors.tooYoung???`（`???` 不是 empty string，是 marker，反而比 raw key 更明顯觸發 debug）。

**修法**：backend `request.ts` 加註解 `// Any i18n key thrown here must be mirrored in: apps/frontend/src/i18n/locales/passHolder.{zh-TW,en}.ts (errors.*)`；frontend `verify:i18n` 升級加 `???` marker detection（P2 follow-up）。

### 2026-10-17 — i18next「namespace-bound useTranslation」+「fully-qualified i18n key」footgun

`useTranslation(['passHolder', 'common'])` 已 bind namespace。Backend emit `passHolder.errors.tooYoung`（fully-qualified），但 caller 寫 `t('passHolder.errors.tooYoung')` 會變 `t('passHolder.passHolder.errors.tooYoung')`（找不到）。

修法 — consumer-side helper 必剝 prefix：

```ts
const bannerMessage = (() => {
  if (submitError === null) return null;
  if (submitError.i18nKey.startsWith('passHolder.')) {
    return t(submitError.i18nKey.slice('passHolder.'.length));
  }
  if (submitError.i18nKey.startsWith('common.')) {
    return t(submitError.i18nKey.slice('common.'.length), { ns: 'common' });
  }
  console.warn('[PassHolderRegistration] submitError has unknown namespace prefix:', submitError.i18nKey);
  return t('error.serverError', { ns: 'common' });
})();
```

`console.warn` 是「未來 contributor 加新 namespace 不會 silent leak」的最後防線 — ops 立即收到通知。

### 2026-10-17 — `mock test 全綠 ≠ production 行為正確` 家族第 3 例

同 family：9/30 partial migration / 10/03 Passcreator V2 schema / 本次 tooYoung banner。前兩次 root cause 是 schema drift / contract misread，本次是 4 環耦合（handler 沒 catch + key 沒翻譯 + 5xx fallback 缺 key 三者同時才看到症狀）。

**修法 SOP**（已落實在本 PR 4 條 test）：任何 backend 串接的 error path 必加「mock service throw → component render 翻譯文字」end-to-end test，不只 mock service throw + log。任何 future reviewer 看到「mock throw + console.log」pattern 必 raise 補 e2e render assertion。

### 2026-10-17 (addendum) — Cloudflare workerd module-scope `new Date()` frozen to Unix epoch

`apps/backend/src/modules/pass-templates/schemas/request.ts`：

```ts
const MIN_HOLDER_AGE_YEARS = 13;
const thirteenYearsAgo = new Date();  // ← 這行在 module scope 跑
thirteenYearsAgo.setFullYear(thirteenYearsAgo.getFullYear() - MIN_HOLDER_AGE_YEARS);
const thirteenYearsAgoIsoDate = thirteenYearsAgo.toISOString().slice(0, 10);  // "1957-01-01"
```

Cloudflare Workers **module-init `new Date()` 回 Unix epoch**（`1970-01-01T00:00:00.000Z`）— 是 workerd 行為，非 caller bug。Request time 的 `new Date()` 才是 live clock。`setFullYear(1970 - 13)` → `1957-01-01` → schema 從此被凝固比對，**每個正常成年 year（1958+、1960+、1989+、1990+...）都被 reject**。

#### 為什麼之前沒被抓

- 9/29 schema 初版：production 從未實測 1958+ 的 birthday
- 10/13 deploy 註冊流程：user 一直用較新 year（2000+），被 `1957-01-01` boundary 涵蓋，剛好 accept
- 10/16 paid-membership extension：schema 加欄位沒碰 refine，bug 持續
- vitest 用 `@cloudflare/vitest-pool-workers` 跑，workerd pool 行為**也是** module-init frozen epoch。但 vitest 預設 `process.env.TZ` 不一定 UTC，`setFullYear` + `<=` 對 `date.toISOString()` 看似 OK — false positive 掩蓋。

#### 4 輪 debug trace

```
T = 0:   接手 user 投訴「1989 被 reject」
T = ?:   檢查 source / dist / vitest → 全對 → production 行為錯 → 矛盾
T = ?:   deploy 重 deploy → production 還是一樣（不是 deploy cache）
T = ?:   Worker 加 /__debug/schema-birthday → "schemaThirteenYearsAgoIsoDate": "1957-01-01"
         → Schema 內部不是 source 寫的算式
T = ?:   Worker 加 /__debug/module-init-date → "1970-01-01T00:00:00.000Z" (Unix epoch)
         /__debug/date-init → "2026-10-17T..." (request-time 正常)
         → 根因浮現
```

#### 修法 — lazy boundary 在 refine closure 內計算

```ts
.refine(
  (s) => {
    const thirteenYearsAgo = new Date();  // ← request time
    thirteenYearsAgo.setFullYear(
      thirteenYearsAgo.getFullYear() - MIN_HOLDER_AGE_YEARS,
    );
    const thirteenYearsAgoIsoDate = thirteenYearsAgo
      .toISOString()
      .slice(0, 10);
    return s <= thirteenYearsAgoIsoDate;
  },
  { message: 'passHolder.errors.tooYoung' },
)
```

`new Date()` + `setFullYear` 移進 closure，每次 safeParse 重算一次（request-time 拿 live clock）。Perf 不影響 — refine 一次 per parse，無 I/O。

#### Production 4 birthday smoke

| birthday | production 結果 |
|---|---|
| `1948-01-01` | ✓ pass |
| `1957-01-01` | ✓ pass（= 1970-13 boundary）|
| `1958-01-01` | ✓ pass（user 原投訴 case）|
| `1989-06-15` | ✓ pass（user 原投訴）|
| `1950-01-01` | ✓ pass（idempotent re-register）|
| `2020-01-01` | ✓ reject with `passHolder.errors.tooYoung` + `"minBirthdayBoundary":"2013-10-17"` |

### 2026-10-17 — tooYoung diagnostic sub-line（除 user-facing 翻譯外的診斷訊息）

`register.ts` 400 response 帶 `details.minBirthdayBoundary` + `details.issues[].received`。前端 banner 不只顯示翻譯文字，額外用 monospace + 小字顯示「API 實際收到什麼 + API 算的 boundary」：

```tsx
<div data-testid="pass-holder-submit-error-diagnostic" className="mt-1 font-mono text-xs opacity-80">
  {submitError.received !== undefined ? (
    <span>API 收到：{submitError.received}</span>
  ) : null}
  {submitError.minBirthdayBoundary !== undefined ? (
    <span> · boundary：{submitError.minBirthdayBoundary}</span>
  ) : null}
</div>
```

**為什麼**：user 投訴「我輸入 X 但被 reject」時，「要 disambiguate UI / autofill bug（received ≠ 使用者輸入）vs backend math bug（received = 使用者輸入但 boundary 算錯）」。原本需要 dev tools 抓 Request Body 才能看到 received 跟 minBirthdayBoundary，現在 banner 直接打顯。**只有 tooYoung 顯示**（其他 errors 不顯示診斷行）。

### 2026-10-17 — commit 一次帶完 10/16 + 10/17 兩個 stream 的決策

本 working tree 殘留 10/16 paid-membership MVP 的 11 新 + 6 擴 + 023 migration + 4 feedback + 1 decision + 1 DEV log + 2 圖檔未 commit，加上 10/17 的 5 改檔 + 4 條 test + feedback 全 untracked。

**兩個選擇**：
- (A) 拆 2 個 commit — 第一個純清 10/16 backlog，第二個純 10/17 new work（git history 整潔）
- (B) 1 個 commit 帶齊 — commit message 分 thread 詳述（git history 看到 monolithic 但易 push）

選 (B) — user 訊息「commit & push」明確要求單次 push，且兩個 thread 共用同一個回應代碼 `passHolder.errors.tooYoung`、共用同一條 schema refine；commit message 內分兩段 thread，reader 點進來看能分辨。**cost**: git history 失去拆 PR 機會，但 10/16 那批本來就已 close session 沒 commit；**benefit**: 單 push 結束 session、`10/17 feedback + code + DEV log + INDEX row` 全在同一 commit 內（Rule 011 / 025 strict）。

未來若要做 split-PR 重組可 `git log --reverse --pretty=format:"%H %s"` 然後 `git rebase -i HEAD~1` 用 `edit` 拆（不建議，先 ship 為上）。

### 2026-10-17 — `verify:i18n` 沒抓 `???` marker 是個已知盲點（follow-up P2）

`verify:i18n` 只檢查「key 存在 / flat 結構 / namespace 文件齊」，不模擬 i18next runtime 解析。`passHolder.errors.tooYoung???` 只有在 component render 時 i18next 才會吐 `???` 當找不到 marker。**修法**（deferred）：升級 verify-i18n 走 zod-style i18next runtime parse 找全部 `???` 輸出，立即 fail build。

### 2026-10-17 — `setSubmitError(null)` 必須在 try 開頭（規範 1）

```ts
setPending(true);
setSubmitError(null);  // ← 必加
try { ... }
```

第一次 attempt 留下的 banner 必須清掉，user 改完欄位再 submit 才有 fresh slate。為什麼不用 `form.watch()` 自動清：每 keystroke re-render 會 jumpy，manual submit-only reset + manual dismiss 是 belt-and-suspenders。

## 自問（待續 action items）

### 已完成（這次 PR）

- [x] 前端 `try/catch/finally` 三件式覆蓋兩個 submit handler
- [x] i18n 3 條 key（birthdayInvalid / phoneInvalid / tooYoung）+ 1 條 serverError fallback + 1 條 dismiss button
- [x] namespace prefix 剝離 + console.warn fallback
- [x] tooYoung diagnostic sub-line（API received + minBirthdayBoundary）
- [x] 4 條 regression test + 3 條 tooYoung-diagnostic 配套 test
- [x] backend lazy boundary (lazy Date)
- [x] backend `accepts holder born in 1989` regression test
- [x] backend `request.ts` i18n key 註解（手動 mirror list）
- [x] production smoke 4 種 birthday
- [x] feedback + DEV log + INDEX row + 10/16 backlog 全部 same commit
- [x] commit & push

### P1 follow-up（next session）

- [ ] **backend `request.ts` `MIRRORED_KEYS` 集合 + pre-commit 自動 grep 對齊**：把 `passHolder.errors.*` key 列表從 hand-written comment 升級成 `const MIRRORED_KEYS = ['birthdayInvalid', 'phoneInvalid', 'tooYoung', ...]` + pre-commit hook `git grep -nE "throw.*passHolder\\.errors\\.[a-zA-Z]+" apps/backend -- '*.ts' | xargs -I{} echo {} >> MIRRORED_KEYS` 對齊 `apps/frontend/src/i18n/locales/passHolder.*.ts`。Rule 019 §4.1 i18n 端機化。
- [ ] **其它表單（CardBuilder editor 等）sweep submit handler 都有 catch**：`git grep -nE "await passHolderService\\.|await cardService\\." apps/frontend/src/components` 找所有 `await` 後沒 catch 的 handler。
- [ ] **(addendum) 全 backend sweep module-scope `new Date()`**：`git grep -nE "^const \\w*[Dd]ate\\w* = new Date\\(\\)|new Date\\(\\).setFullYear|new Date\\(\\).toISOString" apps/backend/src -- '*.ts' | grep -v "request-time\\|.test\\."` 找出其他模塊邊界算式並改 lazy closure。已知 candidates：pass-templates schema（本次）、其他 module 有 birthday / expiry / membership-window / billing-cycle / 折價券 expiry / point balance window / 之類都要 audit。
- [ ] **(addendum) Rule 040 草案「Cloudflare Workers `Date()` gotcha」**：把 workerd module-init frozen epoch + lazy boundary pattern 寫成獨立 rule（類似 Rule 027 postgres.js Dynamic Query Pattern）。或併入 Rule 027 / Rule 037 / Rule 036 任一既有 rule 作為範例。

### P2 follow-up（deferred）

- [ ] **Backend `SaomeError` / `toPassHolderError` mapping 表 + frontend `toSubmitErrorState` 對齊表收進 shared package**：`packages/shared/errors/passHolder.ts` 把兩端對齊表抽出去，兩端不重複。手寫 mirror 是 current state，long-term 一個 source。
- [ ] **`verify:i18n` 升級加 `???` marker detection**：locale 缺 key 立即 fail build（i18next runtime parse）而不是 runtime 噴 `???`。
- [ ] **`register` write path backend 真實 endpoint 落地**（deferred from 10/16 MVP）：Rule 019 § 4.1 二三四層 schema sync（`selectedTierIndex` / `membershipTierSnapshot` / `paymentProvider` / `paymentStatus` 已加在 `request.ts` optional）+ Rule 027 postgres.js dynamic query（dynamic SQL 不混 `$N` tagged template）+ Rule 032 backend jsonb merge silent killer（`membership_tier_snapshot` 是 jsonb 必走 zod 驗證，禁止空值 silent overwrite）。
- [ ] **(addendum) Worker entry probe**：`console.log(new Date().toISOString())` 在 production module init 印一行做 clock sanity —— 避免將來 `module-init Date() = epoch` 的 bug 再次 silent misbehave。同樣的 probe 可作為對 workerd v2 / v3 升級的 smoke test。

### Out of scope（本 PR 不做）

- Backend `SaomeError` 改用 shared i18n key 表（涉及 backend 整個 error 層重構）
- backend `request.ts` 改成 import 共享 schema 取代 hand-written（Rule 019 §1「首選」共 3 步，這次只在 i18n 端做輕量對齊）
- 付費金流整合（Passcreator V3 / Payfast / Ecpay 真實 API）
- Backend `passHolderService.ts::toPassHolderError` 改用 shared helper（避免 scope 蔓延）
- Production smoke test 完整 Playwright e2e（用 curl 矩陣已驗證 backend + 手動驗證前端 banner 顯示）
