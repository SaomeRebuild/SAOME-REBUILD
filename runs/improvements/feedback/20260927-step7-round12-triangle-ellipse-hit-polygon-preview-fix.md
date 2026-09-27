# 2026-09-27 — Step 7 Round 12 (triangle/ellipse hit-region + polygon preview layer)

## 一句話總結

修齊 Step 7 多邊形工具的 5 個 regression bug（Issue 1-5）：
**triangle / ellipse 加 hit-target Rect**（同 Round 9 image pattern）、
**polygon preview 從 conditional Layer 搬進 elements Layer**、
**完成按鈕字串走 i18n**。

## 觸發訊號

| 訊號 | 來源 |
|---|---|
| 使用者回報：「點不到三角形 / 橢圓形」 | 開發期手動測試 |
| 使用者回報：「畫多邊形時看不到藍色虛線連線 / 看不到頂點編號 / 看不到完成按鈕」 | 同上 |
| Round 11 留下的同 pattern（image）hit-region 修復邏輯 | 既有 Round 9 image pattern |

## 範圍

| 項目 | 內容 |
|---|---|
| 修改檔案 | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardCanvas.web.tsx`（既有修改） |
| 修改測試 | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardCanvas.test.tsx`（4 個既有 test 修法 + 8 條 Round 12 新 test）|
| 修改 schema | 無 |
| 涉及 i18n key | `tableCard.shape.polygonFinish`（既有 zh-TW / en 翻譯） |
| 不變 schema | `TableCardElement` 與 zod schema |

## 5 個 bug 對應修法

### Cluster A — Triangle / Ellipse 沒辦法被選（Issue 5）

**根因**：`Step7TableCardCanvas.web.tsx` 的 triangle / ellipse branch 內部 `<RegularPolygon listening={false}>` / `<Ellipse listening={false}>` 都不貢獻 hit region，Konva.Group 完全 click-through。

**修法**：在 `<RegularPolygon>` / `<Ellipse>` 之前加 transparent `<Rect>` 提供完整 bbox hit region。同 Round 9 image pattern 的根因 + 修法。

**位置**：每個 Group 內的 Rect 是第一個 child（Konva reverse-traversal hit detection 優先命中 listening child）。

### Cluster B — 多邊形預覽整包看不到（Issues 1-4）

**根因**：Stage children 夾了一個 conditional `<Layer>`（`{isDrawingPolygon && polygonCreation && <Layer>...</Layer>}`）在兩個**永遠存在**的 Layer 中間。React-Konva reconciler 在 child index 切換時出錯，新 Layer 沒被加進 Stage children，所有 preview children 都不畫。

**修法**：拿掉 conditional Layer，把 preview line + vertex markers + finish button 全部搬進既有 elements `<Layer>` 內（後面），Stage Layer 數量永遠固定為 4（bg / bleed / elements+preview / transformer）。

### Cluster C — 完成按鈕字串 hardcode

**根因**：KonvaText `text="完成多邊形"` hardcode 中文。

**修法**：`useTranslation('tableCard')` 拿 `t('shape.polygonFinish')`，zh-TW / en 既有翻譯。

## 8 條新增 regression test

| # | Test | 涵蓋 |
|---|---|---|
| 1 | Triangle branch 加 transparent hit-target Rect BEFORE `<RegularPolygon>` | Fix A — Rect 存在性 + 順序 |
| 2 | Ellipse branch 加 transparent hit-target Rect BEFORE `<Ellipse>` | Fix A — Rect 存在性 + 順序 |
| 3 | Triangle / Ellipse hit-target Rect 範圍完整 bbox（x=0 y=0 w=width h=height）| Fix A — hit region 大小 |
| 4 | Stage children 不再 conditional mount `<Layer>` for preview | Fix B — 拿掉 conditional Layer |
| 5 | `renderPolygonPreview` call site 在 elements Layer 內 | Fix B — preview 位置 |
| 6 | Finish button 在 elements Layer 內、不是獨立 Layer | Fix B — finish button 位置 |
| 7 | Finish button text 走 `t('shape.polygonFinish')`，不 hardcode | Fix C — i18n |
| 8 | Round 11 invariants 守住（preview/vertex markers/finish wiring intact）| regression |

## 4 條既有 test 修法（Round 12 跟既有 source-level test 的互動）

修這 5 個 bug 後，下游的「source-level assertion」測試需要對應修法，否則會 false-fail：

### 修法 1 — Round 10「ellipse uses radiusX / radiusY」regex window

**問題**：原 regex `[\s\S]{0,1500}?(?:<Ellipse[\s\S]{0,1500}?\/>|</Ellipse>)` 只允許 1500 char 範圍。Round 12 在 ellipse branch 內插入 hit-target Rect + comment block（~400 char），把實際 `<Ellipse>` 推到 1209 char 之外，且 regex 的第一個替代分支會匹配 comment 內的 `<Ellipse listening={false}>` 文字，導致 slice 在 JSX `/>` 處截斷、漏掉 `radiusX` attribute。

**修法**：把 regex 改成 attribute-anchored `<Ellipse\s+x=\{width\s*\/\s*2\}[\s\S]*?\/>`，直接命中實際 JSX，不會被 comment 內文字誤觸。

### 修法 2 — Round 12「Fix A: triangle」indexOf comment bleed

**問題**：原本 `branch.indexOf('<Rect')` / `branch.indexOf('<RegularPolygon')`。Round 12 comment block 在同一個 Group 內**明確提到** `<RegularPolygon listening={false}>` 作為文件，indexOf 找到的是 comment 文字而非 JSX，導致順序顛倒。

**修法**：用 attribute-anchored regex `<Rect\s+x=\{0\}\s+y=\{0\}\s+width=\{width\}` + `<RegularPolygon\s+x=\{width\s*\/\s*2\}`，這兩個 pattern 不可能出現在 prose comment 內。

### 修法 3 — Round 12「Fix A: ellipse」同樣修法

**問題 + 修法**：同修法 2，attribute-anchored。

### 修法 4 — Round 12「Fix B: renderPolygonPreview call site」function-definition vs call-site

**問題**：`src.match(/renderPolygonPreview\(/)` 找到的是**第一個** occurrence = function definition（line 599），不是 JSX call site（line 1017）。所以「在 call site 之前的 2000 char 內找 `<Layer>`」找不到（因為 function definition 在 Layer 之前很遠）。

**修法**：用 `matchAll` + filter，選出 preceded by `polygonCreation &&` 的 occurrence（這是 JSX call site 的 guard pattern，function definition 沒有這個 prefix）。

## 驗證結果

| 驗證項 | 結果 |
|---|---|
| `npm test -- Step7TableCardCanvas.test` | **58/58 passed** |
| `npm test`（全套 frontend test）| **1618/1618 passed**（126 files）|
| `npx tsc -b --noEmit`（Step7TableCard 子樹）| **0 errors**（其他 22 個 error 是 pre-existing，與 Round 12 無關：useImageCrop、MediaAssetUploader、detectLanguage）|
| `npm run lint` | **exit 0**（只有 pre-existing warnings）|
| `npm run verify:i18n` | **18 namespaces / 36 locale files OK** |

## 與既有規則的對齊

| 規則 | 對齊方式 |
|---|---|
| `000 § A.2` 主組件 ≤ 100 行 | Step7TableCardCanvas 已經遠超過（既有架構），本 round 不拆 sub-component |
| `022` 元件重用 | 沿用既有 image hit-target Rect pattern（Round 9），擴充到 triangle / ellipse |
| `023` i18n 書寫紀律 | hardcode `"完成多邊形"` → i18n key（zh-TW 全中文、en 全英文既有 key 已對齊）|
| `024` Hook Split Pattern | 不影響（仍在 web-only Konva 範疇）|
| `027` postgres.js Dynamic Query | N/A |
| `032` Backend JSONB merge silent killer | N/A |
| `036` Worker Runtime CORS Defense | N/A |

## 風險評估

| 風險 | 緩解 |
|---|---|
| 加 hit-target Rect 後 Group 的 bbox 可能被 Rect 影響導致 Transformer 量到錯尺寸 | Rect 是 `x=0 y=0 width=width height=height`，剛好等於 Group local bbox。Konva.Transformer attach 到 Group 時讀的是 `node.width()` / `node.height()`（Group 層級），不會受 Rect 影響 |
| `useTranslation` import 進 canvas 後，可能拖慢 hot reload | `useTranslation` hook 輕量，不影響 bundle size |
| 既有 Round 11 conformance test 失效 | 已修法 1-4 對齊。Round 11 期望的 `text="完成多邊形"` 改為 `text={t('shape.polygonFinish')}`，既有 Issue 6 test 已 update 對應斷言 |

## 不做的事

- 不改 schema / db interface / store action（純 render + UX 修正）
- 不改 transformer 的行為
- 不改 background / image / text 的 hit-region 行為（既有運作正常）
- 不拆 sub-component（Step7TableCardCanvas 主檔案超過 100 行是既有架構問題，不在這次範圍）

## 後續

| 待辦 | 負責 |
|---|---|
| 手動在 dev 環境測 5 個 bug 都修好（點三角形 / 橢圓形 / 畫多邊形時看到虛線 + 編號 + 按鈕 / 切 i18n） | 使用者（Vibe coding 流程的 manual gate）|
| 等使用者回饋「manual 驗證通過」後 commit + push | 視使用者回饋決定 |
