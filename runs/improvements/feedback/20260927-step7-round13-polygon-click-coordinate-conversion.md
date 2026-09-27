# 2026-09-27 — Step 7 Round 13: 多邊形 preview 看不到 — 點擊座標單位轉換 bug

## 一句話總結

修齊 Step 7 多邊形工具的「看不到虛線 / 看不到頂點編號 / 看不到完成按鈕」5 個視覺症狀的**共同根因**：onMouseDown / onTouchStart 把 Konva pointer position 從 CSS px 換算到 mm 時，**漏掉 `PREVIEW_SCALE` 步驟**，導致頂點被存在「CSS px − bboxOrigin(mm)」的混合單位，渲染時被 `mmToPx` 二次放大 → 整包跑到畫布外（849px / 1143px 都 > 595 / 842 的可見 Stage）。

## 觸發訊號

| 訊號 | 來源 |
|---|---|
| 使用者回報：「開始畫多邊形 → 看到藍色虛線 + 頂點編號」「放下第 3 個頂點後 → 看到『完成多邊形』按鈕」「以上全部沒有成功」 | Step 7 Table Card dev manual testing (2026-09-27) |
| Round 12 的 8 條 source-pattern 測試**全部通過**，但實際視覺還是壞的 | 自己 trace code 發現 |

## 範圍

| 項目 | 內容 |
|---|---|
| 修改檔案 | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardCanvas.web.tsx`（既有 mousedown / touchstart handler + 新 export helper）|
| 修改測試 | `Step7TableCardCanvas.test.tsx`（新增 8 條 Round 13 regression test）|
| 修改 schema | 無 |
| 涉及 i18n key | 無 |
| 不變 schema | `TableCardElement` 與 zod schema |

## 根因分析（math walk-through）

### Schema 定義的單位

`TableCardElement.x / y / width / height / points` 一律是 **mm**（Rule 019 + shared schema 規範）。
Konva 的 `<Group x={...} y={...}>` 一律是 **CSS px**（Konva native unit）。
轉換 helper：

```typescript
const PREVIEW_SCALE = PREVIEW_WIDTH_PX / TABLE_CARD_WIDTH_MM;  // 595/210 ≈ 2.83 px/mm
function mmToPx(mm: number): number { return mm * PREVIEW_SCALE; }
```

### 正確的 click → mm 轉換鏈

```text
CSS px（pointer event）
  ÷ stageSize.scale       ← un-scale mobile fit-to-container（desktop: scale=1 → no-op）
  ÷ PREVIEW_SCALE         ← convert stage internal px → mm
  − bboxOrigin.x          ← element-local mm
```

### Round 10 寫錯的轉換

```typescript
// ❌ Round 10 漏掉 PREVIEW_SCALE 步驟
const localX = pos.x / stageSize.scale - polygonCreation.bboxOrigin.x;
```

實際算術（desktop，使用者點擊 canvas CSS px 300，bboxOrigin=(50, 50)）：

| 步驟 | Round 10（錯）| Round 13（正確）|
|---|---|---|
| `pos.x / stageSize.scale` | `300 / 1` = 300（CSS px 內部座標）| `300 / 1` = 300（CSS px 內部座標）|
| `÷ PREVIEW_SCALE` | **❌ 跳過** | `300 / 2.83` ≈ 105.88 mm |
| `− bboxOrigin.x` | `300 − 50` = 250（**CSS px 減 mm 的混合**）| `105.88 − 50` = 55.88 mm ✓ |

### 渲染時的二次破壞

`renderPolygonPreview` 用 `mmToPx(250)` 把「錯的 250」當 mm 看待，渲染成 `250 × 2.83 ≈ 707.5 px`。
再加上 Group 自身在 `mmToPx(50) = 141 px`，**絕對位置 = 141 + 707 = 848 px** — 早就飛出 595 寬的畫布。

完成按鈕的座標更慘：`mmToPx(50 + 350) + 12 = 1131 px` — 遠超 842 高的畫布。

**結果**：使用者看到空白畫布。所有預覽節點（Line / 圓圈 / 編號文字 / 按鈕）都在 canvas 外。

## 修法

### Cluster A — 抽出 single-source-of-truth helper

`Step7TableCardCanvas.web.tsx` 加 `export function polygonPointerToLocalMm(...)`：

```typescript
export function polygonPointerToLocalMm(
  pointerPos: { x: number; y: number },
  stageScale: number,
  bboxOrigin: { x: number; y: number },
): { localX: number; localY: number } {
  const conversionFactor = stageScale * PREVIEW_SCALE;
  return {
    localX: pointerPos.x / conversionFactor - bboxOrigin.x,
    localY: pointerPos.y / conversionFactor - bboxOrigin.y,
  };
}
```

理由：

1. **mousedown + touchstart 共用同一份邏輯**（之前兩處各自 inline，重構風險高）
2. **可單獨 unit test**（不用 mount React tree，不用 mock Konva，直接 call function）
3. **未來新增第 N 個 handler**（例如鍵盤輸入座標、第三方 pointer event lib）只要 call 同一個 helper 就不會再犯

### Cluster B — 兩個 click handler 改用 helper

`onMouseDown` 與 `onTouchStart` 內：

```typescript
const { localX, localY } = polygonPointerToLocalMm(
  pos, stageSize.scale, polygonCreation.bboxOrigin,
);
appendPolygonVertex(localX, localY);
```

兩個 handler 行為對稱（mobile parity，Round 10 已經做對）。

## 8 條新增 regression test

與 Round 12 的 source-pattern test 不同，Round 13 的測試**真的執行** helper 並 assert 數值：

| # | Test | 覆蓋 |
|---|---|---|
| 1 | `PREVIEW_SCALE` sanity（595/210 ≈ 2.83）| 常數穩定性 |
| 2 | Desktop click (300,300) → local (55.88, 55.88) mm | 主修復路徑 |
| 3 | Click at bboxOrigin → local (0, 0) mm（不為非零） | 邊界條件 |
| 4 | Click at (0, 0) → local (-50, -50) mm | bboxOrigin 是相對原點 |
| 5 | Mobile click (200, 200) at scale=0.538 → local ≈ (81.4, 81.4) mm | Mobile path |
| 6 | Mobile 跟 desktop 在同 canvas-mm 位置 → 一致 local | scale-to-fit 不偏 |
| 7 | Round 10 stored 250 for 300px click; Round 13 stores ≈ 56 mm | 直接 pin 數值（無法 silent revert） |
| 8 | Round 10 produced 849px off-canvas; Round 13 ≈ 300px 落在可見範圍 | 渲染路徑端到端驗證 |

關鍵差異：**這 8 條是 unit test on the helper function**，不是 source-code regex。

## 為什麼 Round 12 的測試沒抓到

Round 12 修 5 個 bug 時加了 8 條 test，全部走 source-pattern（regex match JSX 結構）。例如：

```typescript
expect(src).toMatch(/<Ellipse\s+x=\{width\s*\/\s*2\}[\s\S]*?\/>/);
```

這類測試能抓到「JSX 結構錯誤」「文字 hardcode」「Layer 順序錯誤」，但**抓不到 arithmetic 錯誤**——因為 JSX 長相沒變，錯的是 `pos.x / stageSize.scale` 這條算式。

教訓：**任何「轉換 / 計算 / 序列化」邏輯都應該抽出可測試的 helper，並對 helper 做數值 assert**。source-pattern 適合抓結構性 regression，不適合抓算術。

## 驗證結果

| 驗證項 | 結果 |
|---|---|
| `npx vitest run Step7TableCardCanvas.test.tsx` | **66/66 passed**（既有 58 + 新 8）|
| `npx vitest run`（全套 frontend test）| **1626/1626 passed**（126 files）|
| `npx tsc -b apps/frontend/tsconfig.app.json --noEmit` | pre-existing errors only（useImageCrop / detectLanguage — 與 Round 13 無關）|
| `npm run lint --workspace=apps/frontend` | pre-existing warnings only |
| `npm run verify:i18n` | OK（18 namespaces / 36 locale files） |

## 與既有規則的對齊

| 規則 | 對齊方式 |
|---|---|
| `000 § A.3` Hook Extraction Strategy | 算術邏輯抽出 helper（主檔案 1600+ 行是既有問題，不在本 round 拆 sub-component scope）|
| `019` Schema Contract Drift | helper 簽名直接對齊 mm schema（`localX` / `localY` 都是 mm）|
| `023` shared Package 邊界 | helper 沒 cross-package dependency（純 Konva / shared constants）|
| `006` 完工前驗證 | 8 條 numeric regression test 取代 source-pattern 的偽保證 |
| 自 `Run 12` 教訓 | source-pattern test 抓不到算術 → 改 unit test |

## 風險評估

| 風險 | 緩解 |
|---|---|
| Mobile scale-to-fit 行為改變（之前 broken，現在修正）| Test #6 顯式 assert 兩種 viewport 結果一致 |
| Konva `getPointerPosition` 行為在不同版本差異 | helper 與 Konva 解耦；任何版本差異只會改 input，不會改 output math |
| `appendPolygonVertex` store action 接下來會被 Inspector / 其他入口複用 | helper 仍然 single source of truth；其他入口直接 call helper 即可 |

## 後續

| 待辦 | 負責 |
|---|---|
| 手動在 dev 環境畫多邊形，看到虛線 + 編號 + 完成按鈕（verify fix in practice）| 使用者（Vibe coding 流程的 manual gate）|
| 等使用者回饋「manual 驗證通過」後 commit + push | 視使用者回饋決定 |
| Round 14？是否有其他「視覺上看不到 / 反應遲鈍」的類似症狀需要 audit | 看 Round 13 user feedback |

## 不做的事

- 不改 schema / db interface / store action signature
- 不改 `appendPolygonVertex` / `finishPolygonCreation` / `cancelPolygonCreation` / `updatePolygonVertex` 任一個的實作（store 邏輯是對的，只是上游傳入單位錯）
- 不改 `renderPolygonPreview` / `renderPolygonVertexMarkers` / `buildPolygonElement` / `finishPolygonDrawing` 任一個（它們假設「vertices 是 mm」是對的）
- 不拆 `Step7TableCardCanvas` 的 sub-component（既有架構問題，不在這次 scope）
