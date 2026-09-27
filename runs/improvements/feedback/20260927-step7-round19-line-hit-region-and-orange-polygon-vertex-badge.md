# 2026-09-27 — Step 7 Round 19: 線段無法選取 + 多邊形端點編號配色與手機尺寸

## 一句話總結

修兩個移動裝置親和性 bug：(1) 線段工具在移動裝置上**幾乎無法點選**——裸 `<Konva.Line>` 只對 1D 筆畫路徑做命中偵測，預設 strokeWidth=2 mm 在手機 scale-to-fit 後只 ≈ 3 CSS px，比 Rule 013 的 44-pt 觸控目標小了 14 倍。修法：套用 Round 9/11/12 已有的 `<Group>` + 透明 hit `<Rect>` pattern。(2) 多邊形端點編號從「藍底白字 20×20」改為「橘底白字（主視覺色 `#f97316`）」並用 `useIsMobile()` 在手機版放大到 28×28 chip + 44×44 hit area + fontSize 14，符合 4-grid + 44-pt 標準。

## 觸發訊號

| 訊號 | 來源 |
|---|---|
| 使用者：線段工具在行動裝置的畫布很難被選取，預設得太細 | 2026-09-27 即時回饋 |
| 使用者：多邊形的端點編號改成主視覺的橘色底+白色粗體數字，再放大一點（手機版） | 2026-09-27 即時回饋 |
| 既有的 Rect + Triangle + Ellipse + Image 已經有 Group+Rect pattern，Round 18 修過 polygon Line mm/px 換算，但 line 元素漏掉了 | source-code diff |

## 範圍

| 項目 | 內容 |
|---|---|
| 修改檔案 | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardCanvas.web.tsx`（line shape branch + `renderPolygonVertexMarkers` helper + `renderPolygonPreview` helper + main component `useIsMobile()` call） |
| 修改測試 | `Step7TableCardCanvas.test.tsx`（新增 12 條 Round 19 conformance test + 更新既有 Round 11/12 sanity regex 配新 signature） |
| 新增 import | `import { useIsMobile } from '@/hooks/useIsMobile'`（既有 hook，無新檔） |
| 修改 schema | 無（純渲染變更） |
| 涉及 i18n key | 無（chip 顏色是設計 token，非 i18n 字串） |
| 不變 schema | `TableCardElement` 與 zod schema |

## 根因分析

### Issue 1 — Line 1D hit detection

```tsx
// 修改前
<Line
  key={el.id}
  id={el.id}
  x={x}
  y={y}
  points={[0, 0, width, height]}
  rotation={el.rotation}
  stroke={el.stroke ?? el.fill}
  strokeWidth={el.strokeWidth ?? 2}
  draggable
  onClick={() => onSelect(el.id)}
  onTap={() => onSelect(el.id)}
/>
```

`<Konva.Line>` 的命中偵測行為：

| 行為 | 影響 |
|---|---|
| 只沿著 `points` 構成的 1D 折線 path 做測試 | 點擊**線外**但**bbox 內**的空間 → silently 沒反應 → fall through 到 Stage 的 onMouseDown → 清掉 selection |
| `strokeWidth` 影響 path 寬度 | 越細越難命中 |

stage scale-to-fit 數學（mobile）：

| 量 | desktop (scale=1) | mobile (320 CSS px 寬 / 595 stage px 寬) |
|---|---|---|
| 渲染 stroke 寬度 | `2 mm × 2.83 px/mm ≈ 5.7 CSS px` | `2 mm × 2.83 × 0.54 ≈ 3.1 CSS px` |
| Rule 013 觸控目標 | 44 pt = 44 CSS px | 44 pt = 44 CSS px |
| 命中寬度 vs 觸控目標 | 13% of target | **7% of target** |

3 CSS px 寬的手指 hit target — 使用者要像素級瞄準才點得到。這正是 Round 9（image）、Round 11（triangle）、Round 12（ellipse）已經歷過的「Group hit region 缺失」bug 家族：Konva.Group 自身沒有 hit region，要靠 listening children，但這三類 primitive 早已被 `<Group>` + 透明 `<Rect>` 包過，唯獨 line branch 漏了。

### Issue 2 — Polygon vertex badge color + mobile size

| 屬性 | 修改前 | 修改後 |
|---|---|---|
| chip 大小 | 20×20 px（固定） | 20×20 desktop / **28×28 mobile** (4-grid 對齊：7×4=28) |
| hit area | 32×32 px | 32×32 desktop / **44×44 mobile** (Rule 013 floor：11×4=44) |
| fontSize | 11 | 11 desktop / **14 mobile** |
| 填色 | `#3b82f6`（藍） | **`#f97316`**（橘 = Tailwind orange-500 = 出血虛線框 + active 按鈕外框的同一主視覺色） |

Round 17 已經把 chip 從「藍圈 + 深色 chip」雙層結構 collapse 成「單一藍 chip」（Round 16 user feedback：「多餘的白框藍底樣式包了一層」），但 chip 仍然用藍色。Round 19 把藍色換成主視覺橘色，讓多邊形工具的視覺語言跟整個 Step 7（active button border、出血虛線框）對齊。

橘色 `#f97316` 是 Tailwind `orange-500`，已經在 Step 7 用於：
- `BleedOverlay` 的虛線 stroke（`<Rect stroke="#f97316" />`）
- active toolbar button border（`border-primary` token 解析為 `#f97316`）

mobile 尺寸走 `useIsMobile()` hook 拿 Tailwind `sm` breakpoint（< 640 px）。4-grid 對齊：

| 值 | 4-grid 倍數 | 用途 |
|---|---|---|
| 28 | 7×4 | chip |
| 32 | 8×4 | desktop hit area |
| 44 | 11×4 | mobile hit area |
| 14 | — | fontSize |

## 修法（程式碼）

### Line hit region — `Step7TableCardCanvas.web.tsx`

`el.shape === 'line'` branch：

```tsx
// 修改前（裸露 Konva.Line，1D hit detection）
<Line
  id={el.id}
  x={x} y={y}
  points={[0, 0, width, height]}
  rotation={el.rotation}
  stroke={el.stroke ?? el.fill}
  strokeWidth={el.strokeWidth ?? 2}
  draggable
  onClick={() => onSelect(el.id)}
  onTap={() => onSelect(el.id)}
/>

// 修改後（Group + 透明 hit Rect，符合 Round 9/11/12 pattern）
<Group
  id={el.id}            // Transformer attach target via stage.findOne(`#${id}`)
  x={x} y={y}
  width={width} height={height}
  rotation={el.rotation}
  draggable
  onClick={() => onSelect(el.id)}
  onTap={() => onSelect(el.id)}
  onDragEnd={…}        // 移植自裸 Line
  onTransformEnd={…}    // 移植自裸 Line
>
  <Rect                                  // 透明 hit target
    x={0} y={0}
    width={width} height={height}
    fill="rgba(0,0,0,0)"
  />
  <Line                                  // 純渲染
    points={[0, 0, width, height]}
    stroke={el.stroke ?? el.fill}
    strokeWidth={el.strokeWidth ?? 2}
    listening={false}                   // 事件一律走 Rect → Group
  />
</Group>
```

`useIsMobile` 從 `@/hooks/useIsMobile` import，在 main component 計算後 threaded down 給兩個 helper：

```tsx
const isMobile = useIsMobile();
```

### Polygon vertex badge — 同檔

`renderPolygonVertexMarkers` 增加 `isMobile: boolean` 第 3 參數，並把 chip 物理尺寸（chipSize / hitSize / fontSize / cornerRadius）改成 conditional 選擇：

```tsx
const { chipSize, hitSize, fontSize, cornerRadius } = isMobile
  ? { chipSize: 28, hitSize: 44, fontSize: 14, cornerRadius: 4 }
  : { chipSize: 20, hitSize: 32, fontSize: 11, cornerRadius: 3 };
const chipHalf = chipSize / 2;
const hitHalf = hitSize / 2;
// ...
<Rect   // 透明 hit，動態大小
  x={-hitHalf} y={-hitHalf}
  width={hitSize} height={hitSize}
  fill="rgba(0,0,0,0)"
/>
<Rect   // chip，橘底
  x={-chipHalf} y={-chipHalf}
  width={chipSize} height={chipSize}
  cornerRadius={cornerRadius}
  fill="#f97316"                        // ← 主視覺橘
  shadowColor="#000000" shadowBlur={4}
  shadowOpacity={0.25} shadowOffsetY={1}
  listening={false}
/>
<KonvaText
  text={String(vertexIndex + 1)}
  fontSize={fontSize}                   // ← 14 mobile / 11 desktop
  fontStyle="bold"
  fill="#ffffff"
  width={chipSize} height={chipSize}
  align="center" verticalAlign="middle"
  x={-chipHalf} y={-chipHalf}
  listening={false}
/>
```

`renderPolygonPreview` 也加 `isMobile` 第 4 參數，把 preview 中的 vertex markers 也接到 mobile 尺寸（線段繪製中看到的預覽 chip 跟 finished polygon 一樣大，避免使用者以為「畫完後數字會突然變小」）。

兩個 callsites 都更新：

```tsx
// 1. preview（renderPolygonPreview 內）
renderPolygonVertexMarkers(vertices, markerOpts, isMobile)

// 2. finished polygon when selected
renderPolygonVertexMarkers(
  pts,
  { draggable: true, onDragVertex: (vertexIndex, localX, localY) => { … } },
  isMobile,
)
```

## 為什麼 not 其他做法

| 候選方案 | 為什麼不用 |
|---|---|
| 改大 line 的預設 strokeWidth（例如 4 mm） | 1) 改了預設值會把已存線段都視覺變粗，UX 不一致；2) 即便 strokeWidth=8 mm，mobile 仍只有 12 CSS px，還是低於 44-pt floor；3) 命中偵測仍只在 1D path 上，路徑旁的空間點不到 |
| 用 transform tool / Transformer 取代 click 選取 | 需要先點一下元素才能選取（Transformer 才有），所以這條死路 |
| 把 line 也搬上 pure-Konva.Group + 透明 Rect | ✅ 就是採用此方案 — 與 image / triangle / ellipse 完全一致的 pattern，沒有新概念 |
| chip 顏色用 Tailwind class 字串（如 `bg-primary`） | Konva 用 hex 字串，沒有 className 解析；hard-code `#f97316` 是 source-of-truth 的設計 token，Tailwind config 也應該解析到這個值 |
| mobile 尺寸用 CSS media query 改 canvas 渲染 | Konva 是命令式 draw，沒有 reactive CSS；要在渲染時透過 React 傳值，所以走 `useIsMobile()` |

## 自問 / 未來陷阱

| 問題 | 答案 |
|---|---|
| rotation 旋轉 + Group + draggable 還對嗎？ | ✅ 已用 `node.width() * scaleX` / `node.x()` 直接換算 top-left bbox — 跟 Round 11 triangle / ellipse 一致 |
| 已存在的 line 元素資料格式要改嗎？ | ❌ 純渲染變更，schema 不變 |
| `useIsMobile()` 預設 640px breakpoint 跟 Tailwind `sm:` 一致嗎？ | ✅ hook 文件明寫 `(max-width: ${breakpoint - 1}px)`，640-1=639，跟 `sm:` ≥ 640 完全對齊 |
| i18n 改動？ | ❌ 顏色是設計 token，沒新增翻譯 |
| clipboard / export 會受到影響嗎？ | ❌ 不會 — 純 canvas 渲染，export rasterization 用相同 `<Konva.Line points>` props |
| 既有 1339 條 CardBuilderEditor 測試會斷嗎？ | ✅ 1355 / 1355 全綠（新增 16 條 Round 19 + 既有 1 條 Round 12 sanity 改 regex） |

## 對齊既有 rule

| Rule | 應用 |
|---|---|
| `frontend/022-component-reuse.mdc` + `000-modular-design.mdc` | 既有 `<Group>` + hit `<Rect>` pattern 直接複用，無新元件 |
| `014-breakpoints.mdc` | `useIsMobile()` 走 Tailwind `sm:` breakpoint 639 px |
| `mobile-target-touch-floor`（Rule 013） | mobile chip hit area = 44 px = Rule 013 floor |
| `024-mobile-future-proof.mdc` | `useIsMobile()` 是 web-only hook，未來 RN 化會換成 `useWindowDimensions`，無需改這層 |
| `006-verification.mdc`（完工驗證） | TDD：先寫 12 條 failing test → 修 code → 全綠 1355/1355；typecheck 沒有新錯誤（pre-existing TS 錯誤與本 PR 無關） |

## 參照

- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardCanvas.web.tsx`
  - `el.shape === 'line'` branch — 改為 Group + 透明 Rect + 內層裸 Line
  - `renderPolygonVertexMarkers` — 加 `isMobile: boolean` 參數、橘色 fill、mobile chip 尺寸
  - `renderPolygonPreview` — 加 `isMobile: boolean` 參數並 threaded 到 helper
  - main `Step7TableCardCanvas` — `const isMobile = useIsMobile();`
  - `renderElement` 與 `renderElementInner` — 兩個 helper 都加 isMobile 參數（polygon branch 用，其他 branch 忽略）
- `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardCanvas.test.tsx`
  - `Round 19 — line hit region + polygon vertex badge` describe block — 12 條 conformance test
  - 更新既有 Round 11 Issue 4 + Round 11 sanity regex 容忍新 3 參數 signature
- `apps/frontend/src/hooks/useIsMobile.ts` — 既有 hook（2026-08 已存在），無新檔
- Round 9 / Round 11 / Round 12 — 既有 image / triangle / ellipse 的 Group + hit Rect pattern，Round 19 把 line 補齊
- Round 17 — 既有「minimal badge on vertex」pattern，Round 19 把 chip 顏色 + mobile 尺寸補上

## Verification（per `.cursor/rules/006-verification.mdc`）

```
Round 19 conformance tests: 12/12 PASSED
CardBuilderEditor full suite: 1355/1355 PASSED (up from 1339 — adds 16 Round 19 tests)
TypeScript: no new errors (pre-existing TS errors in useImageCrop.native.ts + detectLanguage.web.ts unrelated to this PR)
```
