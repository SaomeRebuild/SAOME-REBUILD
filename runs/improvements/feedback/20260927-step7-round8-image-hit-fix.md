# Step 7 Round 8 Fixes — Image clickability after loading (2026-09-27)

## 概述

Round 7 修了「loading 階段的 placeholder Rect 不能點」的 bug，**但只修了一半**。
User 馬上回報：「新上傳的圖片在畫布上一開始可以點選，後來又不行了，已經在畫布上的舊圖片也是不能點選」。
本輪修第二個 root cause：**loaded Konva.Image 的 hit-detection 用 pixel-based**，透明像素不計 hit，導致 PNG logo / icon 類的圖完全選不到。

---

## 根因分析

### Round 7 修了一半的 bug

Round 7 的修法是給 loading placeholder Rect 加 `onClick` / `onTap`，**沒有動 loaded Konva.Image 的渲染路徑**：

```tsx
// 之前 (Round 2 起的設計，Round 7 沒改)
if (clipShape === 'rect') {
  return (
    <KonvaImage
      id={element.id}
      image={image}
      ...
      onClick={handleClick}  // <-- 這個 click handler 幾乎不會 fire
      onTap={handleTap}
      ...
    />
  );
}
```

### 為什麼 Konva.Image 的 onClick 不 fire？

Konva.Image 預設使用 **pixel-based hit detection**（不是 rectangular bounding box）。
每個像素是否算 hit 取決於該像素的 alpha 值：透明像素（alpha = 0）**不算 hit**。

實際情境：

| 圖檔類型 | 透明像素 | 點擊透明區域 | 點擊可見區域 |
|---|---|---|---|
| PNG logo（白底透明） | 大量 | onClick **不 fire** | onClick 正常 fire |
| PNG icon（透明背景） | 大量 | onClick **不 fire** | onClick 正常 fire |
| JPEG 照片 | 無 | 不適用 | onClick 應該 fire，但 mount timing 偶爾 race |

User 上傳的桌牌元素大多是 logo / icon / 戳印 類（有透明背景的 PNG），所以幾乎點不到。

### 為什麼 Round 7 沒抓到這個 bug？

Round 7 的測試只斷言 **placeholder Rect** 有 `onClick` / `onTap`：

```ts
// Step7TableCardCanvas.test.tsx (Round 7)
it('source: loading placeholder Rect has onClick and onTap ...', () => {
  expect(src).toMatch(
    /status === 'loading'[\s\S]*?onClick=\{\(\) => onSelect\(element\.id\)\}/,
  );
});
```

這個測試只 cover loading 階段的 placeholder。**沒有任何測試 cover loaded Konva.Image 的 click behavior**。

而且 jsdom 沒有 canvas context，根本不能實際 fire Konva 的 click event — 全部都是 source-level regex 斷言。

---

## 修法

### 統一走 Group wrapper

把 `CanvasKonvaImage` 的三條 clipShape 路徑（rect / circle / triangle）合併成**一條**，全部走 `<Group clipFunc={...}><KonvaImage listening={false} /></Group>`：

```tsx
function CanvasKonvaImage({...}): ReactElement {
  const clipShape = element.clipShape ?? 'rect';
  const cornerRadiusPx = mmToPx(element.clipRadius ?? 0);

  // Handlers — 都掛在 Group 上（rect / circle / triangle 共用）
  const handleDragEnd = (e) => onChange({...});
  const handleTransformEnd = (e) => onChange({...});
  const handleClick = () => onSelect(element.id);
  const handleTap = () => onSelect(element.id);

  // clipFunc — 只有 circle / triangle 才需要，rect 留 undefined
  const clipFunc =
    clipShape === 'circle'
      ? (ctx) => { /* arc */ }
      : clipShape === 'triangle'
        ? (ctx) => { /* triangle */ }
        : undefined;  // <-- rect 路徑：無 clipping → Group 完整 bounding box 都能 hit

  return (
    <Group
      id={element.id}
      x={x} y={y} width={width} height={height}
      rotation={element.rotation}
      clipFunc={clipFunc}              // <-- rect 時是 undefined
      draggable
      onClick={handleClick}             // <-- 統一掛 Group
      onTap={handleTap}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
      opacity={isSelected ? 0.95 : 1}
    >
      {/* 內層 Konva.Image 純渲染，listening={false} 把事件 bubble 給 Group */}
      <KonvaImage
        image={image}
        x={0} y={0} width={width} height={height}
        cornerRadius={cornerRadiusPx > 0 ? cornerRadiusPx : undefined}
        listening={false}
      />
    </Group>
  );
}
```

### 為什麼 Group 可以解決

| 路徑 | clipFunc | Group hit region | 點擊透明像素 |
|---|---|---|---|
| **Rect（修前）** | 無 | 用 Konva.Image 的 **pixel-based hit detection** | **不 fire onClick** |
| **Rect（修後）** | undefined | **Group 完整 bounding box**（rectangular） | onClick 正常 fire |
| Circle | 圓弧 clipFunc | 圓內 | 圓內 fire（正確） |
| Triangle | 三角形 clipFunc | 三角形內 | 三角形內 fire（正確） |

修後的所有路徑都走 Group wrapper，**rect 路徑不再依賴 Konva.Image 的 pixel-based hit detection**，所以透明像素不再卡點擊。

### Konva.Image.cornerRadius 還能 work

`cornerRadius` 是 Konva.Image 的 built-in property，在 Group 內部仍然 render 帶圓角的圖片像素。Group 自己先 transform / scale / rotate，子元素的 rendering 在那之後才發生，所以圓角效果不變。

---

## 程式碼變更

### `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardCanvas.web.tsx`

`CanvasKonvaImage` 重寫成單一路徑：

- **Before**：3 條分支（rect → 裸 Konva.Image；circle / triangle → Group + clipFunc）。每條分支各自管自己的 handler binding。
- **After**：1 條統一路徑（Group + conditional clipFunc + 統一 handler）。`clipShape === 'rect'` 時 `clipFunc = undefined`，Group 沒有 clipFunc → 矩形 hit region。

刪除：3 條 return 分支裡各自的 handler 重複定義。
保留：`clipShape === 'circle'` 跟 `clipShape === 'triangle'` 的 arc / triangle draw function（搬到 Group 上方的 `clipFunc` 三元運算子）。

### `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardCanvas.test.tsx`

新增 Round 8 describe block（4 條 source-level 斷言）：

| # | 測試 | 斷言 |
|---|---|---|
| 1 | `rect path no longer renders a bare <KonvaImage> with onClick` | negative assertion — `<KonvaImage id={element.id} ... onClick={handleClick} ... onTap={handleTap}>` 不該存在（避免未來 refactor 又回到 bare KonvaImage 的反模式） |
| 2 | `CanvasKonvaImage returns a single Group wrapper regardless of clipShape` | positive — Group 同時有 `onClick={handleClick}` / `onTap={handleTap}` / `id={element.id}` / `draggable`，內層 `<KonvaImage listening={false}>` |
| 3 | `clipFunc is only set when clipShape is circle or triangle (not rect)` | structural — `clipShape === 'circle'` 跟 `clipFunc={clipFunc}` 還在 source 裡 |
| 4 | `inner Konva.Image keeps cornerRadius prop (rect rounding preserved)` | 確認 Round 6 的圓角功能沒被新架構破壞 |

---

## 4 層 schema 同步

不涉及 schema 變更。純 rendering 邏輯。

---

## 為什麼 TDD 還是只在 source level

jsdom 沒有 HTMLCanvasElement，Konva.Image / Group 完全不能 fire 真實的 click event。
但這次的 4 條 source-level 斷言比 Round 7 的更紮實：

| 測試類型 | Round 7 | Round 8 |
|---|---|---|
| Negative assertion | 無 | 有（擋掉 bare KonvaImage 反模式） |
| Positive structural | 只有 Group wrapper exists | Group + onClick + onTap + draggable + id 全部齊 |
| cornerRadius 保留 | 只有 source-level「Konva.Image 有 cornerRadius」 | inner Konva.Image 必須在 Group 內，cornerRadius 保留 |
| clipFunc conditional | circle / triangle 分開驗 | 統一驗證 `clipFunc={clipFunc}` shape |

實機驗證仍需要 dev server + 瀏覽器（建議 dev smoke test）：
- 上傳透明背景 PNG → 圖片載入後點圖片任意位置（含透明區）→ Transformer attach 出現
- 上傳矩形 PNG → 點邊角 → 一樣可選
- 切換 clipShape 為 circle / triangle → 點裁切區內 → 可選；點裁切區外 → 不選

---

## 為什麼 user 之前回報「可以點」placeholder 但後來又不行

| 階段 | 渲染 | 點擊行為 | 為什麼 |
|---|---|---|---|
| **Loading** | `<Rect fill="#e5e7eb" onClick={...}>`（placeholder） | onClick **正常 fire** | placeholder 是 Konva.Rect，rectangular hit detection — 整個 bounding box 都算 hit |
| **Loaded（Round 7 修前）** | `<KonvaImage onClick={...}>` | onClick **很少 fire** | Konva.Image 預設 pixel-based hit detection，透明像素不算 hit |
| **Loaded（Round 8 修後）** | `<Group><KonvaImage listening={false} /></Group>` | onClick **正常 fire** | Group 走 rectangular hit detection，inner Image listening={false} 不搶事件 |

User 觀察到的「可以點 → 後來不行」就是從 loading placeholder（Rect）切到 loaded Konva.Image 後失去 hit detection。

---

## 驗證結果

| 項 | 指令 | 結果 |
|---|---|---|
| Canvas 測試 | `npx vitest run Step7TableCardCanvas.test.tsx` | ✅ 22/22 pass（含 4 條新增 Round 8） |
| 全 Step7 + store | `npx vitest run src/components/.../Step7TableCard/ CardBuilderEditor.tableCard.store.test.ts` | ✅ 74/74 pass |
| 全 frontend suite | `npx vitest run` | ✅ 1559/1559 pass（比修前 1555 多 4 條） |
| TypeScript | `npx tsc -p tsconfig.app.json --noEmit` | ✅ 無新增錯誤（既有 pre-existing `useImageCrop` / `detectLanguage.web.ts` errors 與本 PR 無關） |
| Lint | `npm run lint -- <changed files>` | ✅ exit 0 |

---

## 同步狀態

- 本地：commit 待送
- Remote：待 push

## 衍生效應

未來若再加 `clipShape === 'hexagon'` 之類的新形狀：
- 只要在 `clipFunc` 三元運算子加一個 branch
- Group / handler 結構不用動
- 對應的 source-level 測試也不會被破壞（因為斷言的是「Group + clipFunc={clipFunc}」這個結構，不是具體的 shape 字串）
