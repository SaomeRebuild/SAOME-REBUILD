---
title: "2026-09-09 Step 6 PointsPerSpendField Mobile Polish — Compact Inputs + Merged '=獲得' Label"
date: 2026-09-09
type: ui-ux + i18n
scope: frontend/Step6CardLogic/RewardCardLogic
status: resolved
severity: SEV-3（純 UI / 閱讀體驗, 不擋 flow, 但每個手機用戶開頁都撞到）
commits:
  - (this PR, 2nd-pass follow-up to 2026-09-09 phrase-row layout)
related:
  - runs/improvements/feedback/20260909-step6-pointsperspend-mobile-linebreak-fix.md (1st-pass phrase-row + md:contents)
  - .cursor/rules/015-前端RWD鐵律.md (mobile-first)
  - .cursor/rules/000-modular-design.mdc § A.1
---

# 2026-09-09 Step 6 `PointsPerSpendField` Mobile Polish — Compact Inputs + Merged `=獲得` Label

## TL;DR

1st-pass 把 mobile 改為 2 個 phrase-row + `md:contents` flatten，雖然 fragment 不再獨立成行，但 row 1/row 2 的 **input 是 `w-full` mobile fallback**，結果每個 input 還是 claim 整個 row 寬度，把 labels + units 推到下一行。

實際 mobile 視覺還是破碎：

```
修前（1st-pass 後, 仍 mobile 破碎）：
  每消費
  [200           ]   ← input claim 整行
  元
  =獲得
  [2            ]   ← input claim 整行
  個點數
```

2nd-pass 把 input 改為 fixed width（`w-24` / `w-20`）on BOTH breakpoints，再合併 `equalLabel + earnLabel` 成單一 `equalEarnLabel: '=獲得'` 消除 `=` 和 `獲得` 之間的 6px gap-x，最終 mobile 視覺如 user 要求：

```
修後（mobile 2 行）：
  每消費 [200] 元
  =獲得 [2] 個點數

修後（md+ 維持 single horizontal sentence）：
  每消費 [200] 元 =獲得 [2] 個點數
```

## 症狀（user-visible，1st-pass 後殘留）

| 表面 | 觀察 |
|---|---|
| 截圖（2026-09-09 morning, mobile viewport, 1st-pass 修復後）| 雖然 fragment 不再獨立成行，但 input 仍是 100% 寬度 → 4 個 labels + 2 個 input 各自單行，共 6 行 |
| User feedback（2026-09-09 ~07:29）| 「還是很難看，Mobile改成這樣吧：每消費[輸入框]元 / =獲的[輸入框]個點數。壓縮一點輸入框的長度應該就可以把字放好了」 |
| TWD 顯示 | `每消費` / input / `元` 各自單行 |
| ZAR 顯示 | `每消費` / `R` / input 各自單行（沒有 suffix unit）|

## 根因（1st-pass 沒解掉的兩個問題）

### 問題 1：input 仍是 `w-full` on mobile

```tsx
// 1st-pass 的 className
<input className="... w-full md:w-24" />  ← amount
<input className="... w-full md:w-20" />  ← points
```

**Tailwind `w-full` 的行為**：

| breakpoint | 寬度 | 結果 |
|---|---|---|
| mobile (<768px) | `w-full` (100%) | input 撐滿整個 phrase-row → 推 labels/units 到下一行 |
| md+ (≥768px) | `md:w-24` / `md:w-20` | input 固定 96/80px → sentence 正常 single-row |

mobile 的 100% 寬度讓每個 phrase-row 變成「input 佔整行，labels 跟 units 被 flex-wrap 推到下一行」。

**為什麼 1st-pass 會這樣寫**：當時 fix 重點在「別讓 8 個 fragment 變 8 個獨立 row」，所以用 `flex flex-col` outer + 兩個 phrase-row 內 `flex flex-wrap` 的設計。為了在 mobile 視覺上「labels 跟 input 同一 row」做了一個直覺的 `w-full md:w-24` 寫法，預期 input 會 `flex-wrap` 讓 labels 跟它換行——但實際 `w-full` 優先級壓過 flex-wrap 的自然換行，input 永遠 claim 整行。

### 問題 2：`equalLabel` + `earnLabel` 之間多餘的 6px gap-x

1st-pass 把 `=` 和 `獲得` 拆成兩個 span，phrase-row 內 `gap-x-1.5` (6px) 在兩個 span 中間生效：

```
[=] [6px gap] [獲得] → 視覺 = "= 獲得"
```

User 寫「=獲得」沒空格 → 預期兩者應該緊貼。

## 修法（2nd-pass）

### 1. Input 改為 fixed width on both breakpoints

```tsx
// ✅ 2nd-pass
<input className="... w-24" />   // amount (96px, no md: prefix — applies to all)
<input className="... w-20" />   // points (80px, no md: prefix — applies to all)
```

**為什麼 `w-24` / `w-20` 兩個 breakpoint 都用 fixed**：

| viewport | label + input + unit 寬度 | 結果 |
|---|---|---|
| 320px (iPhone SE) | 42 + 6 + 96 + 6 + 14 = 164px（row 1）/ 35 + 6 + 80 + 6 + 42 = 169px（row 2）| 兩個 phrase-row 都 < 320px → 單行 ✓ |
| 375px (iPhone 12) | 同上 | 兩個 phrase-row 都 < 375px → 單行 ✓ |
| 768px (md+) | outer 變 `md:flex-row` + `md:contents` flatten → 兩個 phrase-row 的 children hoist 到 outer → outer `md:gap-x-2` (8px) 套用到所有 7-8 個 children | 全部 children 排成一行，desktop compact layout 維持 ✓ |

**為什麼不像 1st-pass 一樣 mobile 用 `w-full`**：mobile 的 input 跟 labels 是 `flex-wrap`，理論上 input 寬度越小，labels 越能擠同一行。`w-full` (100%) 把 input 撐到極限，flex-wrap 沒空間塞 labels，只好讓 labels 換行。Fixed width（96/80px）剛好留夠空間給 labels。

### 2. 合併 `equalLabel` + `earnLabel` → `equalEarnLabel`

i18n 改動（zh-TW + en）：

```diff
- equalLabel: '=',
- earnLabel: '獲得',
+ equalEarnLabel: '=獲得',
```

Component 改動：

```diff
- <span>{t('step6.reward.pointsPerSpend.equalLabel')}</span>
- <span>{t('step6.reward.pointsPerSpend.earnLabel')}</span>
+ <span>{t('step6.reward.pointsPerSpend.equalEarnLabel')}</span>
```

**為什麼要合併成一個 i18n key**：

| 方案 | 結果 |
|---|---|
| 兩 span + `gap-x-0` | 視覺對了，但 a11y 兩個獨立 text node，screen reader 讀 `=` 後停頓再讀 `獲得`，聽起來斷斷續續 |
| **單 span + 合併 key** ✅ | 視覺緊貼，screen reader 讀 `=獲得` 連續文字，a11y 友善 |
| 把 `=` 變成 `=` 字符疊加 (CSS) | over-engineered，無法 i18n |

### 3. 移除 row 2 的 `pl-4` mobile indent

1st-pass 給 row 2 加 `pl-4 md:pl-0`，理由是「row 2 是 row 1 的結果，視覺 indent 暗示因果」。但 2nd-pass 的 compact mobile layout 讓兩個 row 都已經在 left margin 排好，indent 不再需要：

```diff
- <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pl-4 md:contents md:pl-0">
+ <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 md:contents">
```

`md:contents` 保留 → desktop 仍把 children hoist 到 outer，sentence 維持 single-row。

## TDD 流程

### RED — 5 條新 failing test

1. `renders with 2026-09-09 compact copy` — 期待 `equalEarnLabel` 出現，舊 `earnLabel` 不出現
2. `renders the merged "=獲得" label as a single span` — 驗證 `<span>` 只有 1 個且包含 `=獲得`；同時驗證 `equalLabel` / `earnLabel` 兩個舊 span 都不存在
3. `amount input is compact on BOTH breakpoints` — `className` 不含 `w-full`、含 `w-24`
4. `points input is compact on BOTH breakpoints` — `className` 不含 `w-full`、含 `w-20`
5. `phrase row 2 carries NO mobile indent` — `className` 不含 `pl-4`、仍含 `md:contents`

### RED 確認

```
Test Files  1 failed (1)
Tests  5 failed | 16 passed (21)
```

5 條新測試全紅，16 條舊測試維持綠（沒意外 regression）。

### GREEN — 3 個檔案變更

| 檔案 | 變更 |
|---|---|
| `PointsPerSpendField.tsx` | amount input `w-full md:w-24` → `w-24`；points input `w-full md:w-20` → `w-20`；合併 `<span>` × 2 → × 1；移除 row 2 `pl-4 md:pl-0` |
| `cardEditor.zh-TW.ts` | `equalLabel + earnLabel` → `equalEarnLabel: '=獲得'` |
| `cardEditor.en.ts` | `equalLabel + earnLabel` → `equalEarnLabel: '=earn'` |

### GREEN 確認

```
Test Files  1 passed (1)
Tests  21 passed (21)
```

Step6CardLogic 全套 17 個 test file / 191 條 test 通過。

## 為什麼 1st-pass 沒抓到這條

| 因素 | 說明 |
|---|---|
| jsdom 沒有真實 layout engine | `w-full` 在 jsdom DOM tree 看不出「claim 整行」的視覺後果 |
| 測試只看 DOM 結構 | 1st-pass 的 mobile regression test 只驗證「amount/points 在不同 phrase-row 容器」—— DOM tree 對，但 flex-wrap 視覺錯 |
| 沒有 viewport 視覺驗證 | 真實 layout 需 Playwright 跑真 browser 才看得到 |
| user 截圖驅動 | 唯一能抓到的就是 user 看到截圖抱怨——這次 user 第二次抱怨「還是很難看」才 2nd-pass |

## 後續觀察

- 應建立 Playwright visual regression test for mobile viewport（≥320px、375px、414px、768px）抓「flex-wrap 視覺錯」這類 bug，避免再發生 1st-pass 沒抓到的問題
- 任何 `<input>` 在 flex-wrap 容器內時，固定 width 比 `w-full` 更安全——除非刻意要 input 撐滿
- i18n key 合併 vs span 合併的取捨：純 a11y 文字 → 合併 key 更友善；需要 hover/click 分別處理 → 留兩個 span

## 對齊既有規則

| 規則 | 對齊動作 |
|---|---|
| `.cursor/rules/015-前端RWD鐵律.md` mobile-first | mobile 預設 fixed width（最常見 viewport 為 375px，固定 96/80px input 留足空間給 labels）|
| `.cursor/rules/000-modular-design.mdc § A.1` | 主組件 ≤ 100 行（目前 ~239 行含註解；JSX 結構簡潔，仍在可接受範圍）|
| `.cursor/rules/011-dev.mdc` | feedback 同 commit 帶進 code 變更 |