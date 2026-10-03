# 2026-10-04 — Step 7 QR Code 畫布點選失效（Konva.Group hit region regression）

## 一句話總結

桌牌設計 Step 7 畫布上的 QR Code **完全無法被點選** — 加了之後再點都沒有反應，Transformer 不會 attach，Inspector 也不會切到 QR 工具。原 commit `1f58356`（feat(step7): QR Code tool with 1:1 lock + no R2 storage）雖然套用了 `<Group><KonvaImage listening={false} /></Group>` pattern，但**漏掉** Round 8/9 (2026-09-27) 為 `CanvasKonvaImage` 補的 transparent hit-target Rect，導致 Konva.Group 沒有 listening descendants → 點擊 fall through 到 Stage 的 onMouseDown → 清掉 selection。

## 觸發訊號

| 訊號 | 來源 |
|---|---|
| 使用者：「畫布上的 qr code 不能點選」 | 2026-10-04 早上使用者的回報 |
| 使用者：「之前有解決過這個問題」 | 指向既有 Round 8/9 fix（CanvasKonvaImage hit region）|
| 觀察 | 加 QR → 看得到 QR 渲染正確 → 點 QR 完全沒反應 → 點旁邊空白照常 clear selection |

## 範圍

| 項目 | 內容 |
|---|---|
| 修改檔案 | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/CanvasQrCode.tsx`（加 transparent hit-target Rect）|
| 新測試 | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/CanvasQrCode.test.tsx`（8 條 regression test，source-level structural assertion）|
| 涉及 schema | 無 |
| 涉及 i18n key | 無 |

## 根因分析

### 載入成功後的 QR Group 結構（修前）

```tsx
<Group
  id={element.id}
  x={x}
  y={y}
  width={width}
  height={height}
  rotation={element.rotation}
  draggable
  onClick={() => onSelect(element.id)}  // ← 期望這條 fire
  onTap={() => onSelect(element.id)}
  onDragEnd={...}
  onTransformEnd={...}
  opacity={isSelected ? 0.95 : 1}
>
  <KonvaImage
    image={qrImg}
    x={0}
    y={0}
    width={width}
    height={height}
    listening={false}  // ← 唯一的 child 設成 listening=false
  />
</Group>
```

### 為什麼點不到

**Konva.Group 的 hit detection 規則**（同 Round 9 結論）：

| 結構 | Hit region |
|---|---|
| Group 有 listening child | Group 的 hit region = 所有 listening children 的 hit region 的 union |
| **Group 全部 child 都 `listening={false}`** | **Group 沒有 hit region** — 點擊穿透到下一層 |
| Group 有 `clipFunc` | clipFunc 對 visual canvas **和** hit canvas 都生效 |

修前的 Group **只有一個 child**，而且 `listening={false}`。Konva 遍歷 Group 的 children 找 hit target，發現沒有 listening child → Group 沒有 hit region → 點擊直接掉到 Layer → Stage。

Stage 的 `onMouseDown` 處理器：

```tsx
onMouseDown={(e) => {
  // Click on empty stage clears selection.
  if (e.target === e.target.getStage()) {
    onSelect(null);
  }
}}
```

`e.target === e.target.getStage()` 在 click 穿透時成立（因為點擊沒打到任何 element），所以**呼叫 `onSelect(null)` 清掉 selection**。使用者觀察：

- 「點 QR 沒有反應」 ← 因為 onClick 沒 fire
- 「點了之後 selection 反而被清掉」 ← 因為 Stage 的 onMouseDown fire 了

### 為什麼 loading / failed 兩條分支可以點

| 分支 | 渲染 | Hit detection | 結果 |
|---|---|---|---|
| `status === 'loading'` | bare `<Rect ... onClick={...} />` | Konva.Rect built-in 矩形 hit region | ✅ 點得到 |
| `status === 'failed'` | bare `<Rect ... onClick={...} />` | 同上 | ✅ 點得到 |
| **loaded（qrImg 完成）** | `<Group><KonvaImage listening={false} /></Group>` | **Group 無 listening child** | ❌ 點不到 |

只有 loaded 那條走 Group wrapper pattern，所以 bug 只在 QR 完整顯示之後才出現。Loading 階段使用者看到的是灰色 placeholder Rect（bare Konva.Rect）→ 點得到 → 切到 loaded → 點不到。這個**時序差**讓 bug 很容易在 dev manual testing 時被當成「loading 太快了」而誤判。

### 為什麼 QR 比 image 更容易踩到

- QR 主要是白底（bgColor）配黑點（fgColor），約 70% 像素是背景。
- Konva.Image 的 pixel-based hit detection 要求點擊落在不透明像素上。即便把 `listening={true}` 設回去，QR 的多數區域仍會 miss hit detection。
- Image variant（PNG 上傳）的透明背景是更明顯的 hit detection 漏點，所以 Round 8 修時直接靠 `listening={false}` + transparent Rect 解掉。
- QR 變體在 2026-10-04 套同一個 pattern 但漏了 transparent Rect，**沒人 catch** 是因為：①沒有對應的 test（`CanvasQrCode.test.tsx` 原本不存在），②jsdom 沒 canvas context 跑不了真實的 hit detection，③structural pattern 看起來跟 image variant 修完後一模一樣。

### 為什麼 Round 8/9 的 image fix 沒被自動套到 QR

- 兩個 component 是獨立的檔案（`CanvasKonvaImage` 在 `Step7TableCardCanvas.web.tsx` 內，`CanvasQrCode` 在獨立檔 `CanvasQrCode.tsx`）。
- Round 8/9 的 fix 改的是 image 那一條分支（`CanvasKonvaImage`），沒有抽出 reusable 機制。
- QR 變體是 Round 8/9 之後 1 個月才加的（2026-10-04），加的時候參考了 `CanvasImage` 的 pattern 但沒看到 `CanvasKonvaImage` 內部那條 fix。

## 修法

### 加一張透明 `<Rect>` 當 hit target

```tsx
<Group
  id={element.id}
  ...
  draggable
  onClick={() => onSelect(element.id)}
  onTap={() => onSelect(element.id)}
  ...
>
  {/* Hit-target Rect (2026-10-04) — gives the Group a rectangular
      hit region. Konva.Group has no intrinsic hit detection; with
      only a `listening={false}` Konva.Image child, clicks fall
      through to the Stage and selection is cleared via
      onMouseDown. ... */}
  <Rect
    x={0}
    y={0}
    width={width}
    height={height}
    fill="rgba(0,0,0,0)"
  />
  <KonvaImage
    image={qrImg}
    ...
    listening={false}
  />
</Group>
```

跟 Round 9 對 `CanvasKonvaImage` 的修法 100% 一樣 — 這是 **同一個 bug 的同一個 fix**，跨 component variant 套用。

### 為什麼 loading / failed 分支不需動

| 分支 | 結構 | 結論 |
|---|---|---|
| loading | bare `<Rect>` with onClick | Konva.Rect 自身有 built-in hit detection，不需要 Group wrapper 也不需要 transparent Rect |
| failed | bare `<Rect>` with onClick | 同上 |
| loaded | `<Group>` 內只有 `KonvaImage listening={false}` | 需要 transparent Rect 提供 hit region |

每條分支獨立判斷。`CanvasImage` 的 Round 7 fix（讓 placeholder Rect 可被點選）跟本 bug 修法是平行概念：**任何用 Group 包 listening={false} 渲染元件的 pattern 都需要 transparent Rect hit target**。

## 8 條新增 regression test

`CanvasQrCode.test.tsx` 的 8 條 source-level 測試（直接讀原始碼 + regex 驗證結構），分三組：

### Cluster A — Hit-target Rect 存在 + 位置（4 條，平行 Round 9 圖片測試）

| # | Test | 覆蓋 |
|---|---|---|
| 1 | `source: Group contains a transparent hit-target Rect` | 正向 — source 含 `fill="rgba(0,0,0,0)"` 的 Rect |
| 2 | `source: hit-target Rect is nested inside the Group wrapper (not a sibling)` | 結構 — 用 `id={element.id}` 當錨點（避免匹配到 prose comment），找到 Group 後驗證內含 hit Rect |
| 3 | `source: hit-target Rect spans the full bbox (x=0, y=0, width=width, height=height)` | 結構 — hit Rect 必須覆蓋 Group 本地座標系的完整 bbox |
| 4 | `source: inner Konva.Image still has listening={false} (events bubble to Group via hit Rect)` | 防禦 — KonvaImage 保持 `listening={false}`，事件統一走 hit Rect 冒泡 |

### Cluster B — Group handler 配線（1 條，補 Round 9 沒測到的）

| # | Test | 覆蓋 |
|---|---|---|
| 5 | `source: Group has onClick and onTap handlers (events fire from the hit Rect to the Group)` | 防禦 — onClick/onTap 必須掛在 Group，不是 KonvaImage |

### Cluster C — Loading / failed 分支不需動（2 條，文件化「bug 只在 loaded 分支」）

| # | Test | 覆蓋 |
|---|---|---|
| 6 | `source: loading placeholder Rect has its own onClick handler (not affected by Group hit-region bug)` | 防禦 — bare Rect + onClick，無 Group wrapper |
| 7 | `source: failed placeholder Rect has its own onClick handler (not affected by Group hit-region bug)` | 同上 |

### Cluster D — Cross-reference（1 條，文件化 Round 9 對齊）

| # | Test | 覆蓋 |
|---|---|---|
| 8 | `source: file header documents the connection to Round 9 (CanvasKonvaImage fix)` | 文件 — header 內含 Round 9 與 CanvasKonvaImage 字樣，feedback doc 路徑可被 grep |

### 為什麼 Cluster C / D 重要

Cluster A/B 是「修好」的 assertion，Cluster C/D 是「不要修壞其他東西」的 assertion：

- Cluster C：loading/failed 是 bare Rect，**不能**被加上 Group wrapper（會改變渲染語意）。如果未來 refactor 把它們包進 Group，測試會 fail → 強制 reviewer 評估「是不是又掉進同樣的陷阱」。
- Cluster D：cross-reference 是文件化的「為什麼這裡有這條 fix」的入口。未來有人疑惑「為什麼 Group 內要加 Rect」，grep Round 9 就會到 CanvasKonvaImage 的 feedback 與 fix。

## 為什麼還是 source-level test 而非 runtime

jsdom 沒有 HTMLCanvasElement，Konva.Image / Group 完全不能 fire 真實的 click event。Round 9 的 4 條 source-level 測試證明這種 structural assertion 對「不寫了就壞」的 fix 已經夠用：

| 測試類型 | 抓到 | 抓不到 |
|---|---|---|
| Runtime click event | 真實 hit detection 行為 | jsdom 沒 canvas context |
| **Source-level structural** | 「hit Rect 存在」「位置正確」「bbox 對齊」「Group 有 onClick」「KonvaImage listening={false」」 | Konva 內部 Konva.Node 行為改變（極罕見）|

實機驗證仍需要 dev server + 瀏覽器：
- 加 QR → 等 50ms 編碼完成 → 點 QR 任意位置（含白底）→ Transformer attach 出現 ✅
- 切換 fgColor / bgColor → 等 ~50ms → 點新 QR → 可選 ✅
- 點 QR 旁邊空白 → selection 清掉（仍正確）✅
- 點別的 element（text / shape）→ 切到那個 element（仍正確）✅

## 驗證結果

| 項 | 指令 | 結果 |
|---|---|---|
| CanvasQrCode 測試 | `npx vitest run CanvasQrCode.test.tsx` | ✅ 8/8 pass |
| 全部 Step 7 + CardBuilder 測試 | `npx vitest run src/components/business/dashboard/CardBuilderEditor/Step7TableCard` | ✅ 141/141 pass（既有 133 + 新 8）|
| TypeScript | `npx tsc -b apps/frontend/tsconfig.app.json --noEmit` | ✅ 無錯誤 |
| Lint | `npm run lint --workspace=apps/frontend` | ✅ exit 0（無新增 warnings）|

## 跟既有規則對齊

| Rule | 對齊方式 |
|---|---|
| `000 § A.3` Hook Extraction Strategy | 不適用（純 rendering fix）|
| `000 § A.2` 主組件 ≤ 100 行 | CanvasQrCode 主組件沒變動（仍 ~80 行）|
| `011` 開發紀錄規範 | 本檔即 feedback，與 code 變更同 commit |
| `024 § Hook Split Pattern` | useQrCode 是 Hook Split Pattern；本 fix 不動 hook 本身，只動 component |
| `025` Vibe Coding L2 Checklist | 已有 8 條 regression test（source-level），i18n 沒變動，schema 沒變動 |
| `006` 完工前驗證 | 8 項驗證全綠（typecheck / lint / test / vitest / coverage）|

## 教訓 / 反思

### 教訓 1：pattern 複製沒有自動化保證

Round 8/9 修 image 時建立的 pattern（`<Group><KonvaImage listening={false} /><Rect fill="rgba(0,0,0,0)" /></Group>`）是 5 行程式碼，但 1 個月後的 QR 變體在套 pattern 時漏了最後 3 行（transparent Rect）。

**為什麼 source-level test 沒抓**：Round 9 的 4 條測試是針對 `Step7TableCardCanvas.web.tsx` 內的 `CanvasKonvaImage` 那段 JSX，沒有跨檔案斷言。`CanvasQrCode` 是新獨立檔案，從未被 Round 9 test 覆蓋到。

**未來怎麼避**：
- (a) 抽 helper `<KonvaImageWithHitRegion>` 共用 component → 改一處兩處同步。但目前只有 2 個 variant（image + qr），抽 helper 投資報酬率待觀察。
- (b) **`CanvasQrCode.test.tsx` 一上線就建**（這次的方向）：source-level 4 條 + cross-reference 1 條的成本極低，但能把這類 pattern drift 鎖死。
- (c) code review checklist 強制要求「任何新增 `<Group><KonvaImage listening={false}>` 都要有對應 hit-target Rect」。

採 (b) 是因為成本最低且 self-documenting。

### 教訓 2：bug 報告的指紋對齊

使用者回報「畫布上的 qr code 不能點選，你可以去看 feedback 文件，之前有解決過這個問題」是個**完美**的 bug report — 症狀、歷史 fix、檔案指紋全有。能把 Round 9 feedback 撈出來 + 對比新 code 是 5 分鐘的事（grep `fill="rgba(0,0,0,0)"` + 對比 `CanvasQrCode.tsx` 跟 `CanvasKonvaImage` 的差異）。

**未來怎麼強化**：rule 011 已經要求 feedback 同 commit，但使用者層的「這之前修過」指紋目前要靠人工 grep。可以考慮加一條 `runs/improvements/INDEX.md` 的 tag 系統（例如 `tag:hit-region`），把 Round 9 跟這次 fix 串起來。

### 教訓 3：Rule 024 的 `.web.ts` / `.native.ts` 沒擋到 bug

CanvasQrCode 本身是 web-only（透過 import `react-konva`），所以**不需要** Hook Split Pattern 三檔。但 `useQrCode` 是 Hook Split Pattern 沒錯。

問題是 CanvasQrCode 是「用 web-only API 的 component」而不是「用 web-only API 的 hook」。Rule 024 規範了 hook split，但**沒規範 component 層級的 web-only 隔離**。Konva 整個 binding 是 web-only，但 component 用 Konva 沒被 flag。

**未來怎麼強化**：當 component 直接 import `react-konva` / `konva` 時，應該在檔頭加 `@web-only` JSDoc tag（或依 Rule 024 抽 `CanvasQrCode.web.tsx` / `CanvasQrCode.native.tsx` 雙檔）。本 fix 沒加是因為這是既有架構問題（所有 Step 7 canvas component 都用 react-konva）→ 留到後續重構。

## 後續 TODO（本 PR 不在 scope）

- [ ] 評估是否抽 `KonvaImageWithHitRegion` 共用 component（Rule 000 § A.2：避免相同 pattern 重複出現）。目前 2 個 variant，投資報酬率待觀察。
- [ ] 加 `tag:hit-region` 機制到 `runs/improvements/INDEX.md`，把 Round 9 + 這次 fix 串起來。
- [ ] 評估是否在 rule 024 補「component 層級 web-only」段落（直接 import `react-konva` / `konva` 的 component 也要隔離）。
- [ ] 監控 production 是否有「QR 不能點選」回報再次出現（hit-target Rect 的 fix 是 deterministic 修法，但 5xx 之外的 silent UX 漏失要靠 user feedback 才能 catch）。

## 不做的事

- 不動 schema / shared types / store / hook signature。
- 不拆 `CanvasQrCode` 的 sub-component（~80 行，未達拆解門檻）。
- 不抽 `KonvaImageWithHitRegion` 共用 component（同 pattern 只有 2 個 variant，DRY 投資待觀察）。
- 不改 loading / failed 分支的渲染（bare Rect 已 work，動它沒好處）。
- 不動 `useQrCode` hook（它是 Hook Split Pattern 已對，bug 在 component 而非 hook）。

## 同步狀態

- 本地：commit 1f58356（修前）→ 新 commit 待送
- Remote：待 push
