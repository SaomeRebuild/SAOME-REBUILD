# 2026-10-19 — passcreator.ts / passcreator.test.ts 拆分（colocation + protocol 邊界 + shim re-export）

> **Single entry point** for the structural refactor of the Passcreator V2/V3 client wrapper。本檔責任是「為什麼要拆 + 怎麼拆 + 拆完的結構性 invariant + 跟過去 V3 contract fix 的關係」，不重述 feedback 內已有的細節 diff。

## 一句話總結

**把 1801 行 monolith 拆成 7 source 模組 + 4 colocated test 檔 + 1 fixtures 模組，0 behavior change、0 caller 改動，5 phase 同日完成 1 commit。**

| 拆前 | 拆後 |
|---|---|
| `passcreator.ts` 1801 行 | 7 source + 1 shim（90 行 re-export）|
| `passcreator.test.ts` 2414 行（單檔 4 describe section） | 4 colocated test + 1 shim（43 行 documentation-only）|
| Fixture 字串重複貼多處 | 1 個 `__fixtures__/index.ts` 共用模組 |
| 所有 caller `import { ... } from '@/shared/lib/passcreator'` | **不變**（shim re-export 維持既有 API）|

---

## Lineage（為什麼這次拆）

```
2026-10-19 morning:
  ├─ d4ec81f — V3 issuance 接線（passcreator.ts 仍 1801 行 monolith）
  ├─ d348f14 — barcode backfill + 2 URI column（仍 monolith）
  └─ a2106ad — 6 個 user-visible bug round（仍 monolith）

2026-10-19 afternoon:
  └─ 8954151 — passcreator.ts memberName emit（仍 monolith，1-line patch）

2026-10-19 evening (本 session):
  └─ 6e49481 — 拆檔 commit（5 phase 同日完成）
```

**為什麼拖到 V3 contract fix 之後才拆？**

`passcreator.ts` 從 Phase 1 開始就是 1801 行 monolith。理論上每加一個 V3 feature 都能拆，但實務上：

| 時機 | 拆 vs 不拆 | 為什麼 |
|---|---|---|
| Phase 1 d4ec81f | 不拆 | 當時重點是 V3 wire shape 接線，拆檔會讓 diff 跨越多個檔、code review 難以 evaluate V3 contract change 本身（被 refactor 雜訊淹沒）|
| Phase 2 d348f14 | 不拆 | production cleanup 是 SEV-1，refactor 風險高 |
| Phase 3 a2106ad | 不拆 | 6 條 user-visible bug closure，scope 大 |
| Phase 4 8954151 | 不拆 | 1-line fix，拆檔 overhead > 效益 |
| Phase 5 本 session（evening）| **拆** | 所有 V3 contract 演進收斂完成、pure refactor 不會被行為 noise 污染 |

**判斷**：refactor commit 的 sweet spot 是「behavior-changing session 全部收斂後」，不是「看到大檔就拆」。

---

## 拆檔結構（最終）

```
apps/backend/src/shared/lib/
├── passcreator.ts (90 行 shim — re-export only)
├── passcreator.test.ts (43 行 shim — documentation-only)
└── passcreator/                              ← 新子資料夾
    ├── __fixtures__/
    │   └── index.ts (V2 + V3 fixture single source of truth)
    ├── env.ts (61 行 — requireEnv + PasscreatorEnv)
    ├── env.test.ts (3 tests)
    ├── transport.ts (160 行 — passcreatorFetch + re-export requireEnv)
    ├── errors.ts (218 行 — error envelope helpers)
    ├── errors.test.ts (25 tests + 10 skipped)
    ├── v2-template-types.ts (500 行 — V2 wire shape types)
    ├── v2-template.ts (267 行 — create/update/fetch)
    ├── v2-template.test.ts (22 tests + 3 skipped)
    ├── v3-pass-types.ts (222 行 — V3 wire shape types + normalize helpers)
    ├── v3-pass.ts (512 行 — issue/list/getByIdentifier)
    └── v3-pass.test.ts (31 tests + 10 skipped)
```

每個 source 檔平均 ~250 行，**test 跟 source 同資料夾**（colocation 而非 `__tests__` 集中）。

### Protocol 邊界（為什麼這樣切）

| 模組 | Protocol | 對外契約 |
|---|---|---|
| `env.ts` | 「Passcreator API 需要什麼 env」| `requireEnv(env): { apiUrl, apiKey }` |
| `transport.ts` | 「怎麼跟 Passcreator API 講話」| `passcreatorFetch(env, path, init): Promise<Response>` |
| `errors.ts` | 「Passcreator API 錯誤怎麼 parse」| `extractUpstreamErrors(json): PasscreatorErrorEntry[]` |
| `v2-template-*.ts` | V2 template lifecycle（`POST/PUT/GET /api/v2/passtemplate`）| `createPassTemplate` / `updatePassTemplate` / `fetchPassTemplate` |
| `v3-pass-*.ts` | V3 per-pass runtime（`POST /api/v3/pass` + V3 list/get）| `issuePass` / `getPassByIdentifier` / `listPasses` |

**protocol 切換 = 換檔**：未來 Passcreator 推 V4，只需加 `passcreator/v4-pass-*.ts`，不必動 V3 code（**這是 colocation 拆分最大的長期投資報酬**）。

### 為什麼 `PasscreatorFieldType` 跨模組

`PasscreatorFieldType` 是 V2 template body 的欄位型別，但也用在 V3 per-pass 操作裡（v3 也要 identify `primaryFields[].type`）。目前 shim 從 `v3-pass-types` re-export 它（V2 → V3 依賴反向），這是 trade-off：

| 方案 | 優點 | 缺點 |
|---|---|---|
| 從 `v3-pass-types` re-export（採用） | 改 V3 程式碼時 field type 一起可見 | V2 wire context 下 type 在 V3 模組定義很反直覺 |
| 從共用 `passcreator-types.ts` re-export（future） | type 位置語義自然 | 多 1 個檔案，colocation 拆分效益打折扣 |
| 從 `v2-template-types` re-export | V2 是 source of truth | V3 模組 import V2 module 反向依賴，違反 protocol 演進方向 |

未來可考慮 (P2) 拆 `passcreator/types.ts` 共用層。

---

## 5 Phase 拆檔時間軸

| Phase | 時間 | 動作 | 風險 |
|---|---|---|---|
| **1** | 19:00 | 抽 `env.ts` + `transport.ts` stubs + `errors.ts` stubs | 低（都是 helper，無業務邏輯）|
| **2** | 19:30 | `errors.ts` populated — 把上次 V3 parser defensive normalize 的 `BARCODE_VALUE_PLACEHOLDERS` / `normalizeBarcodeValue` / `normalizePasscreatorErrorEntries` 集中 | 中（既有 helpers 必須 verbatim 搬，import path 改）|
| **3** | 20:00 | 抽 `v2-template-types.ts` + `v2-template.ts` | 中（V2 caller 多，shim 必須 export 完整）|
| **4** | 20:30 | 抽 `v3-pass-types.ts` + `v3-pass.ts`（V3 contract root-cause fix 程式碼在這）| 高（V3 是 SEV-1 chain，shrink 行為風險高）|
| **5** | 21:00 | tests colocation + fixtures 共用模組 + shim 簡化 | 低（純結構，行為已驗證）|

每個 Phase 都跑 `npm test --workspace=apps/backend -- shared/lib/passcreator` 確認既有 test 全綠再進下一 phase。

**5 phase 同日完成 1 commit**（commit `6e49481`）— 不是 5 commit。

---

## 為什麼 shim re-export 不是 caller-side 直接 import

`passcreator.ts` 從 1801 行 → 90 行 shim：

```ts
// 純 re-export — 所有既有 caller 行為不變
export { type PasscreatorEnv } from './passcreator/env';
export { type PasscreatorErrorEntry, normalizePasscreatorErrorEntries, /* ... */ } from './passcreator/errors';
export { passcreatorFetch, requireEnv } from './passcreator/transport';
export { type PasscreatorTemplateBody, /* ... */ } from './passcreator/v2-template-types';
export { type PasscreatorFieldType } from './passcreator/v3-pass-types'; // cross-module type
export { type PasscreatorTemplateResponse, createPassTemplate, updatePassTemplate, fetchPassTemplate } from './passcreator/v2-template';
export { type PassIssueHolderData, /* ... */, BARCODE_VALUE_PLACEHOLDERS } from './passcreator/v3-pass-types';
export { issuePass, getPassByIdentifier, listPasses } from './passcreator/v3-pass';
```

| 方案 | 行為改變 | caller 端 diff | 風險 |
|---|---|---|---|
| **Shim re-export（採用）** | 0 | 0（單一 commit）| 低（既有 import path 仍指向 shim）|
| Caller-side 直接 import sub-module | 0 | 6+ caller 改 import path（多 commit / 多檔 diff）| 中（要 cross-caller 確認 + reviewer 難以 isolate refactor）|

**判斷**：refactor commit 第一階段必走 shim，第二階段才 caller-side 直接 import 改善 tree-shaking（見 follow-up P1）。

---

## Fixtures 共用模組（為什麼重要）

原本每個 describe block 內 `vi.hoisted({ ... })` 自己 mock env / mock fetch，這次拆出 `__fixtures__/index.ts` 後：

| 拆前 | 拆後 |
|---|---|
| `v3-pass.test.ts` 內 V3 happy path JSON 200 行 | `__fixtures__/index.ts::v3IssueSuccessBody`（V3 happy path JSON）|
| `errors.test.ts` 內 V3 error envelope JSON 100 行 | `__fixtures__/index.ts::v3ErrorTemplateNotFoundBody` |
| `v3-pass.test.ts` + `errors.test.ts` 都貼同一份 V3 list response | `__fixtures__/index.ts::v3ListResponseJson` |

**好處**：
- fixture string single source of truth（V3 `data.memberName` 改欄位只改 1 處 vs 原來每個 describe 重貼）
- 多檔 test 共用同一份 live-captured fixture（v3-pass + errors 兩個檔都參考同一個 `v3ListResponseJson`）
- 新增測試不必重貼 100+ 行 JSON

**Rule 補強**：live-captured fixture 必抽 `__fixtures__` 共用模組，describe-level mock factory 只留 mock dispatcher 邏輯（mock fetch / mock SQL）不該放 fixture string。

---

## Phase history docblock 範本

`passcreator.ts` shim 跟 `passcreator.test.ts` shim 都標 5 個 Phase history：

```ts
/**
 * Phase history:
 *   - Phase 1 (2026-10-19): extracted env.ts + transport.ts + errors.ts stubs
 *   - Phase 2 (2026-10-19): populated errors.ts helpers
 *   - Phase 3 (2026-10-19): extracted v2-template-types.ts + v2-template.ts
 *   - Phase 4 (2026-10-19): extracted v3-pass-types.ts + v3-pass.ts
 *   - Phase 5 (2026-10-19): test files colocated per source file
 */
```

**為什麼 docblock 比 commit body 好搜尋 — reviewer 從 docblock 直接看到「這次拆檔的 5 個階段」，不必 grep git log**。

---

## Verification

| 項目 | 結果 |
|---|---|
| `npx tsc --noEmit -p apps/backend/tsconfig.json` | exit 0 |
| `npm test --workspace=apps/backend -- shared/lib/passcreator` | 5 test files, **59 passed \| 23 skipped \| 82 total**，duration 3.02s |
| Caller-side 改動 | 0（shim re-export）|
| Migration / Frontend | 0 變更 |

```
14 files changed, 4058 insertions(+), 4095 deletions(-)
```

---

## 4 條 future invariants（給未來 session）

(a) **`passcreator.ts` shim 必保留 re-export** — 任何 caller 從 `@/shared/lib/passcreator` import 都該繼續 work。新 code 才鼓勵直接 import sub-module（`@/shared/lib/passcreator/v3-pass`）改善 tree-shaking。

(b) **fixtures 共用模組 single source of truth** — `passcreator/__fixtures__/index.ts` 是 V2 + V3 fixture single source of truth。新 fixture 必加進這、不在 describe 內 inline。

(c) **colocation 是新規範** — 任何未來新增的 `passcreator/*.ts` 必有對應 `*.test.ts` 在同資料夾（不是 `__tests__` 集中資料夾）。

(d) **Phase history docblock** — 任何 1000+ 行檔案拆分 commit 的 shim 必列 Phase history（n phase + 每 phase 簡述）。

---

## 5 條 follow-up

| 優先 | 動作 | 預期 commit |
|---|---|---|
| **P1** | Caller-side 直接 import sub-module 改善 tree-shaking — `apps/backend/src/modules/pass-templates/**` 6+ 個 caller 把 `import { issuePass } from '@/shared/lib/passcreator'` 改成 `import { issuePass } from '@/shared/lib/passcreator/v3-pass'` | 1 caller 1 commit + 既有 test 全綠 |
| **P2** | `PasscreatorFieldType` 跨模組位置正位（V2 wire context 下更自然，未來可搬共用 `passcreator-types.ts` 或拆 `v3/types.ts`）| 1 commit |
| **P2** | Rule 草案升 rule：「source/test file >1000 行且含 ≥ 2 個 protocol section 必拆」+「shim re-export 是遷移路徑首選」+「fixtures 必抽 `__fixtures__` 共用」| 1 rule commit |
| **P3** | E2E test 對 shim re-export 行為加 lock — trivial test 驗「從 `@/shared/lib/passcreator` import 8 個 export 都拿得到」防 shim 漏 re-export symbol 沒人 catch | 1 commit |
| **P3** | Future Passcreator V4 來時 — V3 已獨立（`v3-pass.ts`），V4 加新檔 `v4-pass.ts` 即可不必動 V3 code（**colocation 拆分最大長期投資報酬**）| 未來 V4 release |

---

## Cross-link

- **feedback**：[runs/improvements/feedback/20261019-split-passcreator-tests.md](../improvements/feedback/20261019-split-passcreator-tests.md) — 5 條教訓 + 4 條 invariants 細節
- **INDEX row**：runs/improvements/INDEX.md（2026-10-19 第一條）
- **V3 contract fix lineage**：
  - d4ec81f — V3 issuance 4 層 sync
  - d348f14 — barcode backfill + 2 URI columns
  - a2106ad — 6 user-visible bug rounds
  - 8954151 — memberName wire
  - 6e49481 — **本 commit 拆檔**
- **Rule reference**：Rule 000 Part C.2（third-party service module structure）、Rule 019 § 4.1（backend request schema 四層同步保留）

---

> 撰寫者：SAOME-REBUILD agent ｜ 時間：2026-10-19 21:30
> Commit hash：local `6e49481`（pending push）