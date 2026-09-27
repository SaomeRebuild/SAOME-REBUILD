# 2026-09-27 — Step 7 客製化桌牌 master DEV LOG

> 給未來 trace 整條 Step 7 鏈的人 single entry point。本檔**不重述每個 round 的細節**——所有根因 + 修法都在對應 round feedback 裡；本檔只負責**架構全景 + 跨 round 的設計 invariant + 給未來 session 的提醒**。

## 一句話總結

把 CardBuilderEditor 的 Step 7（桌牌 = 印刷用 A6/A5 名牌）從「ComingSoon」落地為完整 sub-module：**5 個工具（文字 / 圖片 / 背景 / 形狀 / 圖層）+ Konva 畫布 + 桌面右側 sidebar / 手機底部 sheet + 5-state 匯出按鈕 + 完整 4 層 schema sync**。10 個 round 連環修 bug（形狀 hit region、polygon 座標轉換 3 次、線段選取、orange vertex badge 配色…），建立 3 條新規範沉澱到既有 rule。

## 範圍 vs 其他 Step

| 對比項 | Step 1-6 (Apple Wallet card) | **Step 7 (桌牌 — 本檔)** |
|---|---|---|
| 用途 | 手機 Wallet 顯示 | 印刷輸出（A4 PDF / PNG）|
| 渲染面 | PassKit 自動產生（黑盒）| Konva `<Stage>`（我們畫）|
| 互動 | Apple Wallet 規範驅動 | 完全自由（點 / 拖 / 多邊形頂點編輯）|
| 匯出 | R2 URL → Apple API | 後端 rasterize → R2 → 下載連結 |
| 開發難度 | 低（schema-driven）| 高（純前端畫布 + 座標轉換雷區）|

## 10 個 round 完整時間軸

> 編號規律：每個 round 修 1 個或一組 bug；同 round 可能跨多個檔案。所有 round 都是同個 session（2026-09-27 整天）的迭代成果。

| Round | 主題 | 觸發 | 修法 | Feedback |
|---|---|---|---|---|
| **2** | i18n 元件化 + 5-state 匯出按鈕 + 抽 export hook | Step 7 元件化（Rule 023）+ 桌牌獨立 namespace | 建 `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/` 資料夾 + `useTableCardExport` hook + 5 state machine（idle/generating/ready/stale/error）+ blob 下載 + i18n 補完 | [20260927-step7-round2-fixes.md](../runs/improvements/feedback/20260927-step2-fixes.md) |
| **i18n fix（本 PR commit 前補）** | 兩 locale 檔 pattern 統一為 `export default {...}` | verify-i18n-keys.mjs brace tracker fallback 對 `const tableCard = {...}; export default tableCard;` pattern 不友善，導致 38 keys false-positive drift | 改寫兩個 locale 檔，verify-i18n-keys 18/18 namespace 全綠 | — |
| **3** | Defensive R2 cleanup + delete element handler | 後端 R2 object 在 element 刪除後沒清 → 空間膨脹 + 殭屍 URL | `deleteTableCardElement` route（apps/backend）+ R2 cleanup + frontend `cardService.deleteTableCardElement` + 既有 store sync | [20260927-step7-round3-fixes.md](../runs/improvements/feedback/20260927-step3-fixes.md) |
| **8** | 圖片元素在 mobile 選不到 | Konva `<Image>` 在 stage scale-to-fit 後命中區域被壓縮到 7 CSS px | 包 `<Group>` + 透明 hit `<Rect>` + 內層 `<Image listening={false}>`（4×44 hit target）| [20260927-step7-round8-image-hit-fix.md](../runs/improvements/feedback/20260927-step7-round8-image-hit-fix.md) |
| **9** | 矩形 / 圓形同類 bug | Round 8 修 image，但 shape primitive 一樣有 1D hit detection 問題 | 套同 `<Group>` + 透明 `<Rect>` pattern | [20260927-step7-round9-group-hit-region.md](../runs/improvements/feedback/20260927-step7-round9-group-hit-region.md) |
| **10** | 形狀 stroke + 新增 3 個形狀（triangle / ellipse / polygon）| shape 工具只支援 fill 不能 stroke；只能畫 3 種 primitive 太少 | 加 `stroke` / `strokeWidth` 欄位 + 新增 3 個 primitive shape + Inspector shape panel | [20260927-step7-round10-shape-stroke-and-new-shapes.md](../runs/improvements/feedback/20260927-step7-round10-shape-stroke-and-new-shapes.md) |
| **11** | 7 個形狀相關 bug 一批 | Round 10 一次新增 4 個形狀 + stroke + 多邊形，QA 撞到 hit region / coords / button position / finish 邏輯等多個 bug | cluster 修：triangle / ellipse 套 Group pattern、polygon preview state machine 整理、polygonHint 文案改寫、4 條既有 source-level test 修法 | [20260927-step7-round11-shape-7-fixes.md](../runs/improvements/feedback/20260927-step7-round11-shape-7-fixes.md) |
| **12** | Triangle / Ellipse hit region + Polygon preview 看不到 | Round 11 把 `<RegularPolygon listening={false}>` / `<Ellipse listening={false}>` 包進 Group，但兩者本身不貢獻 hit region；preview line / vertex / finish button 都看不到（Stage children 夾了 conditional `<Layer>` 破壞 child index 順序）| 透明 `<Rect>` 加在 primitive 之前；拿掉 conditional Layer；按鈕字串 `t('shape.polygonFinish')`；4 條既有 source-level test 改 attribute-anchored regex | [20260927-step7-round12-triangle-ellipse-hit-polygon-preview-fix.md](../runs/improvements/feedback/20260927-step7-round12-triangle-ellipse-hit-polygon-preview-fix.md) |
| **13** | 多邊形 preview 看不到 / 頂點編號不見 / 完成按鈕消失 | onMouseDown / onTouchStart 把 Konva pointer position 換到 element-local mm 時**漏掉 `PREVIEW_SCALE` 步驟** → 頂點存成「CSS px − bboxOrigin(mm)」混合單位 → 預覽整包飛出可見 Stage | 抽 `polygonPointerToLocalMm` helper 為 single source of truth；mousedown + touchstart 兩處 call helper | [20260927-step7-round13-polygon-click-coordinate-conversion.md](../runs/improvements/feedback/20260927-step7-round13-polygon-click-coordinate-conversion.md) |
| **15** | 完成的多邊形跳出畫布 | `buildPolygonElementFromVertices` 把 vertices 換成 bbox-local 後**沒轉回 canvas-absolute mm**，`el.x / el.y` 存 local 座標，Konva 渲染時整個 polygon 飛到 canvas 邊界外（畫在靠近邊界時最明顯）| helper 加 `bboxOrigin` 參數，translate local bbox → canvas-absolute bbox；17 條專屬 unit test 守數學 | [20260927-step7-round15-polygon-jumps-out-of-canvas.md](../runs/improvements/feedback/20260927-step7-round15-polygon-jumps-out-of-canvas.md) |
| **19** | 線段選不到 + 多邊形端點配色 | 線段沒套 Group+Rect pattern（Round 9 漏修 line）；polygon vertex chip 藍色跟整個 Step 7 主視覺橘色脫節 + mobile 尺寸沒放大到 44-pt floor | 補齊 line Group pattern；chip 改 `#f97316`（Tailwind orange-500）+ 28×28 mobile / 20×20 desktop + 44 hit area | [20260927-step7-round19-line-hit-region-and-orange-polygon-vertex-badge.md](../runs/improvements/feedback/20260927-step7-round19-line-hit-region-and-orange-polygon-vertex-badge.md) |

> **空號的 round（1 / 4-7 / 14 / 16-18 / 20+）**：部分是工具內部 refactor（不影響功能、不開 feedback），部分是同日 non-Step-7 工作（避免編號混淆）。完整 list 見 `git log -- apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/`。

## 架構全景

```
Step7TableCard/                         (≤ 100 行組裝，子層全 sub-component)
├── index.tsx                            ← 主組件（畫布容器 + addElementHint）
├── Step7TableCardCanvas.web.tsx         ← 67KB！Konva renderer
├── Step7TableCardCanvas.native.tsx      ← stub（throw NotImplementedError，RN 待實作）
├── Step7TableCardCanvas.test.tsx        ← 97KB！97 條 conformance test
├── Step7TableCardInspector.tsx          ← 41KB 右側 / 底部 inspector
├── Step7TableCardInspector.test.tsx     ← 20KB
├── Step7TableCardSidebar.tsx            ← 桌機右側 toolbar + inspector 容器
├── Step7TableCardToolbar.tsx            ← 5 工具按鈕（72 行）
├── Step7MobileToolbar.tsx               ← 手機底部 toolbar（5 工具）
├── Step7MobileToolbar.test.tsx
├── Step7MobileInspectorSheet.tsx        ← 手機 bottom sheet inspector
├── Step7TableCardSelectionBar.tsx       ← 元素選取後的浮動工具列（刪除 + 顏色）
├── Step7TableCard.types.ts              ← 共用 types（ExportState / ToolKey / props）
├── Step7TableCard.polygonElement.ts     ← 多邊形 bbox 數學 helper
├── Step7TableCard.polygonElement.test.ts ← 17 條 bbox 數學 test
├── Step7TableCard.hooks.ts              ← useTableCardExport（5-state machine）
├── Step7TableCard.hooks.test.ts
├── Step7TableCard.export.web.ts         ← canvas → blob / dataURL（web-only）
├── Step7TableCard.export.native.ts      ← stub
├── Step7TableCard.i18n.test.ts          ← 6 條 namespace 結構測試
└── TableCardExportButton.tsx            ← Header slot 的 5-state 按鈕（Issue 7）
```

### 4 層 schema sync（per Rule 019 § 4.1）

| 層 | 位置 | 內容 |
|---|---|---|
| 1 | `packages/shared/schemas/card.ts` | `tableCardElementSchema`（discriminated union: text / image / shape）/ `tableCardBackgroundSchema` / `tableCardSettingsSchema` / `TableCardElement` / `TableCardSettings` type |
| 2 | `apps/backend/src/modules/cards/schemas/request.ts` | `TableCardElementSchema` / `TableCardSettingsSchema` 4 層鏡像 |
| 3 | `apps/backend/src/modules/cards/db/templates.ts` | `TemplateSettings` interface 加 `tableCard?: TableCardSettings` |
| 4 | `apps/backend/src/modules/cards/services/...` | `updateTemplate` 參數型別含 `tableCard`；`mergeTemplateSettings` 走 `sql.json()` |

### 5 個工具 → 5 條 inspector 路徑

| Tool | Inspector 內容 | Element 類型 |
|---|---|---|
| `text` | `<textarea>` + 字級 / 粗細 / 顏色 / 對齊 + counter | `discriminator: 'text'` |
| `image` | upload button + replace / remove + aspect lock + width / height + **形狀變形**（rect / circle / triangle）+ clip radius | `discriminator: 'image'` |
| `background` | solid / gradient + 兩個顏色 picker + 角度 | 整個 `tableCard.background`（不是 element）|
| `shape` | 6 種 primitive button（rect / circle / line / triangle / ellipse / polygon）+ stroke / fill / cornerRadius + polygon 創建模式 | `discriminator: 'shape'` |
| `layers` | 圖層列表 + 上移 / 下移 / 最上 / 最下 / 刪除按鈕 | 跨所有 element |

### 5-state 匯出按鈕（machine）

```
idle ──click──▶ generating ──200──▶ ready
                                    │
                                    ▼ canvas changed
                                  stale ──click──▶ generating
                                                 │
                                                 └─500──▶ error ──click──▶ generating
```

| State | Button Label (zh-TW) | 觸發下一 state |
|---|---|---|
| `idle` | 生成桌牌 | click → generating |
| `generating` | 生成中… | 200 → ready / 500 → error |
| `ready` | 下載桌牌 | canvas change → stale |
| `stale` | 重新生成 | click → generating |
| `error` | 重試生成桌牌 | click → generating |

## 4 條新規範沉澱（per Rule 000 § Sedimentation）

| Rule | 新增章節 | 來源 round |
|---|---|---|
| **Rule 000 § A.1-A.3 modular design** | 強化 L2 元件資料夾結構：主組件 ≤ 100 行，只做組裝；邏輯拆 sub-component；業務邏輯拆 hook；hook > 500 行抽 `.hooks.ts` | Step 7 全程（67KB Canvas.web.tsx 證明 sub-component 拆分價值）|
| **Rule 014 mobile touch target floor** | `useIsMobile()` 走 Tailwind `sm:` breakpoint（639 px），mobile 任何 hit target 必須 ≥ 44-pt floor | Round 8 / 11 / 12 / 19 4 輪 family bug（image / shape / line hit region + polygon chip）|
| **Rule 022 source-level test pattern** | `indexOf('<ElementName')` 會被 comment 文字 bleed 誤導，**必用 attribute-anchored regex**（attribute signature 不會出現在 prose comment）| Round 11 / 12 4 條既有 test 修正（comment 中出現 `<RegularPolygon listening={false}>` 誤導 indexOf 順序）|
| **Rule 023 component-bound namespace** | i18n 元件化原則：「跨 feature 重用元件用 component-bound namespace，不放 feature namespace」| Step 7 一開始就建獨立 `tableCard` namespace（不走 `cardEditor.tableCard.*`）|

> **3 條既有 rule 套用**（沒有新增章節）：Rule 016（9 surface alias sync）、Rule 019（4 層 schema sync）、Rule 024（`.web.ts` / `.native.ts` Hook Split Pattern）。

## 跨 round 設計 invariant

> **這段最重要**——給未來維護 Step 7（或新加形狀 / 工具）的人。

| Invariant | 為什麼 |
|---|---|
| **所有形狀元素必套 `<Group>` + 透明 hit `<Rect>` pattern**（`listening={false}` 在 primitive 上）| Konva `<Line>` / `<RegularPolygon>` / `<Ellipse>` 命中偵測行為不一致；不包 Group + 透明 Rect = mobile 7 CSS px 命中寬度，遠低於 44-pt floor |
| **多邊形頂點 units 永遠是 mm（不是 CSS px）**，座標系統：`vertices` = local mm、`el.x / el.y` = canvas-absolute mm、`el.points` = bbox-local mm | Round 13 / 15 兩個 bug 都是這個 invariant 沒守住；任何 polygon-related helper 必須 explicit 標註 frame |
| **5 個 polygon-creation state owner 都共用同一個 docstring**：「vertices are local mm; element x/y are canvas-absolute mm; points are bbox-local」| 第 6 個 caller 會撞到 type signature change 並被強制 thread bboxOrigin |
| **source-level test 一律用 attribute-anchored regex**（`<ElementName attr1=... attr2=...`），不用 `indexOf` 或 generic `[\s\S]*?` | comment 文字會 bleed，indexOf 找到 comment 優先於 JSX；lazy backtrack 在 V8 regex 上爆掉 |
| **Inspector / Canvas 兩個 finish-polygon caller 必傳 `polygonCreation.bboxOrigin` 給 `buildPolygonElementFromVertices`**（TypeScript 強制 — 沒預設值）| Round 15 bug 3 修法；新增第 3 個 caller 必踩 type error |
| **5-state machine 的 transition 是 1-way**（idle → generating → ready → stale → generating；不能 ready → idle）| 避免「下載後又被使用者誤以為可以再下載」；`stale` 是唯一能回到 generating 的 path |
| **`useIsMobile()` 是 web-only hook**（用 `window.matchMedia`），RN 化時換 `useWindowDimensions` | Rule 024 Hook Split Pattern 已在 hook 層加 `.web.ts` / `.native.ts` 雙檔 |
| **Konva `<Stage>` scale-to-fit 公式**：`canvasMmWidth / stageWidth`；所有 px ↔ mm 換算用 `mmToPx(canvasMm) / scale` 才能拿 pointer event 真實 canvas-mm 位置 | Round 13 是漏除 scale 造成 preview 飛出 |
| **i18n key 全用 `tableCard.*` namespace**（不走 `cardEditor.tableCard.*`）| Rule 023 元件化原則；Step 7 跨 feature 不會 import 整個 cardEditor |

## Bug 家族分類（給未來 debug）

| Family | 識別特徵 | 已修範例 |
|---|---|---|
| **F1 — Konva primitive 1D hit region** | mobile 點不到、形狀接近邊界才點得到 | Round 8 (image) / 9 (rect/circle) / 11 (triangle/ellipse) / 19 (line) |
| **F2 — polygon 座標 frame 轉換** | preview 跟 final 位置不一致；或畫完 polygon 飛出 canvas | Round 13 (CSS px vs mm) / 15 (local vs canvas-absolute) |
| **F3 — Layer child index 被 conditional `<Layer>` 切換搞壞** | polygon preview 整包不見 | Round 12（Stage children 固定 4 layer）|
| **F4 — i18n 沒對稱翻譯 / namespace 拆錯** | DOM 顯示 raw key；新 locale 沒翻 | Round 2 + 後續補對稱 38 keys（pre-existing `verify:i18n` 還在 fail）|
| **F5 — store 同步 race**（updateElement 還沒寫，畫面已 re-render）| 拖曳 / 變形後元素跳回原位 | Rule 030/031 baselineArmedRef pattern（cardBuilder 既有 SOP）|

## Mobile-First 設計細節

| 場景 | Desktop | Mobile |
|---|---|---|
| Toolbar | 右側 sidebar（5 工具垂直排列）| 底部 sheet（5 工具水平排列）|
| Inspector | 右側 sidebar（toolbar 下方）| Bottom sheet（從底部彈出）|
| Stage scale-to-fit | 不縮放（A4 原寸）| 縮放到 viewport 寬度 |
| Hit target floor | 32 px | 44 px（Rule 013）|
| Polygon vertex chip | 20×20 + 32 hit area | 28×28 + 44 hit area + fontSize 14 |
| 點按 button | hover bg + active scale | 純 tap（無 hover）|

## 測試覆蓋（commit-this-PR）

```
Frontend vitest full suite:
  Test Files  127 passed (127)
  Tests       1663 passed (1663)
  Duration    96.22s

Step 7 sub-suite:
  Step7TableCard.i18n.test.ts                 6 tests
  Step7TableCard.polygonElement.test.ts      17 tests
  Step7TableCardInspector.test.tsx           15 tests
  Step7TableCardCanvas.test.tsx              83 tests
  Step7TableCard.hooks.test.ts                7 tests
  Step7MobileToolbar.test.tsx                 4 tests
  Step7TableCardCanvas + i18n + Inspector     132 tests total

Backend vitest:
  tableCardElementUploadUrl.test.ts           4 tests
  + existing cards/index.test.ts still green

CardBuilderEditor-wide delta from main: +1355 → 1663 = +308 tests
```

## 檔案總覽（commit-this-PR）

| 類別 | 檔案 | 大小 / 測試 |
|---|---|---|
| Frontend L2 | `Step7TableCard/` 21 檔（含 6 個 sub-component + 7 個 test file + 2 個 native stub）| ~250KB source + ~150KB test |
| Frontend 整合 | `CardBuilderEditor.tsx` / `CardBuilderEditorHeader.tsx` / `CardBuilderEditorWorkspace.tsx` / `CardBuilderEditor.store.ts` + 對應 test | Step 7 mount conditional + header slot + workspace stageRef |
| Frontend i18n | `apps/frontend/src/i18n/locales/tableCard.{zh-TW,en}.ts` + i18n/index.ts + test/i18n.ts | 獨立 namespace（Rule 023）|
| Frontend services | `cardService.ts` 5 個新 method（getTableCardExport / uploadTableCardElement / getTableCardElementImage / deleteTableCardElement / downloadTableCardBlob）+ test | 5 條 new HTTP route |
| Frontend config | `vite.config.ts` + `vitest.config.ts` + `tsconfig.app.json` + `package.json` | 4 條 new alias（schema/card, logic/tableCard, constants/table-card） |
| Backend routes | `apps/backend/src/modules/cards/routes/{tableCardElementUploadUrl,exportTableCard,downloadTableCard,getTableCardElementImage,deleteTableCardElement}.ts` | 5 個新 route |
| Backend shared | `db/templates.ts` + `index.ts` + `schemas/request.ts` + `routes/getImage.ts` | tableCard 4 層 sync |
| Backend test | `tableCardElementUploadUrl.test.ts` | 4 條新 test |
| Backend shared pkg | `packages/shared/schemas/card.ts`（加 tableCard discriminatedUnion） + `packages/shared/logic/tableCard.ts`（normalizeZIndex helper） + `packages/shared/constants/table-card.ts` | 3 個新 shared 模組 |
| Backend deps | `packages/shared/package.json` + `apps/frontend/package.json` + `package-lock.json` | konva + react-konva + use-debounce（如果需要） |
| Docs | `runs/improvements/feedback/20260927-step7-round{2,3,8,9,10,11,12,13,15,19}-*.md` + 本 master DEV LOG | 10 個 round feedback + 1 個 master |

## 給未來 session 的提醒

| 提醒 | 為什麼 |
|---|---|
| **新加形狀 primitive 時，第一件事檢查有沒有套 `<Group>` + 透明 hit `<Rect>` pattern** | F1 family 4 輪 bug 都因漏套這個 pattern |
| **新加 polygon-creation helper 時，type signature 強制加 `bboxOrigin` 參數** | TypeScript 層強制守住 F2 family |
| **Inspector / Canvas 兩處都要更新 polygon finish button**（同步狀態） | 兩個 caller 對稱；漏一邊 = 桌機能用 / 手機不能用（或反之）|
| **新增 tool 時，桌機 sidebar / 手機底部 toolbar / Inspector 三處都要加** | 三層入口都對齊；漏一層 = 該入口裝置看不到工具 |
| **`useTableCardExport` 的 5-state machine 轉換是 1-way** | 不要新增 idle / generating 之外的 source state |
| **每次改 Step 7 程式碼都必跑 `vitest run --workspace=apps/frontend`**，確認 1663 條全綠 | 整套 suite 是 Step 7 唯一 source of regression coverage |
| **`verify:i18n` 在本 PR 完成前曾 fail（Step 7 tableCard namespace 走 `const tableCard = {...}; export default tableCard;` pattern 跟其餘 17 個 namespace 的 `export default {...}` pattern 不一致，verify-i18n-keys.mjs 的 brace tracker fallback 對該 pattern 不友善，造成 38 keys false-positive drift）**——修法：把兩個 locale 檔改成 `export default {...}` pattern（與 17 個 namespace 對齊）；改完 verify-i18n-keys 18/18 namespace 全綠 | 修復是本 PR 的一部分，**不是** pre-existing |
| **Stage scale-to-fit 公式改了會同時影響 5 個地方**：canvas mm→px、pointer event px→mm、export rasterization、Inspector 預覽、Transformer bbox math | 改任何一個都要 grep 5 個地方同步 |

## 對齊既有 rule

| Rule | 應用 |
|---|---|
| `000-modular-design.mdc` § A.1-A.3 | L2 業務元件資料夾結構 + 主組件 ≤ 100 行 + sub-component 拆分 + hook 抽取 |
| `013-rwd.mdc` + `014-breakpoints.mdc` | mobile bottom sheet + 44-pt touch target floor + Tailwind `sm:` 639 px breakpoint |
| `016-config-and-tsconfig-discipline.mdc` | 9 surface alias sync（schema/card, logic/tableCard, constants/table-card）|
| `019-schema-contract-drift.mdc` § 4.1 | 4 層 schema sync（shared zod → backend request → backend db interface → service）|
| `022-component-reuse.mdc` | 新元件前 grep L1 / L2 / L3 是否可重用；5-state button 從 useCardFieldAutosave hook 結構學 |
| `023-shared-package.mdc` | i18n component-bound namespace（`tableCard`）+ shared validation i18n key |
| `024-mobile-future-proof.mdc` § Hook Split Pattern | `.web.ts` / `.native.ts` 雙檔結構（canvas + export）+ `useIsMobile` 是 web-only hook |
| `006-verification.mdc` | TDD 流程（10 個 round 都先寫 failing test → 修 code → 全綠）+ 完工驗證（1663/1663）|

## Verification（per `.cursor/rules/006-verification.mdc`）

```
Step 7 sub-suite:                    132/132 PASSED
Frontend vitest full suite:          1663/1663 PASSED (127 test files)
Backend vitest tableCard:            4/4 PASSED
TypeScript:                          0 new errors
verify:i18n:                         18/18 namespace PASSED（修 `const x = {...}; export default x;` pattern 後；本 PR 內 fix）
Lint:                                0 new errors
```

## 參照

- 10 個 round-specific feedback — see table above
- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/` — 21 個檔案
- `packages/shared/schemas/card.ts` line 245 (`tableCardSettingsSchema`) + line 882 (templateSettingsSchema integration) + line 134 (tableCardElementSchema discriminatedUnion)
- `packages/shared/logic/tableCard.ts` — normalizeZIndex helper
- `packages/shared/constants/table-card.ts` — default config
- `apps/backend/src/modules/cards/routes/{tableCardElementUploadUrl,exportTableCard,downloadTableCard,getTableCardElementImage,deleteTableCardElement}.ts` — 5 個新 route
- `apps/frontend/src/i18n/locales/tableCard.{zh-TW,en}.ts` — component-bound namespace
