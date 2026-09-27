# useImageCrop moduleSuffixes 順序 bug + Hook Split Pattern 文檔錯誤

> **Date**: 2026-09-27
> **Status**: Fixed
> **Severity**: P0（Cloudflare Pages production deploy blocked，13 個 TS error）
> **Files changed**: `apps/frontend/tsconfig.app.json` + `.cursor/rules/frontend/024-mobile-future-proof.mdc`

---

## TL;DR

`apps/frontend/tsconfig.app.json` 的 `moduleSuffixes` 順序寫反了。Rule 024 § Hook Split Pattern 文檔把 React Native **whole-component** pattern 的順序（platform suffix 先）誤套到 **Hook Split Pattern**（generic 後綴先）。這條 rule 已誤導所有後續使用 Hook Split Pattern 的開發者，但因為 `vite build` runtime 用的是 `resolve.extensions`（不受 moduleSuffixes 影響），dev mode 跟 production runtime 都正常——**build 階段的 `tsc -b` 才會 fail**。

**修法**：`moduleSuffixes: [".web", ".native", ""]` → `["", ".web", ".native"]`，generic `""` 必須最前。

---

## 觸發情境

2026-09-27 Cloudflare Pages 自動 build：

```
2026-09-27T15:37:46.308Z  > frontend@0.0.0 build
2026-09-27T15:37:46.309Z  > node scripts/verify-i18n-keys.mjs && tsc -b && vite build && node scripts/audit-config-defaults.cjs
...
2026-09-27T15:37:49.816Z  src/components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploader.chain.test.tsx(24,10): error TS2305: Module '"@/hooks/useImageCrop"' has no exported member 'useImageCrop'.
... (13 條 TS2305 + TS7006 圍繞 useImageCrop / hooks/index.ts / MediaAssetUploader.tsx / detectLanguage.web.ts)
2026-09-27T15:37:49.900Z  Failed: error occurred while running build command
```

`tsc -b` 在 `vite build` 之前就 fail，production deploy 直接卡住。

---

## 根因鏈

### Step 1：TypeScript 用 moduleSuffixes，順序決定誰遮蔽誰

`apps/frontend/tsconfig.app.json`：

```jsonc
"moduleSuffixes": [".web", ".native", ""]
```

TS 解析 `import { useImageCrop } from '@/hooks/useImageCrop'` 時，按 `moduleSuffixes` 順序 append suffix 找檔案：

| Suffix | 嘗試檔案 | 結果 |
|---|---|---|
| `.web` | `./useImageCrop.web.ts` | ✅ 存在 → **採用** |
| `.native` | （沒機會試）| — |
| `""` | （沒機會試）| — |

但 `./useImageCrop.web.ts` 只 export `cropImageOnWeb`（Canvas-based），**不 export `useImageCrop` hook**：

```ts
// useImageCrop.web.ts
export function cropImageOnWeb(image, cropState, ...): Promise<Blob> { ... }
// ↑ 沒有 useImageCrop function
```

→ TS2305「Module '"@/hooks/useImageCrop"' has no exported member 'useImageCrop'」

### Step 2：錯誤向下游傳染

`useImageCrop()` 回傳型別是 `any`（hook 拿不到）→ destructure `setCropState` 是 `any` → functional updater 的 `(prev) =>` 參數型別 TS 推不出來 → TS7006「Parameter 'prev' implicitly has an 'any' type」× 3（MediaAssetUploader.tsx line 224, 240, 375）。

### Step 3：`detectLanguage.web.ts` circular import

```ts
// detectLanguage.web.ts
import { detectDeviceLanguage as baseDetect, type SupportedLanguage } from './detectLanguage';
```

同樣 moduleSuffixes 順序，TS 解析 `./detectLanguage`：

| Suffix | 嘗試檔案 | 結果 |
|---|---|---|
| `.web` | `./detectLanguage.web.ts` | ✅ 存在 → **採用**（self！circular definition）|

→ TS2303「Circular definition of import alias 'SupportedLanguage'」+ TS2459「declares 'SupportedLanguage' locally, but it is not exported」

### Step 4：為什麼 dev mode 跟 production runtime 都沒事

- **Vite runtime**：用 `resolve.extensions`（`.mjs, .js, .mts, .ts, .jsx, .tsx, .json`），**不**走 moduleSuffixes。`./useImageCrop` 直接配對 `useImageCrop.ts`（main file）→ 拿到 hook ✓
- **Vite 解析 `./useImageCrop.web`**：因為 import string 已經包含 `.web`，會嘗試 `useImageCrop.web.ts` → ✓

兩邊 runtime 都通，所以開發者看不到 bug。**只有 build 階段的 `tsc -b` 才 fail**。

---

## 為什麼 Rule 024 文檔寫反

Rule 024 早期文檔（2026-08-30 Hook Split Pattern 落地時）寫：

```jsonc
"moduleSuffixes": [".web", ".native", ""]  // 從最 specific 到 generic
```

「順序鐵律：`.web` / `.native` 最先，generic `""` 最後（Vite / Rollup / Metro 都按 prefix-match）。」

**這個順序是 React Native **whole-component** pattern**（`LoginScreen.ios.tsx` 完整檔優先）的正確順序 — 因為 RN component 的 import 目標就是「整個 component」，platform suffix 應該遮蔽 generic。

但 Hook Split Pattern 的設計意圖是「main file 持有 public API，platform binding 是 private impl」。Consumer 用 bare import（`./useImageCrop`）應該拿到 hook，**不能**被 `.web.ts` 攔截。

Rule 024 把 RN component 順序直接套到 Hook Split Pattern，沒驗證過 `tsc -b` 行為。2026-08-30 → 2026-09-27 整整一個月沒人 catch，因為：

| 流程 | 觸發？ |
|---|---|
| `vite dev` | ❌（Vite 不走 moduleSuffixes）|
| `vitest run` | ⚠️（vitest 會走 tsconfig，但 Step 7 round 8~19 都是 vitest 全綠，看不到）|
| `tsc -b` standalone | ❌（沒人在本地跑）|
| `npm run build` | ❌（package.json 有，但本地跑會 fail 不會 push）|
| **Cloudflare Pages CI build** | ✅（2026-09-27 自動跑才觸發）|

2026-09-27 是 Step 7 系列首次 push 到 production，才跑 Cloudflare Pages CI build。前面幾次 push（Step 7 round 8~19）都還在 main 但沒 push，到 production deploy 階段才 fail。

---

## 修法

### 1. `apps/frontend/tsconfig.app.json`

```diff
- "moduleSuffixes": [".web", ".native", ""],
+ "moduleSuffixes": ["", ".web", ".native"],
+ // ↑ Hook Split Pattern order: generic `""` MUST be FIRST so bare imports
+ //   (`import { useImageCrop } from '@/hooks/useImageCrop'`) resolve to
+ //   the main `useImageCrop.ts` file, NOT the `.web.ts` / `.native.ts`
+ //   binding. Platform binding files are only picked up when the import
+ //   path EXPLICITLY contains the suffix (`./useImageCrop.web` /
+ //   `./useImageCrop.native`). See Rule 024 § Hook Split Pattern.
```

### 2. Rule 024 § Hook Split Pattern

- 把「順序鐵律」改為 generic `""` 最先
- 加表格：哪個順序對應哪個行為
- 加上「為什麼 generic `""` 必須最前」段落
- 交叉參照本次事故

---

## 驗證

```bash
# 前
$ npx tsc -b --noEmit
src/components/.../MediaAssetUploader/MediaAssetUploader.tsx(30,10): error TS2305: Module '"@/hooks/useImageCrop"' has no exported member 'useImageCrop'.
src/components/.../MediaAssetUploader/MediaAssetUploader.tsx(224,21): error TS7006: Parameter 'prev' implicitly has an 'any' type.
... (13 條)

# 後
$ npx tsc -b --noEmit
(0 errors, exit code 0)

$ npm run build
> frontend@0.0.0 build
> node scripts/verify-i18n-keys.mjs && tsc -b && vite build && node scripts/audit-config-defaults.cjs

verify-i18n-keys: OK — 18 namespace(s) passed (36 locale files)
vite v8.2.1 building client environment for production...
✓ 2284 modules transformed.
dist/index.html                    0.65 kB
dist/assets/index-ByjbpamM.js   1,442.75 kB
✓ built in 1.77s
audit-config-defaults: OK — scanned 3 files in dist/, no hardcoded config leaks
(exit code 0)
```

---

## 給未來 debug 的 checklist

如果 build fail 出現 **TS2305「no exported member 'X'」+ TS7006「implicitly any」包圍某個 `.web.ts` / `.native.ts` 同名 hook**，第一個懷疑點：

```
□ moduleSuffixes 順序對嗎？（generic `""` 必須最前）
□ consumer 用 bare import (e.g. `@/hooks/foo`) 嗎？（應該解析到 main `.ts`）
□ `.web.ts` / `.native.ts` 有正確 export hook 嗎？（binding 應該只 export private impl）
```

---

## 跟其他 rule 的關係

- `frontend/023-shared-package.mdc` § Shared Validation 用 i18n Key — 跟這次無關
- `apps/backend/src/shared/middleware/runtimeCors.ts` — 跟這次無關（CORS 層）
- `016-config-and-tsconfig-discipline.mdc` § 9 個 surface — 提醒：tsconfig.app.json 是 #5 surface（tsconfig.app.json paths），跟這次的 moduleSuffixes 是同檔案不同欄位
- `.cursor/rules/frontend/024-mobile-future-proof.mdc` § Hook Split Pattern — 修完，順序鐵律跟範例都更新

---

## 後續預防

| 行動 | 為什麼 |
|---|---|
| **CI 必跑 `tsc -b`** | 這次是 Cloudflare Pages CI 第一次抓到，本地 vite dev 跟 vitest 都抓不到 |
| **新 PR 加 Hook Split Pattern 時** | 必跑 `npx tsc -b --noEmit`，不能只信 vitest |