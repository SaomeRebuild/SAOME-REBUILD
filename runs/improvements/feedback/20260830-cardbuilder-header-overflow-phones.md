# CardBuilderHeader h1+Steps Overflow on Phones ≤ 412px — Outlet Inner min-content Pull-out

## Metadata

- **日期**：2026-08-30
- **作者**：Josh（agent-assisted via Cursor）
- **commit hash**：pending
- **規則 / skill 觸發**：`saome-dev-logging`、`013-rwd.mdc`、`014-breakpoints.mdc`
- **影響**：CardBuilder Step 3（卡片設計 / Logo 上傳）在 ≤ 412px 手機 viewport 觸發 13–53px 水平 overflow，導致 AppDashboardPage 層級出現橫向捲軸。
- **嚴重度**：SEV-2（user-visible on iPhone 12 mini 360px / iPhone SE 320px）

## 症狀

> 使用者回報：「412*x 以下的手機畫面，上傳圖片頁面還是被撐開，出現了 Y 軸，導致畫面可以左右移動」

- **環境**：dev frontend（localhost:5173），Step 3 載入圖片後進入 cropping state
- **觸發條件**：
  1. 進入 CardBuilder Step 3
  2. 選檔 → 進入 cropping state
  3. Crop stage 元件本身已被 `maxWidth: '100%'` + `VIEWPORT_PADDING = 128` 公式正確縮到 viewport 內
  4. **但 CardBuilderPage wrapper 從父層被撐開 29px**，造成 13–53px 的整頁橫向溢出

| Viewport | Overflow 量（docScrollW − window.innerWidth） |
|---|---|
| 412px | 0px（原本就沒事） |
| 390px | 0px |
| 375px | 0px |
| 360px | 13px ← bug 開始 |
| 320px | 53px ← 最慘 |

## 探針 / 重現

Playwright route mock（mock backend responses）+ 注入 sessionStorage token → 直接 navigate 到 `?id=mock-tpl` → Next×2 → 上傳 images.jpg → 量測每層 clientWidth / scrollWidth。

**Bug 版本**（`flex h-full w-full flex-col overflow-auto p-6 gap-6` 為 CardBuilderPage wrapper）：

| 層 | className | clientW | scrollW | offW | 預期 |
|---|---|---|---|---|---|
| CardBuilderPage wrapper | …p-6 gap-6 | **357** | 357 | 357 | 應該 328 |
| Outlet inner | flex min-h-0 flex-1 flex-col | **357** | 357 | 357 | 應該 328 |
| Outlet container | flex min-h-0 flex-1 items-stretch | 328 | 357 | 328 | 328 ✓ |
| AppDashboardPage wrapper | flex h-full flex-col p-4 pt-16 | 360 | 373 | 360 | 360 ✓ |

> Outlet inner（357）比 Outlet container（328）寬 29px → 把 CardBuilderPage wrapper（w-full）一起撐成 357 → docScrollW = 373 > viewport = 360 → 觸發 body 水平捲軸。

## 根因

### 1. CardBuilderEditorHeader 第一列 h1 + gap-6 + steps 合計 min-content 超過父寬

```tsx
<header className="border-b border-border bg-card p-4">
  <div className="mb-4 flex items-center justify-between gap-6">
    <h1 className="… shrink-0">Card Builder</h1>   {/* ~148px，shrink-0 不縮 */}
    <CardBuilderEditorSteps … />                {/* ~90px，沒設 shrink */}
  </div>
  …
</header>
```

在 360px viewport 下：
- AppDashboardPage p-4 + CardBuilderPage p-6 + Workspace p-6 = 128px 水平 padding
- CardBuilderEditorHeader 父寬（內容區）= 360 − 128 − 32（header p-4）= **200px**
- 第一列內容合計：h1 (148) + gap-6 (24) + steps (90) = **262px**
- 262 − 200 = **62px overflow**（28px 對 Outlet inner，34px 對 header 本身）

雖然 CardBuilderEditor 有 `overflow-hidden` 視覺上把 header 內容切掉，但 header 的 min-content（262px）會沿著 flex 父層往上傳：先撐開 CardBuilderEditorHeader 的 intrinsic min-width，再透過 CardBuilderEditor → CardBuilderPage wrapper → Outlet inner → Outlet container 鏈傳上去，最終 Outlet inner 從 328 變成 357。

### 2. Outlet inner 沒有 `min-w-0` 保護

`flex` item 預設 `min-width: auto` = min-content。Outlet inner 是 AppDashboardPage wrapper 的 flex item（flex-1 in flex row），雖然 `flex: 1 1 0%` 給了 flex-basis: 0，但 min-content 仍然會從子層傳上來。

加上 `min-w-0` 才能讓 Outlet inner 在子層 min-content > 父層寬度時被強制縮到父層寬度（靠 `overflow: hidden` / `overflow: auto` 處理內容溢出）。

### 3. CardBuilderPage wrapper 的 `overflow-auto` 不會自動保護父層

CardBuilderPage wrapper 自己有 `overflow-auto` 處理自己的內容溢出，但它本身的寬度被父層（Outlet inner）撐開後，會把撐大的寬度回傳給祖父層。overflow-auto 只能保護自己的內容，不能保護自己的 box size。

### 跟 8/29 那次 `VIEWPORT_PADDING` 48→96→128 fix 的差別

| | 8/29 那次 | 這次 |
|---|---|---|
| 症狀 | Crop stage 本身撐開 wrapper | CardBuilderPage wrapper 被 header 的 min-content 撐開 |
| 計算位置 | LogoUploader crop stage 寬度 | Outlet inner 的 box width |
| 修法 | 改 `VIEWPORT_PADDING` 常數 + `maxWidth: '100%'` safety net | Header 第一列加 `flex-wrap` + Outlet inner 加 `min-w-0` + body 加 `overflow-x: hidden` |
| 範圍 | 只影響 crop stage 渲染寬度 | 影響整個 dashboard layout chain |

## 修法

### 改 1：CardBuilderEditorHeader 第一列加 `flex-wrap` + `min-w-0`

`apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorHeader.tsx`:

```diff
- <div className="mb-4 flex items-center justify-between gap-6">
+ <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
```

- `flex-wrap`: 窄螢幕時 h1 和 steps 自動換到上下兩列（≥ sm 仍並排），title 與 steps 的合計 min-content 不再把 flex 父層撐大
- `gap-x-6 gap-y-2`: 並排時 gap-6、換行時 gap-y-2（避免上下兩列貼在一起）
- 註解明確指出 wrap 行為與 chain padding 限制的關係

### 改 2：Outlet inner 加 `min-w-0`

`apps/frontend/src/pages/app/AppDashboardPage.tsx`:

```diff
- <div className="flex min-h-0 flex-1 flex-col">
+ <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <Outlet />
  </div>
```

- 防止 Outlet inner 被子層（CardBuilderEditor 等）的 min-content 撐開
- `min-w-0` 是 flex item 防止 min-content 撐大的標準做法；對齊 Tailwind / shadcn 慣例

### 改 3：html/body 加 `overflow-x: hidden`（最終安全網）

`apps/frontend/src/index.css`:

```css
html, body {
  overflow-x: hidden;
}
```

- 即使未來有新的 flex chain overflow，也不會冒出 page-level 水平捲軸
- 不會影響垂直滾動（只鎖 X 軸）

## 涉及檔案

| 檔案 | 變更 |
|---|---|
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorHeader.tsx` | 第一列加 `flex-wrap` + `gap-x-6 gap-y-2` + 註解說明 |
| `apps/frontend/src/pages/app/AppDashboardPage.tsx` | Outlet inner 加 `min-w-0` + 註解 |
| `apps/frontend/src/index.css` | html/body 加 `overflow-x: hidden` |

## 驗證

### Playwright 多 viewport 驗證（mock backend，路由 mock + sessionStorage token）

```
========== VIEWPORT: 412x915 ==========
OK: No horizontal overflow detected

========== VIEWPORT: 390x844 ==========
OK: No horizontal overflow detected

========== VIEWPORT: 375x812 ==========
OK: No horizontal overflow detected

========== VIEWPORT: 360x780 ==========
OK: No horizontal overflow detected

========== VIEWPORT: 320x568 ==========
OK: No horizontal overflow detected
```

各 viewport 的 chain 量測（以 360 為例）：

| 層 | clientW | scrollW | 預期 |
|---|---|---|---|
| AppDashboardPage wrapper | 360 | 360 | 360 ✓ |
| Outlet container | 328 | 328 | 328 ✓ |
| Outlet inner | **328** | 328 | 328 ✓（修前 357）|
| CardBuilderPage wrapper | **328** | 328 | 328 ✓（修前 357）|
| CardBuilderEditor | 280 | 280 | 280 ✓ |
| workspace aside | 232 | 232 | 232 ✓ |
| LogoUploader div | 184 | 184 | 184 ✓ |
| crop stage | 184 | 184 | 184 ✓ |

### Vitest

```
LogoUploader.test.tsx > 8 passed (8)
```

VIEWPORT_PADDING = 128 的 crop stage 計算維持原樣，不受這次 layout chain 修正影響。

### TypeScript

```
tsc -b --noEmit → exit 0
```

### 截圖比對

`debug/mock-step3-{360,320}.png` 已重抓：title 與「Card Design (3/8)」在 360 / 320 viewport 自動換成上下兩列（不再擠在一行），crop stage + 按鈕不再被擠出右邊。

## 衍生

### 為什麼這次 412 沒事、360 開始壞

| 412 viewport | 360 viewport |
|---|---|
| CardBuilderEditorHeader 內容區 = 252px | CardBuilderEditorHeader 內容區 = 200px |
| h1 (148) + gap-6 (24) + steps (90) = 262 | h1 (148) + gap-6 (24) + steps (90) = 262 |
| 262 − 252 = **10px overflow** | 262 − 200 = **62px overflow** |

10px overflow 在 412 剛好被 `align-items: stretch` 的彈性吸收，沒被傳到 Outlet inner。62px overflow 直接撐到 Outlet inner。

→ **layout chain 的 tolerance 比想像中窄**：差 50px viewport 就從「能吸收」變成「明確溢出」。

### flex chain 的 overflow 風險模式

任何 flex chain 只要滿足：
1. 父層用 `align-items: stretch`（或 flex item 用 `w-full` / `width: 100%`）
2. 子層有 min-content 大於父層的場景
3. 子層的 `overflow: hidden` / `overflow: auto` 只能擋自己內容，不能擋自己的 box size

就會把 min-content 一路傳到祖父層。

**預防模式**：在 flex item 加 `min-w-0` 是 Tailwind/shadcn 社群慣例。SAOME 之前沒在 chain 上加，是因為沒有出過 bug；這次補上。

### `overflow-x: hidden` on html/body 的取捨

**優點**：便宜的 belt-and-suspenders，永遠不會有 page-level 水平捲軸。
**缺點**：會 mask 未來真正的 overflow bug（子元件內部被切掉但沒人發現）。

**本專案的選擇**：加上，但要寫 feedback 紀錄這個 trade-off，並要求所有 flex chain 在新增 padding wrapper 時主動 review min-w-0 是否需要。

### 跟既有 feedback 的關係

- 8/29 feedback（`20260830-logo-uploader-iphone12promax-double-padding.md`）只 cover 了 crop stage 本身的 viewport 計算
- 這次補的是 layout chain 上的另一類 bug：flex item min-content 撐大父層
- 兩個 feedback 互補，合在一起構成 CardBuilder Step 3 的完整 mobile overflow 修復

## 自問

- **下次怎麼不犯？**
  - 任何 flex chain 新增 padding wrapper 時，連帶 review chain 上每一層 flex item 是否需要 `min-w-0`
  - CardBuilderEditorHeader 這類「內容 + 操作指示器」並排的 layout，預設加 `flex-wrap`，避免 min-content 撐大
  - 寫新 L2/L3 元件時，layout 不只要驗證「在父層裡 fit」，還要驗證「父層在 chain 裡 fit」

- **哪條 rule 該補？**
  - `014-breakpoints.mdc` 加：**Layout chain tolerance**：mobile viewport 從 412 → 360 時 min-content overflow tolerance 從「可吸收」變「明確溢出」，任何 flex chain 加新 wrapper 都要重算
  - `013-rwd.mdc` 加：**Flex chain `min-w-0` 慣例**：flex item 預設 `min-width: auto`，跨 layout chain 的 flex container 都應該考慮 `min-w-0` 保護

- **有沒有其他地方有類似風險？**
  - DashboardHeader 的 `<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">` — mobile 是 `px-4`，且內容受 `max-w-7xl` (1280px) 保護，暫時安全
  - CardBuilderEditorHeader 的「Mock Template」輸入 + 警示 — `max-w-md` 限制 + 在 200px 內容區裡不撐出，已驗證
  - DashboardFooter 內容簡單，無風險
  - 其他 dashboard 子頁面（charts, members, email, billing, settings）的 layout chain 沒複查過，但都共用 AppDashboardPage，所以這次的 Outlet inner `min-w-0` fix 也保護它們

---

> 撰寫者：Josh ｜ 時間：2026-08-30 05:00
