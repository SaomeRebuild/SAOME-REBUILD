# 2026-10-19 Pass Holder V3 簽發 — 真正 V3 contract 對齊 (Root-cause fix)

**日期**：2026-10-19
**作者**：SAOME-REBUILD
**範圍**：L3 Heavy（DB-pass-through + 第三方 API contract 重新對齊 + backend service + frontend）
**Decision log**：`runs/decisions/2026-10-19-pass-holder-v3-issuance.md`
**Plan (上一輪)**：`file:///c%3A/Users/user/.cursor/plans/pass-holder-v3-issuance_ed620c17.plan.md`

---

## Symptom

上一輪 ([20261019-pass-holder-v3-issuance.md](20261019-pass-holder-v3-issuance.md)) 寫的所有測試全綠、`wrangler deploy --dry-run` 過、`check:migrations` 過、`prebuild` 過、backend build 過、frontend build 過。**但 production 註冊後 holder 從來沒收到實際 wallet pass**。

User 反饋：「全綠還是拿不到 pass 阿，你剛才有參照 https://developer.passcreator.com/en/api/v3/pass 去做嗎」。

---

## Root cause

我從未對照 V3 docs 真正的 `Create a Pass` section — 只從 V3 list endpoint response shape（`{ data: [ { identifier, templateId, linkToPassPage, ... } ] }`）+ V2 update 的 envelope 反推 V3 create endpoint 的 body / response shape。**3 個錯誤 + 1 個缺漏，全部導致 production 拿不到 pass**：

| # | Bug | 我之前寫的（錯） | V3 docs 寫的（對） |
|---|---|---|---|
| 1 | URL 沒 `?async=false` | `POST /api/v3/pass` | `POST /api/v3/pass?async=false`<br/>（docs 原文：「If you need to see the actual `barcodeValue` in the JSON response body, you need to set `async` to `false`. Otherwise the system will not know it when the response is generated.」） |
| 2 | Body 沒包在 `data` object | `{ templateId, additionalPropertyValues: { name, phone, birthday, email } }` | `{ data: { templateId, name, phone, birthday, email } }`<br/>（docs § Request Body：「The following properties of the `data` object can/must be submitted in the request body」） |
| 3 | 用 `additionalPropertyValues` 物件 | `additionalPropertyValues: { name, phone, birthday, email }` | 額外屬性直接放在 `data` object 內（`additionalPropertyValues` 這個欄位 V3 create 不存在；那是 V1 `passtemplate` URL param + zapierStyle=true 用的） |
| 4 | 讀 response field 錯名 | `data.linkToPassPage` | `data.downloadPage`（V3 docs § Returned values）<br/>V3 還多回 `data.iPhoneUri` + `data.androidUri` — 沒存到 DB column 但前端可以用來平台分流下載 CTA |

---

## Why tests passed but production broke

`passcreator.test.ts` 的 6 條 V3 conformance test 是用我反推的「mock shape」寫的，**vitest 全綠是因為 mock 自簽的合約跟實際 V3 API 不同**：

| Assertion | Mock 自簽的（錯） | V3 真實的（對） |
|---|---|---|
| URL | `https://app.passcreator.com/api/v3/pass` | `https://app.passcreator.com/api/v3/pass?async=false` |
| Body | `{ templateId, additionalPropertyValues: { ... } }` | `{ data: { templateId, ... } }` |
| Response | `{ success, data: { identifier, linkToPassPage, barcodeValue } }` | `{ success, data: { identifier, downloadPage, iPhoneUri, androidUri, barcodeValue } }` |
| Wrapper return | `{ identifier, downloadUrl: linkToPassPage, barcodeValue }` | `{ identifier, downloadPage, iPhoneUri, androidUri, barcodeValue }` |

Vitest 跑的是「mock 進、mock 出」，**沒有任何一條測試碰真實的 `https://app.passcreator.com`**。Mock shape 跟 live shape 漂移，測試就會 silent green。

---

## Fix（這次 session）

### 1. TDD Red：先把 conformance test 改成真實 V3 shape

更新 6 條 `issuePass` test 用真實 V3 contract：

- `makeV3SuccessBody` 用 `downloadPage` + `iPhoneUri` + `androidUri`（不再用 `linkToPassPage`）
- URL assertion 包含 `?async=false`
- Body assertion 用 `{ data: { templateId, name, phone, birthday, email } }`（不再用 `additionalPropertyValues`）
- Non-ASCII round-trip test 改讀 `parsed.data.name`（不再 `parsed.additionalPropertyValues.name`）
- Hint message 期望 `identifier+downloadPage`（不再 `identifier+linkToPassPage`）

跑 `npx vitest run apps/backend/src/shared/lib/passcreator.test.ts` → **3 條 fail**，全部圍繞 response parser。

### 2. TDD Green：把 `issuePass` 改成真實 V3 contract

```typescript
// apps/backend/src/shared/lib/passcreator.ts

// Before:
// POST /api/v3/pass
// body: { templateId, additionalPropertyValues: { name, phone, birthday, email } }
// response.data.linkToPassPage → PassIssueResponse.downloadUrl

// After:
POST /api/v3/pass?async=false                  // ← async=false 必要
body: { data: { templateId, name, phone, birthday, email } }
       ↑ wrapper 直接放進 data object，不再用 additionalPropertyValues
response.data.{identifier, downloadPage, iPhoneUri, androidUri, barcodeValue}
       ↑ V3 拆成 3 個 URI（前端做 user-agent detection 分流 CTA）

PassIssueResponse: {
  identifier: string,
  downloadPage: string,   // ← 新名（之前誤叫 downloadUrl）
  iPhoneUri: string,      // ← 新加（Apple Wallet 直接 .pkpass）
  androidUri: string,     // ← 新加（Google Wallet deeplink）
  barcodeValue: string | null,
}
```

### 3. Contract 對齊 — 四層同步（Rule 019 § 4.1）

| 層 | 檔案 | 變更 |
|---|---|---|
| 1 | `packages/shared/types/passHolder.ts` | `PassHolderIssuance`：`downloadUrl` → `downloadPage` + 加 `iPhoneUri` / `androidUri` |
| 2 | `apps/backend/src/shared/contracts/passTemplates.ts` | `PassHolderIssuanceDto`：同上 |
| 3 | `apps/backend/src/modules/pass-templates/db/passHolders.ts` | 沒變（DB column 還是 `download_url`，存的是 universal URL） |
| 4 | `apps/backend/src/modules/pass-templates/services/registerService.ts` | `attemptIssuance` 改讀新欄位；DB 寫入仍存 `download_url = data.downloadPage`（單欄、universal URL）；`iPhoneUri` / `androidUri` 只在 response payload 暴露 |

### 4. Frontend 對齊

| 檔案 | 變更 |
|---|---|
| `PassHolderPassDownload.types.ts` | `PassHolderIssuanceView`：同 contract |
| `PassHolderDownloadButton.tsx` | 加 `pickDownloadUri()` user-agent detection helper：<br/>- iOS → `iPhoneUri` ?? `downloadPage`<br/>- Android → `androidUri` ?? `downloadPage`<br/>- Desktop → `downloadPage` ?? `iPhoneUri` ?? `androidUri` |
| `PassHolderPassDownload.tsx` | `hasAnyUri` gate 用 3 個 URI 任一檢查（不再只看 `downloadUrl`） |
| `PassHolderPassDownload.test.tsx` | 加 4 條新 test：iOS UA → iPhoneUri / Android UA → androidUri / 平台-specific 缺 → fallback downloadPage / 3 URI 全缺 → 不 render CTA |
| `PassHolderPassDownload.stories.tsx` | 3 URI 範例填滿 |
| `passHolderService.ts` | `Issuance` type 透過 Layer 1 自動更新，無需改 |

### 5. Backend test 對齊

| 檔案 | 變更 |
|---|---|
| `apps/backend/src/modules/pass-templates/tests/register.test.ts` | 4 條 V3 scenario test 改用真實 contract shape（mock response 含 `downloadPage` / `iPhoneUri` / `androidUri`）；加 1 條「V3 URL 包含 ?async=false」regression test |

---

## 驗證結果（after fix）

| 驗證項 | 結果 |
|---|---|
| `npx tsc --noEmit -p apps/backend/tsconfig.json` | ✅ exit 0 |
| `npx tsc --noEmit -p apps/frontend/tsconfig.app.json` | ✅ exit 0 |
| `npx vitest run apps/backend` | ✅ **693/693** passed（40 test files；含 6 條 issuePass conformance + 5 條 register V3 scenarios） |
| `npx vitest run apps/frontend/src/components/business/pass` | ✅ **74/74** passed（5 test files；PassHolderPassDownload 9 + Registration 29 + MembershipTiers 15 + TierRow 11 + PaymentButton 10） |
| `npm run verify:i18n` (apps/frontend) | ✅ 21 namespaces passed |
| `npm run check:migrations` (apps/backend) | ✅ 23/23 registered |
| `npm run build` (apps/backend — wrangler deploy --dry-run) | ✅ exit 0；9 bindings wired（HYPERDRIVE / ASSETS / 4 token+URL vars / PASSCREATOR_API_URL / PASSCREATOR_PASS_TYPE_ID / R2_PUBLIC_URL / SAOME_BACKEND_URL）|
| `npm run build` (apps/frontend) | ✅ exit 0；audit-config-defaults clean |

---

## Self-improvement / Rule updates（這次的教訓）

### Root cause — 為什麼會寫錯 V3 contract

1. **WebFetch 拿到的 V3 docs 只到 list endpoint shape 就被截斷** — 32KB 上限。從來沒拿到「Create a Pass」section 的真實 body shape。
2. **從 V2 update + V3 list 反推 V3 create** — 反推的 `additionalPropertyValues` 是 V1 `passtemplate` + zapierStyle 用的；`linkToPassPage` 是 V1 single-link 用的。V3 把這兩個 pattern 都改掉了。
3. **Mock contract 跟 live contract 漂移** — vitest 跑的是「mock 進、mock 出」；mock 自簽的 shape 跟 live shape 不同，測試 silent green。
4. **沒做 live conformance test** — 跟 V2 一樣應該有 capture-passcreator-errors.cjs 跑真實 endpoint 抓 fixture，但這次沒做。

### Rule 衍生 — 必須加進既有規範

| 規範 | 應該加的內容 |
|---|---|
| **Rule 037 MCP Tool Call Pattern** | 不適用（MCP regression 跟這次無關） |
| **Rule 001 Methodology § Decision Log** | 不適用（已是 V1→V2 對齊的模式） |
| **NEW: 「TDD Red before Green 必須碰真實 contract」** | 任何接第三方 API 的 feature，conformance test 必須基於「**live-captured fixture**」（從真實 endpoint 抓到的 bytes），禁止從 docs 反推 mock shape。本次 `runs/experiments/2026-10-13-passcreator-v2-template-data-url/` 已有 capture script 範本，V3 應該照同一個 SOP 跑。 |
| **Rule 027 postgres.js Dynamic Query § workerd JSON.stringify pitfall** | 已在 § 內提到「前端 / backend 必須跑真實 non-ASCII round-trip test」；延伸 —「backend 第三方 API wrapper 的 mock response 也必須從 live capture 拿，禁止從 docs example 反推」 |
| **Rule 011 Dev logging** | Feedback 必須在實作當下 commit（**這次做到了**） |

### Action item（給下一個 session）

1. **加 `apps/backend/scripts/capture-passcreator-v3.sh`** — 跟 `capture-passcreator-errors.cjs` 同 SOP，capture V3 create + V3 list + V3 update 的 fixture 到 `fixtures/passcreator/v3/`。CI 必跑這 3 條 fixture shape assertion。
2. **跑 `card-save-load-pipeline` skill 的「live conformance test」分支** — 拿真實 Passcreator V3 endpoint 對 fixture 做 round-trip，把今天修的 `issuePass` 餵真實 response shape 跑一次，確認 `barcodeValue` 在 response 內不是 `null`。
3. **production smoke test（deploy + 真實 register flow）** — 註冊一個新 pass holder，verify response payload 內 `downloadPage` / `iPhoneUri` / `androidUri` 三個欄位都填滿；前端 user-agent detection 正確分流 CTA。
4. **Rule 037 MCP § 6 靜態檢查（pre-commit hook）仍未解** — 這次 MCP 沒碰到所以沒有 regression。但仍是 pending action。

---

## 觸發的 Rule 索引

| Rule | 觸發點 |
|---|---|
| `001` Decision Log | 開工前 ✅（已寫好 `2026-10-19-pass-holder-v3-issuance.md`；本次 append § 「2026-10-19 衍生：實際 POST body / response shape 跟 Decision Log § Schema 寫的對不上；對齊 V3 docs 真實合約」）|
| `019` Schema Contract Drift § 4.1 | 四層同步 ✅（shared / contracts / db row / service）|
| `006` Verification | 7/7 驗證全綠（typecheck × 2 / vitest × 2 / verify:i18n / check:migrations / 2 個 build）|
| `011` Dev logging | Feedback ✅（本檔即時寫入，不等事後補）|
| `003` TDD Integration | RED-first（先改 mock shape 讓 3 條 fail）→ GREEN（改 `issuePass` + consumer）→ Verify（重跑全部測試）✅ |
| `032` JSONB merge silent killer | 不適用（無 jsonb 寫入）|
| `027` postgres.js Dynamic Query § workerd pitfall | 部分適用（rule 內提到「前端 / backend 必須跑真實 non-ASCII round-trip test」；**延伸建議加「mock 必須 live capture」**）|
| `035` Migration Apply Pipeline | 不適用（沒新增 migration）|
| `037` MCP Tool Call Pattern | 不適用（MCP 沒碰到）|

---

## Out of scope（仍待後續）

- 條碼實際渲染（QR / PDF417 圖像）：今天用 text-only display 顯示 value；整合 `qrcode` lib 是未來 hardening。
- `download_enabled_until` / `expirationDate` / `firstDownloadedAt` 持久化：屬 retention 子系統。
- **production smoke test**（未跑 — 等 user 確認後再 deploy + 手動測試）
- **V3 live-capture fixture**：尚未 capture，conformance test 仍用 mock（雖然是 live shape，但沒從真實 endpoint 抓過）
- Rule 037 § 6 靜態檢查仍未加進 CI

---

## 引用

- `runs/decisions/2026-10-19-pass-holder-v3-issuance.md` — 上輪決策（本次 append derivation）
- `runs/improvements/feedback/20261019-pass-holder-v3-issuance.md` — 上一輪 feedback（V3 簽發功能上線）
- `runs/improvements/feedback/20260930-pass-templates-mcp-descriptor-blocker.md` — MCP regression #1
- `runs/improvements/feedback/20261003-mcp-tool-call-pattern-regression.md` — MCP regression #2 + Rule 037 起源
- `apps/backend/src/shared/lib/passcreator.ts` — `issuePass` 修正後
- `apps/backend/src/shared/lib/passcreator.test.ts` — 6 條 V3 conformance test 改用真實 V3 shape
- `apps/backend/src/modules/pass-templates/services/registerService.ts` — `attemptIssuance` 修正後
- `apps/backend/src/modules/pass-templates/tests/register.test.ts` — 5 條 V3 scenario 改用新 contract
- `packages/shared/types/passHolder.ts` — Layer 1 type 更新
- `apps/backend/src/shared/contracts/passTemplates.ts` — Layer 2 contract 更新
- `apps/frontend/src/components/business/pass/PassHolderPassDownload/` — L2 folder 更新（含 `pickDownloadUri` UA detection helper + 4 條新 test）
- https://developer.passcreator.com/en/api/v3/pass — 真實 V3 Create a Pass 規格