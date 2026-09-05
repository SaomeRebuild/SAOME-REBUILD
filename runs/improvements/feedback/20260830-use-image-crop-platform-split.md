# useImageCrop Hook Split Pattern（.web.ts / .native.ts）— RN Migration Backlog Codification

## Metadata

- **日期**：2026-08-30
- **作者**：Josh（agent-assisted via Cursor）
- **commit hash**：見各 sub-task commits（Phase A 共 4 commits）
- **規則 / skill 觸發**：`frontend/024-mobile-future-proof.mdc` § Hook Split Pattern、`saome-image-upload`
- **影響**：`useImageCrop` 為 RN migration 鋪路；LogoUploader / IconUploader / BackgroundUploader 等未來 RN 化時可零成本切換 platform binding
- **嚴重度**：Low（純 refactor，無 runtime behavior 改變；新檔 .native.ts 為 throw-stub）

---

## 症狀

> 「`useImageCrop` 內 `cropImage()` 用 Canvas API（`document.createElement('canvas')` + `ctx.drawImage()`），是 web-only。RN 化時整個 hook 都得改。」

### 為什麼這是問題

| 現狀 | RN 化時的痛點 |
|---|---|
| `useImageCrop.ts` 內 200+ 行混 JSX-free state hook + `cropImage()` Canvas 實作 | RN migration 時整檔要 fork，無法 selective replace |
| `cropImage()` 是 hook 的 return value（被 `LogoUploader.handleApplyCrop` 直接呼叫） | RN 替換 `cropImage()` 必須改 hook return shape 或加 platform 分支 |
| 純 Canvas API（無替代 import）| RN 必須用 `react-native-image-crop-picker` / `expo-image-manipulator`，不是 drop-in |

---

## 根因分析

### Hook Split Pattern 設計動機

SAome 未來會做 React Native 化，每個 PR 必須能回答「換成 RN 需要改什麼？」。

理想的答案：
> 「換成 RN 需要改的只有 platform binding，業務邏輯零成本遷移」

`useImageCrop` 同時包含：
- 共用 state（`useState`、`useCallback`、`loadImage`、`setFocalPoint`、`resetCrop`）
- web-only API（`document.createElement('canvas')`、`ctx.drawImage`、`canvas.toBlob`）

如果整個 hook 都在 `.web.ts`，RN 化時 state 部分也要 fork → DRY 破壞。

如果整個 hook 留在 `.ts`，RN 化時 `cropImage()` 就要帶 platform 分支 → 違反單一職責，TS 推導會壞掉（`HTMLImageElement` 在 RN 環境不存在）。

### 修法 — 三檔結構 + 顯式 platform binding

```
hooks/
├── useImageCrop.ts          ← 共用 state：useState, useCallback, loadImage, setFocalPoint, ...
├── useImageCrop.web.ts      ← cropImage() 用 Canvas API（web-only）
└── useImageCrop.native.ts   ← cropImage() stub（throw NotImplementedError，待 RN 實作）
```

**主檔簽名必須 export platform binding 的型別**：

```ts
// useImageCrop.ts
export type CropImageFn = (
  image: HTMLImageElement,
  cropState: CropState,
  cropWindowWidth: number,
  cropWindowHeight: number,
  baseCanvasWidth: number,
  outputWidth: number,
  outputHeight: number | null,
) => Promise<Blob>;

// 主檔根據 platform 決定 binding
const cropImageImpl: CropImageFn = cropImageOnWeb; // .web.ts 提供
                                              // RN 時換成 cropImageOnNative
```

**Web binding 範例**（`useImageCrop.web.ts`）：

```ts
import { computeSrcRegion, computeSrcSquareSize } from '@saome/shared/logic/imageCrop';
import type { CropState } from '@saome/shared/types';

export function cropImageOnWeb(
  image: HTMLImageElement,
  cropState: CropState,
  cropWindowWidth: number,
  cropWindowHeight: number,
  baseCanvasWidth: number,
  outputWidth: number,
  outputHeight: number | null,
): Promise<Blob> {
  const canvas = document.createElement('canvas');  // ← web-only API
  const ctx = canvas.getContext('2d');
  // ... compute src region, drawImage, toBlob ...
}
```

**Native stub 範例**（`useImageCrop.native.ts`）— **必 throw**：

```ts
export const cropImageOnNative: CropImageFn = (
  _image, _cropState, _cropWindowWidth, _cropWindowHeight,
  _baseCanvasWidth, _outputWidth, _outputHeight,
): Promise<Blob> => {
  throw new Error(
    '[useImageCrop.native] cropImage() not yet implemented on React Native. ' +
    'See RN migration backlog (use react-native-image-crop-picker).',
  );
};
```

理由：silent stub（`return null` 或 `Promise.resolve(new Blob())`）→ RN runtime 看到神秘的 canvas error 而 stack 混亂；throw → 開發者立即看到清楚的「not yet implemented」訊息，並指向 backlog。

---

## 配套基礎建設

### Vite / TypeScript moduleSuffixes

`.web.ts` / `.native.ts` 不會被 Vite 自動 resolve 為 TypeScript 編譯時的 module — **必須**在 `apps/frontend/tsconfig.app.json` 加：

```jsonc
// apps/frontend/tsconfig.app.json
{
  "compilerOptions": {
    "moduleSuffixes": [".web", ".native", ""]  // 從最 specific 到 generic
  }
}
```

順序鐵律：`.web` / `.native` 最先，generic `""` 最後（Vite / Rollup / Metro 都按 prefix-match）。

沒設 `moduleSuffixes` → TS 編譯找不到 `useImageCrop.web.ts`（Vite dev 也會失敗）。

### `FileLike` 介面 pattern（跨平台檔案物件）

跨平台共用 hook 若需要檔案物件，定義**最小介面**而非 import web-only `File`：

```ts
// packages/shared/types/imageCrop.ts
export interface FileLike {
  type: string;
  size: number;
}
```

Web `File` 與 RN native file picker（如 `react-native-image-crop-picker` 的 response）都 conform 這個介面。
**禁止**在 shared/ 內 import `File` from DOM lib（會把 web-only 型別 leak 到 RN）。

---

## 驗證

### 1. Web binding 行為合約

```ts
// apps/frontend/src/hooks/useImageCrop.web.test.ts（已 ship, Phase 7b）
it('logo variant uses 960×NH aspect (outputHeight=null)', async () => {
  // ... cropImageOnWeb 用 fakeCanvas + toBlobSpy 驗證 output dimensions ...
});
```

### 2. Native stub 行為合約（推薦新增，未 ship）

```ts
// apps/frontend/src/hooks/useImageCrop.native.test.ts（推薦新增）
import { cropImageOnNative } from './useImageCrop.native';

describe('useImageCrop.native — RN stub throws NotImplementedError', () => {
  it('throws when called on RN platform', async () => {
    await expect(cropImageOnNative(
      {} as HTMLImageElement,
      {} as CropState,
      200, 200, 400, 960, null,
    )).rejects.toThrow(/not yet implemented on React Native/);
  });
});
```

### 3. typecheck / vitest 全綠

```bash
cd apps/frontend
npx tsc --noEmit                          # exit 0
npx vitest run useImageCrop               # 6/6 passed
npx vitest run useImageCrop.web           # 3/3 passed
```

---

## 禁止（codified in rule 024）

| ❌ 禁止 | 為什麼 |
|---|---|
| ❌ 在 `shared/` 內 import `File`、`HTMLCanvasElement`、`URL.createObjectURL`、`window`、`localStorage` 等 web-only API | 把 web-only 型別 leak 到 RN |
| ❌ `.web.ts` / `.native.ts` 內互相 import | 會形成 cycle，且破壞 platform isolation |
| ❌ `.native.ts` 用 silent stub（`return null` 或 `Promise.resolve(new Blob())`） | **必須 throw** — silent stub 會在 RN runtime 產生神秘的 canvas error，stack 混亂 |
| ❌ 主檔用 `if (typeof window !== 'undefined')` 在主檔分流 | 違反單一職責，TS 推導會壞掉 |
| ❌ 主檔直接寫 web-only 實作 | 把 Canvas API leak 進 shared logic，無法 RN 化 |

---

## 影響

| 範圍 | 影響 |
|---|---|
| 業務邏輯（state hook + `computeSrcSquareSize` / `computeSrcRegion`） | 已抽到 `packages/shared/logic/imageCrop.ts`（Phase A），RN 化零成本 |
| 平台 binding（`cropImageOnWeb` / `cropImageOnNative`） | `.web.ts` / `.native.ts` 雙檔；RN 替換實作時改 `useImageCrop.ts` 的一行 import |
| `MediaAssetUploader` 變體（logo / icon / background） | 對 `cropImage()` API 完全無感；純粹傳 `outputWidth` / `outputHeight` |
| Future RN 工作 | 移除 `.native.ts` 的 throw，換成 `react-native-image-crop-picker` 實作 |

---

## 參照

- `.cursor/rules/frontend/024-mobile-future-proof.mdc` § Hook Split Pattern — 完整規範（MUST throw、FileLike、moduleSuffixes）
- `apps/frontend/src/hooks/useImageCrop.ts` — 主檔
- `apps/frontend/src/hooks/useImageCrop.web.ts` — Web binding
- `apps/frontend/src/hooks/useImageCrop.native.ts` — RN stub
- `packages/shared/logic/imageCrop.ts` — `computeSrcSquareSize` / `computeSrcRegion` 純函式
- `packages/shared/types/imageCrop.ts` — `FileLike` / `CropState` / `ValidationError`
- `apps/frontend/tsconfig.app.json` — `moduleSuffixes` 配置（若尚未加，需補）
- Phase A commit history（sub-task commits，2026-08-30）