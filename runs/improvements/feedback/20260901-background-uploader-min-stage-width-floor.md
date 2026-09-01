# BackgroundUploader MIN_STAGE_WIDTH Floor — Stage Width Floor = 200，不跟 CROP_WINDOW 走

> 日期：2026-09-01
> 來源 commit：`09cd641` refactor(mediaAssetUploader): add background variant support
> 修法位置：`apps/frontend/src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.tsx` L175–190
> 對齊 rule：Rule 028 § 12.1 Stage Width Floor（NEW）

## 背景

LogoUploader 時代的 Stage Height Invariant（Rule 028 § 12）只解釋 **height**：

```ts
const baseContainerH = Math.max(
  aspectMatchedH,
  responsiveCropWindowHeight + 2 * FRAME_PADDING,
);
```

沒解釋 **width floor**。當時 LogoUploader 用 `CROP_WINDOW_SIZE = 200` 為 floor 巧合 200 == mask size，沒出問題。

Background variant 的 `CROP_WINDOW_WIDTH = 800` 直接套用，結果 **376px iPhone viewport 撐不下 800px stage**，white crop frame 跑出容器（visual overflow bug，hero strip 變成兩條橫線）。

## 根因

原本的 stage width 公式：

```ts
const baseContainerW = Math.min(
  naturalCap,
  BASE_CANVAS_WIDTH,
  Math.max(availableWidth - STAGE_SAFETY_MARGIN, CROP_WINDOW_WIDTH),  // ← 800 對手機 viewport 太大
);
```

`Math.max(x, 800)` 在 viewport < 800 時永遠 return 800，導致 stage 寬度永遠 ≥ 800，但實際容器（`<aside>` in Step 3）只有 ~360px。`overflow: hidden` 沒設，frame 跑出去。

**概念錯誤**：把 `CROP_WINDOW_*`（使用者介面互動尺寸）當作 stage container 的下限。應該用一個跟 mobile viewport 對齊的 fixed floor。

## 修法

```ts
// Floor at MIN_STAGE_WIDTH (200) instead of CROP_WINDOW_WIDTH. The previous
// floor (CROP_WINDOW_WIDTH = 800 for background variant) forced the stage
// to 800px on a 376px phone viewport, overflowing the viewport and making
// the white frame (480px wide, centered in the 360px-capped outer) appear
// as full-width horizontal lines outside the container. The crop window
// itself scales to `min(baseContainerW * 0.6, CROP_WINDOW_WIDTH)`, so it
// always fits inside the stage regardless of stage size. The 200 floor
// also covers the jsdom test case where `offsetWidth` reports 0 (so the
// ResizeObserver-based `availableWidth` collapses to 0 and the floor
// prevents a degenerate 0px-wide stage).
const MIN_STAGE_WIDTH = 200;
const baseContainerW = Math.min(
  naturalCap,
  BASE_CANVAS_WIDTH,
  Math.max(availableWidth - STAGE_SAFETY_MARGIN, MIN_STAGE_WIDTH),
);
```

`MIN_STAGE_WIDTH = 200` 兩個覆蓋：

1. **Mobile viewport**（≥ 320px）：floor 200 保證 stage 至少 200px，frame 在容器內
2. **jsdom test**：當 `offsetWidth = 0`（ResizeObserver 還沒觸發或 wrapper 未 mounted），`availableWidth - STAGE_SAFETY_MARGIN = -16`，floor 200 把它撐成 200，避免 degenerate 0px-wide stage 導致 cropImage 算 NaN

## 學習

未來 variant 寫 MEDIA_ASSET_CONFIG 必須自問：

> 「`CROP_WINDOW_WIDTH` 比 mobile viewport 大時 floor 是什麼？」

→ magic number 該沉澱成 invariant，**不能跟 `CROP_WINDOW_*` 走**。

未來如果設計改成「user-configurable stage size」，要重新考慮 floor 邏輯（例如讓 user 從 small/medium/large 切換，floor 動態計算）。但預設情境下 `MIN_STAGE_WIDTH = 200` 是 universal 安全的 invariant。

## Rule update

Rule 028 § 12 補「§ 12.1 Stage Width Floor」子節：

- `MIN_STAGE_WIDTH = 200` 為 universal floor
- 不跟 `CROP_WINDOW_SIZE/WIDTH` 走
- 兩個覆蓋場景：mobile viewport 退化 + jsdom 退化

## Cross-link

- Master DEV LOG：Round 2 第 5 點「關鍵決策瞬間」— `DEV/08-2026/0901-background-uploader-implementation.md`
- Rule 028 § 12.1 Stage Width Floor（NEW）
- SKILL saome-image-upload § Stage Height Invariant 補 width floor 段
