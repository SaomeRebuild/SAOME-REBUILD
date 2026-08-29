# LogoUploader iPhone 12 Pro Max Horizontal Overflow — Double-Padding Bug

## Metadata

- **日期**：2026-08-30
- **作者**：Josh（agent-assisted via Cursor）
- **commit hash**：pending
- **規則 / skill 觸發**：`saome-dev-logging`、`saome-image-upload`、`saome-task-router`（L2 Standard）、`013-rwd.mdc`、`014-breakpoints.mdc`
- **影響**：LogoUploader crop stage 在 iPhone 12 Pro Max（428×926）以及其他較寬的 mobile viewport 觸發 48px 水平 overflow，導致 CardBuilderPage 的 `overflow-auto` 出現水平捲軸、頁面被撐開
- **嚴重度**：SEV-2（user-visible，影響所有 iPhone Pro Max / Plus 等 ≥393px 但 < 480px 的 mobile viewport）

---

## 症狀

> 使用者回報：「回到開發中，在 iPhone12max 的環境中，上傳圖片時 UI 還是被撐開了」

- **環境**：dev（本地 + Safari / Chrome on iPhone 12 Pro Max，428×926 logical px）
- **觸發條件**：
  1. 進入 CardBuilder Step 3
  2. 點擊「上傳 Logo」、選檔
  3. 進入 cropping state → 頁面被水平撐開 48px
- **觀察到的錯誤**：
  - 頁面出現水平捲軸（CardBuilderPage wrapper `overflow-auto` 被觸發）
  - crop stage 右側被裁切或擠出 viewport
  - scale slider 和底部按鈕的 layout 跟著 shift
- **預期**：crop stage 完全 fit 在 viewport 內，無水平捲軸

---

## 探針 / 重現

手動步驟（可重現）：

1. 開啟 dev frontend（`localhost:5173`）
2. 登入 → 進入 CardBuilder → 進到 Step 3（卡片設計）
3. 在 iPhone 12 Pro Max（428px）或任何 ≥ 393px 的 mobile viewport 上：
4. 點擊「選擇圖片」按鈕
5. 選一張 ≥ 960px 的圖片上傳
6. 觀察：頁面被往右撐 48px、crop stage 顯示在比容器寬的位置

**計算驗證**（bug 版本）：

| 項目 | 值 |
|---|---|
| iPhone 12 Pro Max viewport | 428 |
| CardBuilderPage wrapper `p-6` | -24 (left) -24 (right) = -48 |
| CardBuilderEditorWorkspace aside `p-6` | -24 (left) -24 (right) = -48 |
| **實際可用寬度** | **428 - 48 - 48 = 332** |
| `VIEWPORT_PADDING` (bug 版本) | 48 |
| LogoUploader 算的 `availableW` | 428 - 48 = **380** |
| `baseContainerW` | min(1024, 400, 380) = **380** |
| **水平 overflow** | **380 - 332 = 48px** ← 撐開頁面 |

---

## 根因

### `VIEWPORT_PADDING = 48` 只算一層 padding，實際有兩層

```typescript
// ❌ Bug：LogoUploader.tsx:192
const VIEWPORT_PADDING = 48; // p-6 on CardBuilderEditorWorkspace aside
```

`LogoUploader` 坐在兩層 `p-6` container 內：

| 層級 | 檔案 | className | padding |
|---|---|---|---|
| 1. Page wrapper | `pages/app/dashboard/card-builder/CardBuilderPage.tsx:174` | `p-6` | 48 |
| 2. Workspace aside | `CardBuilderEditorWorkspace.tsx` | `p-6` | 48 |
| **總計** | | | **96** |

但 `VIEWPORT_PADDING` 寫的是 `48`（只算第 2 層），所以 mobile 上 crop stage 計算結果比實際可用寬度多 48px，撐開外層 `overflow-auto` 的 wrapper。

### 為什麼之前沒抓到

| 既有測試 | 結果 | 為什麼沒抓到 bug |
|---|---|---|
| 320px → 272px | 過 | 測試本身的期望值（`viewport - 48`）就反映 bug 公式。期望值錯了 |
| 375px → 327px | 過 | 同上 |
| 1024px → 400px | 過 | desktop 上 96px padding 不影響結果（`min(...)` 還是 400） |

**Bug 被既有測試「合法化」**：測試斷言的是程式碼的計算結果，但程式碼本身的公式就是錯的。Green 測試掩蓋了實際的 UI overflow。

更糟的是：`LogoUploader.test.tsx` 直接渲染 `<LogoUploader />`，沒有包在 `CardBuilderPage` 或 `<aside p-6>` 裡。測試環境完全反映不了真實 layout chain，所以即使寫了 `viewport - 48` 也不對。

### 為什麼 desktop 測試抓不到

`BASE_CANVAS_WIDTH = 400`。desktop 上 `availableW = max(viewport - 96, 200)` 通常 > 400，所以 `baseContainerW = min(naturalCap, 400, availableW) = 400`。bug 公式跟修正公式在 desktop 都回 400。

只有 mobile（`viewport - 48 < 400` 且 `viewport - 96 < viewport - 48`）才看得出差異。

---

## 修法

### `VIEWPORT_PADDING` 從 48 改成 96

```typescript
// ✅ Fix：LogoUploader.tsx:192
const VIEWPORT_PADDING = 96; // p-6 (24px each side) on CardBuilderPage wrapper + aside
```

加上註解明確指出兩層 padding 的來源，未來 refactor 任一層 padding 的人會看到警告。

### 為什麼不用其他修法

| 替代方案 | 為什麼不採用 |
|---|---|
| 移除 CardBuilderPage 的 `p-6` | 改其他元件的 layout，scope 過大；影響 library mode 渲染 |
| 用 `ResizeObserver` 量 LogoUploader 實際寬度 | 較 robust 但需要 mock clientWidth / ResizeObserver in jsdom；測試複雜度上升 |
| 改寫 `CardBuilderPage` 不要包 padding | 影響 `TemplateLibraryGrid` 等其他元件的 layout |

最小且最對症的修法：把 `VIEWPORT_PADDING` 改對。

---

## 涉及檔案

| 檔案 | 變更 |
|------|------|
| `LogoUploader.tsx` | `VIEWPORT_PADDING` 48 → 96；註解列出兩層 padding 來源 |
| `LogoUploader.test.tsx` | 既有 320/375 期望值從「viewport - 48」改成「viewport - 96」；新增 iPhone 12 Pro Max (428px) regression guard |

---

## 驗證

### 自動驗證（CI）

```bash
cd apps/frontend
npx vitest run src/components/business/dashboard/CardBuilderEditor/LogoUploader/LogoUploader.test.tsx
# Test Files  1 passed (1)
# Tests  7 passed (7)
```

完整 frontend test suite：

```bash
npx vitest run
# Test Files  42 passed | 1 skipped (43)
# Tests  268 passed | 5 skipped (273)
```

i18n smoke test：

```bash
npm run verify:i18n
# verify-i18n-keys: OK — 14 namespace(s) passed (28 locale files)
```

### 手動驗證

1. 開啟 dev frontend（`localhost:5173`）
2. 模擬 iPhone 12 Pro Max（DevTools responsive mode：428×926）
3. 進入 CardBuilder Step 3
4. 上傳 ≥ 960px 圖片
5. 觀察：crop stage 寬度 = 332px，完全 fit 在 viewport 內，**無水平捲軸** ✓

---

## 衍生

### 為什麼之前沒抓到 — 三層原因

| 層 | 原因 |
|---|---|
| **公式** | `VIEWPORT_PADDING` 寫成 48 時就漏算了外層 |
| **測試期望值** | 寫成「viewport - 48」時沒驗證「48」這個數字是怎麼來的；測試反映的是公式而非 layout 事實 |
| **測試 isolation** | `LogoUploader.test.tsx` 直接渲染 LogoUploader 沒包 parent，測不到外層 padding 的影響 |

### 推論：類似的「layout chain 漏算」風險

任何 deep component 只要用 `viewportW - HARDCODED_PADDING` 算寬度，就有這個風險。**root cause**：用 `viewportW - X` 是 fragile 的，因為 X 來自 layout chain，不在 component 自己手上。

更 robust 的做法：用 `ResizeObserver` 量自己的 `clientWidth`。但實作成本 + 測試成本較高。

**目前策略**：
- 修 bug：把 X 改成對的值（48 → 96）
- 加 regression guard：明確測 iPhone 12 Pro Max (428px)，未來 layout 再改會 fail
- **未來**：若 LogoUploader 的 layout chain 又變，refactor 成 `ResizeObserver`

### 跟既有 decisions 的關係

- 沿用 `runs/improvements/feedback/20260830-logo-uploader-portrait-stale-closure.md` 的 Bug-φ 修法精神（**TDD：先寫 failing test，再 fix**）
- 這次 bug 不在 closure，在於**對 layout chain 的認知錯誤**。同個 component、同一週、兩個獨立 bug。

### 為什麼兩次都漏

portrait stale closure 那次是 closure deps 漏，這次是 layout padding 漏。共同點：

> 寫 component 時，假設「某個值是固定的」並寫死，沒有驗證假設。

修法：對所有「寫死的 layout 數字」加 lint rule 或 review check item，強制驗證假設來源。

---

## 自問

- **下次怎麼不犯？**
  - 任何 `viewportW - X` 形式的計算，X 必須來自**量測或明確列舉 padding chain**，不可憑印象寫
  - review checklist 加一項：「這個 component 的 parent chain 上有哪些 padding？總共多少？」
  - 寫測試時，**期望值要對應真實 layout 事實**，不是對應程式碼當前的公式

- **哪條 rule 該補？**
  - 在 `.cursor/rules/uiux/013-rwd.mdc` 或 `014-breakpoints.mdc` 加：**Layout chain 透明度**：component 不直接知道 parent 有什麼 padding；必須明列所有 wrapper 的 padding 來源
  - 在 `.cursor/rules/006-verification.mdc` 的測試寫法 section 加：**測試期望值必須對應 layout 事實，不是程式碼公式**

- **有沒有其他地方有類似風險？**
  - `CardBuilderEditor.tsx` 用了 `flex-2`（無效 Tailwind class，fallback 到無）— 雖然現在不影響，但若日後改 config 加上 `flex-2`，可能會突然改變 layout
  - `CardBuilderEditorPreview` 用 `max-w-sm`（384px）在 mobile sheet 內 — 是否會跟 CardBuilderPage wrapper 衝突需驗證
  - 任何用 `window.innerWidth` 計算 layout 的元件都要 audit

---

> 撰寫者：Josh ｜ 時間：2026-08-30 03:50
