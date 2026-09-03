# Stamp Grid 功能 — DEV LOG（2026-09-04）

## Summary

實作「集點印章」Step 3 功能：當 cardType 為 `stamp_card` 或 `multipass` 時，使用者可選擇印章圖示 + 集點格數（1×5 / 2×5 / 3×5 / 4×5）。完成合併 Plan 1（L2 廣範圍）與 Plan 2（渲染層精煉）。

## 範圍

| 項目 | 內容 |
|---|---|
| Card type 限制 | `stamp_card`, `multipass`（其他 cardType 在 CardBuilderEditorWorkspace conditional 排除） |
| Schema 4 層同步 | shared `templateSettingsSchema` + `cardTypeExtensions.stamp_card / multipass` + backend `request.ts` + backend `db/templates.ts::TemplateSettings` |
| 共用 component | `StampGridPreview`（Plan 2 API：收 `stripHeight/stripWidth`，內部呼叫 `calculateCellSize`） |
| Step 3 編輯器 | `Step3StampGrid`（conditional）+ `StampGridCountSelector` + `StampIconPicker`（popover + live preview） |
| Strip 渲染 | `PassCardPreviewStrip` Plan 2 設計：透明 padded container + flex centering |
| i18n | 沿用 `cardEditor` namespace，加 `step3.stampSection.*`（title / hint / gridCount / iconPicker / icons.bell\|fire\|lightbulb\|love\|sun） |
| 圖示管理 | 從根目錄 `stamp_icon/` 搬到 `apps/frontend/src/assets/icons/stamps/{stamped,unstamped}/`（10 個 PNG）+ `manifest.ts` 用 `import.meta.glob` 動態探索 |

## 衝突與定案

| 項目 | Plan 1 (d3e28d0b) | Plan 2 (2052e468) | 定案 |
|---|---|---|---|
| `StampGridPreview` API | 收 `cellSize: number` | 收 `stripHeight/stripWidth`、內部呼叫 `calculateCellSize` | **Plan 2** |
| cellSize 計算位置 | Strip 端計算後傳入 | component 內部計算（純函式） | **Plan 2** |
| Strip 內部結構 | inline cellSize | 透明 padded container（`padding: 8px`）+ `flex items-center justify-center` | **Plan 2** |

理由：Plan 2 把 cellSize 計算封進純函式 + component，讓 caller 只給 strip 尺寸、cellSize 集中在一處（未來調格線大小不會牽動 Strip）。

## cellSize 對照表（Option B 嚴格 min-cap）

`stripHeight=120, stripWidth=256`：

| rows | cellByHeight | cellByWidth | floor(min) |
|---|---|---|---|
| 1 | 104 | 44.8 | **44** |
| 2 | 50 | 44.8 | **44** |
| 3 | 32 | 44.8 | **32** |
| 4 | 23 | 44.8 | **23** |

`stripHeight=100, stripWidth=256`（compact）：

| rows | cellByHeight | cellByWidth | floor(min) |
|---|---|---|---|
| 1 | 84 | 44.8 | **44** |
| 2 | 40 | 44.8 | **40** |
| 3 | 25 | 44.8 | **25** |
| 4 | 19 | 44.8 | **18** ← plan typo 修正 |

## 完工驗證（Rule 006）

```
Frontend:
  typecheck (tsc -b):  exit 0
  lint (oxlint):        exit 0
  vitest:               56 files passed | 1 skipped (57)
                        453 tests passed | 5 skipped (458)
  verify:i18n:          17 namespaces passed (34 locale files)
  build:                exit 0 + dist/ produced (sun.png emitted, 9 icons inlined as base64)
  bundle URL audit:     no localhost:PORT URLs in dist; production API URL present

Backend:
  typecheck (tsc):      exit 0
  schema-conformance:   13/13 passed (stampGridRows + stampIconId in shared + local)
  updateTemplate.merge: pre-existing failure (sql.json in vitest-pool-workers) — stashed/reverted: also fails on clean main
```

## 風險與緩解

| 風險 | 緩解 |
|---|---|
| Vite `import.meta.glob` + Windows + case-sensitive 路徑 | build 通過；stamped/sun.png 5418 bytes 超過 4KB inline threshold 變成獨立檔，其餘 9 個 < 4KB 自動 inline 為 base64 — 預期 Vite 行為 |
| Schema 4 層同步漏一層 | schema-conformance.test.ts 加 stampGridRows + stampIconId 兩層斷言（shared + local） |
| Step3StampGrid 主組件破 100 行 | 主組件 53 行（只做組裝）；sub-component 拆 `StampGridCountSelector` + `StampIconPicker` |
| Type inference 把 `stampGridRows: 1` widen 成 `number` | 加 `as 1 \| 2 \| 3 \| 4` annotation + `typedInitialState: Pick<...>` 確保型別不被 broaden |
| Stripe icon PNG 漏搬到 frontend bundle | build 後 `dist/assets/sun-D_gGEYQQ.png` + 9 個 inline base64 — 全 10 個都進了 bundle |

## Files Changed（17）

```
M apps/backend/src/modules/cards/db/templates.ts
M apps/backend/src/modules/cards/schemas/request.ts
M apps/backend/src/modules/cards/tests/schema-conformance.test.ts
M apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.ts
M apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.test.ts
M apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditorWorkspace.tsx
M apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreview.tsx
M apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreview.types.ts
M apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardPreview/PassCardPreviewStrip.tsx
M apps/frontend/src/i18n/locales/cardEditor.en.ts
M apps/frontend/src/i18n/locales/cardEditor.zh-TW.ts
M packages/shared/schemas/card.ts
M packages/shared/schemas/cardBuilder.ts
? apps/frontend/src/assets/icons/                              (10 PNGs + manifest.ts)
? apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step3StampGrid/  (index/types/test/stories/GridCount/IconPicker)
? apps/frontend/src/components/business/stampCard/StampGridPreview/  (index/utils/types/test/stories/.tsx)
? packages/shared/schemas/card.test.ts                        (新增 schema unit test)
```

## 不做的事（明確 scope）

- 不改 Step 1 / Step 2 任何欄位
- 不動 MediaAssetUploader
- 不重構 PassCardPreviewBody / Footer / Back
- 不開新的 i18n namespace（沿用 cardEditor）
- 不動 CardPreview 既有其他測試（只加新 case）
- 不開 Decision Log（L2 scope，沒跨 module 架構決策）
- 不做 icon 上傳功能（icon pool 是 bundling 的固定集合）
- 不引入 ResizeObserver 動態計算
- 不改 `STRIP_BACKGROUND_COLOR`（仍固定 `#1f2937`）
- 不改 `textColor` 在 strip 的行為（仍硬編 `#ffffff`）