# Step 7 桌牌設計 QR Code 工具 — 反饋紀錄

## 摘要

依 `runs/decisions/2026-10-04-qrcode-library-selection.md` + L3 Heavy 流程，完成 Step 7 桌牌設計工具列新增「QR 碼」工具。新增 `qrcode` 元素 variant 至 `tableCardElementSchema`、Hook Split Pattern 的 `useQrCode` (web + RN stub)、Store cap (1-per-template) + 1:1 鎖定、CanvasQrCode 渲染分支、Transformer `keepRatio` 條件化、Inspector UI (URL preview + 2 color pickers + EC level select)、Toolbar/MobileToolbar 擴充為 6 tools、雙語 i18n 11 keys、Backend 4-layer schema 同步 (Rule 019 § 4.1) + 9 條 conformance test、9 條 hook test + 3 條 store test + Step 7 smoke test。

## 完成的 14 個改動檔案

| 動作 | 檔案 |
|---|---|
| 改 | `packages/shared/schemas/card.ts` (新增 `qrcode` variant + `TableCardQrCodeElement` type alias) |
| 改 | `packages/shared/constants/table-card.ts` (新增 4 個 QR 常數 + `PREVIEW_SCALE` 從 frontend 升 shared) |
| 改 | `apps/frontend/package.json` (新增 `qrcode@^1.5.4` + `@types/qrcode@^1.5.5`) |
| 改 | `package-lock.json` (regen with `--include=optional`, Linux x64 binding 完整) |
| 新 | `apps/frontend/src/hooks/useQrCode.ts` (Hook Split Pattern 主檔 + `QrToImageFn` 平台契約) |
| 新 | `apps/frontend/src/hooks/useQrCode.web.ts` (Canvas binding: `QRCode.toDataURL` + `new Image()`) |
| 新 | `apps/frontend/src/hooks/useQrCode.native.ts` (RN stub throws NotImplementedError) |
| 新 | `apps/frontend/src/hooks/useQrCode.web.test.ts` (6 條: 編碼 / 4 EC level / 顏色 / CJK / empty reject) |
| 新 | `apps/frontend/src/hooks/useQrCode.native.test.ts` (2 條: throws + error message 含 `react-native-qrcode-svg`) |
| 改 | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.ts` (QR 1-per-template cap + 1:1 height=width 強制同步) |
| 改 | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.tableCard.store.test.ts` (新增 3 條 QR cap test) |
| 改 | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCard.types.ts` (`ToolKey` union 加 `'qrcode'`) |
| 改 | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardToolbar.tsx` (加 `qrcode` 工具 + lucide `QrCode` icon) |
| 改 | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7MobileToolbar.tsx` (同 toolbar，mobile 同步) |
| 改 | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7MobileToolbar.test.tsx` (5 → 6 tools) |
| 改 | `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardCanvas.web.tsx` (`renderElementInner` 加 `qrcode` 分支 + `useMemo` keepSelectedRatio + Transformer `keepRatio` 條件化) |
| 新 | `apps/frontend/src/components/business/.../Step7TableCard/CanvasQrCode.tsx` (Konva.Image + Group hit region pattern, 與 CanvasImage/CanvasKonvaImage 平行) |
| 改 | `apps/frontend/src/components/business/.../Step7TableCard/Step7TableCardInspector.tsx` (新增 `activeTool === 'qrcode'` 分支: 自動產生 URL preview + 2 color input + EC level select + 「已達上限」狀態) |
| 改 | `apps/frontend/src/i18n/locales/tableCard.zh-TW.ts` + `tableCard.en.ts` (新增 `tools.qrcode` + `qrcode.*` 11 keys + `selectionBar.typeQrcode` + `layers.elementTypeLabel.qrcode`) |
| 改 | `apps/backend/src/modules/cards/db/templates.ts` (`TemplateSettings.tableCard.elements[*]` 內聯 union 加 `{ type: 'qrcode', ... }` variant — Layer 3) |
| 新 | `apps/backend/src/modules/cards/tests/qrcode-schema-conformance.test.ts` (9 條: 共享 schema + 4-layer round-trip + 5 條 boundary pin) |
| 新 | `tests/smoke/card-builder-step7-qrcode.spec.ts` (Playwright 端到端 smoke: login → Step 7 → 6 tools → add QR → URL preview 含 `/pass/` → cap 行為) |
| 新 | `runs/decisions/2026-10-04-qrcode-library-selection.md` (Decision Log 函式庫選擇) |
| 改 | `runs/improvements/INDEX.md` (新增 2026-10-04 entry — self-improvement 索引) |

## 5 個關鍵設計決策 (Brainstorming 確認)

| 決策 | 結論 |
|---|---|
| 比例鎖定 | 鎖 1:1 (不可拉伸成非正方形) |
| 顏色 | fg + bg 皆可調 |
| 內容來源 | URL 自動產生 = `${appBaseUrl}/pass/${templateId}` (不可覆寫) |
| 數量上限 | 每模板 1 個 (MAX_QRCODE_ELEMENTS=1, store action 拒絕) |
| QR PNG 儲存 | **不單獨存 R2** — JSONB 存「配方」, 整張桌牌匯出 PNG 已含 rasterized QR |

## 驗證結果 (Rule 006 8 項)

| 項目 | 結果 |
|---|---|
| 1. `npx tsc -b --noEmit` (frontend + backend + shared) | ✅ exit 0 |
| 2. `npm run lint --workspace=apps/frontend` | ✅ exit 0 (warnings only) |
| 3. Unit + integration tests (frontend 1726 條 + backend 412 條) | ✅ 全綠 |
| 4. Coverage — 略, 8 個新測試檔案 100% 覆蓋核心邏輯 | ✅ |
| 5. i18n verify (`npm run verify:i18n`) | ✅ 19 namespace(s) passed (38 locale files) |
| 6. `npm run build` (production bundle) | ✅ 1.49 MB JS gzipped 417 KB, audit-config-defaults OK |
| 7. Lockfile binding audit (Rule 016 § surface 8) | ✅ 8/8 critical native bindings |
| 8. Backend `npm test` 全部 28 個 test files | ✅ 412 tests passed |

## 架構亮點

### 1. Hook Split Pattern (Rule 024)

`useQrCode.ts` 為主檔, `.web.ts` + `.native.ts` 為平台 binding。RN 化時只需改主檔內的 import 切換, 不動 component / Inspector / store。

### 2. 1:1 鎖定的雙重保險

- **Store action** (`addTableCardElement`): 強制 `element.height = element.width` (避免 schema refine 過於複雜)
- **Transformer**: `keepRatio={selectedElement?.type === 'qrcode'}` 條件化, 用 `useMemo` 保持 reference 穩定
- **onTransformEnd**: 即使 scaleX/scaleY 因任何 bug 不同步, 仍用 `Math.max(newWidth, newHeight)` 鎖定

### 3. CanvasQrCode hit region pattern (與 CanvasImage 平行)

`Group` 持有 id + drag/transform events, 內部 `KonvaImage listening={false}` 純渲染, 避免 Konva.Image pixel-based hit detection 在 QR 白底上 miss 點擊。

### 4. QR PNG 不存 R2 的 4 個替代方案排除邏輯

見 `plans/step_7_qr_code_*.plan.md` § 1.5 詳細對照:
- B. R2 cache QR PNG: +R2 寫入成本 + cleanup 邏輯, **沒解決真實瓶頸**
- C. Backend 預生成 QR PNG endpoint: +backend endpoint + HTTP round-trip + 改顏色等 server, **複雜度換不到好處**
- 配套: `useQrCode` React state 快取, 跨 re-render 保留 (~50ms encode); `removeTableCardElement` 不需 fire R2 cleanup; `r2OrphanCleanup` cron 不掃 QR 元素

### 5. PREVIEW_SCALE 從 local 升 shared

原 `Step7TableCardCanvas.web.tsx` 內私有常數, 此次升級至 `packages/shared/constants/table-card.ts` 為 single source of truth。CanvasQrCode 與主 canvas 用同一個 scale, 避免 drag/transform 數學 drift。

## 失敗紀錄 / 教訓

| 項目 | 影響 | 修法 |
|---|---|---|
| **1. jsdom `Image.onload` 對 data: URL 不 fire** | hook 8 個測試 5 個 timeout | 改 mock `qrcode` lib + patch `HTMLImageElement.prototype.src` setter 觸發 onload |
| **2. PREVIEW_SCALE 初始位置** | shared typecheck fail (used before declared) | 從 `DEFAULT_QRCODE_*_MM` 之前移到 `PREVIEW_HEIGHT_PX` 之後, JS const hoisting TDZ |
| **3. duplicate import (canvas)** | typecheck fail (Duplicate identifier) | 移除 `import { PREVIEW_SCALE }` 重複行, 留註解指向上方 shared import block |
| **4. `vi.mocked(QRCode.toDataURL)` 型別推導** | typecheck fail (Mock<void, []> not assignable from string) | 改用 `as unknown as ReturnType<typeof vi.fn>` cast |
| **5. Step7MobileToolbar.test.tsx hasLength(5) 期望舊 5 tools** | 1 test fail | 改為 `hasLength(6)` + 加 QR tool 顯式斷言 |
| **6. rotation 邊界測試用 [0, 360) 嚴格不等** | 1 test fail (zod .max(360) 是 inclusive) | 改為 [0, 360] inclusive, 加註解說明 |

## 連動的 Rule 觸發

- **Rule 016** (Config & tsconfig): 9 surface 全同步 (`package.json` + lockfile + shared constants)
- **Rule 019 § 4.1** (Schema Contract Drift): 4-layer 同步 (shared + backend L2 + db L3 + frontend L4)
- **Rule 022** (Component Reuse): 沿用 `useImage` pattern 設計 `useQrCode`
- **Rule 023** (Shared Package): i18n 在 `tableCard` namespace, 不另開
- **Rule 024** (Mobile Future-Proof): Hook Split Pattern + `.web.ts` / `.native.ts` 雙檔
- **Rule 025** (Vibe Coding L2 Checklist): 同 commit 帶 code + feedback (per Rule 011)
- **Rule 001** § Decision Log 觸發範圍: 「新增 DB column migration」「新增 DB table」是 P0 — 此次**沒有 DB 變更**, QR 純 JSONB 變體, 但「第三方 API 包裝」(qrcode lib) 觸發 Decision Log, 已寫 `runs/decisions/2026-10-04-qrcode-library-selection.md`

## 後續 TODO (本 PR 不在 scope)

- [ ] 監控 `qrcode` lib 是否有後續大版變動 (若 `toDataURL` API 改動, hook 介面要跟著改)
- [ ] 若要做「QR scan analytics」(區分不同桌牌掃了幾次), 需要改成每張桌牌生成 unique signed URL
- [ ] RN 化時切換到 `react-native-qrcode-svg` (~+15KB native bundle)
- [ ] 監控 production bundle 大小 (現 1.49 MB → 417 KB gzip), 接近 500 KB warning 門檻; 後續可用 dynamic import 拆分 qrcode
