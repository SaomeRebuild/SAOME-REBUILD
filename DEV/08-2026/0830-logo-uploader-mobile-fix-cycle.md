# LogoUploader 行動裝置修正循環（Aug 30）— 從症狀層到結構層

## Metadata

- **日期**：2026-08-30
- **作者**：Cursor Agent + Josh
- **commit 範圍**（12 commits，同 branch `fix/card-builder-migration`）：
  - 規範層：`8d969e2`（Rule 028 § 12 Stage Height Invariant）
  - 結構 fix：`3c8c7b3`、`1b0f7a5`、`cd21cf9`
  - 症狀 fix：`d1ff146`、`7d81110`、`66d046d`、`3426bd3`、`f16d7ea`、`e8f3b60`、`c66c4b6`、`db5711e`
- **規則 / skill 觸發**：`saome-dev-logging`、`saome-image-upload`、`saome-task-router`（L2 Standard）、`029-image-crop-mobile-ux.mdc`、`028-image-uploader-pattern.mdc`

---

## 背景

LogoUploader 於 2026-08-23 完成實作（見 `DEV/08-2026/0823-logo-uploader-implementation.md`）。7 天後（2026-08-30）使用者回報四類獨立的 mobile UX 問題，全部跟 cropping state 有關。本 DEV LOG 紀錄今天一整天的修正循環，從「症狀層 try-and-error」走到「結構層 invariant 定義」。

四個 user-facing issue（依使用者回報順序）：

| # | Issue | 對應 commits |
|---|-------|--------------|
| 1 | 直立圖片裁切位置 ≠ 實際上傳 | `db5711e`、`c66c4b6` |
| 2 | ≤412px 手機 viewport 拉寬 UI | `db5711e`、`66d046d`、`7d81110`、`d1ff146` |
| 3 | 手機拖曳一次只能移動一點（跳格）| `e8f3b60`、`f16d7ea`、`3426bd3` |
| 4 | landscape 圖片白框超出容器 | `cd21cf9`、`1b0f7a5`、`3c8c7b3` |

最後一個 fix 觸發 Rule 028 § 12 新章節（`8d969e2`）。

---

## Round 1（早）— Portrait stale closure + chain min-w-0（雙 issue 同 commit）

### 症狀

```
使用者回報：
- 「直式圖片的裁切，選定的位置跟實際上傳的位置差別很多」
- 「卡片設計 / Logo 上傳在手機上還是被撐開」
```

兩個 issue 看起來無關，但**根因都跟 LogoUploader 內部 measurement 沒算對**有關。

### Issue 1：Portrait crop 偏移 250 source px

**根因**：`handlePointerUp` `useCallback` 空 deps → 捕獲 first-render placeholder `baseContainerH=400`。Portrait 圖 `naturalHeight > naturalWidth` 會讓 `baseContainerH` 重新計算成 600，但 callback 從未 recreate，永遠用 stale 400 算 focalY：

```typescript
// ❌ Bug-φ: 空 deps
const handlePointerUp = useCallback(() => {
  setCropState((prev) => syncFocalFromOffset(prev, baseContainerW, baseContainerH));
}, []);  // baseContainerH 永遠是 initial 400

// ✅ Fix: deps 加 baseContainerW/H
const handlePointerUp = useCallback(() => {
  setCropState((prev) => syncFocalFromOffset(prev, baseContainerW, baseContainerH));
}, [baseContainerW, baseContainerH]);
```

**為什麼測試沒抓到**：square 圖 `baseContainerH = baseContainerW`，400 = 400，永遠對。Portrait / landscape 才會錯。

**修法**：`c66c4b6` + `db5711e` — handlePointerUp deps 補 baseContainerW/H，加 3 個 conformance test（portrait / landscape / square）。

### Issue 2：≤412px 手機 viewport 拉寬

**根因（第一層）**：crop stage 用 inline width（`style={{ width: 329 }}`），沿 flex chain 一路傳 `min-content` 到 Outlet。flex item 預設 `min-width: auto` = `min-content`，所以即使父層有 `min-w-0` 也不夠。

DOM path：
```
div#root > main > AppDashboardPage wrapper > Outlet inner
  > CardBuilderPage wrapper > CardBuilderEditor outer > flex-row
  > Workspace aside > section > LogoUploader root > crop stage (329px)
```

`LogoUploader root`、`section`、`aside`、`flex-row`、`Outlet inner` 全部要加 `min-w-0`。

**修法**：`db5711e` — 五層 `min-w-0` + html/body `overflow-x: hidden` 終局安全網。

---

## Round 2（上午）— iPhone 12 Pro Max 雙層 padding

### 症狀

```
使用者回報：「回到開發中，在 iPhone12max 的環境中，上傳圖片時 UI 還是被撐開了」
```

第一次 chain-min-w-zero fix 後，使用者在 320–412px 都過了（量測顯示 OK），但**實際 iPhone 12 Pro Max（428px）仍 overflow**。

### 根因

| 項目 | 預期值 | 實際值 |
|---|---|---|
| `VIEWPORT_PADDING` | 96 (2 層 p-6 × 48) | **48**（只算一層）|
| CardBuilderPage wrapper `p-6` | -24 -24 | -48 |
| Workspace aside `p-6` | -24 -24 | -48 |
| **實際可用寬度（428 viewport）** | 428 - 96 = **332** | 428 - 48 = **380**（錯）|

公式寫死 `VIEWPORT_PADDING = 48`，沒對應 layout chain 真實的兩層 padding。

**為什麼這個 bug 沒被早點抓到**：
- 320/375/390/412 viewport chain 量測時，`min-w-0` 已經夠 → OK
- 但 iPhone 12 Pro Max 428 viewport，chain 算出來 380 + 18px 邊界 = **398**，還沒到 min-w-0 觸發門檻，但已經 overflow container 自身

**修法**：`66d046d` — `VIEWPORT_PADDING` 48 → 96，新增 iPhone 12 Pro Max 428px regression guard。

### 教訓

`viewportW - X` 的 X 必須**列舉 layout chain**所有 padding 來源，不能憑印象寫。
詳見 `runs/improvements/feedback/20260830-logo-uploader-iphone12promax-double-padding.md`。

---

## Round 3（中午）— Mobile drag stutter（順暢度 vs 量）

### 症狀

```
使用者回報：「手機上還是只能用手指一點一點的拉動圖片」
「雖然感覺好像動作大一點了」「但本質上還是只能一點點拉，而不是順滑的移動」
```

Round 1-2 把「一次只能移動一點」（= sensitivity 太低）修了，但「順暢度」（= 視覺跟不上手指）沒解。

### 根因

每個 pointermove（mobile 60-120 Hz）都 `setCropState(...)`，React reconciliation 觸發整個 LogoUploader reconcile：

```typescript
// ❌ 舊
const handlePointerMove = useCallback((e) => {
  setCropState((prev) => ({ ...prev, offsetX: ..., offsetY: ... }));
}, []);
// 每個 pointermove → SVG mask / mask overlay / 兄弟 elements 全部 diff
```

60 Hz × 50 ms reconcile = 主線程被榨乾，視覺「跳格」。

### 修法：pointermove 走 ref + 直接 DOM，繞過 React

```typescript
// ✅ ref 持有 live offset
const liveOffsetXRef = useRef(0);

const handlePointerMove = useCallback((e) => {
  if (!isDraggingRef.current) return;
  const dx = (e.clientX - dragStartRef.current.x) * TOUCH_SENSITIVITY;
  liveOffsetXRef.current = dragStartRef.current.x + dx;
  imageRef.current.style.transform = `translate(${liveOffsetXRef.current}px, ...)`;
  // 不呼叫 setCropState
}, []);

const handlePointerUp = useCallback(() => {
  setCropState((prev) => ({ ...prev, offsetX: liveOffsetXRef.current }));
}, []);
```

**三軸同時修**（詳見 Rule 029 § 1）：

| 軸 | 衡量 | Touch |
|---|------|-------|
| 量 | sensitivity | 1.5 → **5.0** |
| 順暢度 | pointermove 走 ref + DOM | ✅ |
| 手感 | momentum | on |

`e8f3b60` — bypass React reconciliation
`f16d7ea` — jsdom PointerEvent + URL polyfill（讓 drag test 能跑）
`3426bd3` — useLayoutEffect sync wrapper measurement（避免 first-paint 跳動）

---

## Round 4（下午）— Responsive crop window mask + stage HEIGHT clamp

### 症狀

使用者回報 crop frame 在某些 viewport 顯示怪異。Josh 觀察到舊 frame size 用 `width * 0.6`，但**只 clamp by width**，沒 clamp by stage HEIGHT。

### 修法

`d1ff146` — `responsiveCropWindow = min(width * 0.6, 200)` 改為**同時 clamp by stage HEIGHT**：

```typescript
const responsiveCropWindow = Math.min(
  baseContainerW * 0.6,   // width cap
  BASE_CANVAS_WIDTH * 0.6,  // 200 cap
  baseContainerH * 0.8,  // HEIGHT cap (NEW)
);
```

避免極端的 landscape（stage HEIGHT 很小）frame 比 stage 還高。

`7d81110` — TOUCH_SENSITIVITY 1.5 → 1.0（之前過頭）、mask 由固定 200 改 responsive。

---

## Round 5（傍晚）— Landscape 白框超出 stage（結構性 fix）

### 症狀

```
使用者回報：「上傳一張高度不高的圖片做測試，在某些寬度的裝置，
白框卡到了其他元件，白框還是超出了容器，會不會讓容器不要矮於白框，
並加上一點高度會比較好？」
```

這是今天**唯一**結構性 issue，不是 padding 數字錯。

### 根因

舊設計：

```
stage = aspect-matched image 高度       （e.g. 360×120 for landscape）
outer = max(stage, mask + 2 * padding)  （e.g. 360×224）
frame = outer 的 absolute sibling，居中於 outer
```

對 landscape 圖（aspect-matched H = 120，mask H = 200）：
- stage 是 360×120，outer 是 360×224
- frame 200×200 居中於 **outer**（不是 stage）
- frame 跨越 bright image area（stage）與 dark padding（outer）各 40px
- 使用者看到「frame 在 stage 之外延伸進 dark padding」

### 嘗試過的三個 layer

| 嘗試 | 策略 | commit | 結果 |
|---|---|---|---|
| Option A | 縮小 frame 適應 stage | (rejected) | frame 變 72×72，與 200×200 export 不一致，使用者心智裂掉 |
| **Option B（採用）** | **stage extends 包含 mask + padding** | **`3c8c7b3`** | frame 永遠 200×200，stage 內 letterbox image |
| Side fix | `srcSquareSize` 加 `naturalHeight` cap | `1b0f7a5` | landscape export 不被縱向拉伸 |
| Side fix | frame HEIGHT clamp by stage | `cd21cf9` | 避免極端 landscape frame 比 stage 高 |

### 結構性修法

```typescript
// ✅ New invariant (Rule 028 § 12)
const FRAME_PADDING = 16;  // Tailwind md token
const aspectMatchedH = baseContainerW * (naturalHeight / naturalWidth);
const baseContainerH = Math.max(
  aspectMatchedH,
  responsiveCropWindow + 2 * FRAME_PADDING,
);
const outerContainerH = baseContainerH;  // outer = stage
```

對 landscape 3000×1000：stage 從 360×120 → **360×232**（max(120, 200+32)）。
Image 用 `object-fit: contain` 在 stage 內 letterbox 為 360×120，上下各有 56px dark area。
Frame 永遠在 stage 內。

### 為什麼這次跟前 4 次性質不同

| 輪 | 性質 | 改變的結構假設 |
|---|---|---|
| 1 (stale closure) | 症狀 | 不變 |
| 2 (chain min-w-0) | 症狀 | 不變 |
| 3 (iPhone 12 padding) | 症狀 | 不變 |
| 4 (drag stutter) | 症狀 | 不變 |
| **5 (landscape frame)** | **結構** | **stage = aspect, outer padded → stage = max(aspect, mask+padding)** |

前 4 次保留了「stage 永遠是 aspect-matched」這個錯的結構假設，只在 padding 數字 try-and-error。
第 5 次改的是不變量本身：未來任何 aspect ratio 都不會再出現「frame 超出 stage」視覺。

---

## Round 6（最後）— Rule 沉澱

`8d969e2` — 把 Round 5 的 fix 沉澱到永久 invariant：

- Rule 028 § 12（NEW）：Stage Height Invariant
- SKILL `saome-image-upload` § Stage Height Invariant（NEW）
- Rule 029 參照加 § 12 交叉引用
- INDEX.md 加 row + done 條目

**為什麼這次必須進 rule**：今天 12 個 commits，10 個症狀層、2 個結構層。沒 rule 沉澱，未來實作 `BackgroundUploader`（800×800）或 `IconUploader`（256×256）一定會重蹈同樣的 try-and-error 循環。

---

## Cross-cutting pattern：症狀層 vs 結構層

今天的循環暴露一個 meta-pattern：

```
使用者回報症狀
  → 開發者猜根因（通常猜「padding 數字錯」「deps 漏」「callback 慢」）
  → 改 code → 測試綠 → push
  → 使用者回報下一個症狀（同一個結構假設的另一個表面）
  → 循環 4 輪才發現真正的結構假設錯了
  → 結構 fix（Rule 028 § 12）
```

這個 pattern 在 mobile UX / layout / crop 元件特別常見，因為：
1. jsdom 模擬不到 touch event、layout chain 簡化
2. 視覺問題必須真機看才抓得到
3. 結構假設錯的症狀會在不同 surface 表現，看起來像獨立 bug

**教訓**：mobile UX issue 經過 ≥ 3 輪 try-and-error 還沒清乾淨，**該停下來問「結構假設是不是錯了」**。

---

## 衍生

### 測試覆蓋（今天新增）

- 5 個 portrait / landscape / square conformance test（stale closure）
- 6 個 viewport regression guard（chain + padding）
- 6 個 aspect ratio invariant test（landscape stage height）
- 8 個 `computeSrcSquareSize` landscape cases（srcW === srcH invariant）

`LogoUploader.test.tsx` 從 9 個 test 變 **15 個 test**，全部 Vitest + RTL 綠。

### 待做（Rule 028 § 12 引用）

- [ ] **BackgroundUploader**（800×800 crop）— 沿用 Crop Window Invariant + Stage Height Invariant
- [ ] **IconUploader**（256×256 crop）— 同上
- [ ] `packages/shared/logic/cropGeometry.ts`（Rule 027 引用）— `computeSrcSquareSize` + `buildCropRect` 抽成 pure function，RN-friendly

### 已寫進 rules

- `028-image-uploader-pattern.mdc` § 12 Stage Height Invariant（NEW）
- `frontend/029-image-crop-mobile-ux.mdc` 參照加 § 12 交叉引用
- `saome-image-upload/SKILL.md` § Stage Height Invariant（NEW）

### 不在今天的 scope（pending）

- 任何 crop / frame / mask 元件都要有 invariant test 守 stageH ≥ maskH + 2*padding
- Layout chain `viewportW - X` 紀律：X 必須明列所有 wrapper padding 來源

---

## 自問

### Q1：為什麼需要 4 輪才找到結構問題？

A：mobile UX bug 的症狀會分散在不同 surface（crop 位置、layout overflow、drag 順暢度、白框視覺），每個看起來獨立。每次修一個 surface 的症狀，下一個 surface 又冒出來。直到最後一個 surface（白框）才暴露結構假設錯。

**下次怎麼不犯**：mobile UX issue 經過 ≥ 3 輪 try-and-error 還沒清乾淨，**停下來 audit 結構假設**。問「這個元件的 layout / 渲染 / measurement 有哪些 invariant？invariant 是什麼？」

### Q2：哪條 rule 該補？

A：Rule 028 § 12（已加）+ Rule 029 跨參照（已加）。Rule 029 已是 mobile UX 規範，加 cross-reference 後兩條 rule 互補。

### Q3：哪個 test 該加？

A：`LogoUploader.test.tsx` 已加 6 個 aspect ratio invariant test，覆蓋 portrait 1:3、square 1:1、mild landscape 16:9、landscape 3:1、extreme landscape 15:1、6:1。

新增的 `useImageCrop.computeSrcSquareSize` 從 local duplicate 升級為 exported pure function（見 `runs/improvements/feedback/20260830-logo-uploader-landscape-squash.md`），消除 test 跟 production 公式斷開綁定的風險。

### Q4：今天最關鍵的 insight 是什麼？

A：crop / frame / mask 元件的**兩條獨立 invariant**：

| § | 不變量 | 對齊目標 |
|---|---|---|
| 11 | mask size === export srcSquareSize | UI ↔ export |
| **12** | **stage height ≥ mask + padding** | **stage ↔ mask** |

Rule 028 § 11 已經守住 export 對齊，今天才發現 § 12（stage 對齊 mask）也要守。BackgroundUploader 跟 IconUploader 實作時必須同時滿足兩條。

---

> 撰寫者：Cursor Agent + Josh ｜ 時間：2026-08-30