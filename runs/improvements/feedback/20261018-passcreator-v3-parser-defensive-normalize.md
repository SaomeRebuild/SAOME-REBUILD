# 2026-10-18 Passcreator V3 parser defensive normalize（Q2 root cause + V3 error envelope）

**日期**：2026-10-18
**作者**：SAOME-REBUILD
**範圍**：L2 Standard（2 個 P0 parser fix + TDD Red-first + 11 條新 conformance test + capture-baseline-derived fix）
**上一輪 feedback（context）**：`runs/improvements/feedback/20261018-passcreator-v3-capture.md`（capture script + 3 個 live fixture + 6 條 conformance test，揭露 4 個 contract drift + 1 個 Q2 真 root cause）
**關聯 Decision Log**：`runs/decisions/2026-10-19-pass-holder-v3-issuance.md`（V3 簽發架構）

---

## Summary

完成上一輪 capture feedback 列的 P0 Action item #1 + #2。兩個 P0 都改 `apps/backend/src/shared/lib/passcreator.ts` parser 的 defensive normalize：

| P0 | 函式 | 問題 | 修法 |
|---|---|---|---|
| **#3** | `extractPassIssueData` | `barcodeValue: "no value specified"` 是 Passcreator 的 literal placeholder，parser 原封寫進 `pass_holders.barcode_value`（Q2 root cause — production 該欄位就是 literal `"no value specified"`） | 加 `BARCODE_VALUE_PLACEHOLDERS` set + `normalizeBarcodeValue()` helper，把 4 個 placeholder（含空字串）collapses 成 null；real barcode value 不動 |
| **#2** | `normalizePasscreatorErrorEntries` | V3 error envelope 用 `errors: string[]`，helper 只處理 V2 的 `{property, message}[]` 跟 singular object → string 條目 silently dropped → frontend banner 看不到 per-field reason | array 分支加 string-array 判斷（看 first entry 型別），wrap 成 `{property: 'data', message: <string>}`；V2 array-of-objects 跟 singular-object path 維持不變（regression guard） |

兩個 P0 是同源（mock-vs-live V3 envelope drift），同一個 session 跑 TDD Red-first。

---

## 完成項目（4 改檔 + 1 新 feedback + 1 INDEX row）

### 修改

| 檔案 | 變更 |
|---|---|
| [`apps/backend/src/shared/lib/passcreator.ts`](../../apps/backend/src/shared/lib/passcreator.ts) | (1) Module-level `BARCODE_VALUE_PLACEHOLDERS = Set(['no value given', 'no value specified', 'no barcode', ''])` + docblock 列 4 個來源；(2) 新 `normalizeBarcodeValue(raw)` helper — 非 string 回 null、命中 set 回 null、其餘 verbatim；(3) `extractPassIssueData` 兩處萃取點（V3 envelope branch + legacy flat-shape branch）改呼叫 `normalizeBarcodeValue()`；(4) `normalizePasscreatorErrorEntries` array 分支加 string-array 判斷（first entry 型別 + filter empty/whitespace-only strings + wrap 成 `{property: 'data', message: <string>}`）；(5) docblock 更新兩處（extractPassIssueData 註明 barcodeValue 三種可能值 + normalize rationale） |
| [`apps/backend/src/shared/lib/passcreator.test.ts`](../../apps/backend/src/shared/lib/passcreator.test.ts) | (1) 既有 V3 SUCCESS fixture test 改 `expect(result.barcodeValue).toBe('no value specified')` → `.toBeNull()`（post-fix 行為，新合約）+ docblock 引用；(2) 新 describe block `"barcodeValue defensive normalize (P0 #3 — 2026-10-17 capture)"` 加 7 條 test（4 placeholder + null body + 1 real value + 1 legacy flat-shape fallback）；(3) 既有 V3 ERROR fixture test 從「current parser silently drops V3 string-array errors (TODO — flagged for next-session parser fix)」翻面成「V3 string-array errors are wrapped into upstreamErrors (P0 #2 — 2026-10-17 capture)」+ 期望 `[{property: 'data', message: 'Template not found!'}]`；(4) 新 describe block `"V3 string-array errors defensive wrap (P0 #2 — 2026-10-17 capture)"` 加 4 條 test（單 string / 多 string / empty filter / V2 array-of-objects regression guard）；(5) `makeV3SuccessBody` helper 改用 `'barcodeValue' in overrides ? ... : default` 讓 explicit `null` override pass through（原 `??` 把 null 當 default） |

### 新增

| 檔案 | 用途 |
|---|---|
| `runs/improvements/feedback/20261018-passcreator-v3-parser-defensive-normalize.md`（本檔） | feedback — Rule 011 / 025 同 commit |

---

## TDD Red-first 流程（4 phase）

```
Phase 1: RED P0 #3
  Write 7 條新 test（barcodeValue defensive normalize describe block）
  跑 vitest -t "barcodeValue defensive normalize" → 6 failed, 1 passed
  → RED 確認

Phase 2: GREEN P0 #3
  改 passcreator.ts（加常數 + helper + 兩處萃取點）
  改既有 V3 SUCCESS fixture test 翻面（barcodeValue: 'no value specified' → null）
  改 makeV3SuccessBody helper 讓 null override pass through
  跑 vitest -t "barcodeValue defensive normalize" → 7 passed
  → GREEN

Phase 3: RED P0 #2
  改既有 V3 ERROR fixture test 翻面（upstreamErrors === [] → [{property: 'data', message: 'Template not found!'}]）
  加 4 條新 test（V3 string-array errors defensive wrap describe block）
  跑 vitest -t "V3 string-array" → 4 failed, 1 passed（1 是 fixture exists 不涉及 parser）
  → RED 確認

Phase 4: GREEN P0 #2
  改 normalizePasscreatorErrorEntries 加 string-array 分支
  跑 vitest -t "V3 string-array" → 5 passed
  → GREEN
```

---

## Phase 5 — 完整 regression

| 驗證項 | 結果 |
|---|---|
| `npx vitest run apps/backend/src/shared/lib/passcreator.test.ts` | ✅ **69/69 passed**（從 65 → 69：+4 P0 #2 + +7 P0 #3 - 1 翻面既有 fixture test = +10 新斷言有效） |
| `npx tsc --noEmit -p apps/backend/tsconfig.json` | ✅ exit 0 |
| `npx vitest run apps/backend` | ✅ **336/336 tests passed**（23 個 file 失敗是 pre-existing `@/` alias resolve issue，跟 V3 capture feedback 記錄的 17/40 baseline 完全一致，**沒引入新 regression**） |

---

## 4 條教訓

### 1. mock-vs-live contract drift 是 SAOME 第五次同 family（9/30 + 10/03 + 10/16 + 10/19 + 本次）

跟前幾次同源：mock-derived conformance test 跟 live API shape 漂移，vitest silent green。**Q2 root cause** 是其中最具破壞性的——production 已經把 Passcreator 內部 sentinel string 寫進 `pass_holders.barcode_value`，直到 user 拿出真實 DB row 才發現。

**修法 SOP 已在 Rule 019 § 4.1 補強為必走 live capture**（capture-passcreator-v2 + v3 script 都是這個 SOP 的 artifact）。本輪 capture script（commit `a59ff5c`）+ parser fix 是**同一條 SOP chain** 的兩個 stage：先抓真實 shape、再對 fixture shape 做 live assertion、最後改 parser 收斂。

未來任何第三方 API wrapper 的 conformance test，**必須**基於 live-captured fixture，禁止從 docs example 反推 mock shape（本輪 4 個 drift 都來自 mock-derived test vs live 對不上）。

### 2. TDD Red-first 在 parser fix 的價值不只是 regression guard

這次 TDD 跑出 4 個 phase：
- Phase 1 RED（6 fail + 1 pass）→ parser 還沒改，但 `real barcode value → unchanged` test 通過 → **驗證既有正確行為沒壞**
- Phase 2 GREEN → 新 7 條全通過
- Phase 3 RED（4 fail + 1 pass）→ 既有 V3 ERROR fixture test 翻面後 fail，新 mock-based test 全部 fail
- Phase 4 GREEN → 5 條全通過

這個 cycle 比「直接改 parser 再寫 test」少 1-2 個 debug 循環。**特別是「V2 array-of-objects shape → STILL uses property from each entry (regression guard)」這條 test**：如果只在 mock-derived 環境測，會忘了 V2 path 是否被 string-array 分支污染。

### 3. `'X' in overrides` vs `overrides.X ?? default` 在 helper 函式裡的差別

`makeV3SuccessBody` helper 原本用 `overrides.barcodeValue ?? '3897897988979823497234'` —— 這語意是「如果 null/undefined 用 default」。但 P0 #3 的 null-body test 需要「明確傳 null 並且 helper 不要把它當 default」。

修法：改成 `'barcodeValue' in overrides ? overrides.barcodeValue : 'default'` —— 讓 explicit null pass through。**這個差別在 generic factory helper 很常見**（factory pattern），未來 helper 寫法預設應該用 `in` check，optional fallback 才用 `??`。

### 4. 'data' 是 V3 error envelope 最準確的 context prefix

V3 docs § Request Body：「The following properties of the `data` object can/must be submitted in the request body」—— V3 envelope 把所有 input 跟 output 包在 `data` object。當 V3 string-array errors 沒提供 per-field path 時，**`property: 'data'` 是最準確的 context prefix**（比 `'passcreator-v3'` / `'upstream'` 更精準，因為 V3 失敗的原因幾乎都在 `data.*` field）。

frontend banner 拿 `property` 來 group error 條目時，會看到「data: Template not found!」「data: Email is invalid」一組，至少知道「所有 V3 失敗都來自 data object 內部」。比現在的「Bad request」generic message 已經強很多。

---

## scope

```
2 backend 改檔（passcreator.ts / passcreator.test.ts）
1 backend test helper 微調（makeV3SuccessBody 'in' check）
1 新 feedback
1 INDEX row
1 commit（code + test + feedback + INDEX 同 commit — Rule 011 / 025 對齊）
0 migration（Rule 035 不觸發）
0 frontend 變更
0 shared schema 變更
0 DB 變更
```

---

## future invariant

1. **`BARCODE_VALUE_PLACEHOLDERS` 是 single source of truth** —— 未來 Passcreator 加新 placeholder string（例如 "no barcode configured"），必加這 set + 加 conformance test + 加 docblock entry
2. **`normalizeBarcodeValue` 必套用於 `extractPassIssueData` 的兩個分支**（V3 envelope + legacy flat-shape）—— 任何未來新增第三個分支（例如 mock-mode test-double），必同步呼叫這個 helper
3. **`normalizePasscreatorErrorEntries` 的 array 分支判斷依「first entry 型別」** —— `Array.isArray(rawErrors) && rawErrors.length > 0 && typeof rawErrors[0] === 'string'` → string-array branch；其餘走 array-of-objects branch。**這個判斷**是 defensive 對抗 mixed array（Passcreator 沒文件化 mixed，但 future-proof）
4. **V3 string-array errors 必 wrap 成 `property: 'data'`** —— V3 envelope 一切都在 `data` object，context prefix 用 `data` 最精準
5. **`makeV3SuccessBody` helper 必走 `'X' in overrides` pattern** —— 不要回退到 `??` 寫法，否則 null override 會被當 default 吃掉
6. **P0 #2 的 regression guard test 必保留** —— V2 array-of-objects shape 必須繼續用各 entry 自己的 `property`，不被 string-array branch 污染

---

## 6 條 follow-up（從上一輪 capture 沿襲 + 本輪發現）

| # | 內容 | 優先度 | 觸發時機 |
|---|---|---|---|
| 1 | **P0 production smoke test**：deploy + 真實 register flow，verify `pass_holders.barcode_value` 在 production 真的變 NULL（修前是 `"no value specified"` literal） | **P0** | Next session — deploy |
| 2 | **P1 Drift #1 follow-up**：parser 加 `linkToPassPage → downloadPage` fallback（for future V3-list consumers，capture 已揭露 V3 LIST 用 `linkToPassPage` 不是 `downloadPage`） | P1 | 未來任何 V3 LIST consumer（retention / dashboard）出現時 |
| 3 | **P1 Drift #4 follow-up**：i18n copy verify（`passHolder.download.android*` "Save to Google Wallet" vs "Save to Passwallet"）+ `pickDownloadUri` UA detection sanity check | P1 | Next session |
| 4 | **P2 Drift #5 follow-up**：docblock `passcreator.ts::PassIssueResponse` 更新 `genericProperties: []`（array not object） | P2 | 文件修正，無 code 影響 |
| 5 | **P2 Rule 037 § 6 pre-commit hook** 仍未解 | P2 | 自 MCP regression 沿襲 |
| 6 | **P3 Capture SOP 統一文件**：把 `capture-passcreator-v2-errors.cjs` + `capture-passcreator-v3.cjs` 的 SOP 寫進 `runs/improvements/SOPs/capture-passcreator.md` | P3 | Rule 040 SOP 落地時 |

---

## Rule 衍生

| 規範 | 應該加的內容 |
|---|---|
| **Rule 019 § 4.1 Backend Request Schema 第四層（補強）** | 任何第三方 API wrapper 的 conformance test **必須**基於 live-captured fixture，禁止從 docs example 反推 mock shape。本輪 4 個 drift 都是 docs-derived mock vs live 對不上的範例 |
| **Rule 003 TDD Red-first** | parser fix 也走 Red-first；mock factory helper（`makeV3SuccessBody`）的 `??` vs `in` check 差別要在測試階段就抓到 |
| **NEW Rule 040 草案（沿襲 capture feedback 沿革）** | 「Live capture is mandatory after mock-derived conformance」—— 任何 mock-derived conformance test 在 first production usage 之前必跑 capture script + 對 fixture shape 做 live assertion |

---

## 觸發的 Rule 索引

| Rule | 觸發點 |
|---|---|
| `003` TDD Red-first | 4 phase TDD cycle（Phase 1-4）✅ |
| `006` 完工前驗證 | target file + typecheck + backend scope ✅ |
| `011` Dev logging | Feedback 同 commit ✅（本檔即時寫入）|
| `019` Schema Contract Drift § 4.1 | 4-layer 同步檢查：live fixture = source of truth，mock-derived test = drift source ✅（fix 落地） |
| `027` postgres.js Dynamic Query | 不適用（沒 DB 改動） |
| `035` Migration Apply Pipeline | 不適用（沒新增 migration） |
| `037` MCP Tool Call Pattern | 不適用（MCP 沒碰到） |

---

## 引用

- `runs/improvements/feedback/20261018-passcreator-v3-capture.md` — 上一輪（capture script + 3 fixture + 6 conformance test）
- `runs/decisions/2026-10-19-pass-holder-v3-issuance.md` — V3 簽發決策
- `apps/backend/scripts/capture-passcreator-v3.cjs` — capture script
- `fixtures/passcreator/v3/{v3-create-success,v3-list,v3-create-error}.json` — 3 個 live fixture
- `apps/backend/src/shared/lib/passcreator.ts` — parser（修法落地的檔案）
- `apps/backend/src/shared/lib/passcreator.test.ts` — 11 條新/翻面 test 落地處
- https://developer.passcreator.com/en/api/v3/pass — V3 真實 spec
- Rule 003 / Rule 006 / Rule 011 / Rule 019 / Rule 040 草案