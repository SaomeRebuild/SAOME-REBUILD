# StampIconPicker Trigger — Default Icon Visual Preview

> Date: 2026-09-04
> Session: stamp grid feature follow-up UX fix
> Scope: Step 3 stamp grid editor panel (left column), `StampIconPicker` trigger button

## 背景

Stamp grid feature（commit `8d0e5b9`）完成後，使用者進到 Step 3 選擇 `stamp_card` 或 `multipass`，會看到新區塊「印章與格數」。格數選擇器（4 顆 segmented buttons）顯示清楚，但印章圖示選擇器的 trigger button 顯示 32×32 灰色 placeholder (`bg-neutral-300`)，label 顯示「選擇印章」。

使用者反應：「這裡應該顯示被使用的蓋章」（DOM path: `<span class="block h-8 w-8 bg-neutral-300" data-cursor-element-id="cursor-el-1">`）。

## 根因

`StampIconPicker.tsx` 的 `currentIcon` 邏輯：

```tsx
const currentIcon = stampIconId ? getStampIcon(stampIconId) : undefined;
```

當 `stampIconId` 為空字串（store 預設值）時，`currentIcon` 是 `undefined`，render fallback `<span className="bg-neutral-300">`。

設計決策（plan § 8.2）原本允許「不選 stamp」狀態（保留既有 CreditCard icon + name fallback）。但對剛進入 Step 3 的使用者：

- 他們已選 `stamp_card`，預期看到印章
- 看到 gray placeholder → 困惑「這是 bug 還是我沒選？」
- 必須點 trigger 才會看到第一個 icon

## 修法

最小變更 `StampIconPicker.tsx`，不改 store default、不改 schema：

```tsx
const fallbackIcon = STAMP_ICONS[0];
const currentIcon = stampIconId
  ? (getStampIcon(stampIconId) ?? fallbackIcon)
  : fallbackIcon;
```

並加 `aria-label` 給 trigger button，讓 a11y name 穩定是「印章圖示」而非隨 fallback icon 變動。

**設計決策**：

| 選項 | 理由 | 結果 |
|---|---|---|
| A. 改 store default `stampIconId` 為第一個 icon | 單一 source of truth，strip 也會立刻 render grid | 拒：會把 Strip 也改變行為（plan § 8.2 原本說「沒選時 fallback」），scope creep |
| **B. 只改 picker trigger 顯示** | 最小變更，不影響 Strip 既有 fallback 行為 | **採用** |

**Nullish coalescing** (`??`) 而不是 optional chaining：當 store 持有 stale icon id（icon 檔案被移除），trigger 也 fallback 到第一個 icon 而不是 crash。

## 學習

### 1. Visual placeholder ≠ functional default

Gray placeholder 表示「沒有東西」，但對剛選完卡種的使用者而言，他們的 mental model 是「系統應已選一個」。Fix：picker trigger 用第一個 icon 作為 visual default；store 維持空字串（語意「未選定」）。兩者分離。

### 2. `aria-label` 跟 visible label 解耦

加上 `aria-label` 讓 a11y name 永遠是「印章圖示」（穩定），visible label 跟著當前狀態變（fallback / 已選）。Screen reader 不會因為 icon 切換而讀到不同 button name。

### 3. Defensive icon lookup

`getStampIcon(stampIconId) ?? fallbackIcon` 比 `getStampIcon(stampIconId) || fallbackIcon` 安全 — 若將來 manifest 有 `stampedUrl: ''` 等 falsy 值（理論上不該有，但 defensive），行為一致。

## 影響範圍

| 檔案 | 改動 |
|---|---|
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3StampGrid/StampIconPicker.tsx` | trigger 顯示 fallback icon + 加 aria-label |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3StampGrid/Step3StampGrid.test.tsx` | 加 2 個 test（fresh load + invalid id 兩種 fallback 情境） |

## Verification

| 項目 | 指令 | 結果 |
|---|---|---|
| TypeScript | `npx tsc -b --noEmit` | exit 0 |
| Lint | `npm run lint` (oxlint) | exit 0（僅 pre-existing warnings） |
| Vitest | `npx vitest run` | 55 files, 455 passed (+2 vs prior 453), 5 skipped |
| Backend schema-conformance | `npx vitest run schema-conformance` | 13/13 passed |
| verify:i18n | `npm run verify:i18n` | 17 namespaces passed |
| Build | `npm run build` | exit 0 + dist/ produced |
| Manual bundle URL audit | grep localhost + grep josh1989213.workers.dev in dist/ | OK |

## 待辦（後續 session）

- [ ] 觀察「使用者是否困惑為什麼 trigger 顯示 bell 但 store 是空」— 若有反應，改 plan：store default 也設第一個 icon，strip 也立刻 render grid
- [ ] 寫 Rule 023 元件 i18n 章節補：visual default 與 functional default 分離 pattern
