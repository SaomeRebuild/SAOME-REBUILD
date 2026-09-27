# Step 7 Round 9 Fixes — Konva.Group hit region (image still unclickable) (2026-09-27)

## 概述

Round 8 修了「loaded Konva.Image 因為 pixel-based hit detection 點不到」的 bug，但**只修了表象**，沒有處理一個根本性的 Konva 行為：**Konva.Group 本身沒有自己的 hit region，hit detection 完全來自子元素**。

User 在 Round 8 merge 後回報：「還是點擊不到圖片」。本輪修真正的 root cause：Round 8 把 inner Konva.Image 設成 `listening={false}`，導致 Group **完全沒有 listening child**，點擊穿透到 Stage，Stage 的 `onMouseDown` 反而清掉 selection。

---

## 根因分析

### Round 8 修了一半

Round 8 的修法：

```tsx
// Round 8 修後
<Group
  id={element.id}
  ...
  onClick={handleClick}
  onTap={handleTap}
  ...
>
  <KonvaImage
    image={image}
    ...
    listening={false}   // ← 唯一的子元素設成 listening=false
  />
</Group>
```

### 為什麼還是點不到

**Konva.Group 的 hit detection 規則**（來自 Konva 內部行為）：

| 結構 | Hit region |
|---|---|
| Group 有 listening child | Group 的 hit region = 所有 listening children 的 hit region 的 union |
| **Group 全部 child 都 `listening={false}`** | **Group 沒有 hit region** — 點擊穿透到下一層 |
| Group 有 `clipFunc` | clipFunc 對 visual canvas **和** hit canvas 都生效 |

Round 8 的 Group wrapper 內**只有一個 child**，而且 `listening={false}`。Konva 遍歷 Group 的 children 找 hit target，發現沒有 listening child → Group 沒有 hit region → 點擊直接掉到 Layer → Stage。

Stage 的 `onMouseDown` 處理器：

```tsx
onMouseDown={(e) => {
  // Click on empty stage clears selection.
  if (e.target === e.target.getStage()) {
    onSelect(null);
  }
}}
```

`e.target === e.target.getStage()` 在 click 穿透時成立（因為點擊沒打到任何 element），所以**呼叫 `onSelect(null)` 清掉 selection**。User 的觀察：

- 「點圖片沒有反應」 ← 因為 onClick 沒 fire
- 「點了之後 selection 反而被清掉」 ← 因為 Stage 的 onMouseDown fire 了

### 為什麼 text / shape 元素可以點

| 元素 | Hit detection | 結果 |
|---|---|---|
| `<KonvaText>` | 文字外框的矩形 hit region | ✅ 點得到 |
| `<Rect>` | 矩形 hit region（Konva built-in）| ✅ 點得到 |
| `<Circle>` | 圓形 hit region（Konva built-in）| ✅ 點得到 |
| `<Line>` | 線段 hit region（Konva built-in）| ✅ 點得到 |
| `<KonvaImage>` wrapped in `<Group>` with `listening={false}` | Group 沒有 listening child → 無 hit region | ❌ 點不到 |

這也是 user 觀察到的「唯獨圖片元素沒有」的根本原因。

### 為什麼 Round 8 的測試沒抓到

Round 8 的 4 條測試只 cover **structural pattern**，沒實際驗證 Group 有 hit region：

```ts
// Round 8 通過的測試
it('source: CanvasKonvaImage returns a single Group wrapper regardless of clipShape', () => {
  expect(src).toMatch(/<Group[\s\S]*?onClick=\{handleClick\}/);
  expect(src).toMatch(/<Group[\s\S]*?onTap=\{handleTap\}/);
  expect(src).toMatch(/<Group[\s\S]*?id=\{element\.id\}/);
  expect(src).toMatch(/<Group[\s\S]*?draggable/);
  expect(src).toMatch(/<KonvaImage[\s\S]*?listening=\{false\}/);
});
```

這些斷言只驗證「onClick 在 Group 上」「KonvaImage listening=false」— 但沒有驗證「Group 有 listening child」。Round 8 的盲點：以為只要 onClick 掛在 Group 上就會 fire，忽略了 Konva 的 hit detection 是子元素驅動的。

---

## 修法

### 加一張透明 `<Rect>` 當 hit target

```tsx
<Group
  id={element.id}
  ...
  draggable
  onClick={handleClick}
  onTap={handleTap}
  ...
>
  {/* Hit target — 透明 Rect 提供 Group 的 hit region */}
  <Rect
    x={0}
    y={0}
    width={width}
    height={height}
    fill="rgba(0,0,0,0)"
  />
  <KonvaImage
    image={image}
    ...
    listening={false}
  />
</Group>
```

### 為什麼這個修法有效

| 行為 | 原理 |
|---|---|
| Rect 提供 hit region | Konva 遍歷 children 找 listening node，Rect 預設 listening=true 且覆蓋整個 bbox |
| Rect 是透明的 | `fill="rgba(0,0,0,0)"` — 視覺上看不見，不影響渲染 |
| 點擊 Rect → onClick 冒泡到 Group | Konva event 系統：child 收到 event 後冒泡到 parent Group → Group 的 onClick fire |
| 對 circle / triangle 也 work | Group 的 `clipFunc` 同時 clip visual canvas **和** hit canvas → Rect 的 hit region 被裁切到形狀內部，圓外 / 三角形外的點擊仍然穿透（正確的 deselect 行為）|
| 對 rect（無 clipFunc）work | Group 的 hit region = Rect 的 hit region = 整個 bbox。**修正了 Round 7/8 沒處理到的「Konva.Image pixel-based hit detection」**——不再依賴 Konva.Image 的 alpha 判斷 |

### 為什麼不直接把 KonvaImage 的 `listening` 改成 true

選項 A：把 inner KonvaImage 的 `listening={false}` 拿掉

```tsx
// 不採用
<KonvaImage image={image} ... />   // 沒有 listening={false}
```

問題：
1. 對 PNG-with-transparent-background uploads，Konva.Image 的 pixel-based hit detection 仍然會忽略透明像素 → 透明區點不到
2. 對 circle / triangle，Konva.Image 的 hit region 是矩形（不 clip），所以圓外 / 三角形外的點擊會 fire（錯誤）
3. 兩種 path 行為分裂（rect vs circle/triangle），跟 Round 8 的「統一」目標矛盾

選項 B：加透明 Rect 作為 hit target（✅ 採用）

```tsx
<Rect fill="rgba(0,0,0,0)" />   // hit target
<KonvaImage listening={false} />  // 純視覺渲染
```

好處：
1. Rect 提供一致的 hit region（rect = 全 bbox，circle/triangle = clipFunc 後的形狀）
2. KonvaImage 保持 `listening={false}` — 視覺渲染跟事件處理完全分離
3. 不依賴 Konva.Image 的 pixel-based hit detection（PNG 透明區也能點）
4. 對 circle / triangle 形狀外點擊仍然穿透（正確的 deselect）

---

## 程式碼變更

### `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardCanvas.web.tsx`

`CanvasKonvaImage` 在 `<Group>` 開頭加透明 `<Rect>` 作為 hit target：

```tsx
<Group ...>
  {/* Hit-target Rect (Round 9, 2026-09-27) — gives the Group a
      hit region. Konva.Group's hit detection comes entirely
      from its listening children; with only a Konva.Image that
      has `listening={false}`, the Group has NO hit region and
      clicks fall through to the Stage (which clears selection
      via onMouseDown). ... */}
  <Rect
    x={0}
    y={0}
    width={width}
    height={height}
    fill="rgba(0,0,0,0)"
  />
  <KonvaImage image={image} ... listening={false} />
</Group>
```

### `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardCanvas.test.tsx`

新增 Round 9 describe block（4 條 source-level 斷言）：

| # | 測試 | 斷言 |
|---|---|---|
| 1 | `source: Group contains a transparent hit-target Rect (regression — Konva.Group needs listening children for hit region)` | 正向 — source 含 `fill="rgba(0,0,0,0)"` 的 Rect |
| 2 | `source: hit-target Rect is nested inside the Group wrapper (not a sibling)` | 結構 — 用 `id={element.id}` 當錨點（避免匹配到 Round 8 prose comment），找到 Group 後驗證內含 hit Rect |
| 3 | `source: hit-target Rect spans the full bbox (x=0, y=0, width=width, height=height)` | 結構 — hit Rect 必須覆蓋 Group 本地座標系的完整 bbox |
| 4 | `source: inner Konva.Image still has listening={false} (events bubble to Group via hit Rect)` | 防禦 — KonvaImage 保持 `listening={false}`，事件統一走 hit Rect 冒泡到 Group |

---

## 4 層 schema 同步

不涉及 schema 變更。純 rendering 邏輯。

---

## 為什麼 TDD 還是只在 source level

jsdom 沒有 HTMLCanvasElement，Konva.Image / Group 完全不能 fire 真實的 click event。
但這次的 4 條 source-level 斷言比 Round 8 的更紮實地抓到了 hit region 的實質：

| 測試類型 | Round 8 | Round 9 |
|---|---|---|
| Negative assertion | bare KonvaImage with onClick 不該存在 | Konva.Group hit region 必須有 listening child |
| Positive structural | Group + onClick + onTap + draggable + id 全部齊 | Group 內必須有 hit-target Rect（透明 fill）|
| Hit-region 驗證 | ❌（漏掉 Konva.Group 沒有自有 hit region）| ✅（透明 Rect + bbox 覆蓋）|
| Konva.Image 保持 listening=false | 有（但沒驗證是 hit-region 必要條件）| 有（明確標示是「事件統一走 hit Rect 冒泡」）|

實機驗證仍需要 dev server + 瀏覽器：
- 上傳透明背景 PNG → 圖片載入後點圖片任意位置（含透明區）→ Transformer attach 出現 ✅
- 切換 clipShape 為 circle / triangle → 點形狀內 → 可選；點形狀外 → 穿透到 Stage（正確 deselect）✅
- 確認 Stage 點空白處仍然正確清掉 selection ✅

---

## 驗證結果

| 項 | 指令 | 結果 |
|---|---|---|
| Canvas 測試 | `npx vitest run Step7TableCardCanvas.test.tsx` | ✅ 26/26 pass（22 → 26，含 4 條新增 Round 9）|
| 全 Step7 + store | `npx vitest run Step7TableCard/ CardBuilderEditor.tableCard.store.test.ts` | ✅ 78/78 pass（74 → 78）|
| 全 frontend suite | `npx vitest run` | ✅ 1563/1563 pass（1559 → 1563）|
| TypeScript | `npx tsc -p tsconfig.app.json --noEmit` | ✅ 無新增錯誤（既有 pre-existing `useImageCrop` / `detectLanguage.web.ts` errors 與本 PR 無關）|
| Lint | `npm run lint -- <changed files>` | ✅ exit 0 |

---

## 衍生效應 / 觀察

### 為什麼 Round 7 跟 Round 8 都漏抓了同一類 bug

Round 7 修的是 placeholder Rect（loading 階段），當時的修法是把 `listening={false}` 拿掉讓 placeholder 可以點。Konva.Rect 預設 listening=true，這個修法 work。

Round 8 修的是 loaded 階段，想套用同樣的「加 onClick handler」思維，但忽略了：
1. Konva.Image 的 pixel-based hit detection 對透明像素不 fire（Round 8 修了這點）
2. **Konva.Group 沒有自有 hit region**（Round 8 漏掉）

兩個 bug 都源自「source-level 測試只看 structural pattern，沒有驗證實際的 hit detection 行為」。jsdom 沒 canvas context 也讓這類 bug 特別難抓。

### 教訓：對 Konva 的 hit detection 必須有 structural assertion

未來任何用 `<Group>` 包裝 image / 自定義 shape 的元件，必加：

```ts
// 必須驗證 Group 內有 listening child 提供 hit region
expect(src).toMatch(/<Group[\s\S]*?id=\{element\.id\}[\s\S]*?(<Rect|<Circle|<KonvaImage(?!\s+listening=\{false\}))/);
```

或更明確地驗證有 transparent hit target：

```ts
expect(src).toMatch(/fill="rgba\(0,0,0,0\)"/);
```

### Konva.Group 行為速查（避免再次踩雷）

| 場景 | 行為 | 修法 |
|---|---|---|
| Group 包一個 `listening={false}` child | Group 無 hit region | 加 transparent Rect 當 hit target |
| Group 包多個 `listening={false}` child | Group 無 hit region | 同上 |
| Group 包 `listening={true}` child | Group hit region = child 的 union | 直接 work |
| Group 有 clipFunc | clipFunc 對 visual **和** hit 都生效 | hit 自動被形狀限制 |
| Group 沒 child | Group 無 hit region | 加 child |

---

## 同步狀態

- 本地：commit 待送
- Remote：待 push
