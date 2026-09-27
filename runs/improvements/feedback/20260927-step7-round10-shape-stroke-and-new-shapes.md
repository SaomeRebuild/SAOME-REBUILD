# Step 7 — Round 10 — Shape Stroke Picker Fix + 3 New Shapes

> 2026-09-27 — CardBuilder Step 7 表單卡片工具強化
> 根因 + 修法 + regression test trace

## 背景

Step 7 (表單卡) Inspector 的 shape 區塊從 Phase 1 開始就只有「fill」顏色 picker 跟圓角 mm 輸入,沒有獨立的「stroke」顏色 picker。這埋了兩個 user-visible bug:

1. **Task #1 — 矩形 / 圓形的邊框改色無效**:Inspector 暴露 `cornerRadius` 但完全沒有 stroke color picker,使用者根本無法設定 stroke color
3. **Task #2 — 線段 (line) 的 fill picker 改色無效**:`addShape('line')` 預設填了 `stroke: '#3b82f6'`,canvas 渲染讀 `stroke={el.stroke ?? el.fill}`,所以使用者用 fill picker 改色完全不影響渲染

兩個任務的**同一個根因**:**stroke picker 在 Inspector 缺失**。

額外任務(Task #3):新增 三角形 / 橢圓形 / 任意多邊形 三個形狀。多邊形需要「click-to-add-vertex」creation mode + canvas pointer-event interception。

## 變更清單

### Schema (`packages/shared/schemas/card.ts`)

`tableCardElementSchema` 的 shape discriminator union 擴充為 6 種:

```ts
shape: z.enum(['rect', 'circle', 'line', 'triangle', 'ellipse', 'polygon'])
```

新增 polygon-only 欄位:

```ts
points: z.array(z.number()).optional()      // Konva flat format
vertexCount: z.number().int().min(3).max(12).optional()
```

`points` 是 Konva 內建的 flat number array 格式 `[x1, y1, x2, y2, ...]`,直接喂進 `<Line points>` 不用 transform。

### Backend TS Mirror (`apps/backend/src/modules/cards/db/templates.ts:636-650`)

更新 hardcoded union + `points` / `vertexCount` 欄位,跟 shared schema 同步。

### Canvas Render (`Step7TableCardCanvas.web.tsx`)

新增 3 個 branch:

| shape | Konva primitive | 數學 |
|---|---|---|
| `triangle` | `<RegularPolygon sides={3}>`` | radius = min(w, h) / 2,centered in bbox |
| `ellipse` | `<Ellipse>`` | radiusX = w/2, radiusY = h/2,centered in bbox |
| `polygon` | `<Line closed>`` | points = stored array |

三角形 / 橢圓形 / 矩形 都用 Konva 內建 primitive,所以 hit-test / drag / resize 行為免費。Polygon 用 `<Line closed>`,onTransformEnd 同步 scaleX/Y 到 points,避免 resize 後視覺被壓扁。

### Inspector UI (`Step7TableCardInspector.tsx`)

重寫整個 shape section,加 6 個 add button + stroke color picker + stroke width picker + polygon sides (vertex count) read-only 顯示。

`addShape()` 擴充接受所有 6 種 shape kind,每種給合理 default:

| shape | fill | stroke | strokeWidth |
|---|---|---|---|
| line | `#000000` (irrelevant, schema 要求) | `#3b82f6` | `2` |
| triangle / ellipse / polygon | `#3b82f6` | `#3b82f6` | `0` |
| rect / circle (既有) | `#3b82f6` | (新增預設) | `0` |

line 的 fill picker 隱藏 (line draw with stroke only)。

### Polygon Creation Mode

新增 `polygonCreation` state 在 store + 4 個 action (startPolygonCreation / appendPolygonVertex / finishPolygonCreation / cancelPolygonCreation)。

Lifecycle:

```
Inspector「新增多邊形」按鈕按下
   ↓ startPolygonCreation({ x, y, width, height })
canvas 進入 drawing mode (cursor: crosshair, 隱藏 Transformer, 凍結其他元素的 drag)
   ↓ useEffect on isDrawingPolygon=true
Canvas onMouseDown / onTouchStart 攔截點擊
   ↓ appendPolygonVertex(localX, localY)
Canvas 預覽連線 + 頂點 marker
   ↓ 雙擊 / Enter
finishPolygonCreation() 回傳 flat points 給 addElement
   ↓
畫布回到正常模式
```

按 Esc / Cancel button 走 `cancelPolygonCreation()`,vertex 不保留。

### i18n

新增 7 個 key (zh-TW + en 對稱):

| key | zh-TW | en |
|---|---|---|
| `shape.triangle` | 三角形 | Triangle |
| `shape.ellipse` | 橢圓形 | Ellipse |
| `shape.polygon` | 多邊形 | Polygon |
| `shape.addTriangle` | 新增三角形 | Add triangle |
| `shape.addEllipse` | 新增橢圓形 | Add ellipse |
| `shape.addPolygon` | 新增多邊形 | Add polygon |
| `shape.sides` | 頂點數 | Vertex count |
| `shape.sidesHint` | 範圍 3-12 | Range 3-12 |
| `shape.polygonHint` | 已加入 {{count}} 個頂點 ... | {{count}} vertices added ... |
| `shape.polygonFinish` | 完成 | Finish |
| `shape.polygonCancel` | 取消 | Cancel |

## 測試策略

### Canvas conformance (`Step7TableCardCanvas.test.tsx`)

兩個 layer:

1. **Source-level regex** — 確認 import / branch / props shape 不漂移
2. **Render-level mock** — 確認 canvas dispatch 到正確 Konva primitive

Render-level mock 的關鍵坑:`vi.mock('react-konva', ...)` factory 一定要把 `children` 往下傳 (`<div>{children}</div>`),否則 nested Konva primitive 不會被呼叫 — 修法參考 `Stage: vi.fn(({ children, ...props }) => <div>{children}</div>)`。

### Inspector regression (`Step7TableCardInspector.test.tsx`)

每個 6 個 add button 都有 `data-testid` (e.g. `shape-add-rect`, `shape-add-triangle`, `shape-add-polygon`),測試可以 userEvent.click 觸發 store action 並驗證 element 加入 / creation mode 啟動。

stroke picker 的 mutation 路徑是 `updateElement(shapeEl.id, { stroke: newColor })` → store。**Test 必須先把 element seed 進 store**,否則 `find(el => el.id === 'line-2')` 回傳 `undefined` (這次踩到的坑 — test 第一次跑 fail)。

## Schema Contract Drift Check

| 層 | 同步狀態 |
|---|---|
| `packages/shared/schemas/card.ts` | ✅ shape enum 6 種 + points/vertexCount optional |
| `apps/backend/src/modules/cards/schemas/request.ts` | ✅ import shared schema,沒寫 stub |
| `apps/backend/src/modules/cards/db/templates.ts` | ✅ TS union mirror 更新 |
| `apps/backend/src/modules/cards/services/...` | N/A (沒新增 service; jsonb 透傳) |

符合 Rule 019 § 4.1 Backend Request Schema 四層同步。

## Verification

```
✅ Step7TableCard tests: 71/71 passed (5 files)
   - Step7TableCardCanvas.test.tsx (含 Round 10 mock + source regex)
   - Step7TableCardInspector.test.tsx (6 buttons + stroke regression)
   - Step7TableCard.i18n.test.ts
   - 其他既有 test
```

## 關鍵設計決策

| 決策 | 選擇 | 原因 |
|---|---|---|
| 多邊形類型 | 任意多邊形 (user click 頂點) | user 明確指定 |
| 線段 fill 欄位 | 隱藏 | line 語意上沒有 fill |
| 三角形實作 | RegularPolygon sides=3 | Konva 內建 + 跟 image clipShape='triangle' 視覺一致 |
| 多邊形 points 格式 | Konva flat array | 直接喂給 `<Line points>` 不用 transform |
| Polygon onTransformEnd | 同步 scale points | bbox resize 跟頂點位置一起縮放 |
| Polygon creation UX | Stage 攔截 pointerdown | 既有 drag/Transformer 暫停,避免競爭 |

## 參照

- Rule 019 § 4.1 — Backend Request Schema 四層同步
- Rule 033 — Popover sizing (本 round 不適用,但 cursor: crosshair pattern 參考)
- Rule 022 — 元件重用 (本 round 是既有 L2 元件擴充)
- Rule 024 § Hook Split Pattern (web/.native.tsx 分檔)
- DEV/09-2026/0908 (Round 9 image clipShape + Group hit region) — 確認 image hit-test 不受 polygon creation mode 影響