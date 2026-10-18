# 2026-10-19 — Pass Holder 非付費路徑下載頁空白（non-paid `onValidSubmit` 漏 propagate `result.issuance`）

## Symptom

User 完成註冊（`/pass/{templateId}` 公開頁），轉到「下載 Pass」畫面，卻看不到：

- 平台化下載按鈕（iOS Apple Wallet / Android Passwallet / Desktop universal landing）
- barcode
- Android Tips（**已完成**的 10/19 #1 + #2 + #3 fix 應該在這裡 render 的 UI）

只看到一行「尚未簽發 Pass，請稍候」（pre-launch copy）。

## Root cause

`apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.tsx` 的 **`onValidSubmit`（非付費模板路徑）默默丟掉 `passHolderService.register(...)` 的回傳值**：

```ts
// Before
await passHolderService.register(template.id, { ... });
// ↑ result discarded
setSubmitted(true);
onSubmit();
```

`lastIssuance` state 因此保持 `null`，下游 `PassHolderPassDownload` 收到 `issuance={undefined}`，走到「pre-launch」分支（`!hasError && !hasAnyUri && !hasBarcodeButNoUri`），render 的是 `t('download.notReadyYet')` "尚未簽發 Pass，請稍候"。

docblock 註解甚至自稱「We snapshot in both paths to keep the contract uniform」— 但事實上只有「付費路徑」（`onCtaClick`）+ 「retry 路徑」（`onRetryIssuance`）有呼叫 `setLastIssuance`。

## Trigger

之前 10/19 一輪 plan (`fix_membername_v3_payload_+_cta_platform_icons`) 把下載頁拆成 4 段狀態（`hasError > hasAnyUri > hasBarcodeButNoUri > pre-launch`），做對的是：

| 路徑 | call `setLastIssuance`? |
|---|---|
| 付費（`onCtaClick`）| ✅ |
| Retry（`onRetryIssuance`）| ✅ |
| **非付費（`onValidSubmit`）** | ❌ **regression** |

付費路徑是後寫的（10/16 single-CTA refactor），當時顯式呼叫 `setLastIssuance(result.issuance ?? null)`。10/19 切到新下載頁時，沒去補「原 onValidSubmit 路徑也應該 propagate」 — 是 pre-existing bug，10/19 沒新引入也沒修。

## 為什麼 test 沒抓到

| Test | 結果 |
|---|---|
| `passHolderServiceMock.register` 預設回傳 `{ ok: true, passHolderId: 'mock-123' }` — **沒 `issuance` 欄位** | 「switches to Success view」assertion 只看 `pass-holder-download` testid 存在，沒 assert「CTA 出現」or「notReadyYet 不出現」— silent green |
| `PassHolderPassDownload.test.tsx` 自己的渲染分支 test 都直接 mount `PassHolderPassDownload` — 不走 `PassHolderRegistration` parent | 隔離了 `onValidSubmit` ↔ `setLastIssuance` 的 wire-up |

`PassHolderRegistration` 自己有 13 條 test，**0 條**測「register response 有 issuance → CTA 出現」這個 contract。

## Fix（5 件）

### Fix 1 — 修 onValidSubmit 串接 `setLastIssuance`

```ts
const result = await passHolderService.register(template.id, {
  ...values, selectedTierIndex, membershipTierSnapshot, paymentProvider, paymentStatus,
});
// Propagate issuance from BOTH paid (onCtaClick) AND non-paid paths,
// so the download view always receives the per-pass artifact.
setLastIssuance(result.issuance ?? null);
setSubmitted(true);
onSubmit();
```

docblock 註解換成 truth-telling 版本（之前是「snapshot in both paths」 but actually only one did）。

### Fix 2 — 2 條 conformance test 在 `PassHolderRegistration.test.tsx`

| # | Test | Pin |
|---|---|---|
| 1 | `non-paid register response issuance propagates to download CTAs (regression 2026-10-19)` | mock register 回 `issuance: { downloadPage, iPhoneUri, androidUri, barcodeValue }`，submit 後 `pass-holder-download-cta-demo-cafe` 出現 + `pass-holder-download-not-ready` 不出現 + `downloadView.textContent` 不含「尚未簽發」 |
| 2 | `non-paid register without issuance keeps the pre-launch "not ready" copy` | mock register 不回 `issuance`，submit 後 `pass-holder-download-not-ready` 出現 + 平台 CTA 不出現 — defensive counterpart 防 over-correction |

### Fix 3 — 同 commit feedback + INDEX row

此檔。

## Verification

```bash
npx vitest run src/components/business/pass/PassHolderRegistration/PassHolderRegistration.test.tsx
# → 35 tests passed (含 2 新 conformance)
npm test --workspace=apps/frontend
# → 148 test files / 1951 tests passed (從 1949 → 1951，+2 新)
npx tsc --noEmit -p apps/frontend/tsconfig.app.json
# → exit 0
npm run verify:i18n --workspace=apps/frontend
# → verify-i18n-keys: OK — 21 namespace(s) passed (42 locale files)
```

User 端驗證（待 production deploy 後）：register 任何非付費 card → 應該看到 CTA + barcode + Tips，不再是「尚未簽發」 placeholder。

## 3 條教訓

1. **「stale docblock」是 silent regression 的溫床** — 10/19 那輪 docblock 寫「snapshot in both paths to keep the contract uniform」，但事實上只有 paid path 做了。「docblock 描述 ≠ 程式碼事實」是 low-cost regression：code review 必掃「docblock claims vs implement gaps」。修法：`onValidSubmit` 串 `setLastIssuance(result.issuance ?? null)` 後 docblock 改成 truth 版本（清楚標 BOTH paths 都 propagate）。
2. **「silent green test」對 wire-up contract 是 0 覆蓋** — 既有 13 條 test 沒任何一條測「register 回的 issuance 真的有 propagate 到 download view」這 contract；只看了「`pass-holder-download` testid 存在」（container mount 證據）卻沒看「孩子 CTA 真的有 render」（functional evidence）。修法：mock service + submit + assert child CTA / barcode / Tips，**不走過 isolation mount 測 render，而是 end-to-end wire-up 測 render**。這是 SAOME 第五次同 family（mock-driven test silent green）— 9/30 / 10/03 / 10/16 / 10/19 / 本次。
3. **`useState` initial `null` 跟 `undefined` 在 React 比較都是 falsy，但要明確區分「從未 set」vs「explicit set to null」** — `lastIssuance` 的 `null` 是「還沒試過 register」的 marker；`undefined` 一路 propagate 到 `PassHolderPassDownload`。JS 對兩者用 `??` 才看得出差異，用 `||` 看不到。我們用 `null ?? undefined = undefined` 在 `issuance={lastIssuance ?? undefined}`，跟 download view 的 `Boolean(issuance?.barcodeValue)` 配對 — 是 expected 設計，但 docblock 必明示這個 nullish chain。

## Future invariants

1. **`onValidSubmit` / `onCtaClick` / `onRetryIssuance` 三個 submit path 必都 propagate `result.issuance` 到 `setLastIssuance`** — 未來任何 submit entry point 新增必走「setLastIssuance → setSubmitted → onSubmit」三件式 wire-up；code review 必掃這個 pattern 是否齊全。
2. **`PassHolderRegistration.test.tsx` 必加 wire-up contract test** — 任何 register service mock 變動必加對應 conformance test 驗「service 回 X → download view render Y」（不是只驗 mock 被 call）。
3. **`PassHolderPassDownload` 4-state 分支順序**（既有不變）：`hasError > hasAnyUri > hasBarcodeButNoUri > pre-launch`。

## Follow-up

| Pri | 項目 |
|---|---|
| P0 | Production deploy 後手動 verify 一次註冊流程：CTA / barcode / Tips 三項都 render |
| P1 | 未來若再加新 submit path（如「modify email 重新註冊」、「重新領取」），code review checklist 必含「有 propagate `setLastIssuance` 嗎？」 |
| P2 | Rule 040（draft）升 rule：「wire-up contract test 是 L2+ TDD mandatory」— 端到端 service ↔ component ↔ render 三層 wire-up 必測，禁止只測 mock call count |
| P3 | `PassHolderRegistration.tsx` docblock cross-check pass — 寫一段後跑 automation grep 找 docblock claim vs implementation drift |

## Scope

| File | Change |
|---|---|
| `apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.tsx` | `onValidSubmit` 加 `const result = await ...` + `setLastIssuance(result.issuance ?? null)` + docblock 修 truth 版本 |
| `apps/frontend/src/components/business/pass/PassHolderRegistration/PassHolderRegistration.test.tsx` | +2 conformance test（service issuance propagate + defensive no-issuance counterpart）|
| `runs/improvements/feedback/20261019-pass-holder-nonpaid-issuance-capture.md` | 新增（本檔）|
| `runs/improvements/INDEX.md` | append 1 row |

**Test count 變化**：backend scope 不變（純前端 bug）；frontend 1949 → 1951 tests（+2 conformance）；`PassHolderRegistration.test.tsx` 33 → 35 tests。
