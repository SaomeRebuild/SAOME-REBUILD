# Step 7 客製化桌牌 — 防呆守門（使用者必須按「生成桌牌」才能進 Step 8）

## 摘要

依 user feedback 2026-10-04（桌牌忘記生成就儲存卡片的 bug），新增 `isStep7Valid()` 防呆守門：使用者必須至少成功按過一次「生成桌牌」按鈕（`tableCardExportState === 'ready' | 'stale'`）才能進入 Step 8（儲存）。`idle` / `generating` / `error` 三態阻擋下一步按鈕，並在按鈕下方顯示紅字警示（`step7Guard.mustGenerateFirst`）。設計決策：**stale 放行**（已成功過一次、畫布後來又改了，使用者可刻意保留舊桌牌），僅 `error` / `generating` / `idle` 阻擋。

## 完成改動的 4 個檔案

| 動作 | 檔案 | 變更摘要 |
|---|---|---|
| 改 | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorWorkspace.tsx` | 改 `useTranslation('cardEditor')` → `useTranslation(['cardEditor', 'tableCard'])`（多 namespace pattern 對齊 Footer.tsx / DashboardHeaderActions.tsx）；新增 `isStep7Valid()` 守門函式（純邏輯、無副作用）；`handleNext` 在 step === 7 阻擋；「下一步」按鈕 `disabled={!isStep7Valid()}` + 紅字 hint（`!isStep7Valid()` 才顯示） |
| 改 | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorWorkspace.test.tsx` | +11 條 conformance test：(a) 5-state × 預期 disabled 對照（it.each 5 cases）；(b) 紅字提示 idle / ready / stale 顯示規則 3 條；(c) handleNext 在 idle / ready / stale 三態的 onStepChange 行為 3 條（disabled 防禦 + ready/stale 正常前進） |
| 改 | `apps/frontend/src/i18n/locales/tableCard.zh-TW.ts` | 新增 `step7Guard.mustGenerateFirst`：「請先按上方「生成桌牌」按鈕生成一次桌牌, 才能進入下一步」 |
| 改 | `apps/frontend/src/i18n/locales/tableCard.en.ts` | 新增 `step7Guard.mustGenerateFirst`：「Please click the "Generate Table Card" button above first before proceeding.」 |

## 3 個關鍵設計決策

| 決策 | 結論 | 理由 |
|---|---|---|
| 5-state machine 哪些放行 | 僅 `ready` / `stale` 放行；`idle` / `generating` / `error` 阻擋 | 「使用者已證明會用桌牌」即可放行；`generating` 避免 race、`error` 強制重試 |
| stale 放行而非阻擋 | stale 放行 | stale 意味「桌牌存在、畫布已變更」但不影響「桌牌存在」這個事實；使用者可能刻意保留舊桌牌（店家先印這批、內部另有設計）；「重新生成」按鈕已提示 stale 狀態，使用者可自行決定 |
| 防呆放在 `handleNext` 還是 `setTableCardElements` | 放 `handleNext`（純邏輯判斷、無副作用） | 跟其他 step 共用 `isStepNValid()` 風格；不放 store setter 是因為這是 UI flow gate、不該污染 store invariant |

## 4 條 i18n 規則對齊

| 規則 | 對齊方式 |
|---|---|
| Rule 023 § 元件化原則 | `step7Guard.mustGenerateFirst` 放 `tableCard` namespace（component-bound），不污染 `cardEditor`；workspace `useTranslation(['cardEditor', 'tableCard'])` 跨 namespace 翻譯 |
| Rule 023 § 翻譯書寫紀律 | zh-TW 全中文（「請先按上方『生成桌牌』按鈕生成一次桌牌, 才能進入下一步」）、en 全英文 |
| Rule 023 § Shared Validation 用 i18n Key | 不適用（本 fix 為 UI hint，無 validation 邏輯） |
| Rule 006 § 完工前驗證 | `verify:i18n` 19 namespaces 全綠、typecheck exit 0、lint exit 0、1384/1384 tests pass |

## 為什麼這次 session 沒走 L3 Heavy 流程

| 維度 | 本 PR | 對比 QR Code（1f58356 L3 Heavy）|
|---|---|---|
| 觸發 | 1 個 user feedback（桌牌忘記生成 bug） | 1 個新功能（QR Code 工具）|
| 跨模組 | 0（純 frontend 邏輯）| 4（shared schema + store + canvas + backend 4-layer）|
| Decision Log | 不必 | 必須（library 選擇）|
| Brainstorming | 5-state 對照在 JSDoc 內 | 獨立 brainstorming 階段 |
| scope | 4 檔（1 改 1 改 2 改）| 24 檔（跨 3 packages + i18n + smoke）|

## 失敗紀錄 / 教訓

| 項目 | 影響 | 修法 |
|---|---|---|
| **1. 早期 spec 5-state 全阻擋（idle / generating / ready / stale / error）**| 違反「已成功過就放行」invariant，stale 阻擋會誤導使用者 | 改為「ready / stale 放行；idle / generating / error 阻擋」|
| **2. test 跑在根目錄（`npx vitest run` from `SAOME-REBUILD/`）**| vitest 找不到 `apps/frontend/vitest.config.ts`，`@/hooks/...` alias 解析失敗 | 改從 `apps/frontend/` 跑（package.json `test` script 是從該目錄執行的）|
| **3. 早期 `step7-repro.test.tsx` 暫存檔** | 我把暫存 repro test 留成 untracked，前端 dev server 重啟時被吃掉 | 結論：untracked 暫存檔不該長期存在 dev 目錄；改用 inline mock 在正式 test file |

## 跟既有 rule 對齊

| Rule | 對齊方式 |
|---|---|
| `000 § A.2` 主組件 ≤ 100 行 | `isStep7Valid()` 抽成獨立 function 守「主組件只做組裝」鐵律 |
| `011` 開發紀錄規範 | 本 feedback + DEV log + commit footer `Self-improvement:` 同 commit |
| `022` Component Reuse | 對齊既有 `isStep1Blocked` / `isStep2Valid` / `isStep4Valid` / `isStep5Valid` / `isStep6Valid` 風格 |
| `023` Shared Package | i18n key 放 `tableCard` namespace（component-bound，跨 feature 重用）|
| `025` Vibe Coding L2 Checklist | i18n 先建、test 跟上（it.each × 5-state + 紅字顯示 + handleNext 三類行為）、typecheck / lint / 全部 tests 全綠 |
| `006` 完工前驗證 | typecheck exit 0 + lint exit 0 + 1384/1384 tests pass + i18n verify 19 namespaces OK |
| `013` RWD | 紅字警示走 `text-xs` + `style={{ color: 'var(--color-destructive)' }}`（design token，非 hardcode）|
| `024` Mobile Future-Proof | 不引入 web-only API（純 useState / useTranslation），RN 化零成本 |

## 驗證輸出（Rule 006 5 項必跑）

| 項目 | 結果 |
|---|---|
| `npx tsc -b apps/frontend/tsconfig.app.json --noEmit` | ✅ exit 0 |
| `npx oxlint <改動檔案>` | ✅ exit 0 |
| `npx vitest run src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorWorkspace.test.tsx` | ✅ 25/25 pass |
| `npx vitest run src/components/business/dashboard/CardBuilderEditor` | ✅ 1384/1384 across 82 files |
| `npm run verify:i18n` (內含在 test script) | ✅ 19 namespaces OK |

## 跨鏈

- **DEV LOG**: [DEV/10-2026/1004-step7-table-card-guard-master-dev-log.md](../../DEV/10-2026/1004-step7-table-card-guard-master-dev-log.md)
- **Step 7 QR Code master**（前一個工作）: [DEV/10-2026/1004-step7-qrcode-master-dev-log.md](../../DEV/10-2026/1004-step7-qrcode-master-dev-log.md)
- **INDEX**: [INDEX.md](../INDEX.md)（新增 2026-10-04 entry）

## Self-improvement action items

| Action | Owner | Trigger | Status |
|---|---|---|---|
| production smoke test：完整 Step 1 → Step 7 → 試跳過「生成桌牌」→ 驗證「下一步」disabled | User | push 完成後 | ⏳ pending |
| 評估是否把 `isStep7Valid` 抽進 store（讓 `Step7TableCard` 內的「重新生成」按鈕也能用）| Future | 第二個 consumer 出現 | ⏳ pending |
| 加 `tag:step-guard` 機制到 `runs/improvements/INDEX.md`，把 `isStepNValid` 系列串起來 | Future | 下次 step guard 變更 | ⏳ pending |
| Step 7 「生成桌牌」按鈕目前由 Header 控制，但 disabled 狀態從 `tableCardExportState` 讀，考慮加 i18n hint 在 Header tooltip（目前只有按鈕顏色/文字切換）| Future | ux feedback | ⏳ pending |

---

> 撰寫者：cursor (assisted) ｜ 時間：2026-10-04 06:12 UTC+8
>
> 本 feedback 與 DEV LOG `DEV/10-2026/1004-step7-table-card-guard-master-dev-log.md` 同源；本檔補既有 docs 沒有的「5-state 對照」「stale 放行 vs 阻擋的取捨」「為什麼不抽 shared」三段。
