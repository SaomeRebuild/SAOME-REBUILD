# 2026-10-04 — Step 7 QR Code 工具 master DEV LOG

> 給未來 trace 整條 Step 7 QR Code 鏈的人 single entry point。本檔**不重述每個 commit 的細節**——所有根因 + 修法都在對應 decision / feedback 裡；本檔負責**架構全景 + 跨 commit 的設計 invariant + 給未來 session 的提醒**。

## 一句話總結

把 CardBuilderEditor 的 Step 7 桌牌設計從「5 個工具」擴充為「6 個工具」，新增第 6 個 QR Code 工具：Hook Split Pattern 的 `useQrCode.{ts,web.ts,native.ts}`（RN migration ready）+ Konva `<Group>` + 透明 hit `<Rect>` pattern（與既有 CanvasKonvaImage / CanvasImage 平行）+ 1:1 鎖定（store action + Transformer `keepRatio` + `onTransformEnd` 三層防護）+ JSONB 存「配方」而非 R2 存 PNG + 9 條 backend schema 共享 + Playwright smoke + 8 條 canvas hit-region regression。**跨越 2 個 commit（1f58356 L3 Heavy feature + 53e1da0 hit region regression fix）+ 1 個 follow-up commit（URL alignment, 見隔壁 `1004-prod-url-alignment-workers-dev.md`）**。

## 範圍 vs 其他 Step 工具

| 對比項 | text / image / shape / background（既有） | **qrcode（本檔）** |
|---|---|---|
| 渲染資源 | 用戶上傳 / 純 Konva primitive | **自動生成**（`qrcode` lib → PNG data URL → Konva.Image）|
| 內容可編輯 | 是（text / image）| 否（URL 自動產生 = `${appBaseUrl}/pass/${templateId}`）|
| 數量上限 | 無上限 | **1-per-template**（`MAX_QRCODE_ELEMENTS=1`，store action 拒絕）|
| 比例鎖定 | 自由（image / text）/ locked | **1:1 鎖死**（不可拉伸成非正方形）|
| 顏色客製 | shape 有 fill / stroke | fg + bg 兩色 + 容錯等級 L/M/Q/H |
| 儲存策略 | R2 image key（image 才有）| **JSONB 配方**（不存 R2 — 改色即時重新生成 ~50ms）|
| Hit region | 既有 Round 9 image / Round 11 triangle / Round 12 ellipse pattern | **同 `<Group>` + 透明 `<Rect>` pattern**（Round 9 對齊）|

## 兩條 commit 完整時間軸

> 編號規律：commit 1 是 L3 Heavy feature（24 檔變更），commit 2 是 production 撞到的 regression fix（2 檔變更）。同 session 內迭代。

| Commit | 主題 | 觸發 | 修法 | Decision / Feedback |
|---|---|---|---|---|
| **`1f58356`** | L3 Heavy — QR Code 工具落地 | 桌牌設計需求「桌面上放 QR Code 讓顧客掃碼註冊 Pass」 | Hook Split Pattern 三檔 + qrcode 1-per-template cap + 1:1 鎖定 + CanvasQrCode + Inspector (URL preview + 2 color + EC level) + Toolbar 5→6 + Backend 4-layer schema sync + 9 條 conformance test + Decision Log 函式庫選擇 + Playwright smoke | [decision 2026-10-04-qrcode-library-selection](../runs/decisions/2026-10-04-qrcode-library-selection.md) + [feedback 20261004-step7-qrcode-tool](../runs/improvements/feedback/20261004-step7-qrcode-tool.md) |
| **`53e1da0`** | Hit region regression — QR 加了之後**完全無法被點選** | 使用者：「畫布上的 qr code 不能點選，你可以去看 feedback 文件，之前有解決過這個問題」 | 套 Round 9 image fix pattern：`<Group>` 內第一個 child 加 `<Rect x={0} y={0} width={width} height={height} fill="rgba(0,0,0,0)" />` 作為 hit target，Konva 倒序遍歷 children 找 hit target，事件 bubble 到 Group 的 onClick。Loading / failed 兩條 bare Rect 分支不需動。**8 條 source-level regression test** | [feedback 20261004-step7-qrcode-canvas-hit-region](../runs/improvements/feedback/20261004-step7-qrcode-canvas-hit-region.md) |

## 架構全景

```
Step7TableCard/
├── CanvasQrCode.tsx                ← Konva.Group + KonvaImage + transparent hit Rect（80 行）
├── CanvasQrCode.test.tsx           ← 8 條 source-level structural regression test
├── Step7TableCardToolbar.tsx       ← 5→6 tools + lucide QrCode icon
├── Step7MobileToolbar.tsx          ← 同 toolbar，mobile 同步
├── Step7TableCardInspector.tsx     ← activeTool === 'qrcode' branch：URL preview + 2 color + EC level + cap 狀態
└── Step7TableCard.types.ts         ← ToolKey union 加 'qrcode'

hooks/useQrCode.ts                  ← 主檔（共用 state：status / qrImg / error + 共用 QrToImageFn type）
hooks/useQrCode.web.ts              ← binding：qrcode lib → QRCode.toDataURL → new Image() → HTMLImageElement
hooks/useQrCode.native.ts           ← RN stub：throw NotImplementedError（指向 react-native-qrcode-svg backlog）
hooks/useQrCode.web.test.ts         ← 6 條：編碼 / 4 EC level / 顏色 / CJK / empty reject
hooks/useQrCode.native.test.ts      ← 2 條：throws + error message 含 react-native-qrcode-svg
```

**Cross-module 連接**：
- `CardBuilderEditor.store.ts::addTableCardElement` — QR 1-per-template cap + 1:1 height=width 強制同步
- `Step7TableCardCanvas.web.tsx::renderElementInner` — 加 `qrcode` 分支 + `useMemo` keepSelectedRatio + Transformer `keepRatio` 條件化
- `tableCardElementSchema` (shared) — 加 `'qrcode'` variant + `TableCardQrCodeElement` type alias
- `TemplateSettings.tableCard.elements[*]` (backend db) — 內聯 union 加 `qrcode` variant（Layer 3 schema sync）
- `tableCard.{zh-TW,en}.ts` (i18n) — 加 `tools.qrcode` + `qrcode.*` 11 keys + `selectionBar.typeQrcode` + `layers.elementTypeLabel.qrcode`

## 5 個關鍵設計 invariant

### 1. Hook Split Pattern 三檔（Rule 024）

`useQrCode.ts` 主檔持有 public API（status / qrImg / error + 共用 state）。`useQrCode.web.ts` 持 web-only impl（`QRCode.toDataURL` + `new Image()` 載入 HTMLImageElement）。`useQrCode.native.ts` 持 RN stub（throw NotImplementedError + 指向 `react-native-qrcode-svg` backlog）。

主檔內 import binding：
```ts
const qrToImageImpl: QrToImageFn = qrToImageOnWeb;   // RN 時改 qrToImageOnNative
```

`tsconfig.app.json::moduleSuffixes: ["", ".web", ".native"]` — 順序鐵律：generic `""` MUST be FIRST（Rule 024 § Hook Split Pattern 詳列）。

### 2. 1:1 鎖定的三層防護

| 層 | 程式碼 | 鎖定方式 |
|---|---|---|
| Store | `addTableCardElement({ type: 'qrcode', ... })` 內 `element.height = element.width` | Schema 不接受非 1:1 |
| Transformer | `keepRatio={selectedElement?.type === 'qrcode'}` | Konva drag-to-resize 強制等比例 |
| `onTransformEnd` | `Math.max(newWidth, newHeight)` 取大值 | 即使前兩層失守，第三層仍鎖定 |

**任何一層失守 = use case 失效**（QR 掃不出來）。三層並存是 defense-in-depth。

### 3. JSONB 存「配方」不存 R2 PNG

| 方案 | 優點 | 缺點 | 採納 |
|---|---|---|---|
| A. JSONB 存 recipe（value + fgColor + bgColor + ecLevel）| 改色即時 regenerate ~50ms，0 R2 寫入 | 需要前端每次重新編碼 | ✅ |
| B. R2 cache PNG | R2 CDN cache 加速 | +R2 寫入 + cleanup + 顏色變更後要 invalidate | ❌ |
| C. Backend 預生成 endpoint | 後端 single source of truth | +backend endpoint + HTTP round-trip + 改色等 server | ❌ |

**配套**：
- `useQrCode` React state 快取跨 re-render 保留（避免重複編碼）
- `removeTableCardElement` 不需 fire R2 cleanup
- `r2OrphanCleanup` cron 不掃 QR 元素（只掃有 `imageKey` 的 image 元素）
- `removeTableCardElement` 同時 `setTableCardElements` 走既有 JSONB merge（跟 image variant 一致）

### 4. CanvasQrCode Hit Region Pattern（與 CanvasImage 平行）

`<Group>` 持有 id + drag/transform events，內部：
- `<Rect x={0} y={0} width={width} height={height} fill="rgba(0,0,0,0)" />` ← hit target
- `<KonvaImage image={qrImg} listening={false} />` ← 純視覺

**為什麼 transparent Rect 必須**：Konva.Group 的 hit detection 規則 = 所有 listening children 的 union。Konva.Image 設 `listening={false}` 後沒有 hit region → 點擊 fall through 到 Stage → `onMouseDown` 清掉 selection。Transparent Rect 提供矩形 hit region。

**8 條 source-level regression test**（`CanvasQrCode.test.tsx`）直接讀原始碼 + regex 驗證結構，jsdom 沒有 canvas context 跑不了真實 hit detection，但 structural assertion 對「不寫了就壞」的 fix 已經夠用。

### 5. Production URL Alignment（見隔壁 DEV LOG）

`useQrCode` 編碼的 URL = `${appBaseUrl}/pass/${templateId}`。`appBaseUrl` 在 production 從 `saome-frontend.pages.dev` 改為 `saome-frontend.josh1989213.workers.dev`（Worker + assets binding 取代 Pages hosting）。**3 處必同步**：
- `apps/backend/wrangler.jsonc::ALLOWED_ORIGINS` 加新 origin（Layer 1 CORS）— 此 commit
- `apps/frontend/.env.production::VITE_APP_BASE_URL` 改 workers.dev — 此 commit
- `apps/frontend/src/config/env.ts::appBaseUrl.default` 改 workers.dev — 此 commit

**Layer 3**（`runtimeCors.ts::RUNTIME_ALLOWED_HOSTS`）早已有 `saome-frontend.josh1989213.workers.dev`（9/7 commit `7935de8` 開 Worker-level CORS 時就列入）。

詳見隔壁 `1004-prod-url-alignment-workers-dev.md`。

## 失敗紀錄 / 教訓

| 項目 | 影響 | 修法 |
|---|---|---|
| **1. jsdom `Image.onload` 對 data: URL 不 fire** | hook 8 個測試 5 個 timeout | 改 mock `qrcode` lib + patch `HTMLImageElement.prototype.src` setter 觸發 onload |
| **2. PREVIEW_SCALE 初始位置** | shared typecheck fail (used before declared) | 從 `DEFAULT_QRCODE_*_MM` 之前移到 `PREVIEW_HEIGHT_PX` 之後，JS const hoisting TDZ |
| **3. duplicate import (canvas)** | typecheck fail (Duplicate identifier) | 移除 `import { PREVIEW_SCALE }` 重複行，留註解指向上方 shared import block |
| **4. `vi.mocked(QRCode.toDataURL)` 型別推導** | typecheck fail (Mock<void, []> not assignable from string) | 改用 `as unknown as ReturnType<typeof vi.fn>` cast |
| **5. Step7MobileToolbar.test.tsx hasLength(5) 期望舊 5 tools** | 1 test fail | 改為 `hasLength(6)` + 加 QR tool 顯式斷言 |
| **6. rotation 邊界測試用 [0, 360) 嚴格不等** | 1 test fail (zod .max(360) 是 inclusive) | 改為 [0, 360] inclusive，加註解說明 |
| **7. CanvasQrCode Group 漏 transparent Rect** | 使用者完全無法點選 QR | 套 Round 9 image pattern，加 `<Rect fill="rgba(0,0,0,0)" />` + 8 條 source-level test |

## 跟既有 rule 對齊

| Rule | 對齊方式 |
|---|---|
| `000 § A.3` Hook Extraction Strategy | 不適用（純 rendering fix） |
| `000 § A.2` 主組件 ≤ 100 行 | CanvasQrCode 主組件 ~80 行 OK |
| `011` 開發紀錄規範 | 本檔 + feedback 同 commit，commit footer 帶 Self-improvement 標記 |
| `016` Config & tsconfig | 9 surface 全同步（package.json + lockfile + shared constants + tsconfig）|
| `019 § 4.1` Schema Contract Drift | 4-layer 同步（shared → backend request → backend db interface → service）|
| `022` Component Reuse | 沿用 `useImage` pattern 設計 `useQrCode`（同 Hook Split Pattern 三檔結構）|
| `023` Shared Package | i18n 在 `tableCard` namespace（不另開）+ `PREVIEW_SCALE` 升 shared 為 single source of truth |
| `024 § Hook Split Pattern` | useQrCode 三檔結構（main + .web + .native）+ `moduleSuffixes: ["", ".web", ".native"]` 順序鐵律 |
| `025` Vibe Coding L2 Checklist | 已有 source-level test + i18n + schema 4-layer + smoke test，commit footer 帶 Self-improvement 標記 |
| `006` 完工前驗證 | typecheck / lint / test / vitest / coverage 8 項驗證全綠 |
| `036` Worker Runtime CORS | deploy 後必跑 curl OPTIONS / POST 矩陣（Rule 017 § backend Worker CORS post-deploy check）|
| `013` Popover Sizing | QR 變體無 popover（不像 ColorPicker / StampPicker），不適用 |

## 驗證輸出（commit `1f58356` + `53e1da0` + working tree）

| 項目 | 結果 |
|---|---|
| `npx tsc -b --noEmit` (frontend + backend + shared) | ✅ exit 0 |
| `npm run lint --workspace=apps/frontend` | ✅ exit 0 (warnings only) |
| Unit + integration tests (frontend) | ✅ 1726/1726 across 134 files |
| Unit + integration tests (backend) | ✅ 412/412 across 28 files |
| i18n verify (`npm run verify:i18n`) | ✅ 19 namespace(s) passed (38 locale files) |
| `npm run build` (production bundle) | ✅ 1.49 MB JS gzipped 417 KB |
| Lockfile binding audit (Rule 016 § surface 8) | ✅ 8/8 critical native bindings |
| Backend `npm test` | ✅ 412 tests passed |
| Smoke test `card-builder-step7-qrcode.spec.ts` | ✅ Playwright end-to-end |

## 後續 TODO（本 PR 不在 scope）

- [ ] 監控 `qrcode` lib 是否有後續大版變動（若 `toDataURL` API 改動，hook 介面要跟著改）
- [ ] 若要做「QR scan analytics」（區分不同桌牌掃了幾次），需要改成每張桌牌生成 unique signed URL
- [ ] RN 化時切換到 `react-native-qrcode-svg`（~+15KB native bundle）— 已留 native stub 指引
- [ ] 監控 production bundle 大小（現 1.49 MB → 417 KB gzip），接近 500 KB warning 門檻；後續可用 dynamic import 拆分 qrcode
- [ ] 評估是否抽 `KonvaImageWithHitRegion` 共用 component（Rule 000 § A.2：避免相同 pattern 重複出現）。目前 2 個 variant（image + qrcode），抽 helper 投資報酬率待觀察
- [ ] 加 `tag:hit-region` 機制到 `runs/improvements/INDEX.md`，把 Round 9 + 這次 fix 串起來

## 自我反省 / 給未來 session

1. **pattern 複製沒有自動化保證** — Round 8/9 image fix 是 5 行程式碼（`<Group><KonvaImage listening={false} /><Rect fill="rgba(0,0,0,0)" /></Group>`），1 個月後的 QR 變體在套 pattern 時漏了最後 3 行。**未來怎麼避**：`CanvasQrCode.test.tsx` 一上線就建（成本極低但能把 pattern drift 鎖死）。教訓 1 已進 `feedback 20261004-step7-qrcode-canvas-hit-region.md`。

2. **bug 報告指紋對齊很有用** — 使用者回報「畫布上的 qr code 不能點選，你可以去看 feedback 文件，之前有解決過這個問題」是個**完美**的 bug report — 症狀、歷史 fix、檔案指紋全有。能把 Round 9 feedback 撈出來 + 對比新 code 是 5 分鐘的事（grep `fill="rgba(0,0,0,0)"` + 對比 `CanvasQrCode.tsx` 跟 `CanvasKonvaImage` 的差異）。**未來怎麼強化**：rule 011 已經要求 feedback 同 commit，但使用者層的「這之前修過」指紋目前要靠人工 grep。可以考慮加一條 `runs/improvements/INDEX.md` 的 tag 系統。

3. **Rule 024 的 `.web.ts` / `.native.ts` 沒擋到 bug** — `useQrCode` 是 Hook Split Pattern 沒錯，但 `CanvasQrCode` 本身是 web-only（透過 import `react-konva`），所以**不需要** Hook Split Pattern 三檔。問題是 CanvasQrCode 是「用 web-only API 的 component」而不是「用 web-only API 的 hook」。**Rule 024 規範了 hook split，但沒規範 component 層級的 web-only 隔離**。Konva 整個 binding 是 web-only，但 component 用 Konva 沒被 flag。**未來怎麼強化**：當 component 直接 import `react-konva` / `konva` 時，應該在檔頭加 `@web-only` JSDoc tag（或依 Rule 024 抽 `CanvasQrCode.web.tsx` / `CanvasQrCode.native.tsx` 雙檔）。本 fix 沒加是因為這是既有架構問題（所有 Step 7 canvas component 都用 react-konva）→ 留到後續重構。

4. **Production URL 對齊是 QR Code 功能的隱性前置作業** — `useQrCode` 編碼的 URL 取自 `appBaseUrl`，這個值從 dev 環境看起來無害（localhost:5173），但 production 必須對齊 backend CORS allow-list + runtime CORS allow-list。**3 處必同步的 SOP 應該寫進 rule 036 § 4 同步責任 SOP**。本 commit 把這三處對齊補完了，但沒有單獨 rule 文檔化這個 SOP。

## 跨鏈

- **Decision Log**: [runs/decisions/2026-10-04-qrcode-library-selection.md](../runs/decisions/2026-10-04-qrcode-library-selection.md)
- **Feedback 主檔**: [runs/improvements/feedback/20261004-step7-qrcode-tool.md](../runs/improvements/feedback/20261004-step7-qrcode-tool.md)
- **Feedback hit-region regression**: [runs/improvements/feedback/20261004-step7-qrcode-canvas-hit-region.md](../runs/improvements/feedback/20261004-step7-qrcode-canvas-hit-region.md)
- **Production URL alignment 隔壁 DEV LOG**: [DEV/10-2026/1004-prod-url-alignment-workers-dev.md](1004-prod-url-alignment-workers-dev.md)
- **INDEX**: [runs/improvements/INDEX.md](../runs/improvements/INDEX.md)（已有 2 條 QR Code 條目 + 本檔新增 1 條 URL alignment 條目）
- **既有 reference**: `0927-step7-table-card-master-dev-log.md` — Step 7 桌牌設計前 10 個 round 的 master log，本檔是 QR Code 變體的 master log

## Self-improvement action items

| Action | Owner | Trigger | Status |
|---|---|---|---|
| commit 規範層/操作層 5 個檔（2 feedback + 1 decision + 2 dev log + 1 INDEX 條目）| Self | 立即 | ⏳ pending（本 commit 內帶）|
| deploy 後跑 Rule 036 + 017 CORS post-deploy check（curl OPTIONS / POST 矩陣）| User | push 完成後 | ⏳ pending |
| `wrangler tail --format pretty` 觀察 5 分鐘驗 cron 仍正常跑 | User | push 完成後 | ⏳ pending |
| QR Code production smoke test（`tests/smoke/card-builder-step7-qrcode.spec.ts`）實際 deploy 驗證 | User | push 完成後 | ⏳ pending |
| 評估抽 `KonvaImageWithHitRegion` 共用 component（2 → 3 個 variant 出現時再做）| Future | 第三個 hit-region-variant 出現 | ⏳ pending |
| 評估 Rule 024 補「component 層級 web-only 隔離」段落 | Future | 下次 Step 7 重構 | ⏳ pending |

---

> 撰寫者：cursor (assisted) ｜ 時間：2026-10-04 05:30 UTC+8
>
> 本 DEV LOG 與 feedback `runs/improvements/feedback/20261004-step7-qrcode-tool.md` + `20261004-step7-qrcode-canvas-hit-region.md` + decision `runs/decisions/2026-10-04-qrcode-library-selection.md` 同源；本檔補既有 docs 沒有的「跨 commit 架構全景」「5 條 design invariant」「自我反省」四段。