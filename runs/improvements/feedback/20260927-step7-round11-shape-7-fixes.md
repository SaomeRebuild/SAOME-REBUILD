# Step 7 — Round 11 — Shape Tool 7 項修正（Triangle/Ellipse bbox + Polygon UX）

> 2026-09-27 — CardBuilder Step 7 表單卡片工具 7 項 regression 修正
> 根因 + 修法 + 完整 Round 11 conformance tests trace

## 背景

Round 10 (見 `20260927-step7-round10-shape-stroke-and-new-shapes.md`) 新增了 triangle / ellipse / polygon 三個形狀,實作後在 production 跑出 **7 個 user-visible bug**。本 round 集合 7 項修正,涵蓋 canvas render math (Issue 1+2)、polygon 編輯 UX (Issue 3-6)、i18n 文案 (Issue 7)。

完整 plan:[`step7_形狀工具_7_項修正計畫_33365e87.plan.md`](file:///c:/Users/user/.cursor/plans/step7_%E5%BD%A2%E7%8B%80%E5%B7%A5%E5%85%B7_7_%E9%A0%85%E4%BF%AE%E6%AD%A3%E8%A8%88%E7%95%AB_33365e87.plan.md)

---

## 7 項 bug 清單

| # | 症狀 | 觸發場景 |
|---|---|---|
| 1 | 三角形 / 橢圓 resize **只能放大不能縮小** | 拖 Transformer anchor 縮小 shape 時,新寬度永遠是 0 |
| 2 | 三角形 / 橢圓 move **跳動、跳出畫布** | resize 後再 drag,新位置跟游標不一致 |
| 3 | 多邊形頂點 **沒編號** | 5+ 頂點時分不清「第 1 個」「第 3 個」是哪個 |
| 4 | 多邊形頂點 **不能拖曳**(無論建立中或完成後) | 想微調頂點位置只能 cancel 重畫 |
| 5 | 缺 **跟隨游標的虛線** | 不知道「下一個 click 會落在哪」 |
| 6 | Enter / 雙擊 **無法完成多邊形** | React 19 strict mode + dblclick 兩次 mousedown = 額外塞 2 個頂點 |
| 7 | i18n 文案**跟實際操作不符** | 「按確認鍵完成」但 UI 沒有確認鍵,「完成」按鈕其實是畫布按鈕 |

---

## Issue 1+2 — Triangle / Ellipse:wrap `<Group>` 統一 bbox 數學

### 根因

Round 10 把 `RegularPolygon` / `Ellipse` 放在 **bbox 中心**:

```12:35:apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardCanvas.web.tsx
onDragEnd={(e) =>
  onChange({
    ...el,
    x: e.target.x() / PREVIEW_SCALE - width / 2,
    y: e.target.y() / PREVIEW_SCALE - height / 2,
  })
}
```

兩個 Konva 內建 primitives 有**兩個 quirk**:

1. `RegularPolygon.width()` / `height()` 內建回傳 **0**(radius-driven)
2. `Ellipse.width()` / `height()` 也是 **0**(radiusX/radiusY-driven)
3. `onTransformEnd` 透過 closure 抓 `width / height`,但 resize 後 closure 還沒刷新就用舊值

→ 縮小到一半時 `newW = 0 * 0.5 = 0` → triangle collapse
→ drag 還原 top-left 用 closure 舊值 → 視覺位置錯位

### 修法

**仿 Round 8 image pattern**:用 `<Group>` 包住 primitive,Group 擁有 bbox (`x, y, width, height`) + drag/transform handlers,inner primitive 是 `listening={false}` 的純渲染。

```tsx
<Group x={x} y={y} width={width} height={height} rotation={el.rotation}
       draggable onClick onTap onDragEnd onTransformEnd>
  <RegularPolygon x={width/2} y={height/2} sides={3}
                  radius={Math.min(width, height)/2} listening={false} />
</Group>
```

- `onDragEnd` 統一 `x: e.target.x() / PREVIEW_SCALE` (Group 的 x 就是 bbox top-left)
- `onTransformEnd` 統一 `newW = node.width() * scaleX` (Group 的 width() = 真實 bbox)
- 不需 `* (width / 2)` center-offset compensation

Math 跟 rect branch **完全一致**,no special case。

### 不變 schema

`TableCardElement.x / y / width / height` 仍是 bbox top-left,不需改 zod / db interface。

---

## Issue 3 — Polygon 頂點編號標籤

### 行為

每個 vertex 從「單純藍點」升級為「**白色 stroke + 藍色 fill 5px 圓** + **上方 11px 粗體黑色數字 (1, 2, 3...)**」。

### 實作

`renderPolygonVertexMarkers(points, opts)` helper 同時服務兩個 call site:

| Call site | 用途 | draggable |
|---|---|---|
| `renderPolygonPreview`(canvas line 587) | 建立中的預覽 | `true`(讓使用者可在 finish 前微調) |
| `renderElementInner` polygon selected branch(canvas line 1455) | 完成後的 polygon,只有 `selectedId === el.id` 時顯示 | `true` |

每個 marker 是 `<Group draggable>`,內含 `<Circle radius={5} stroke="#fff" />` + `<KonvaText fontSize={11} fontStyle="bold" listening={false} />`。

完成後的 markers 只在 selected 時出現,避免遮擋其他元素;`e.cancelBubble = true` 阻止 marker click 冒泡到 polygon's onClick(避免 deselect)。

---

## Issue 4 — Polygon 頂點可拖曳(建立中 + 完成後)

### 設計

頂點 drag 有兩個情境,共享同一 helper 但 onDragVertex 寫到不同 store path:

| 情境 | On drag commit 寫到 |
|---|---|
| **建立中** | store `polygonCreation.vertices` (element-local) |
| **完成後 + selected** | `el.points` (element-local) |

### Store 新增 action

`CardBuilderEditor.store.ts` 新增 `updatePolygonVertex(vertexIndex, localX, localY)`:

- vertexIndex 0-based,out-of-bounds no-op
- `flatIdx = vertexIndex * 2`(Konva flat format)
- 必須 `localX / localY` 是 finite number,否則 no-op

### Drag 技巧:Snap-back

`<Group draggable onDragMove>` 期間:
1. invoke `opts.onDragVertex(vertexIndex, node.x() / PREVIEW_SCALE, node.y() / PREVIEW_SCALE)` → 觸發 store update
2. **Snap back 視覺位置**:`node.position({ x: px, y: py })` 把 marker 移回原位

理由:Konva onDragMove 期間 store 已 commit,但 React re-render 還沒到下一幀。如果讓 marker 停在 drag 的位置,視覺會瞬間跳到新值,跟 store 落後一格。Snap back 後 React re-render 帶 store 的新值,marker 從原位直接跳到新位 — 視覺跟 state 同步不抖。

```tsx
onDragMove={(e) => {
  if (!opts.onDragVertex) return;
  const node = e.target;
  opts.onDragVertex(vertexIndex, node.x() / PREVIEW_SCALE, node.y() / PREVIEW_SCALE);
  node.position({ x: px, y: py });   // ← snap back
}}
onDragEnd={(e) => {
  if (!opts.onDragVertex) return;
  opts.onDragVertex(vertexIndex, e.target.x() / PREVIEW_SCALE, e.target.y() / PREVIEW_SCALE);
}}
```

### 與 Transformer 互不相衝

- Marker 透過 `e.cancelBubble = true` 阻止 click 冒泡(已實作)
- Konva reverse-traversal hit detection:marker 先被命中,事件不傳到 polygon 的 onClick

---

## Issue 5 — 跟隨游標的虛線

### 行為

建立中且 `vertices.length >= 2` 時,在 **最後一個頂點 → 滑鼠游標** 之間畫 fainter dashed 線;滑鼠離開 canvas 就清掉。

### 實作

- `<Stage onMouseMove>` → `setCursorPosMm({ x, y })`(只在 `isDrawingPolygon` 時)
- `<Stage onMouseLeave>` → `setCursorPosMm(null)`
- `renderPolygonPreview` 多吃一個 `cursorPosMm` 參數;非 null 且 ≥ 1 個 vertex 時,append 一條 `<Line dash={[4,4]} opacity={0.6} listening={false}>`

顏色用既有的藍 `#3b82f6`,stroke 1px(比連線虛線 `[6,4]` 稍短稍 fainter,視覺層級:Vertex > Connecting line > Cursor tail)。

---

## Issue 6 — 畫布完成按鈕 + 移除 Enter / dblclick

### 為什麼 Enter / dblclick 都壞

- **Enter**:React 19 strict mode 雙 mount 期間,`window.addEventListener('keydown')` 可能在 input focus 切換時被 `useEffect` cleanup 提前拔掉
- **dblclick**:Konva 的 `onDblClick` 在 React 18/19 下,點擊兩下會先觸發兩次 `onClick`(Stage 的 `appendPolygonVertex`),再加一個 `dblClick` event → 多塞 2 個不需要的頂點

### 修法:on-canvas finish button

`polygonCreation.vertices.length >= 6`(≥ 3 個 vertex) 時,在**最後一個 vertex 右下方 12px offset**位置,浮現一個 56×32px 圓角按鈕:

```tsx
<Group x={buttonX} y={buttonY}
       onClick={(e) => {
         e.cancelBubble = true;          // ← 阻止 Stage 的 appendPolygonVertex
         const pts = finishPolygonCreation();
         if (pts && polygonCreation) {
           finishPolygonDrawing(polygonCreation, pts, addElement, tableCard.elements);
         }
       }}
       onTap={...}>
  <Rect width={56} height={32} cornerRadius={6} fill="#ffffff" stroke="#3b82f6" />
  <KonvaText text="完成多邊形" fontSize={12} fill="#3b82f6" />
</Group>
```

`e.cancelBubble = true` 是關鍵 — 沒這個,點擊按鈕會先 bubble 到 Stage 的 `onMouseDown`,再加一個 vertex。

**Esc 保留**(取消用),`Enter` 完全移除。`<Stage onDblClick>` handler 也不存在(原本就沒加,但 dblclick 隱含觸發兩次 click)。

---

## Issue 7 — i18n 文案更新

### zh-TW (`tableCard.zh-TW.ts`)

| Key | 舊 | 新 |
|---|---|---|
| `polygonHint` | 已加入 {{count}} 個頂點 — 在畫布上點擊加頂點,雙擊或按確認鍵完成 | 已加入 {{count}} 個頂點 — 點擊畫布加頂點,完成多邊形按鈕在最後一個頂點旁,或拖曳頂點微調 |
| `polygonFinish` | 完成 | 完成多邊形 |

### en (`tableCard.en.ts`)

| Key | 舊 | 新 |
|---|---|---|
| `polygonHint` | {{count}} vertices added — click the stage to add more, double-click or press Enter to finish | {{count}} vertices added — click stage to add vertices, tap the Finish button next to the last vertex, or drag vertices to fine-tune |
| `polygonFinish` | Finish | Finish polygon |

### i18n test mirror

`Step7TableCard.i18n.test.ts` 已有 mirror 斷言(zh-TW ↔ en key 必須同步存在),新文案自動涵蓋。

---

## Round 11 Conformance Tests(9 條 + 2 條既有更新)

新增在 `Step7TableCardCanvas.test.tsx` 的 `describe('Round 11 — Step7 shape-tool 7-fix regression tests', ...)` block:

| # | Test | 涵蓋 |
|---|---|---|
| 1 | Issue 1: triangle/ellipse render inside `<Group>` with bbox math | Issue 1 structural invariant(both shapes wrapped) |
| 2 | Issue 1: triangle/ellipse onDragEnd uses `node.x() / node.y()` directly | Issue 2 regression(no center-offset) |
| 3 | Issue 2: triangle/ellipse onTransformEnd uses `node.width() * scaleX` | Issue 1 regression(real bbox math) |
| 4 | Issue 3: KonvaText with `String(vertexIndex + 1)` + `fontStyle="bold"` | Issue 3 structural |
| 5 | Issue 4: renderPolygonVertexMarkers wires onDragVertex for both call sites | Issue 4 wiring(both creation + finished) |
| 6 | Issue 4: store has `updatePolygonVertex` action wired | Issue 4 + store action |
| 7 | Issue 5: cursorPosMm via onMouseMove + clears via onMouseLeave | Issue 5 wiring |
| 8 | Issue 6: canvas finish button text `"完成多邊形"` | Issue 6 + i18n label pinned together |
| 9 | Issue 6: canvas finish button gated on `vertices.length >= 6` | Issue 6 visibility gate |

既有 Round 10 mock test 自動更新 — 因為 triangle/ellipse 從「裸 Konva primitive」變成「Group wrapped」,mock factory 的 `Group: vi.fn(({ children }) => <div>{children}</div>)` 已自然處理(沒有寫死的 prop 斷言)。

---

## Schema Contract Drift

| 層 | 同步 |
|---|---|
| `packages/shared/schemas/card.ts` | ✅ Round 10 已擴充 shape union + points/vertexCount |
| `apps/backend/.../schemas/request.ts` | ✅ import shared,沒漂移 |
| `apps/backend/.../db/templates.ts` | ✅ Round 10 TS union mirror |
| `apps/backend/.../services/` | N/A(jsonb 透傳) |

本 round 沒新增欄位、不改 schema — pure render / UX / store action。

---

## Verification

```
✅ Step7 tests: 80/80 passed (5 files, 4.68s)
   - Step7TableCardCanvas.test.tsx (50 tests)
   - Step7TableCardInspector.test.tsx (13 tests)
   - Step7TableCard.i18n.test.ts (6 tests)
   - Step7TableCard.hooks.test.ts (7 tests)
   - Step7MobileToolbar.test.tsx (4 tests)

✅ Full frontend: 1610/1610 passed (126 test files, 105.75s)
✅ Lint: 0 errors (warnings only, all pre-existing)
✅ Typecheck: 0 Step7 errors
   (16 pre-existing errors in unrelated useImageCrop + MediaAssetUploader files)
```

---

## 已知設計取捨

| 取捨 | 選擇 | 原因 |
|---|---|---|
| Marker radius | 5 px(原 4 px) | 加上 stroke + label 後視覺重量平衡 |
| Label 位置 | `(8, -16)` offset | 數字不擋圓點本身,容易閱讀 |
| Snap-back on dragMove | 視覺固定 + state 提前 commit | 避免 fast drag 時 Konva 視覺殘留 |
| Finish button 位置 | last vertex + 12px offset | 靠近最後一個 vertex 而不擋到 |
| Finish button gating | `vertices.length >= 6` | schema 規定 ≥ 3 vertex,3×2=6 |

---

## 參照

- Rule 019 § 4.1 — Backend Request Schema 四層同步(本 round 未動 schema)
- Rule 022 — 元件重用(本 round 是既有 L2 元件擴充)
- Rule 024 § Hook Split Pattern(web/.native.tsx 分檔)— 跟 Step7TableCardCanvas 的 `.web.tsx` 對齊
- Plan: [`step7_形狀工具_7_項修正計畫_33365e87.plan.md`](file:///c:/Users/user/.cursor/plans/step7_%E5%BD%A2%E7%8B%80%E5%B7%A5%E5%85%B7_7_%E9%A0%85%E4%BF%AE%E6%AD%A3%E8%A8%88%E7%95%AB_33365e87.plan.md)
- 上一輪 feedback: [`20260927-step7-round10-shape-stroke-and-new-shapes.md`](file:///c:/Users/user/Desktop/SAOME-REBUILD/runs/improvements/feedback/20260927-step7-round10-shape-stroke-and-new-shapes.md)
