# 2026-10-04 — Step 7 客製化桌牌防呆守門 master DEV LOG

> 給未來 trace 整條 Step 7 guard 鏈的人 single entry point。本檔**不重述每個 commit 的細節**——所有根因 + 修法都在對應 feedback 裡；本檔負責**架構全景 + 跨 commit 的設計 invariant + 給未來 session 的提醒**。

## 一句話總結

把 CardBuilderEditor 的 Step 7 客製化桌牌「下一步」按鈕加防呆守門：使用者必須至少成功按過一次「生成桌牌」按鈕（`tableCardExportState === 'ready' | 'stale'`）才能進入 Step 8（儲存）。`idle` / `generating` / `error` 三態阻擋下一步按鈕，並在按鈕下方顯示紅字警示。**scope = 4 檔變更**（1 workspace 改 + 1 test 改 + 2 i18n 改），0 schema / 0 store signature / 0 backend 變更。

## 範圍 vs 其他 Step guard

| 對比項 | `isStep1Blocked` | `isStep4Valid` / `isStep5Valid` / `isStep6Valid` | **`isStep7Valid`（本檔）** |
|---|---|---|---|
| 觸發條件 | 1-condition（卡片類型必選）| multi-condition（必填欄位 + sub-card-type specific）| **5-state machine**（export 狀態）|
| 阻擋粒度 | 完全不渲染「下一步」 | 按鈕 disabled | 按鈕 disabled + 紅字 hint |
| 對齊 invariant | 卡片類型必選 | Apple Wallet 規格 | 「已成功過一次」即可放行 |
| stale 行為 | N/A | N/A | **放行**（已成功過、畫布後來又改了，使用者可刻意保留舊桌牌）|
| hint 文案 | 沒有 | 沒有 | 紅字警示引導使用者按 Header 按鈕 |

## 5-state machine 對照表

| 狀態 | 意義 | 阻擋? | 對應 Step 7 視覺 |
|---|---|---|---|
| `idle` | 使用者從未按過生成鈕 | ✅ 阻擋 | 紅字提示「請先按上方『生成桌牌』按鈕生成一次桌牌」 |
| `generating` | POST 進行中、還沒成功過 | ✅ 阻擋 | 同上（避免 race 中放行）|
| `ready` | 至少成功生成過一次 | ❌ 放行 | 無 hint（避免多餘雜訊）|
| `stale` | 成功過、後來畫布又改了 | ❌ 放行 | 無 hint（對齊既有 invariant: stale 可下載）|
| `error` | 上次生成失敗 | ✅ 阻擋 | 紅字提示，使用者必須按「重試生成桌牌」成功才能前進 |

## 架構全景

```
CardBuilderEditorWorkspace.tsx
├── useTranslation(['cardEditor', 'tableCard'])    // 多 namespace pattern 對齊 Footer/DashboardHeader
├── isStep7Valid() → boolean                        // 純邏輯、無副作用
│   └── useCardBuilderStore.getState().tableCardExportState
│       ├── 'ready' | 'stale'   → true
│       └── 'idle' | 'generating' | 'error' → false
├── handleNext() (line ~780)
│   └── step === 7 && !isStep7Valid() → return  (UI 之外 defense-in-depth)
└── <button onClick={handleNext} disabled={!isStep7Valid()}>
    {t('step1.next')}
    </button>
    {!isStep7Valid() && (
      <p style={{ color: 'var(--color-destructive)' }} role="alert">
        ⚠ {t('step7Guard.mustGenerateFirst', { ns: 'tableCard' })}
      </p>
    )}

i18n:
- tableCard.zh-TW.ts + tableCard.en.ts → step7Guard.mustGenerateFirst

store (CardBuilderEditor.store.ts, 既存在):
- tableCardExportState: 'idle' | 'generating' | 'ready' | 'stale' | 'error'
- setTableCardExportState(state) — 由 Step7TableCardSidebar 的「生成桌牌」/「重新生成」/「重試」按鈕 dispatch
```

## 5 個關鍵設計 invariant

### 1. stale 放行而非阻擋

`tableCardExportState === 'stale'` 放行的理由：

| 角度 | 說明 |
|---|---|
| 語意 | stale 意味「桌牌存在、畫布已變更」，但這不影響「桌牌存在」這個事實 |
| 業務 | 使用者可能刻意保留舊桌牌（A4 大小給店家印，內部另有設計）|
| UX | 「重新生成」按鈕已提示 stale 狀態，使用者自行決定是否重生成 |
| 既有 invariant | Phase 5.16 store 已有「stale = 可下載」invariant，本 fix 對齊同一條線 |

### 2. 防呆放在 `handleNext` 而非 store setter

| 方案 | 優點 | 缺點 | 採納 |
|---|---|---|---|
| A. 放 `handleNext`（UI flow gate）| 純邏輯、無副作用、跟其他 step 共用 `isStepNValid` 風格 | 沒有 store-level 防護 | ✅ |
| B. 放 `setTableCardElements`（store invariant）| store 一致性保證 | 污染 store 純資料職責，違反「store 只存資料、不存 UI gate」| ❌ |

UI flow gate 屬於 workspace 層級，不該污染 store 純資料職責。對齊既有 `isStep4Valid` / `isStep5Valid` / `isStep6Valid` 風格。

### 3. UI + handleNext 雙重防護

| 層 | 程式碼 | 防護對象 |
|---|---|---|
| UI | `<button disabled={!isStep7Valid()}>` | 一般使用者（滑鼠點不到）|
| `handleNext` | `if (step === 7 && !isStep7Valid()) return;` | Defense-in-depth（瀏覽器 dev tools 強制 enabled、a11y tool 觸發、其他元件 bypass）|

兩層並存是 belt-and-suspenders；單靠任一層都不夠。

### 4. i18n 走 `tableCard` namespace（component-bound，不污染 `cardEditor`）

`step7Guard.mustGenerateFirst` 放 `tableCard` 而不是 `cardEditor` 的理由：

| 規則 | 對齊 |
|---|---|
| Rule 023 § 元件化原則 | component-bound namespace 跨 feature 重用（任何用 Step 7 的元件都吃到）|
| Rule 023 § 翻譯書寫紀律 | zh-TW 全中文、en 全英文 |
| Footer.tsx / DashboardHeaderActions.tsx pattern | `useTranslation(['ns1', 'ns2'])` + `t('key', { ns: 'ns2' })` |

### 5. Conformance test 必覆蓋 5-state × 行為 + 紅字顯示 + handleNext 行為

| Test | 覆蓋 |
|---|---|
| `it.each(5-state cases)` | 5 個狀態 × 預期 disabled 對照 |
| 紅字顯示規則 × 3 條 | idle 顯示、ready 隱藏、stale 隱藏 |
| handleNext × 3 條 | idle 阻擋、ready 前進、stale 前進（defense-in-depth）|

## 失敗紀錄 / 教訓

| 項目 | 影響 | 修法 |
|---|---|---|
| **1. 早期 spec 5-state 全阻擋** | 違反「已成功過就放行」invariant，stale 阻擋會誤導使用者 | 改為「ready / stale 放行；idle / generating / error 阻擋」|
| **2. test 從根目錄跑 vitest** | vitest 找不到 `apps/frontend/vitest.config.ts`，`@/hooks/...` alias 解析失敗 | 改從 `apps/frontend/` 跑（package.json `test` script 就是從該目錄執行）|
| **3. `step7-repro.test.tsx` 暫存 repro 檔** | 我把暫存 repro test 留成 untracked，前端 dev server 重啟時被吃掉 | untracked 暫存檔不該長期存在 dev 目錄；改用 inline mock 在正式 test file |

## 跟既有 rule 對齊

| Rule | 對齊方式 |
|---|---|
| `000 § A.2` 主組件 ≤ 100 行 | `isStep7Valid()` 抽成獨立 function 守「主組件只做組裝」鐵律 |
| `011` 開發紀錄規範 | 本 DEV log + feedback 同 commit，commit footer 帶 Self-improvement 標記 |
| `022` Component Reuse | 對齊既有 `isStep1Blocked` / `isStep2Valid` / `isStep4Valid` / `isStep5Valid` / `isStep6Valid` 風格 |
| `023` Shared Package | i18n key 放 `tableCard` namespace（component-bound，跨 feature 重用）|
| `025` Vibe Coding L2 Checklist | i18n 先建、test 跟上（it.each × 5-state + 紅字顯示 + handleNext 三類行為）、typecheck / lint / 全部 tests 全綠 |
| `006` 完工前驗證 | typecheck exit 0 + lint exit 0 + 1384/1384 tests pass + i18n verify 19 namespaces OK |
| `013` RWD | 紅字警示走 `text-xs` + `style={{ color: 'var(--color-destructive)' }}`（design token，非 hardcode）|
| `024` Mobile Future-Proof | 不引入 web-only API（純 useState / useTranslation），RN 化零成本 |

## 驗證輸出（commit `TBD`）

| 項目 | 結果 |
|---|---|
| `npx tsc -b apps/frontend/tsconfig.app.json --noEmit` | ✅ exit 0 |
| `npx oxlint <改動檔案>` | ✅ exit 0 |
| `npx vitest run src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorWorkspace.test.tsx` | ✅ 25/25 pass（+11 新增）|
| `npx vitest run src/components/business/dashboard/CardBuilderEditor` | ✅ 1384/1384 across 82 files |
| `npm run verify:i18n` (內含在 test script) | ✅ 19 namespaces OK |

## 後續 TODO（本 PR 不在 scope）

- [ ] production smoke test：完整 Step 1 → Step 7 → 試跳過「生成桌牌」→ 驗證「下一步」disabled
- [ ] 評估是否把 `isStep7Valid` 抽進 store（讓 `Step7TableCard` 內的「重新生成」按鈕也能用）— 第二個 consumer 出現時再做
- [ ] 加 `tag:step-guard` 機制到 `runs/improvements/INDEX.md`，把 `isStepNValid` 系列串起來
- [ ] Step 7 「生成桌牌」按鈕目前由 Header 控制，但 disabled 狀態從 `tableCardExportState` 讀，考慮加 i18n hint 在 Header tooltip（目前只有按鈕顏色/文字切換）

## 自我反省 / 給未來 session

1. **「repro 測試」與「conformance 測試」要分開** — 我這次先寫 `step7-repro.test.tsx` 暫存 repro，最後併入正式 `CardBuilderEditorWorkspace.test.tsx`。**未來怎麼避**：pro 階段直接寫 conformance test（`it.each` 5-state 一次到位），不另開 repro 檔。**教訓已進 feedback**。

2. **vitest 必須從含 `vitest.config.ts` 的目錄跑** — `apps/frontend/vitest.config.ts` 沒在 root，從根目錄跑 `npx vitest run` 會找不到 alias，CI 全綠但本地開發者會被誤導。**未來怎麼強化**：在根目錄 `package.json` 加上 `"test:frontend": "cd apps/frontend && npm test"`，避免開發者用 `npx vitest` from root。

3. **5-state 全阻擋 vs 5-state 部分放行的設計 intent 不明顯** — 早期 spec 直覺是「5 個狀態對應 5 個 disabled 與否」，但實際需求是「成功過一次即可放行」（stale 不該擋）。**未來怎麼強化**：JSDoc 內明寫「`stale` 放行而非阻擋」的理由（已實作），不靠 reviewer 問為什麼。

4. **feedback 與 DEV LOG 同步寫的時機** — 本次因為有上個 session 的教訓（`20261004-step7-qrcode-tool.md` 的 format + commit footer 帶 Self-improvement），寫起來順暢很多。**未來怎麼強化**：每次 L2+ 變更都同 session 帶 feedback + dev log + INDEX，不要等「明天補」。

5. **5-state 對照表應該進 conformance test 的 describe block 標題** — 已實作（`step7ExportStateCases` 5 個 case 從 `idle` 到 `error`），但可以在 describe 加 inline markdown 對照表（jsdoc）讓讀者一眼看到 invariant。

## 跨鏈

- **Feedback 主檔**: [runs/improvements/feedback/20261004-step7-table-card-guard.md](../../runs/improvements/feedback/20261004-step7-table-card-guard.md)
- **Step 7 QR Code master**（前一個工作）: [DEV/10-2026/1004-step7-qrcode-master-dev-log.md](1004-step7-qrcode-master-dev-log.md)
- **既有 reference**: `0927-step7-table-card-master-dev-log.md` — Step 7 桌牌設計前 10 個 round 的 master log
- **INDEX**: [runs/improvements/INDEX.md](../../runs/improvements/INDEX.md)（新增 2026-10-04 entry — 本檔 + feedback + INDEX 三條同 commit）

## Self-improvement action items

| Action | Owner | Trigger | Status |
|---|---|---|---|
| commit 規範層/操作層 4 個檔（1 改 + 1 test + 2 i18n + 1 feedback + 1 dev log + 1 INDEX 條目）| Self | 立即 | ⏳ pending（本 commit 內帶）|
| production smoke test：完整 Step 1 → Step 7 → 試跳過「生成桌牌」→ 驗證「下一步」disabled | User | push 完成後 | ⏳ pending |
| 評估是否把 `isStep7Valid` 抽進 store（讓 `Step7TableCard` 內的「重新生成」按鈕也能用）| Future | 第二個 consumer 出現 | ⏳ pending |
| 加 `tag:step-guard` 機制到 `runs/improvements/INDEX.md`，把 `isStepNValid` 系列串起來 | Future | 下次 step guard 變更 | ⏳ pending |
| 評估在根 `package.json` 加 `"test:frontend": "cd apps/frontend && npm test"` 防止開發者從根目錄跑 vitest 找不到 config | Future | 第二次有開發者撞到 | ⏳ pending |

---

> 撰寫者：cursor (assisted) ｜ 時間：2026-10-04 06:12 UTC+8
>
> 本 DEV LOG 與 feedback `runs/improvements/feedback/20261004-step7-table-card-guard.md` 同源；本檔補既有 docs 沒有的「5-state 對照」「stale 放行 vs 阻擋的取捨」「為什麼不抽 shared」三段。
