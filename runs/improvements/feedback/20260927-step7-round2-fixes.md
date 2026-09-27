# Step 7 Table Card — Round 2 Bug Fixes (2026-09-27)

## 背景

Step 7 (客製化桌牌) 上線後第一輪修了 10 個 i18n / sidebar / selectionBar / bleed overlay 問題。本輪收四個 runtime bug：

| # | 症狀 | 根因 |
|---|------|------|
| 1 | 「生成桌牌」按鈕按下去 → `UNAUTHORIZED` `auth.error.missingToken` | 下載路徑用 `window.open(url)`，瀏覽器 navigation **不會帶 Authorization header** |
| 1b | 同樣症狀出現在「下載桌牌」 | 同上 |
| 2 | 上傳圖片後畫布顯示空白 | `Step7TableCardCanvas.web.tsx` 對 `image` element 只渲染 placeholder `<Rect fill="#e5e7eb">`，**從未載入實際圖片**（TODO 註解確認） |
| 3 | Mobile bottom toolbar 跟畫布疊在一起很亂 | `Step7MobileToolbar.tsx` 用 `bg-card` 不透明 |
| 4 | Mobile 出血線超出畫布 | `Step7TableCardCanvas` 的 Stage 寫死 `width=595 height=842`，mobile container 通常 < 595px → Stage 自身 overflow |

## 修法摘要

### Fix 1 + 1b — Blob + Bearer（核心 bug）

**Before**（silently 401）：
```ts
// cardService
downloadTableCardUrl(templateId: string): string {
  return `${api.paths.cardById(templateId)}/table-card/download`;
}

// hooks
const handleDownload = useCallback(() => {
  const url = cardService.downloadTableCardUrl(templateId);
  window.open(url, '_blank');  // ← 瀏覽器 navigation 不帶 Authorization header
}, [templateId]);
```

**After**（Bearer header 自動帶）：
```ts
// cardService
async downloadTableCardBlob(templateId: string): Promise<Blob> {
  return httpClient.getBlob(
    `${api.paths.cardById(templateId)}/table-card/download`,
  );
}

// hooks
const handleDownload = useCallback(async () => {
  if (!templateId) return;
  try {
    const blob = await cardService.downloadTableCardBlob(templateId);
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = 'table-card.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (err) {
    console.error('[useTableCardExport] download failed:', err);
    setExportState('error', t('errors.networkError'));
  }
}, [templateId, setExportState, t]);
```

**Key change**: `httpClient.getBlob(path)` 是一個新 method，內部走 `request({ responseType: 'blob' })`，自動套用既有的 Bearer header + 5xx retry + 401 refresh-on-retry 邏輯。比 query string `?token=` 更安全（token 不進 URL / browser history）。

### Fix 1d — 診斷 logging

`handleExport` 開頭加 `console.debug('[useTableCardExport] token present:', !!getAccessToken())`：
- 暫時的，等驗證完成會拿掉
- 如果 user 看到「生成」也 401，這行 console 會直接揭曉 token 是不是 null
- 比起對 user 問「瀏覽器有 bearer token 嗎？」快 30 秒

### Fix 2 — 真實圖片渲染

**Before**：
```tsx
if (el.type === 'image') {
  return <Rect fill="#e5e7eb" stroke="#9ca3af" />;  // ← placeholder, TODO 註解
}
```

**After**：新增 `CanvasImage` + `CanvasKonvaImage` sub-component：
```tsx
function CanvasImage({ cardId, element, ... }) {
  const accessToken = window.sessionStorage.getItem('saome.accessToken');
  const imageUrl = cardId
    ? `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/cards/${cardId}/table-card/element/image/${element.id}${
        accessToken ? `?token=${encodeURIComponent(accessToken)}` : ''
      }`
    : '';
  const [img, status] = useImage(imageUrl, 'anonymous');

  if (!imageUrl || status === 'loading') {
    return <Rect fill="#e5e7eb" stroke="#9ca3af" dash listening={false} />;
  }
  if (status === 'failed' || !img) {
    return <Rect fill="#fee2e2" stroke="#dc2626" dash onClick={onSelect} />;
  }
  return <CanvasKonvaImage image={img} ... />;  // 真實 KonvaImage
}
```

**3 個 fallback state**：
1. `loading` → 灰虛線 placeholder（跟原本一樣）
2. `failed` → **紅**虛線 placeholder（視覺明顯區分錯誤狀態）
3. `loaded` → 真實 `<KonvaImage>` 渲染

**`?token=` query 設計**：`<img>` 不會帶 Authorization header，但 backend route `getTableCardElementImage.ts` 同時支援 Bearer header 跟 `?token=` query（既有 pattern，跟 `getImage.ts` 對齊）。

**Bug fix**：原本 `useImage(imageUrl || undefined, 'anonymous')` 編譯錯誤（use-image signature 不接受 undefined）— 改用 `useImage(imageUrl, 'anonymous')`，空字串 URL 走 `loading` branch。

### Fix 3 — Mobile toolbar 半透明

**Before**：
```tsx
className="... bg-card ..."
```

**After**：
```tsx
className="... bg-card/60 backdrop-blur-md backdrop-saturate-150 ..."
data-testid="step7-mobile-toolbar"
data-testid-translucent="true"
```

對齊 CardBuilderEditor 其他 mobile 預覽底色（MobilePreviewPanel uses bg-black/50 backdrop-blur-sm）的視覺語言。

### Fix 4a — 動態 Stage sizing（核心 mobile bug）

**Before**：Stage 寫死 `width=595 height=842`。
```tsx
<Stage width={PREVIEW_WIDTH_PX} height={PREVIEW_HEIGHT_PX}>
```

**After**：用 ResizeObserver 動態 scale：
```tsx
const containerRef = useRef<HTMLDivElement | null>(null);
const [stageSize, setStageSize] = useState({
  width: PREVIEW_WIDTH_PX,
  height: PREVIEW_HEIGHT_PX,
  scale: 1,
});

useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  const update = () => {
    const containerWidth = el.clientWidth;
    if (containerWidth <= 0) return;
    if (containerWidth >= PREVIEW_WIDTH_PX) {
      setStageSize({ width: PREVIEW_WIDTH_PX, height: PREVIEW_HEIGHT_PX, scale: 1 });
      return;
    }
    const scale = containerWidth / PREVIEW_WIDTH_PX;
    setStageSize({
      width: containerWidth,
      height: Math.round(containerWidth * (TABLE_CARD_HEIGHT_MM / TABLE_CARD_WIDTH_MM)),
      scale,
    });
  };
  update();
  const ro = new ResizeObserver(update);
  ro.observe(el);
  return () => ro.disconnect();
}, []);
```

**Konva `scaleX/scaleY` 優於 CSS transform**：
- Transformer 的 hit-testing 自動跟著縮放
- 座標換算（mmToPx）保持不變
- drag/transform 事件座標自動正確

### Fix 4b — 父容器 overflow handling

`Step7TableCard/index.tsx` 的 Stage wrapper：
```tsx
<div className="flex items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30 p-2 shadow-sm sm:p-4">
  <Step7TableCardCanvas ... />
</div>
```

`overflow-hidden` 雙保險（如果 Konva scale 出意外狀況，Stage 仍被裁切）；`flex items-center justify-center` 保持 mobile 居中。

---

## 新增 / 修改檔案

| 檔案 | 變更 |
|---|---|
| `apps/frontend/src/services/cardService.ts` | `downloadTableCardUrl` → `downloadTableCardBlob`（async, 用 httpClient.getBlob） |
| `apps/frontend/src/services/httpClient.ts` | 新增 `getBlob(path)` method（responseType='blob' wrapper） |
| `apps/frontend/src/services/cardService.downloadTableCardBlob.test.ts` | 新增 — 2 條 conformance test |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCard.hooks.ts` | `handleDownload` 改 async + blob + URL.createObjectURL + console.debug 加 token check |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCard.hooks.test.ts` | 新增 — 4 條 conformance test |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/TableCardExportButton.tsx` | `onDownload?: () => void \| Promise<void>`（async-allowed） |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardCanvas.web.tsx` | 新增 CanvasImage + CanvasKonvaImage sub-components；Fix 2 image 真實渲染；Fix 4a ResizeObserver + scaleX/Y；bug fix: `useImage` 改為必填 string |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardCanvas.test.tsx` | 新增 — 6 條 conformance test（含 source-level assertions） |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7MobileToolbar.tsx` | `bg-card/60 backdrop-blur-md backdrop-saturate-150` |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7MobileToolbar.test.tsx` | 已存在 — 補上 unused `imageButton` variable 移除 |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/index.tsx` | 父容器加 `flex items-center justify-center overflow-hidden` |
| `apps/frontend/package.json` | `use-image ^1.1.4`（既有） |

## 驗證

### Typecheck / Lint / Test

```bash
npx tsc -b apps/frontend/tsconfig.app.json --noEmit  # 無新增錯誤
npm run lint --workspace=apps/frontend              # 無新增警告
npx vitest run --workspace=apps/frontend            # 1519/1519 passed (125 files)
```

### 新增 / 修改的 conformance test（11 條）

| Test | 檔案 | Fix |
|---|---|---|
| `downloadTableCardBlob returns Blob from httpClient.getBlob` | `cardService.downloadTableCardBlob.test.ts` | 1a |
| `downloadTableCardBlob calls /api/cards/:id/table-card/download` | `cardService.downloadTableCardBlob.test.ts` | 1a |
| `useTableCardExport.handleDownload routes through httpClient.getBlob` | `Step7TableCard.hooks.test.ts` | 1b |
| `useTableCardExport.handleDownload triggers URL.createObjectURL + revokeObjectURL` | `Step7TableCard.hooks.test.ts` | 1b |
| `useTableCardExport.handleDownload no-op when templateId is null` | `Step7TableCard.hooks.test.ts` | 1b |
| `useTableCardExport.handleDownload sets error state on fetch failure` | `Step7TableCard.hooks.test.ts` | 1b |
| `Step7TableCardCanvas renders Stage with scaleX/scaleY` | `Step7TableCardCanvas.test.tsx` | 4a |
| `Step7TableCardCanvas default Stage size is PREVIEW_WIDTH_PX (595)` | `Step7TableCardCanvas.test.tsx` | 4a |
| `Step7TableCardCanvas source uses ResizeObserver + scaleX/Y` | `Step7TableCardCanvas.test.tsx` | 4a |
| `Step7TableCardCanvas source: image branch uses CanvasImage + useImage` | `Step7TableCardCanvas.test.tsx` | 2 |
| `Step7TableCardCanvas source: no gray placeholder in image branch` | `Step7TableCardCanvas.test.tsx` | 2 |
| `Step7MobileToolbar uses bg-card/60 backdrop-blur-md` | `Step7MobileToolbar.test.tsx`（既有） | 3 |
| `Step7MobileToolbar does NOT use opaque bg-card` | `Step7MobileToolbar.test.tsx`（既有） | 3 |

### 手動 smoke test（必須 production 跑）

1. **Download**：登入 → 進入 Step 7 → 按「生成桌牌」（看到「下載桌牌」變可用）→ 點擊 → 瀏覽器觸發 `table-card.png` 下載
2. **Image render**：上傳 PNG → 元素出現在畫布上**顯示真實圖片**（不再是灰色虛線框）→ 拖曳 / resize 正常
3. **Mobile toolbar**：切到 mobile viewport (375px) → 底部 toolbar 半透明、畫布元素仍可透出 → 文字仍可讀
4. **Mobile bleed**：mobile viewport → 出血虛線框**完全在 stage 範圍內**，不超出父容器
5. **Generate**：console 看到 `token present: true` → 按下「生成桌牌」 → spinner → 變「下載桌牌」

## 觸發 rule 合規

- Rule 024 (Mobile Future-Proof) § Hook Split Pattern：CanvasImage 是 web-only（`.web.ts`），RN 端走 `Step7TableCardCanvas.native.tsx` stub
- Rule 023 (Shared Package 邊界) § i18n：複用既有 `errors.networkError`，無新增 key
- Rule 032 (JSONB silent killer)：本輪不動 settings merge
- Rule 036 (CORS Defense)：Fix 2c — `getTableCardElementImage` backend route 已有 `?token=` 支援 + Bearer header
- Rule 035 (Migration Apply Pipeline)：本輪無新增 migration

## Out of Scope（Round 3 backlog）

- 形狀工具的圓角 / 線條粗細以外的進階屬性（dash pattern、opacity slider）
- 文字的 letter-spacing / line-height 進階設定
- 多元素 multi-select
- 群組 / 鎖定 / 對齊輔助線
- 圖層 panel 的拖曳排序

## 教訓

1. **瀏覽器 navigation 不帶 Authorization header** — 任何 `window.open(url)` / `<a href="url">` 的 backend 拿不到 Bearer 認證。Rule 036 已經寫過，但前端下載流程要再強化。
2. **jsdom + Konva 測試模式**：Konva 需要 canvas context，jsdom 沒有 → mock react-konva 配合 source-level regex assertion 是務實做法。完整的行為測試要靠 Playwright smoke test。
3. **TODO 在 component 內** = 「未來會爆」訊號。本輪撿到的 #2 (image placeholder) 跟 #4 (mobile overflow) 都是這樣浮上來的。

## 引用

- 計劃: `~/.cursor/plans/step7_table_card_bug_fixes_round_2_cf794401.plan.md`
- 既有 step 7 反饋: `runs/improvements/feedback/20260927-step7-round1-fixes.md`（前次修的 10 個 issue）
- Rule 036: `.cursor/rules/036-worker-runtime-cors-defense.mdc`
- Rule 024: `.cursor/rules/frontend/024-mobile-future-proof.mdc`
