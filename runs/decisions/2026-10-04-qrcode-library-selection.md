# Decision: Step 7 桌牌設計 QR Code 工具 — 函式庫選擇

## 背景

Step 7 桌牌設計的 use case 包含「桌面上放 QR Code 讓顧客掃碼註冊 Pass」。這需要**即時生成 QR Code 圖片**並渲染到 Konva 畫布上，再隨整張桌牌匯出為印刷用的 PNG。

需求：

1. 即時生成（~50ms/次），不可接受 async-heavy 或 1s+ 延遲
2. TypeScript 一級支援（type-only 引用要能編譯）
3. workerd / Vite / Cloudflare Pages 全部相容（前端 bundle 不能因此 build fail）
4. React Native 化時（Rule 024）要能乾淨分離，目前只 web 需要
5. 不希望 +bundle 過大（理想 < 30KB gzip）
6. 已 grep 確認 repo 內**無**既有 QR 函式庫

確認過的設計約束（[DEV/10-2026 DEV LOG] + 使用者 Brainstorming 確認）：

- QR 編碼值是固定 URL `${appBaseUrl}/pass/${templateId}`，**不**由使用者編輯
- QR PNG **不單獨存 R2**（見 runs/decisions/2026-10-04-step7-qrcode-storage-strategy 對應 § 1.5 段）
- 1 模板上限 1 個 QR
- 鎖 1:1 比例，可調 fg/bg 色

## 選項與決定

### 函式庫選擇

- **選項 A**：`qrcode` (npm) + `@types/qrcode`
- **選項 B**：`qrcode-generator`
- **選項 C**：自寫 matrix encoder
- **決定**：**選項 A**（`qrcode` + `@types/qrcode`）

理由對照：

| 維度 | A. `qrcode` | B. `qrcode-generator` | C. 自寫 |
|---|---|---|---|
| TypeScript 一級支援 | ✅ `@types/qrcode` | ❌ 無 official type | — |
| `toDataURL` 一行 API | ✅ 直接給 PNG data URL | ❌ 須自己畫 Canvas | — |
| workerd / Vite 相容 | ✅ 純 JS，無 native binding | ✅ 純 JS | — |
| Bundle size | +~20KB gzip | +~10KB gzip | 0 |
| Maintenance | 活躍（v1.5.4, 2024 更新）| 半維護（最後 release 2017）| 自家負擔 |
| 容錯等級 API | ✅ `errorCorrectionLevel: 'L'\|'M'\|'Q'\|'H'` | ✅ 但 signature 較原始 | — |
| 配色 API | ✅ `color: { dark, light }` | ❌ 須自己 iterate matrix 填色 | — |

選項 A 的 `toDataURL(text, opts)` API 最合 fit — 一行給 PNG data URL，直接餵 `new Image()` 載入成 HTMLImageElement 給 Konva.Image 用。選項 B 雖然 bundle 較小但失去 type safety + 配色 API 麻煩；選項 C 開發成本跟長期維護完全不划算。

### Hook Split Pattern 結構

依 Rule 024 § Hook Split Pattern（`.web.ts` / `.native.ts` 雙檔結構，TS `moduleSuffixes: ["", ".web", ".native"]`）：

- `useQrCode.ts`（共用）— `useState` + `useEffect`，跟 `useImageCrop.ts` 同構；export hook 給 consumer import
- `useQrCode.web.ts`（binding）— `import QRCode from 'qrcode'` + `QRCode.toDataURL` + `new Image()` 載入成 HTMLImageElement
- `useQrCode.native.ts`（binding stub）— `throw new Error('[useQrCode.native] ... See RN migration backlog (use react-native-qrcode-svg).')`

> RN 化時把 `useQrCode.ts` 內的 `const qrToImageImpl = qrToImageOnWeb` 改為 `qrToImageOnNative` 即可；用 `react-native-qrcode-svg` 取代 `qrcode` lib。

### QR PNG 儲存策略（cross-reference § 1.5）

- **不存 R2**（明確決定）— JSONB 存「配方」`(value, fgColor, bgColor, ecLevel, x, y, w, h, rotation, zIndex)`，瀏覽器記憶體存 HTMLImageElement，整張桌牌匯出 PNG 自動含 QR
- 不在 `TableSettings` interface 加 `qrcodeR2Key` 欄位
- `removeTableCardElement` 不需 fire R2 cleanup
- `r2OrphanCleanup` cron 不掃 QR 元素（只掃有 `imageKey` 的 image 元素）

## 影響

| 既有系統 | 影響 |
|---|---|
| `apps/frontend/package.json` | dependencies 加 `qrcode@^1.5.4` + `@types/qrcode@^1.5.5` |
| `package-lock.json` | `npm install --include=optional --workspaces apps/frontend` 重生成，確認 Linux x64 binding 完整（Rule 016 § surface 8）|
| `apps/frontend/src/hooks/` | 新建 `useQrCode.ts` + `.web.ts` + `.native.ts` 三檔 |
| Konva 畫布 | 引入 `CanvasQrCode` 子組件，吃 `useQrCode` 輸出 |
| `addTableCardElement` | 新增 QR 1-per-template cap + 強制 1:1 height=width |
| `tableCardElementSchema` | 新增 `'qrcode'` 變體 |
| `ToolKey` union | 從 5 tool 擴充為 6 tool（`+ 'qrcode'`）|
| i18n | `tableCard.{zh-TW,en}.ts` 加 `tools.qrcode` + `qrcode.*` 11 個 key |
| Backend `TemplateSettings` | 內聯 union 加 `qrcode` variant |
| Schema conformance test | 加 `qrcode variant conformance` describe block |
| Test 新增 | unit (`useQrCode.test.ts` + `.native.test.ts`) + integration (3 條 store + 1 條 canvas + 1 條 toolbar + 1 條 inspector) + smoke (1 條 Playwright) |

## 後續

- 監控 `qrcode` lib 是否有後續大版變動（`toDataURL` API 改動的話 hook 介面要跟著改）
- 若後續要做「QR scan analytics」（區分不同桌牌掃了幾次），需要改成每張桌牌生成 unique signed URL（不在本次 scope）
- RN 化時切換到 `react-native-qrcode-svg`，預期 +~15KB native bundle size
