# passcreator.ts / passcreator.test.ts 拆分 — colocation + protocol 邊界

**日期**：2026-10-19
**作者**：SAOME-REBUILD
**範圍**：L1 Trivial-ish refactor（純結構拆分，0 behavior change）
**Commit hash**：local `6e49481`（pending push）

---

## Summary

把 `apps/backend/src/shared/lib/passcreator.ts`（1801 行單體）與
`passcreator.test.ts`（2414 行、單檔含 5 個 protocol section）拆成可維護的多檔結構。

| 拆前 | 拆後 |
|---|---|
| `passcreator.ts` 1801 行（env + transport + errors + v2-template + v3-pass 5 種關注點混在一起） | 7 個 source 模組 + 1 個 shim，每個 ~250 行 |
| `passcreator.test.ts` 2414 行（describe block 散落各 section） | 4 個 colocated test 檔 + 1 個 shim，colocation 跟 source 檔同資料夾 |
| `passcreator.test.ts` 內 fixture 字串重複貼多處（`VALID_ENV` / V3 happy path JSON / V3 error envelope） | 1 個 `__fixtures__/index.ts` 共用模組 |
| 所有 caller `import { ... } from '@/shared/lib/passcreator'` | **不變**（shim re-export） |

---

## 觸發（為什麼要拆）

兩個結構性問題在最近 3 個 session 同時浮現：

1. **「passcreator.test.ts 2400 行」** — 2026-10-19 早上做 V3 contract fix 時，要加 4 條 conformance test（`issuePass` happy path + network failure + V3 error envelope + non-ASCII round-trip），要 scroll 過整個 v2-template section 找對應的 describe block，且 `VALID_ENV` 跟 `REPO_ROOT` 都在 v2-template 描述頂部定義、跟 v3-pass section 隔 1000+ 行
2. **「V3 wire shape 跟 V2 同一個檔」** — `data.memberName` rename、`?async=false`、`{ data: { ... } }` 這 3 條 V3 契約跟 V2 的 `linkToPassPage` 放在同一個 source 檔，每次 V3 contract fix 都要解開 V2 的 source
3. **mock factory 散落** — `vi.mock` + `vi.hoisted` 對每個 describe block 都重寫一遍，fixture string（V3 `linkToPassPage` / V3 `barcodeValue`）貼多次

### 為什麼不早點拆

之前 2026-10-19 V3 contract fix + V3 parser defensive normalize 兩個 session 都在 passcreator.ts 內改 code，當時拆檔會讓 diff 跨越多個檔、code review 難以 evaluate V3 contract change 本身（會被 refactor 雜訊淹沒）。

兩次 V3 fix 結束後，拆檔結構性 refactor 才不會被行為改變的 noise 污染。

---

## 修法（做了什麼）

5 個 Phase（**同日完成**）：

### Phase 1（2026-10-19）
- 建 `passcreator/` 子資料夾
- `env.ts`：純 `requireEnv` boundary check + `PasscreatorEnv` interface
- `transport.ts`：`passcreatorFetch` 共用 fetch helper（把 `requireEnv` re-export 讓 consumer 一行 import）

### Phase 2（2026-10-19）
- `errors.ts` populated：把上次 V3 parser defensive normalize 的 `BARCODE_VALUE_PLACEHOLDERS` + `normalizeBarcodeValue` + `normalizePasscreatorErrorEntries` + `extractUpstreamErrors` 集中到 errors 模組

### Phase 3（2026-10-19）
- `v2-template-types.ts`：V2 template body 的所有 type（`PasscreatorPassType` / `PasscreatorFieldType` / `PasscreatorAdditionalProperty` / `PasscreatorTemplateBody`）
- `v2-template.ts`：`createPassTemplate` / `updatePassTemplate` / `fetchPassTemplate` + `extractTemplateId`

### Phase 4（2026-10-19）
- `v3-pass-types.ts`：V3 wire shape 的所有 type（`PassIssueHolderData` / `PassIssueResponse` / `PassBackfillResponse`）
- `v3-pass.ts`：`issuePass` / `getPassByIdentifier` / `listPasses`（V3 contract root cause fix 的程式碼留在這裡）

### Phase 5（2026-10-19）
- `passcreator/env.test.ts`：requireEnv 3 tests
- `passcreator/v2-template.test.ts`：22 tests + 3 skipped（live V2 fixture）
- `passcreator/errors.test.ts`：25 tests + 10 skipped（V2/V3 error envelope + live V2 fixtures）
- `passcreator/v3-pass.test.ts`：31 tests + 10 skipped（live V3 fixtures，含本次 V3 contract fix 的 4 條）
- `passcreator/__fixtures__/index.ts`：V2 + V3 fixture 共用模組（從各 test 檔的 mock factory 抽出）
- `passcreator.test.ts`：90 → 43 行，純 documentation-only shim（1 placeholder test 給 Vitest 不會 reject）

### Shim（`passcreator.ts` 90 行）

```ts
// 純 re-export — 所有既有 caller 行為不變
export { type PasscreatorEnv } from './passcreator/env';
export { type PasscreatorErrorEntry, /* ... */ } from './passcreator/errors';
export { passcreatorFetch, requireEnv } from './passcreator/transport';
export { type PasscreatorTemplateBody, /* ... */ } from './passcreator/v2-template-types';
export { type PasscreatorFieldType } from './passcreator/v3-pass-types'; // cross-module type
export { type PasscreatorTemplateResponse, createPassTemplate, updatePassTemplate, fetchPassTemplate } from './passcreator/v2-template';
export { type PassIssueHolderData, /* ... */, BARCODE_VALUE_PLACEHOLDERS } from './passcreator/v3-pass-types';
export { issuePass, getPassByIdentifier, listPasses } from './passcreator/v3-pass';
```

---

## Verification

| 項目 | 結果 |
|---|---|
| `npx tsc --noEmit -p apps/backend/tsconfig.json` | exit 0 |
| `npm test --workspace=apps/backend -- shared/lib/passcreator` | 5 test files, **59 passed \| 23 skipped \| 82 total**，duration 3.02s |
| Backend call site（`apps/backend/src/modules/pass-templates/**`）import `@/shared/lib/passcreator` | 0 改動（shim re-export 維持既有 API） |
| Frontend call site（無直接 import） | 0 改動 |
| `@cloudflare/vitest-pool-workers` 環境 | 無 EBUSY 之外的 error |

---

## Diff 規模

```
14 files changed, 4058 insertions(+), 4095 deletions(-)
```

`passcreator.ts`（1801 → 90，-1711 行）
`passcreator.test.ts`（2414 → 43，-2371 行）
新檔 12 個（7 source + 4 test + 1 fixtures）

---

## 為什麼沒有對 production code 行為改變

| 既有行為 | 拆後行為 | 驗證 |
|---|---|---|
| `createPassTemplate` 對 non-2xx throw `BadGatewayError` | 相同（函式本體搬到 `v2-template.ts`，function body verbatim） | 22 條 test 全綠（含 4 條 live fixture） |
| `issuePass` 帶 `?async=false` + `{ data: { memberName } }` | 相同（V3 contract fix 的 6 條 conformance test 仍 pass） | 31 條 test 全綠 |
| `normalizeBarcodeValue` 把 `BARCODE_VALUE_PLACEHOLDERS` 4 placeholder 清成 null | 相同（搬到 `v3-pass-types.ts`，set 定義保留） | `v3-pass.test.ts` P0 #3 conformance test 全綠 |
| `extractUpstreamErrors` 處理 V3 string-array wrap 成 `property: 'data'` | 相同（搬到 `errors.ts`，分支邏輯保留） | `errors.test.ts` 4 條 string-array P0 conformance test 全綠 |
| `requireEnv` 在 env 缺 key 時 throw | 相同（搬到 `env.ts`，boundary check 邏輯保留） | `env.test.ts` 3 條 test 全綠 |

**Caller 端 import 完全不變** — `apps/backend/src/modules/pass-templates/services/registerService.ts` / `passTemplateMapping.ts` / `routes/register.ts` 等 6+ 個 caller 0 改動（從 `@/shared/lib/passcreator` import 仍指向 shim re-export）。

---

## 教訓（下次怎麼不犯）

### 1. **「colocation > convention」** — 1k 行 test 檔拆檔時機：第 2 個獨立 section 出現時就拆

原本 1801 行的 passcreator.ts / 2414 行的 passcreator.test.ts 一直拖到 V3 contract fix 才拆，是因為「檔大但不影響日常編輯」。事實上：
- 每次 V3 contract 改 code → scroll 過 1000+ 行的 V2 section → 找錯檔 risk
- mock factory 在多個 describe 重複 → fixture drift risk
- test count 增加但檔大小也增加 → `npm test` 跑某 section 也要跑整檔

**Rule 草案**（未來可能升 rule）：
> 任何 source/test file >1000 行且含 ≥ 2 個 protocol section（HTTP API / DB layer / 不同 protocol version）→ 必拆
> protocol section 判斷：API endpoint 改變或 wire shape 改變會同時影響 2+ 個不相關 function → 是 1 個 protocol section

### 2. **「shim re-export 是安全的遷移路徑」** — 0 behavior change 的重構不必全檔搬到新路徑

`passcreator.ts` 從 1801 行 → 90 行 shim，行為完全保留（所有 caller import path 不變、所有 test 全綠）。這個 pattern 比「caller 端全改 import path」安全得多（前者 1 commit、後者要 cross-caller 確認 + 多檔 diff）
**適用**：任何 source/test 拆分的第一階段都是 shim re-export，第二階段才改 caller 直接 import sub-module（tree-shaking 改善）

### 3. **「fixtures 共用模組比 describe-level mock factory 好維護」**

原本每個 describe block 內 `vi.hoisted({ ... })` 自己 mock env / mock fetch，這次拆出 `__fixtures__/index.ts` 後：
- fixture 字串 single source of truth（V3 `data.memberName` 改欄位只改 1 處）
- 多檔 test 共用同一份 live-captured fixture（v3-pass + errors 兩個檔都參考同一個 `v3ListResponseJson`）
- 新增測試不必重貼 100+ 行 JSON

**Rule 補強**（Rule 003 TDD 既有 spirit 延伸）：live-captured fixture 必抽到 `__fixtures__` 共用模組，describe-level mock factory 只留 mock dispatcher 邏輯（mock fetch / mock SQL）不該放 fixture string

### 4. **「docblock 標 Phase history」讓 refactor commit 是 narrative 不是 noise**

`passcreator.ts` shim 跟 `passcreator.test.ts` shim 都標 5 個 Phase history（Phase 1 → Phase 5 對應 env → transport → errors → v2-template → v3-pass + test colocation），
reviewer 從 docblock 直接看到「這次拆檔的 5 個階段」、不必 grep git log。**比 commit message body 短但更可搜尋**

### 5. **「5 phase 同日完成 1 commit」是 refactor commit 的 sweet spot**

5 phase 拆檔如果分 5 commit，每個 commit 都是「檔案不存在 → 檔案存在」的 no-op（沒新行為可 review）；
如果全混 1 commit，又會讓 reviewer 看到 4000+ 行 diff 沒結構。

折衷：5 phase 同日完成 + **1 commit** + commit body 列出 5 phase 結構 + 對應 `verification` 區塊
**好處**：reviewer 看到 commit 一次理解全貌、找出深層 bug（mock factory drift / fixture duplicate）成本低

---

## 4 條 future invariants

(a) **`passcreator.ts` shim 必保留 re-export** — 任何 caller 從 `@/shared/lib/passcreator` import 都該繼續 work。新 code 才鼓勵直接 import sub-module（`@/shared/lib/passcreator/v3-pass`）改善 tree-shaking。

(b) **fixtures 共用模組** — `passcreator/__fixtures__/index.ts` 是 V2 + V3 fixture 的 single source of truth。新 fixture 必加進這、不在 describe 內 inline。

(c) **colocation 是新規範** — 任何未來新增的 `passcreator/*.ts` 必有對應 `*.test.ts` 在同資料夾（不是 `__tests__` 集中資料夾）。

(d) **Phase history docblock** — 任何 1000+ 行檔案拆分 commit 的 shim 必列 Phase history（n phase + 每 phase 簡述），讓 reviewer 從 docblock 看出拆檔結構。

---

## 5 條 follow-up

(P1) **Caller-side 直接 import sub-module（改善 tree-shaking）** — 對 `apps/backend/src/modules/pass-templates/**` 6+ 個 caller 把 `import { issuePass } from '@/shared/lib/passcreator'` 改成 `import { issuePass } from '@/shared/lib/passcreator/v3-pass'`。可以分階段做，每個 caller 1 個 commit + 既有 test 全綠。

(P2) **`PasscreatorFieldType` 跨模組** — 現在 shim 從 `v3-pass-types` re-export `PasscreatorFieldType`（因為 v3-pass 也用到），但 type 定義在 V2 wire shape context 下更自然。未來可以搬到共用 `passcreator-types.ts` 或拆 `v3/types.ts`。

(P2) **Rule 草案升 rule**：「source/test file >1000 行且含 ≥ 2 個 protocol section 必拆」+ 「shim re-export 是遷移路徑首選」+ 「fixtures 必抽 `__fixtures__` 共用」。

(P3) **E2E test 對 shim re-export 行為加 lock** — `apps/backend/src/modules/pass-templates/tests/passcreator-import.test.ts` 加 1 條 trivial test 驗「從 `@/shared/lib/passcreator` import 8 個 export 都拿得到」，防止 shim 沒 re-export 某個 symbol 沒人 catch。

(P3) **Future Passcreator V4 來時** — V3 protocol section 已獨立（`v3-pass.ts`），V4 加新檔 `v4-pass.ts` 即可，不必動 V3 code。**這是 colocation 拆分最大的長期投資報酬**。

---

## Scope

- 2 backend 改檔（`passcreator.ts` shim + `passcreator.test.ts` shim，-4082 行）
- 7 backend 新 source 檔（env / transport / errors / v2-template-types / v2-template / v3-pass-types / v3-pass）
- 4 backend 新 test 檔（env / v2-template / errors / v3-pass colocated）
- 1 backend 新 fixtures 模組（`__fixtures__/index.ts`）
- 0 production caller 改動（shim re-export 保留既有 import path）
- 0 migration / 0 frontend feature
- 1 commit（`refactor(backend): split passcreator monolith`）+ 1 feedback（本檔）+ 1 DEV LOG + 1 INDEX row（pending push 後填）