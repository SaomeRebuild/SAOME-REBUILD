# LogoUploader P0+P1 Refactor + Rule Sedimentation（Aug 30）— 從症狀層走到結構層，再到規範層

## Metadata

- **日期**：2026-08-30
- **作者**：Cursor Agent + Josh
- **branch**：`fix/card-builder-migration`
- **規則 / skill 觸發**：`saome-dev-logging`、`saome-image-upload`、`saome-task-router`（L2 Standard）、Rule 028 / 023 / 024 / 000 / 029
- **commit 範圍**（未提交，準備一次 commit + push）：
  - 生產代碼：13 修改 + 14 新增（含 7 個 LogoUploader sub-component、useImageCrop 平台分流、shared/ 抽離）
  - 規範文件：5 個 rule 改（028 § 13/14、024 Hook Split、000 A.3、023 Shared Validation i18n Key）+ 1 個 SKILL 擴充
  - DEV LOG：本檔

---

## 背景

今天（2026-08-30）兩條 thread 並行：

1. **Thread A**：使用者回報「上傳 Logo 後兩張預覽圖（PassCardPreviewHeader 跟 LogoUploader）都不即時更新，要 F5 才看到」
2. **Thread B**：使用者回應「可是現在兩張預覽圖都可以被及時更新了，沒有你說的問題啊」之後，發現 LogoUploader 主組件 887 行過大、純邏輯沒進 shared/、沒準備 RN 化

兩個 thread 表面獨立，但**根因都指向「規範層缺口」**——今天之前的 codebase 沒有任何 rule 規範 image cache busting、hook 平台分流、shared validation i18n key 等 pattern，導致每次新 uploader / hook / shared validation 都要從零決策。

本 DEV LOG 紀錄從「症狀層」（圖沒更新）走到「結構層」（P0+P1 重構）再到「規範層」（4 個 rule 補完）的完整循環。

---

## Round 1（下午）— Image Preview Stale 診斷

### 症狀

```
使用者回報：
- 上傳 logo 後，PassCardPreviewHeader 跟 LogoUploader 兩張預覽圖不即時變
- F5 或重新進入 CardBuilder 才看到新圖
```

DOM 檢查發現兩個 `<img>` 都有 `src="/api/cards/{id}/image/logo?token=..."`，URL 完全沒變。

### 根因（兩層）

| 層 | 設定 | 影響 |
|---|---|---|
| Backend `Cache-Control` | `public, max-age=31536000`（1 年）| 圖片端點永久 cache |
| Backend R2 檔名 | 固定 `{tenantId}/{cardId}/issuerLogo.png` | 上傳覆蓋同 key，URL 不變 |
| Frontend URL | 無 version | 三層 cache 都 return 舊檔 |

使用者**不**希望改動多租戶資料命名（避免同一卡片模板被新上傳圖塞爆 R2），所以保留固定檔名。

### 修法：時間戳記 query param

保留固定檔名 + 1 年 cache，在 frontend URL 加 `&v=${Date.now()}` query param 強制 bust cache。

實作：

```typescript
// apps/frontend/src/components/business/dashboard/CardBuilderEditor/CardBuilderEditor.store.ts
issuerLogoVersion: 0,
setIssuerLogo: (issuerLogo) => set({ issuerLogo, issuerLogoVersion: Date.now() }),

// PassCardPreviewHeader.tsx + LogoUploader.tsx + TemplateCardPreview.tsx
const logoUrl = `${api.baseUrl}${api.paths.cardImage(templateId, 'logo')}?token=...&v=${issuerLogoVersion}`;
```

效果：兩張預覽圖在 upload 完成 callback 觸發 `setIssuerLogo(key)` 時自動 bump version，URL 改變 → cache bust → 重新 fetch。

> **使用者驗證回饋**：「可是現在兩張預覽圖都可以被及時更新了，沒有你說的問題啊」——確認 fix 成功。

### 為什麼時間戳記 OK

- **R2 不浪費空間**：同 key 覆蓋，無 UUID 增殖
- **Cache 友善**：1 年 max-age 不變，version 只在 upload 後 bump
- **DB key 不 drift**：仍是固定 key，DB 端無變更
- **多租戶隔離維持**：每租戶自己的 `{tenantId}/{cardId}` 前綴

---

## Round 2（下午）— RN 化討論（query token vs cookie）

### 觸發

時間戳記修完後，使用者提問：

> 「為了以後推出 React Native 版本，現在這些圖片預覽需要先從用 token 認證，改成 cookie 嗎?」

### 選項評估

| Auth 方案 | `<img src>` (web) | `<Image source>` (RN) | Cache 友善 | 實作成本 |
|---|---|---|---|---|
| `Authorization: Bearer` header | ❌ 不送 header | ⚠️ 需手動設 header | N/A | 中 |
| **`?token=JWT` query param（✅ 採用）** | ✅ 自動 | ✅ 自動 | ✅ | **低** |
| Cookie (`HttpOnly + SameSite=Lax`) | ⚠️ CORS `credentials: 'include'` | ⚠️ RN 預設不送 | ✅ | 中 |
| R2 Presigned GET URL (TTL) | ✅ | ✅ | ✅ | 高 |

### 決策：保留 query token

理由：

- `<img src>` 跟 RN `<Image>` 都**不送 Authorization header**（瀏覽器/RN 自動 fetch 才送）
- Query token 是唯一「兩邊都自動送」的方案
- Token 有效期 1 年（登入體驗），query string 暴露風險可控
- 切 cookie 會犧牲 cacheability（cookie-based request 通常不走 edge cache）

**結論**：保留 query token，**不**為 RN 化切換 auth 策略。

---

## Round 3（下午）— LogoUploader 主組件 887 行 audit

### 觸發

使用者回應「圖片預覽可以及時更新了」後，下一個需求浮現：

> 「現在請觀察整個 LogoUploader，有沒有必要為了之後的 RN 化作出什麼改善?」

### 觀察

| 項目 | 當前狀態 | RN 化風險 |
|---|---|---|
| `LogoUploader.tsx` 行數 | **887** | 嚴重超過 L2 100 行上限 |
| 純邏輯位置 | inline 在 component | 無法 RN 共用 |
| `useImageCrop.ts` cropImage() | 用 `document.createElement('canvas')` | RN 沒有 `document` |
| Sub-component 拆分 | 全部 inline 在主組件 | 測試難寫 |
| Shared validation | 沒抽出 | web/RN 各寫一套 |

### 決定走 P0 + P1 合併重構

#### P0（cache busting + RN 化準備）

1. **`useImageCrop` 平台分流**：拆成 `.web.ts` / `.native.ts` 雙檔結構
2. **`tsconfig.app.json` 加 `moduleSuffixes: [".web", ".native", ""]`**：讓 Vite / tsconfig 正確 resolve
3. **純邏輯搬到 `packages/shared/logic/imageCrop.ts`**：`validateLogoFile` / `applyScaleChange` / `computeSrcSquareSize`
4. **shared types 抽離**：`FileLike` / `ValidationError` / `CropState` 到 `packages/shared/types/imageCrop.ts`
5. **shared constants 抽離**：`LOGO_CROP_CONFIG` / `MAX_FILE_SIZE` 到 `packages/shared/constants/crop-interaction.ts`
6. **`validateLogoFile` error message 改 i18n key**：`'logoUpload.validation.tooLarge'` 而非 raw text

#### P1（sub-component 拆分）

7. **LogoUploader.tsx 887 → 394 行**：拆出 7 個 sub-component
   - `UploadPrompt`（初始提示）
   - `LogoPreview`（裁切前預覽）
   - `CropStage`（裁切舞台 + drag logic）
   - `ScaleControl`（scale slider）
   - `CropActions`（套用/取消按鈕）
   - `UploadError`（錯誤訊息）
   - `UploadingIndicator`（上傳中 spinner）

#### Hook Split Pattern（重要！）

`useImageCrop` 拆成三檔：

```
hooks/
├── useImageCrop.ts          ← 共用 state：useState, useCallback, loadImage, setFocalPoint
├── useImageCrop.web.ts      ← cropImage() 用 Canvas API（web-only）
└── useImageCrop.native.ts   ← cropImage() stub（throw NotImplementedError，待 RN 實作）
```

`.native.ts` 必須 throw 而非 silent stub：

```typescript
// useImageCrop.native.ts
export const cropImageOnNative: CropImageFn = (): Promise<Blob> => {
  throw new Error(
    '[useImageCrop.native] cropImage() not yet implemented on React Native. ' +
    'See RN migration backlog (use react-native-image-crop-picker).'
  );
};
```

理由：silent stub（`return null`）→ RN runtime 看到神秘的 canvas error 而 stack 混亂；throw → 開發者立即看到清楚訊息。

#### `FileLike` interface（跨平台檔案物件）

```typescript
// packages/shared/types/imageCrop.ts
export interface FileLike {
  type: string;
  size: number;
}
```

Web `File` 與 RN native picker 都 conform 這個介面。**禁止**在 shared/ 內 import `File` from DOM lib。

---

## Round 4（下午）— Rule 沉澱（規範層）

### 觸發

P0+P1 重構完成後，使用者回應：

> 「我們做了個出色的行動，重一開始的時間戳記，到後面的 P0 P1 的 RN 化準備，有沒有必要修改或新增的 SKILL 或 rule?」

### 識別的規範缺口

這次 session 踩到 5 個**未在任何 rule/skill 內記載**的 pattern / 決策：

| 缺口 | 後果 |
|---|---|
| Image cache busting 沒 rule | 下次新 uploader 一定忘 `?v=` query param |
| Hook split for RN 化沒 rule | Vite + tsconfig 設定細節漏，下次 hook 永遠踩雷 |
| Mega-component 拆分順序沒 rule | LogoUploader.tsx 887 → 394 是對的順序，但沒寫成鐵律 |
| i18n key in shared validation 沒 rule | 下次 `validateEmail` / `validatePassword` 會重蹈「該不該回 raw text」決策循環 |
| Image auth 策略決策沒 rule | RN 化實際執行時一定會重新辯，浪費 1-2 小時 |

### 規範修改（5 個 rule + 1 個 SKILL）

| Rule | 新增章節 | 防的坑 |
|---|---|---|
| Rule 028 § 13 | **Image Cache Busting** | 「上傳後圖沒變」+ UUID 檔名浪費 R2 空間 |
| Rule 028 § 14 | **Image Auth Strategy** | RN 化時重新辯 cookie vs token vs signed URL |
| Rule 024 | **Hook Split Pattern（`.web.ts` / `.native.ts`）** | 主檔 import web-only API / RN runtime canvas error |
| Rule 000 A.3 | **Hook Extraction Strategy（>500 行元件）** | 800+ 行元件直接拆 sub-component 造成 props 爆炸 |
| Rule 023 | **Shared Validation i18n Key** | shared validation 回 raw text 綁死單一語言 |
| SKILL `saome-image-upload` | 擴充 Hook Split Pattern 範例 | 跟 Rule 024 同步 |

零 production code 變動，純規範文件沉澱。

---

## 變更統計（本 commit）

### 生產代碼（27 個檔案）

| 類型 | 數量 | 範例 |
|---|---|---|
| 修改既有檔 | 13 | `LogoUploader.tsx`（-56%）、`useImageCrop.ts`、`CardBuilderEditor.store.ts`、`getImage.ts` |
| 新建檔 | 14 | 7 個 sub-component、2 個 platform binding、5 個 shared/ 檔案 |
| 刪除檔 | 1 | `apps/frontend/src/hooks/useImageCrop.test.ts`（邏輯搬到 shared/） |
| 新測試 | 8 | `imageCrop.test.ts` 覆蓋 shared logic |

### 規範文件（5 個 rule + 1 個 SKILL）

| 檔案 | 新增行數 | 章節 |
|---|---|---|
| `.cursor/rules/028-image-uploader-pattern.mdc` | +159 | § 13 + § 14 |
| `.cursor/rules/frontend/024-mobile-future-proof.mdc` | +134 | Hook Split Pattern + tsconfig + FileLike |
| `.cursor/rules/000-modular-design.mdc` | +75 | A.3 Hook Extraction Strategy |
| `.cursor/rules/frontend/023-shared-package.mdc` | +79 | Shared Validation i18n Key |
| `.cursor/rules/frontend/029-image-crop-mobile-ux.mdc` | +3 | cross-reference 補強 |
| **總計** | **+450 行 rule** | |

---

## 為什麼這次結構是對的

```
症狀層：圖不更新、887 行太大、shared/ 沒抽乾淨
  ↓ 結構層：時間戳記 + P0+P1 重構
    ↓ 規範層：4 個 rule + 1 個 SKILL
```

每一層解決上一層**無法持久化**的問題：

| 層 | 解決什麼 | 持續性 |
|---|---|---|
| 症狀層 | 立即 user complaint | 一次性 |
| 結構層 | 把 code 搬到正確位置 | 程式碼還在，但下次新 uploader 仍會犯 |
| **規範層** | **下次新 uploader / hook / shared validation 自動遵守** | **永久** |

這個「症狀 → 結構 → 規範」三層遞進，是今天 session 最關鍵的 insight。

---

## Cross-cutting Pattern：五個新 pattern 的內在邏輯

這次沉澱的五個 pattern 都指向同一個方向：**RN 化預先準備**。

| Pattern | RN 化角色 |
|---|---|
| Cache busting | RN `<Image>` cache 行為不同，但 URL versioning pattern 不變 |
| Image auth (query token) | RN `<Image>` 不送 Authorization header，query token 兩邊通用 |
| Hook split | RN 化時主檔零修改，只換 binding |
| Shared validation i18n key | RN 跟 web 共用同一組 key，零 platform 分支 |
| Hook extraction | 大元件拆 sub-component 後，RN 化時 sub-component 也容易移植 |

下次真正做 RN 化時，所有「換成 RN 需要改什麼？」的答案都是「**只改 platform binding（`.native.ts` / RN-specific 元件），業務邏輯零成本遷移**」——這正是 SAOME 為未來 RN 化預先準備的目標。

---

## 衍生

### 已實作

- ✅ Image cache busting（時間戳記 query param）
- ✅ Query token auth 策略確認保留
- ✅ `useImageCrop` 平台分流（`.web.ts` / `.native.ts` + tsconfig moduleSuffixes）
- ✅ 純邏輯搬到 `packages/shared/logic/imageCrop.ts`
- ✅ Shared types 抽離（`FileLike` / `ValidationError` / `CropState`）
- ✅ Shared constants 抽離（`LOGO_CROP_CONFIG` / `MAX_FILE_SIZE`）
- ✅ `validateLogoFile` error message 改 i18n key
- ✅ LogoUploader 主組件 887 → 394 行（拆 7 個 sub-component）
- ✅ 4 個 rule + 1 個 SKILL 沉澱新規範

### 待寫（backlog — 不在本 commit 內）

- [ ] `runs/improvements/feedback/20260830-logo-image-cache-busting.md`（rule 028 § 13 引用「待寫」）
- [ ] `runs/decisions/2026-08-30-image-auth-strategy-query-token.md`（rule 028 § 14 引用「待寫」）
- [ ] `runs/improvements/feedback/20260830-use-image-crop-platform-split.md`（rule 024 Hook Split 引用「待寫」）
- [ ] `runs/improvements/feedback/20260830-logouploader-887-line-refactor.md`（rule 000 A.3 引用「待寫」）
- [ ] `runs/improvements/INDEX.md` 加這次 session 的 row + done 條目（本 DEV LOG 同 commit 帶入）

### 已寫進 rules / skills

- Rule 028 § 13 Image Cache Busting（NEW）
- Rule 028 § 14 Image Auth Strategy（NEW）
- Rule 024 Hook Split Pattern + tsconfig + FileLike（NEW）
- Rule 000 A.3 Hook Extraction Strategy（NEW）
- Rule 023 Shared Validation i18n Key（NEW）
- Rule 029 cross-reference 補強
- SKILL `saome-image-upload` Hook Split Pattern 範例擴充

### 不在今天 scope（pending）

- BackgroundUploader（800×800 crop）— 沿用 Rule 028 § 11 / § 12 / § 13 / § 14
- IconUploader（256×256 crop）— 同上
- 真正 RN 化時實作 `cropImageOnNative`（目前 stub throw NotImplementedError）
- Layout chain `viewportW - X` 紀律（Rule 013 RWD 待補）

---

## 自問

### Q1：為什麼時間戳記 OK 但 UUID 檔名不好？

A：兩者都能讓 cache 失效，但 R2 商業成本不同：
- **時間戳記**：固定檔名覆蓋，R2 物件數不變，cache 命中率高（1 年 max-age 內大部分 request 走 edge cache）
- **UUID 檔名**：每次上傳新增物件，R2 物件數隨時間線性成長；DB key 容易 drift（user 換瀏覽器看到舊圖）；同一卡片模板的歷史圖片永遠在 R2

時間戳記是**最低商業成本 + 最高 cache 友善**的解。

### Q2：為什麼不切 cookie auth？

A：`<img src>` 跟 RN `<Image>` 都**不送 Authorization header**。改 cookie 需要：
- web `<img>` 加 `credentials: 'include'`（CORS preflight 變複雜）
- RN `<Image>` 用 native fetch 套 cookie（RN 預設不送）

Query token 是唯一「兩邊都自動送」的方案。切 cookie 的實作成本遠超維持現狀。

### Q3：為什麼 `useImageCrop` 必須拆三檔而非兩檔？

A：如果只拆 `.web.ts` / `.native.ts` 兩檔，共用 state（`useState`, `useCallback`, `loadImage`, `setFocalPoint`）必須重複寫兩次 → drift 起點。
主檔保留共用 state，`.web.ts` / `.native.ts` 只負責 platform-specific 的 `cropImage()` 實作，是最少重複 + 最明確分流的結構。

`.native.ts` 必須 throw 而非 silent stub 的理由：silent stub（return null）→ RN runtime 看到神秘的 canvas error 而 stack 混亂；throw → 開發者立即看到清楚的「not yet implemented」訊息，並指向 backlog。

### Q4：為什麼 `validateLogoFile` 必須回 i18n key？

A：shared validation 在 web 跟 RN 共用，但兩邊 i18n lib 不同（web 用 `react-i18next`，RN 可用 `react-i18next` 或 `i18n-js`）。如果 validation 回 raw text `'檔案過大'`：
- web 端寫死中文
- RN 端必須重寫另一套英文 / 繁中
- 兩邊永遠不會同步

回 i18n key `'logoUpload.validation.tooLarge'`：
- shared 提供 contract（key 字串）
- web / RN 各提供翻譯（`logoUpload.zh-TW.ts` / `logoUpload.en.ts`）
- 零 platform 分支，未來加語言也是零成本

### Q5：今天最關鍵的 insight 是什麼？

A：**「症狀 → 結構 → 規範」三層遞進**。

| 層 | 持續性 |
|---|---|
| 症狀層 | 一次性（修了就消失） |
| 結構層 | 程式碼還在（但下次新需求仍會犯同樣錯） |
| **規範層** | **永久（下次自動遵守）** |

今天的 session 完美演示了這個三層遞進：圖沒更新（症狀）→ 時間戳記 + 重構（結構）→ 4 個 rule 沉澱（規範）。

下次遇到「修了又犯」的循環，**該停下來問「這個 pattern 該不該進 rule？」**。

---

> 撰寫者：Cursor Agent + Josh ｜ 時間：2026-08-30