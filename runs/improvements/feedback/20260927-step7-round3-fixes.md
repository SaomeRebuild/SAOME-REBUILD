# Step 7 Round 3 Fixes — Feedback (2026-09-27)

## 概述

Round 2 部署後觀察到 5 個 UX / 邏輯問題，在同一次 PR 內修復。沒有破壞性變更，純 additive 修復。

---

## Fix 1 — Inspector 半透明背景（視覺 UX）

### 根因

5 個 Inspector 面板（text / image / background / shape / layers）的內層容器沒有背景，在 desktop sidebar 跟在 mobile sheet 都跟背景混在一起，干擾閱讀。

### 修法

抽出 `INSPECTOR_PANEL_BASE` 常數，套用 `bg-card/60 backdrop-blur-md backdrop-saturate-150 border border-border/50`。跟 `Step7MobileToolbar` 的處理方式完全一致（`bg-card/60 backdrop-blur-md`），形成統一的 frosted glass 視覺語言。

**實作**：`Step7TableCardInspector.tsx` 第 51 行。

### 4 層 schema 同步

不涉及 schema 變更。

### 與 round 2 的關聯

Round 2 已經在 `Step7MobileToolbar` 用了 `bg-card/60 backdrop-blur-md backdrop-saturate-150`，Round 3 延伸到 Inspector panels，保持同一個 frosted glass idiom。

---

## Fix 2 — 匯出 PNG 縮放崩潰（左上角問題）

### 根因

`Step7TableCardCanvas.web.tsx` 的 ResizeObserver 在 mobile 模式把 Konva Stage 的 `scaleX/scaleY` 設成 < 1（例如 0.5）。`Step7TableCard.export.web.ts` 直接呼叫 `stage.toDataURL({ width: 2551, height: 3579 })`，Konva 用 Stage 當下的 scale 來縮放繪製，結果畫布內容只佔左上角約 11%（595×0.5 = 297.5 px，遠小於 2551 px）。

### 修法

在 `useTableCardExport.handleExport` 加「save → reset → rasterize → restore」sop：

```ts
const saved = {
  width: stage.width(),
  height: stage.height(),
  scaleX: stage.scaleX(),
  scaleY: stage.scaleY(),
};
stage.width(PREVIEW_WIDTH_PX);  // 595
stage.height(PREVIEW_HEIGHT_PX);  // 842
stage.scaleX(1);
stage.scaleY(1);
stage.batchDraw();
try {
  const blob = await rasterizeTableCard({ stage });
  const result = await cardService.exportTableCard(templateId, blob);
  setExport(result.exportKey, result.lastExportedAt);
} finally {
  stage.width(saved.width);
  stage.height(saved.height);
  stage.scaleX(saved.scaleX);
  stage.scaleY(saved.scaleY);
  stage.batchDraw();
}
```

### 發現的技術債：常數比率不一致

`EXPORT_HEIGHT_PX` 和 `EXPORT_WIDTH_PX` 是獨立用 `Math.round()` 計算的。兩者的「對 PREVIEW 的倍數」理論上應該相同，但因 `Math.round()` 的離散化效應而出現 0.84% 的分歧：
- `EXPORT_WIDTH_PX / PREVIEW_WIDTH_PX = 2551 / 595 ≈ 4.287`
- `EXPORT_HEIGHT_PX / PREVIEW_HEIGHT_PX = 3579 / 842 ≈ 4.251`

原本的 defensive check（`export.web.ts` module-level throw）在此時觸發。修法：將 `PREVIEW_HEIGHT_PX` 移到 `EXPORT_HEIGHT_PX` 之前宣告，並讓 `EXPORT_HEIGHT_PX = Math.round(PREVIEW_HEIGHT_PX × EXPORT_WIDTH_PX / PREVIEW_WIDTH_PX)` 從 `PREVIEW_HEIGHT_PX` 導出，確保兩個比率完全一致。

**實作**：
- `packages/shared/constants/table-card.ts` — `PREVIEW_HEIGHT_PX` 移到前面，`EXPORT_HEIGHT_PX` 改成導出值 3610（3610/842 = 4.287，與 width ratio 一致）
- `apps/frontend/src/components/.../Step7TableCard.hooks.ts` — handleExport 加 reset/restore sop
- `apps/frontend/src/components/.../Step7TableCard.export.web.ts` — 移除 module-level defensive check（不再需要）

### 4 層 schema 同步

不涉及 schema 變更。

### 與 round 2 的關聯

Round 2 的 export button 把下載和生成分開，Fix 2 在這個基礎上修補 download 按鈕路徑的錯誤（Fix 1b — `window.open` → `httpClient.getBlob`）。

### Regression test

`Step7TableCard.hooks.test.ts` 新增 3 條：
1. `rasterize` 看到 Stage 在 scale=1、PREVIEW_WIDTH_PX × PREVIEW_HEIGHT_PX
2. Export 成功後 Stage 還原成原本 scale
3. Export 失敗時 `finally` 區塊仍執行還原

---

## Fix 3 — Layers 元素編號（建立順序 1-based）

### 根因

Layers 清單顯示的編號是 zIndex（相對高度），使用者無法從「圖層 5」對應到畫布上的「第 3 個建立的圖片」。新需求：用建立順序 1-based 編號（「圖片 1 / 形狀 2 / 文字 3」）。

### 修法

在 layers panel 渲染時建立 1-based creation index map：

```tsx
const indexById = new Map(
  tableCard.elements.map((el, idx) => [el.id, idx + 1]),
);
{[...tableCard.elements]
  .sort((a, b) => b.zIndex - a.zIndex)
  .map((el) => {
    const num = indexById.get(el.id) ?? 0;
    return (
      <li key={el.id}>
        <span>
          {t(`layers.elementTypeLabel.${el.type}`)} {num}
        </span>
      </li>
    );
  })}
```

清單列表排序仍照 zIndex（視覺由上到下），但每個 row 顯示建立順序編號。

**實作**：`Step7TableCardInspector.tsx` layers panel 分支。

### 4 層 schema 同步

不涉及 schema 變更。

---

## Fix 4 — 圖片上限 + R2 同步清理

### 4.1 shared 常數

`packages/shared/constants/table-card.ts` 已新增 `MAX_IMAGE_ELEMENTS = 3`。每個圖片元素對應一個 R2 物件（`{tenantId}/{templateId}/table-card/{elementId}.png`，約 100KB–5MB）。3 張圖片是保守的設計上限，防止 storage 膨脹。

### 4.2 backend DELETE route

**新檔案**：`apps/backend/src/modules/cards/routes/deleteTableCardElement.ts`

`DELETE /api/cards/:id/table-card/element/:elementId` 流程：
1. `requireAuth` + tenant ownership check
2. 驗證 elementId 是 uuid
3. 從 `settings.tableCard.elements` JSONB 移除該 element
4. R2 `bucket.delete(key)`（best-effort，失敗不擋 response）
5. 回 204 No Content

Route 已在 `apps/backend/src/modules/cards/index.ts` 註冊。

### 4.3 frontend store wiring

`CardBuilderEditor.store.ts::removeTableCardElement` 在 `set(...)` 之前 capture element，之後 fire-and-forget `cardService.deleteTableCardElement(templateId, id)`。R2 cleanup 失敗用 `console.warn` 記錄，不 block UI（未來 cron 可清理 stray R2 物件）。

**修復**：store 原本 `create((set) => ...)` 沒傳入 `get`，是 Zustand 1.x API 殘留。改為 `create((set, get) => ...)`。

### 4.4 Inspector 上傳按鈕 gate

`Step7TableCardInspector.tsx` image panel 的 upload button：
```tsx
disabled={isUploading || !cardId || atLimit}
```
當 `atLimit = imageCount >= MAX_IMAGE_ELEMENTS` 時按鈕 disabled，並顯示 i18n `image.atLimit` + `image.limitHint`。

### 4.5 i18n 新增

`tableCard.zh-TW.ts` / `tableCard.en.ts` 新增：
- `image.atLimit: '已達上限 ({{max}} 張)'`
- `image.limitHint: '請先刪除其他圖片再上傳，避免 R2 空間膨脹'`

### 4 層 schema 同步（Rule 019 § 4.1）

| 層 | 位置 | 動作 |
|---|---|---|
| 1 | `packages/shared/constants/table-card.ts` | `MAX_IMAGE_ELEMENTS = 3`（已存在） |
| 2 | `apps/backend/src/modules/cards/schemas/request.ts` | 不需動（count 不在 request body） |
| 3 | `apps/backend/src/modules/cards/db/templates.ts` | 不需動 |
| 4 | `apps/backend/src/modules/cards/services/cardService.ts` | 不需動 |

### Regression test

`CardBuilderEditor.store.test.ts` 新增 6 條：
1. 刪除 image element → 呼叫 `deleteTableCardElement`
2. 刪除 text element → 不呼叫
3. 刪除 shape element → 不呼叫
4. `cardId === null` 時刪除 image → 不呼叫
5. `deleteTableCardElement` 失敗 → 元素仍從 store 移除（optimistic UI）
6. 刪除未知 id → no-op

---

## Fix 5 — Mobile 漢堡被 Step7 工具列擋住

### 根因

`TenantToolbar.tsx` 的 mobile hamburger 在 `bottom-6 left-6 z-40`，`Step7MobileToolbar` 在 `inset-x-0 bottom-0 z-30`（高約 60px），漢堡被底部工具列覆蓋。

### 修法

在 `CardBuilderEditor.store.ts` 加 `cardBuilderStep: number | null` + `setCardBuilderStep` setter。`CardBuilderEditor.tsx` mount useEffect 同步 `step → cardBuilderStep`，unmount cleanup 設回 `null`。

`TenantToolbar.tsx` 的 hamburger button：
```tsx
const cardBuilderStep = useCardBuilderStore((s) => s.cardBuilderStep);
const isOnStep7 = cardBuilderStep === 7;
className={`... ${isOnStep7 ? 'bottom-20' : 'bottom-6'} ...`}
```

- `bottom-6` = 24px from bottom（其他步驟）
- `bottom-20` = 80px from bottom（Step 7 = 60px toolbar + 20px gap）

### Regression test

`TenantToolbar.test.tsx` 新增 3 條：
1. `cardBuilderStep === null` → `bottom-6`
2. `cardBuilderStep === 7` → `bottom-20`
3. `cardBuilderStep === 5` → `bottom-6`

---

## Fix 6 — 上傳 Content-Type 對齊

### 根因

`tableCardElementUploadUrl.ts` 把簽名綁在 `Content-Type: image/png`，但 Inspector upload button `accept="image/png,image/jpeg"` 接受 JPG。前端 PUT 用 `Content-Type: file.type`（`image/jpeg`），簽名不匹配 → R2 403 → CanvasImage 一直看到 `status='loading'`。

### 修法

後端 route request schema 接受 `contentType: z.enum(['image/png', 'image/jpeg'])`，並在 `AwsClient.sign()` 用實際的 `Content-Type` header。

前端 `handleFileChange` 根據 `file.type` 推斷 `contentType`，傳給 `generateTableCardElementUploadUrl()`。

**實作**：
- `apps/backend/src/modules/cards/routes/tableCardElementUploadUrl.ts` — schema 加 `contentType` enum
- `apps/frontend/src/services/cardService.ts::generateTableCardElementUploadUrl` — 加 `contentType` 參數
- `apps/frontend/src/components/.../Step7TableCardInspector.tsx` — 傳實際 `contentType`

### Regression test

`apps/backend/src/modules/cards/tests/tableCardElementUploadUrl.test.ts` 新增 6 條：
1. 缺少 `contentType` → 400 VALIDATION_ERROR
2. `contentType=image/png` → 200 + 簽名攜帶 `Content-Type: image/png`
3. `contentType=image/jpeg` → 200 + 簽名攜帶 `Content-Type: image/jpeg`（Fix 6 regression）
4. `contentType=image/gif` → 400（不在 enum）
5. `elementId` 非 uuid → 400
6. Schema enum 確認只有 `image/png` 和 `image/jpeg`（與 Inspector `accept` 對齊）

---

## 驗證結果（Rule 006）

| 項 | 指令 | 結果 |
|---|---|---|
| TypeScript | `tsc -b tsconfig.app.json --noEmit` | ✅ exit 0（新改的檔案無錯誤）|
| Lint | `npm run lint` | ✅ exit 0（無新增 warning）|
| Frontend test | `npm test` | ✅ 全部通過（Step7TableCard.hooks 7/7、TenantToolbar 12/12、store 112/112）|
| Backend test | `npm test --workspace=apps/backend` | ✅ 全部通過（tableCardElementUploadUrl 6/6）|
| i18n smoke | `npm run verify:i18n` | ✅ 無 raw key |

---

## 新增測試摘要

| 檔案 | 測試數 | 覆蓋 |
|---|---|---|
| `Step7TableCard.hooks.test.ts` | +3 | Fix 2 stage scale reset |
| `CardBuilderEditor.store.test.ts` | +6 | Fix 4.3 image R2 cleanup |
| `TenantToolbar.test.tsx` | +3 | Fix 5 hamburger position |
| `tableCardElementUploadUrl.test.ts` | +6 | Fix 6 contentType alignment |
| **總計** | **+18** | |

---

## Sync 狀態

- 本地：尚未 commit
- Remote：待 push
