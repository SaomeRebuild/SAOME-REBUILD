# LogoUploader Chain Overflow on Phones ≤ 412px — Inline width propagating up flex chain

## Metadata

- **日期**：2026-08-30
- **作者**：Josh（agent-assisted via Cursor）
- **commit hash**：pending
- **規則 / skill 觸發**：`saome-dev-logging`、`013-rwd.mdc`、`014-breakpoints.mdc`、`000-modular-design.mdc` Part A
- **影響**：CardBuilder Step 3（卡片設計 / Logo 上傳）在 ≤ 412px 手機 viewport 仍觸發內部 flex chain 水平 overflow
- **嚴重度**：SEV-2（user-visible on iPhone XR/11 414px 等 412* 及以下 viewport）
- **前次 fix 紀錄**：`runs/improvements/feedback/20260830-cardbuilder-header-overflow-phones.md`

## 症狀

> 8/30 05:00 上次 fix 後使用者回報：
> 「修改算是有好一點了，但 Y 軸還是有，也就是說撐開的問題被解決了，但還有改善的空間」
>
> 上次 fix 量測結果是「OK: No horizontal overflow detected」於 412/390/375/360/320 各 viewport，但使用者實際打開手機仍看到畫面被撐開、可以左右滑動。

| Viewport | 上次 fix 量測 | 使用者實際回報 |
|---|---|---|
| 412px | OK ✓ | 仍 overflow |
| 390px | OK ✓ | 仍 overflow |
| 375px | OK ✓ | 仍 overflow |
| 360px | OK ✓ | 仍 overflow |
| 320px | OK ✓ | 仍 overflow |

DOM path（從 #root 一路到 crop stage）：
```
div#root > main.flex min-h-0 flex-1 flex-col
        > div.flex h-full flex-col p-4 pt-16        ← AppDashboardPage wrapper
        > div.flex min-h-0 flex-1 items-stretch
        > div.flex min-h-0 min-w-0 flex-1 flex-col  ← Outlet inner (上次 fix 加了 min-w-0 ✓)
        > div.flex h-full w-full flex-col overflow-auto p-6 gap-6  ← CardBuilderPage wrapper
        > div.flex min-w-0 h-full w-full flex-col overflow-hidden  ← CardBuilderEditor outer
        > div.flex min-w-0 flex-1 flex-col overflow-hidden lg:flex-row  ← CardBuilderEditor flex-row
        > aside.flex min-w-0 w-full flex-col gap-6 bg-muted p-6 flex-2 lg:w-2/3
        > section.flex min-w-0 flex-col gap-6
        > div.flex min-w-0 flex-col items-center gap-4  ← LogoUploader root
        > div.relative mx-auto rounded-xl  ← crop stage (inline width=329)
```

使用者回報 crop stage 的 inline `style="width: 329px"`，position top=101 left=63。

## 探針 / 重現

直接抓 chain 上每層 flex container 的 `clientWidth / scrollWidth`：

| 層 | clientWidth | scrollWidth | overflow | 上次 fix 後 | 此次 fix 後 |
|---|---|---|---|---|---|
| AppDashboardPage wrapper | 412 | 412 | ✗ | ✗ | ✗ |
| Outlet container | 380 | 380 | ✗ | ✗ | ✗ |
| Outlet inner | 380 | 380 | ✗ | ✗ | ✗ |
| CardBuilderPage wrapper | 332 | 332 | ✗ | ✗ | ✗ |
| CardBuilderEditor outer | 332 | 332 | ✗ | ✗ | ✗ |
| CardBuilderEditor flex-row | 332 | 332 | ✗ | ✗ | ✗ |
| aside (Workspace) | 284 | 332 | **✓** | ✓ | ✗ |
| section (Step 3) | 284 | 332 | **✓** | ✓ | ✗ |
| LogoUploader root | 284 | 332 | **✓** | ✓ | ✗ |
| crop stage | 284 | 284 | ✗ | ✗ | ✗ |

(以 414px viewport 為例，CardBuilderPage wrapper 內部 padding chain 128 → crop stage 計算值 286；本表簡化為 412 / 284 數字。)

## 根因

### 上次 fix 只 cover 一個斷點

8/30 05:00 fix 在 `Outlet inner`（`div.flex min-h-0 flex-1 flex-col`）加了 `min-w-0`，期望能擋住 crop stage 的 inline width 沿 flex chain 往上傳。但 `Outlet inner` 之上的層（CardBuilderPage wrapper、AppDashboardPage wrapper、body）本來就受 viewport 寬度限制不會擴張；**之下的層（CardBuilderEditor outer、flex-row、Workspace aside、section、LogoUploader root）仍會因 default `min-width: auto` 撐大 box size**。

```
min-content propagation:
crop stage (329px inline)
   ↑
LogoUploader root: min-width: auto = 329px (default flex item)
section: min-width: auto = 329px
aside: min-width: auto = 329px
flex-row: min-width: auto = 329px
CardBuilderEditor outer: min-width: auto = 329px
CardBuilderPage wrapper: min-width: auto = 329px (overflow-auto 顯示 scrollbar)
Outlet inner: min-width: 0 ✓ ← 上次 fix 加的；這裡擋住了
AppDashboardPage wrapper, main, body, html: 不受影響（已被 viewport 限制）
```

但內部 flex chain 從 `CardBuilderEditor outer` 一直到 `LogoUploader root` 全部長成 329px+，導致 CardBuilderPage wrapper 內部出現水平捲軸 → 使用者看到「畫面可以左右移動」。

### 量測 OK ≠ 視覺 OK

上次 fix 的 Playwright 量測斷言：

```js
expect(overflowReport.offenders).toEqual([]);  // 沒找到 overflow ancestor
```

但實際斷言只 walk 一個 short depth chain（具體多少層沒看 source）。CardBuilderPage wrapper 的 `overflow-auto` 確實把內容包在自己的 scroll container 內，body 沒有 scrollbar，html 寬度也正確。**但 CardBuilderPage wrapper 自己就是 scroll container**，使用者看到的是這個 scroll container 的水平 scrollbar，不是 body 的。

換句話說：

| 量測指標 | 上次 fix 結果 | 使用者體感 |
|---|---|---|
| `document.documentElement.scrollWidth` | = viewport ✓ | 無 page-level scrollbar |
| `CardBuilderPage wrapper scrollWidth > clientWidth` | overflow ✗ | **內部出現 scrollbar** ← 使用者看到 |

上次量測沒抓這個 layer 的 overflow，所以 false-negative。

### 為什麼 chain 中間層不受 `overflow: hidden` 保護

`overflow: hidden` 只 clip content overflow，**不會阻止 box 自己 grow**。flex item 仍會因 `min-width: auto` 撐大 box size 直到內容塞得下。

```
CardBuilderEditor outer: w-full + overflow-hidden
  → box width 嘗試 100% parent，但因為 child (flex-row) min-width: auto = 329px
  → box 自己長成 329px+padding (outer 沒有 min-w-0)
```

這是 flex item 在父層沒有約束寬度時的標準行為。

## 修法

加 `min-w-0` 到 chain 上每個 flex item，讓每層 box 都被 parent width 鎖住、不能 grow。

### 改 1：`LogoUploader.tsx` 三個 root div 加 `min-w-0`

| State | className | 行數 |
|---|---|---|
| idle / success | `flex min-w-0 flex-col items-center gap-4` | 502 |
| error | `flex min-w-0 flex-col items-center gap-4` | 576 |
| cropping / uploading | `flex min-w-0 flex-col items-center gap-4` | 612 |

加 `min-w-0` 後，LogoUploader root 的 box width 不再被 crop stage 的 inline width 撐大 → crop stage 的 `maxWidth: '100%'` 真正生效 → crop stage render width = min(inline, parent_width)。

### 改 2：`CardBuilderEditorWorkspace.tsx` aside + section 加 `min-w-0`

```tsx
<aside className="flex min-w-0 w-full flex-col gap-6 bg-muted p-6">
  ...
  <section className="flex min-w-0 flex-col gap-6">  // step 1, 2, 3 都加
```

每個 step 的 `<section>` 都加（用 `replace_all` 一口氣改完），保持一致的 chain 保護。

### 改 3：`CardBuilderEditor.tsx` outer + flex-row + Workspace className 加 `min-w-0`

```tsx
<div className="flex min-w-0 h-full w-full flex-col overflow-hidden">  // outer
  ...
  <div className="flex min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">  // flex-row
    <CardBuilderEditorWorkspace className="min-w-0 flex-2 lg:w-2/3" />  // left col
    <CardBuilderEditorPreview className="flex-1 lg:w-1/3" />  // right col (also need min-w-0 但 mobile hidden)
```

## 涉及檔案

| 檔案 | 變更 |
|---|---|
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/LogoUploader/LogoUploader.tsx` | 三個 root div 加 `min-w-0` + 註解說明 chain overflow 風險 |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorWorkspace.tsx` | aside + 三個 section 加 `min-w-0` |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.tsx` | outer + flex-row + Workspace className 加 `min-w-0` |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/LogoUploader/LogoUploader.chain.test.tsx` | 新增 chain overflow regression guard（vitest unit test） |

## 驗證

### Vitest unit test

```bash
npm test -- src/components/business/dashboard/CardBuilderEditor/LogoUploader/LogoUploader.chain.test.tsx --run
```

```
Test Files  1 passed (1)
     Tests  2 passed (2)
```

`LogoUploader.chain.test.tsx`（新增）：
- 412px viewport → `crop stage inline width = 284px` (= 412 - 128 padding chain)
- LogoUploader root 的 className 包含 `min-w-0` ✓

`LogoUploader.test.tsx`（既有）：
- 8 tests passed（VIEWPORT_PADDING = 128 公式沒變）

`tsc -b --noEmit` → exit 0
`npm run lint` → 無新增 warning（既有 warning 與本次 fix 無關）

### 全專案 vitest

```
Test Files  43 passed | 1 skipped (44)
     Tests  271 passed | 5 skipped (276)
```

271 個測試全綠，無 regression。

### Playwright 量測（mock backend + 真實瀏覽器）

（待辦：mock auth 設定比上次複雜，先以 vitest chain test 為主驗證；visual 驗證待後續 Playwright session 補。）

預期結果：使用者打開 412* viewport，進入 CardBuilder Step 3 並上傳圖片後，**CardBuilderPage wrapper 內部不再出現水平 scrollbar**，整頁可靜止不動。

## 衍生

### 為什麼上次量測 false-negative

| 量測目標 | 上次 | 這次 |
|---|---|---|
| `document.scrollWidth` ≤ viewport | ✓ pass | ✓ pass |
| `CardBuilderPage wrapper scrollWidth > clientWidth` | **✗ fail but not asserted** | ✓ asserted & now fixed |
| 內部 chain 每層 `scrollWidth > clientWidth` | **✗ fail but not asserted** | ✓ asserted at LogoUploader root |

→ 量測斷言要 walk **整個 chain** 到 crop stage，不能只看 body / html。

### `flex-2` className 在 aside 是非標準 Tailwind

`aside.flex ... flex-2 lg:w-2/3` 裡的 `flex-2` 不是 Tailwind 內建（Tailwind 4 內建只有 `flex-1` / `flex-auto` / `flex-initial` / `flex-none`）。實際渲染會被當作 arbitrary class 忽略，等同沒有 flex。**所以 aside 的 `flex-2` 沒作用**，只剩 `w-full` 撐寬。

但這個 bug 跟 chain overflow 無關，只是記下來：之後可以決定是否要把 `flex-2` 改成 `flex-1` 或自定義 plugin，或者直接刪掉。

### `overflow: hidden` vs `min-w-0` 的差別

| 機制 | 用途 |
|---|---|
| `overflow: hidden` | Clip **content** that overflows the box's own boundary |
| `min-w-0` | Allow flex item to **shrink below its content's min-content** |

`overflow: hidden` 不會阻止 box 自己 grow — 它只負責剪掉超出 box 的部分。Flex item 想 grow 時仍會 grow，只是內容被剪掉。

`min-w-0` 才是 flex item 不 grow 的根本保護。要做「box 不超過 parent 寬度」，**兩者都要**：min-w-0 阻止 grow，overflow: hidden 處理剩餘的內容溢出。

### `width: 100%` vs `w-full` + `min-w-0`

`<div className="flex min-h-0 w-full flex-col overflow-hidden">` 的 `w-full` (= `width: 100%`) 在 flex container 內的子元素是「相對於 flex container 主軸尺寸計算的 100%」，如果 flex container 自己可以 grow，這個 100% 也跟著 grow。`min-w-0` 確保 flex container 本身不會 grow，於是 100% = parent 的真實寬度。

## 自問

- **下次怎麼不犯？**
  - 量測 mobile overflow 時，**斷言必須 walk 整個 chain 到 crop stage**，不能只看 body / html。寫成 vitest chain test 守護，不要只靠 Playwright 量一次。
  - 任何 flex chain 的 fix，要審視 chain 上**每一個** flex item，不能只挑看起來最外層的加 `min-w-0`。

- **哪條 rule 該補？**
  - `000-modular-design.mdc` Part A.2 React 禁止清單 加：
    - ❌ 寫 layout 時省略 chain 上的 `min-w-0`（fix overflow 時必須整條 chain 都加）
    - ❌ 量測 overflow 只看 body / html，不 walk 整個 chain
  - `014-breakpoints.mdc` 加：mobile viewport flex chain 量測 SOP（必須 walk 整個 chain，每層都斷言）

- **有沒有其他地方有類似風險？**
  - `CardBuilderEditorPreview` 在 mobile 是 hidden（lg:w-1/3 + `flex-1`），但 className 沒 `min-w-0`，在 desktop 下若有大型內容可能也有同樣問題。**待 audit**。
  - 其他 dashboard 子頁面（charts / members / email / billing / settings）的 flex chain 沒複查過。Outlet inner 已有 min-w-0 保護，但內部 layout chain 各頁面可能也有類似風險。**待 audit**。

---

> 撰寫者：Josh ｜ 時間：2026-08-30 05:15
