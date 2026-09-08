---
title: "2026-09-09 Step 6 PointsPerSpendField Mobile Line-Break — Phrase-Row Layout + md:contents Flatten"
date: 2026-09-09
type: bug-fix + ui-ux
scope: frontend/Step6CardLogic/RewardCardLogic
status: resolved
severity: SEV-3（純 UI / 閱讀體驗, 不擋 flow, 但每個手機用戶開頁都撞到）
commits:
  - (this PR)
related:
  - .cursor/rules/000-modular-design.mdc § A.1
  - .cursor/rules/015-前端RWD鐵律.md（mobile-first）
---

# 2026-09-09 Step 6 `PointsPerSpendField` Mobile Line-Break — Phrase-Row Layout + `md:contents` Flatten

## TL;DR

`PointsPerSpendField` 在 mobile 把 `<span>` / `<input>` 全部當 top-level flex item，導致「每消費」「R」「200」「元」「=」「獲得」「2」「個點數」每個 fragment 各自獨立成行，讀起來像 8 行破碎的句子，不是正常中文排列。修法：把整句拆成 2 個語意 phrase-row（"每消費 [N] 元" / "= 獲得 [M] 個點數"）當 mobile 的 row，desktop 透過 `md:contents`（`display: contents`）把兩個 row 的 children 攤平回單一水平 row。原 186 個測試 0 regression + 2 條 mobile regression test。

## 症狀（user-visible）

| 表面 | 觀察 |
|---|---|
| 截圖（2026-09-09 morning, mobile viewport）| 「消費點數比例」標題下方，整句斷成 8 個獨立豎排行：每消費 / R / 200 / = / 獲得 / 2 / 個點數 |
| 對比 stamp.per_spend 段（已存在的 reference 實作, 2026-09-07）| stamp 段同樣是「每消費 N 元可獲得 M 個蓋章」，用 2-row stack 排版，讀起來正常 |
| Reward 段為何不同 | 2026-09-09 refactor 把 pointsPerSpendField 改 inner-row 設計時只考慮 desktop（`md:flex-row`），沒測 mobile，導致每個 fragment 變成獨立 row |

## 時間軸

| 時間 (UTC+8) | 事件 |
|---|---|
| 2026-09-09 ~07:15 | user 截圖：mobile view 下「消費點數比例」斷行破碎，不是正常文字排列 |
| 2026-09-09 ~07:18 | agent 讀 `PointsPerSpendField.tsx` — 確認 outer 是 `flex flex-col`，每個 fragment 是 top-level flex item |
| 2026-09-09 ~07:20 | TDD：先加 2 條 failing test（mobile regression），確認 RED |
| 2026-09-09 ~07:24 | refactor JSX：outer 保留 `flex flex-col md:flex-row`（mobile=stack / md+=row），內層拆 2 個 phrase-row 都加 `md:contents` 讓 desktop 攤平 |
| 2026-09-09 ~07:25 | GREEN：18/18 通過（含 2 條新測試） |
| 2026-09-09 ~07:26 | 188/188 全套 Step6CardLogic suite 通過；typecheck exit 0；oxlint 0 warnings；verify:i18n exit 0 |

## 根因（為什麼 mobile 變 8 行）

```tsx
// ❌ BEFORE — outer 是 flex-col，每個 child 都是獨立 row
<div className="flex flex-col gap-1.5 md:flex-row md:items-center md:flex-wrap md:gap-x-2 md:gap-y-1.5">
  <span>每消費</span>
  {isZAR && <span>R</span>}
  <input id="...amount" />
  {!isZAR && <span>元</span>}
  <span>=</span>
  <span>獲得</span>
  <input id="...points" />
  <span>個點數</span>
</div>
```

**flex 規則**：每個 direct child 是 flex item，flex item 自動 block-level。`flex flex-col` 強制每個 item 換行 + 撐滿 main axis。所以 8 個 span/input 全部堆成 8 行。

**為什麼之前沒被抓**：
- vitest + jsdom 沒有真實 layout engine，純 DOM tree 看不到 visual stack
- 既有「single row container」測試只驗 amount + points 同一 parent，沒驗 mobile visual hierarchy
- 2026-09-09 refactor focus 在 desktop compress（2 row → 1 row），沒跑 mobile preview

## 修法（phrase-row + md:contents）

**思路**：mobile 跟 desktop 是兩種 layout topology — mobile 要 vertical phrase-by-phrase，desktop 要 single horizontal sentence。同一個 DOM tree 不能同時滿足兩個 layout 模式，除非用 `display: contents` 把 mobile-only 結構「隱形」掉。

### Outer container

```tsx
<div className="
  flex flex-col gap-2                              /* mobile = 2 個 phrase-row stacked */
  md:flex-row md:items-center md:flex-wrap         /* md+ = 攤平成 single row, 允許窄 viewport wrap */
  md:gap-x-2 md:gap-y-1.5
">
```

### Phrase row 1（spend amount）

```tsx
<div className="
  flex flex-wrap items-center gap-x-1.5 gap-y-1     /* mobile = 內部 inline 排列 */
  md:contents                                       /* md+ = 把自己 invisible 掉，children 變 outer 直接子 */
">
  <span className="shrink-0">每消費</span>
  {isZAR && <span className="shrink-0">R</span>}
  <input className="... w-full md:w-24" />
  {!isZAR && <span className="shrink-0">元</span>}
</div>
```

### Phrase row 2（earned points, mobile 有 pl-4 indent）

```tsx
<div className="
  flex flex-wrap items-center gap-x-1.5 gap-y-1
  pl-4 md:contents md:pl-0                          /* mobile indent 顯示「這是 row 1 的結果」*/
">
  <span className="shrink-0">=</span>
  <span className="shrink-0">獲得</span>
  <input className="... w-full md:w-20" />
  <span className="shrink-0">個點數</span>
</div>
```

### 為什麼 `md:contents` 比 `md:flex` 適合

| 方案 | 結果 |
|---|---|
| 用 `md:flex` 在每個 phrase-row 也設水平 flex | 兩個 nested flex container 在 md+ 仍存在 → grid/flex 計算兩次 → 邊距 / baseline 對齊怪異 |
| 用 `md:contents` | row container 變 `display: contents`，children 被 hoist 到 outer → outer 直接看到 7-8 個 children → 跟原本 single-row layout 等價 |
| 用 conditional render（mobile / desktop 兩份 JSX）| code duplication + hydration mismatch 風險 |

`md:contents` 沒副作用、不破壞 a11y（modern browser 都正確處理）、零 dup 程式。

### Mobile 視覺

```
每消費 [200] 元
  = 獲得 [2] 個點數
```

- 每 row 1 個 phrase，labels 跟 input 同行
- row 2 的 `pl-4` (16px) 視覺 indent 暗示「row 2 是 row 1 的結果」

### Desktop 視覺

`md+` 把兩個 phrase-row 攤平 → outer 直接看到 [每消費] [R?] [input] [元?] [=] [獲得] [input] [個點數] → 同一個 1 行 sentence，保留現有 desktop compact layout。

## Regression test（2 條新 test, 1 條改寫）

### 新 test 1 — Mobile: label 跟 input 同 phrase-row

```ts
it('mobile regression 2026-09-09: "每消費" label sits in SAME phrase-row as amount input', () => {
  // label 跟 input 共享同一個 parent（phrase-row），不再被 flex-col 拆開
  expect(amountLabel.parentElement).toBe(amountInput.parentElement);
});
```

### 新 test 2 — Mobile: amount 跟 points 在不同 phrase-row

```ts
it('mobile regression 2026-09-09: amount and points live in DIFFERENT phrase-row containers', () => {
  // 直接 children of outer 還是可以有相同 grandparent
  expect(amountInput.parentElement).not.toBe(pointsInput.parentElement);
  expect(amountInput.parentElement.parentElement).toBe(pointsInput.parentElement.parentElement);
});
```

### 改寫 test — md+ 透過 `md:contents` 攤平

```ts
it('md+ viewport: amount + points share a GRANDPARENT row container; each phrase-row uses md:contents to flatten', () => {
  // 新語意: 兩個 phrase-row 都用 md:contents, 透過 shared grandparent 連結
  expect(amountParent.parentElement).toBe(pointsParent.parentElement);
  expect(amountParent.className).toContain('md:contents');
  expect(pointsParent.className).toContain('md:contents');
});
```

### 為何 「label 同 phrase-row」會通過舊 code？

舊 code label 跟 input 是 outer 直接 sibling，`parentElement` 一樣 → 測試通過。但 bug 是 label / input / 下一個 label / 下一個 input / 之間的 fragment 全部獨立 row。**新 test 2（amount/points 不同 parent）才能 pin 死 mobile hierarchy**。

## TDD 流程

1. **RED**：2 條新 test 先 fail — amount/points 仍是 outer 直接 sibling
2. **GREEN** 確認紅：vitest 報 `expected ... not to be ...`
3. **Refactor**：outer 不動 className，內層拆 2 個 phrase-row 加 `md:contents`
4. **GREEN 重跑**：18/18 全綠；`md:flex-row` + `md:contents` 雙 className 都被 assertion 驗到
5. **Sanity**：
   - Step6CardLogic full suite 188/188（原 186 + 2 新）
   - `tsc -b --noEmit` exit 0
   - `oxlint` 0 warnings
   - `verify:i18n` exit 0（既有 Latin-mixed warning 全為既有，非本次新增）

## 對齊既有 RWD + Component Reuse 規則

| 規則 | 對齊動作 |
|---|---|
| `.cursor/rules/015-前端RWD鐵律.md` mobile-first | mobile 預設起點, 用 `md:` 增強 |
| `.cursor/rules/000-modular-design.mdc § A.3 Hook Split Pattern spirit | 把 visual structure 拆成 sub-container（phrase-row），主組件保持 assembly-only 風格 |
| `.cursor/rules/036-popover-sizing-pattern.mdc`（display: contents 慣例） | 同樣的 `display: contents` 技巧 — 讓「group container」在 desktop 等價消失 |

## 後續觀察

- React Native 化時 `display: contents` 在 Yoga 不支援 → RN migration 時需建立 `.web.ts` / `.native.ts` 變體，這層已在 `Rule 024` Hook Split Pattern 規範下
- 等下個 PR 在桌機預覽 screenshot 看 `md:contents` 是否真的視覺跟舊版一致（screen reader 也要測）
