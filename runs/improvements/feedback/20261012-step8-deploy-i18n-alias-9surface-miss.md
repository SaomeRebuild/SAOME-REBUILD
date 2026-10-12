# 2026-10-12 Step 8 v12-followup deploy — `@saome/shared/i18n/fieldLabels` alias 漏登錄

> **對應**：commit `638be24`（v12-followup 完成的 commit）上 Cloudflare Pages deploy 失敗
> **類型**：fix（L2 Standard — build infra）
> **影響範圍**：`apps/backend/tsconfig.json` + `apps/backend/vitest.config.ts` 兩條 Rule 016 surface

## 1. 背景 — production deploy 第一次跑就 fail

`638be24`（Step 8 v12-followup complete）push 完後，Cloudflare Pages backend deploy 跑 `npx wrangler deploy`，esbuild bundler 第一關就 fail：

```
✘ [ERROR] Could not resolve "@saome/shared/i18n/fieldLabels"
src/modules/pass-templates/services/passTemplateMapping.ts:123:7

  To fix this, you can add an entry to "alias" in your Wrangler configuration.
```

v12-followup 期間 6 個 backend 檔案新增了 `@saome/shared/i18n/fieldLabels` import（`passTemplateMapping.ts`、`passTemplateSync.ts`、`cardService.ts` + 3 個 test file），但**只更動了 `packages/shared/i18n/` 的內容，沒更新 backend 兩條 config surface**。

## 2. 根因 — Rule 016 § 9-surface 漏登錄

| Surface | backend 狀態（v12-followup 前）| 漏登錄 |
|---|---|---|
| 4 — `vitest.config.ts` resolve.alias | 有 `schemas/types/logic/constants` 4 組 | **缺 `i18n`** |
| 5 — `tsconfig.json` paths | 有 `schemas/types/logic/constants` 4 組 | **缺 `i18n`** |
| 3 — `vite.config.ts` | backend 無此檔 | N/A |

對照組：frontend `tsconfig.app.json` 早就有 `@saome/shared/i18n` + `@saome/shared/i18n/*`，`vitest.config.ts` 也有 4 個 i18n 子路徑 alias（`zh-TW` / `en` / `detectLanguage` / 裸 `i18n`）— 所以 frontend 從來沒遇到這個 bug。漏的純粹是 backend 兩條。

其他 `@saome/shared/*` 路徑（`schemas` / `types` / `logic` / `constants`）在 backend deploy 都 work → 證實 **Wrangler 4.x 透過 esbuild 讀 tsconfig paths**，只要 `tsconfig.json` 寫好就 bundle 出來。所以**修法不是去動 `wrangler.jsonc::alias`（事實上 wrangler.jsonc 從來沒設過 alias）**，而是補 backend 兩條 config。

## 3. 修法

### 3.1 `apps/backend/tsconfig.json` paths — 新增 1 行

```diff
 "@saome/shared/constants/*": ["../../packages/shared/constants/*"]
+ "@saome/shared/i18n/*": ["../../packages/shared/i18n/*"]
```

### 3.2 `apps/backend/vitest.config.ts` resolve.alias — 新增 4 行（specific 在前，generic 在後）

```diff
 '@saome/shared/constants': path.resolve(__dirname, '../../packages/shared/constants/index.ts'),
+ // Specific entries (with subpath) MUST come BEFORE the generic ones
+ // (Rule 016: vite alias is prefix-matching, first match wins).
+ '@saome/shared/i18n/fieldLabels': path.resolve(__dirname, '../../packages/shared/i18n/fieldLabels.ts'),
+ '@saome/shared/i18n/detectLanguage': path.resolve(__dirname, '../../packages/shared/i18n/detectLanguage.ts'),
+ '@saome/shared/i18n/': path.resolve(__dirname, '../../packages/shared/i18n/'),
+ '@saome/shared/i18n': path.resolve(__dirname, '../../packages/shared/i18n/index.ts'),
```

完全 mirror 既有 `constants` 區塊的 pattern（specific subpath → trailing-slash → bare）。

## 4. 驗證輸出

| 命令 | 結果 |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | exit 0, 無錯誤 |
| `npm test` (vitest) | 35 test files / 566 tests all passed (16.28s) |
| `npm run build` (`wrangler deploy --dry-run`) | exit 0, Total Upload: 564.84 KiB / gzip: 124.88 KiB |
| `npm run check:migrations` (prebuild hook) | OK: 19 migrations registered as applied |

stderr 看到 `NotFoundError` 來自 `deleteTableCardElement.test.ts` / `getPublic.validation.test.ts` 的 404-path 測試，是預期 errorHandler 輸出，不是 test fail。

## 5. 教訓

1. **跨 package 第一次 import 某個子路徑**，必跑 Rule 016 § 變更前強制檢查（9 surface checklist）。
2. **frontend 有不代表 backend 有**：frontend `tsconfig.app.json` / `vitest.config.ts` 是獨立 surface，必須分開登錄。
3. **Wrangler 4.x deploy 錯誤訊息會誤導**：「add an entry to alias in your Wrangler configuration」是通用建議，但實際上 Wrangler 4 透過 esbuild 讀 tsconfig paths，不需要 wrangler.jsonc::alias。
4. **本來可以 build 階段 fail-fast**：backend `prebuild` hook 只跑 `check:migrations`，沒跑 typecheck / build dry-run。如果 backend 也有 `prebuild` build 驗證，這個 bug 會在 commit 時就抓到，不會推到 origin 讓 Cloudflare Pages 跑第一次 deploy 才 fail。

## 6. 待辦（pending action）

| # | 待辦 | 優先 |
|---|---|---|
| 1 | `apps/backend` 加 `prebuild: tsc --noEmit` 跟 `prebuild: wrangler deploy --dry-run`，跟 frontend 對齊 | P2（避免再發生） |
| 2 | Rule 016 § 變更前強制檢查 9 條 surface 必查清單加進 `frontend/025-vibe-coding-l2-checklist.mdc` § DB Migration Checklist 旁邊 | P3 |
| 3 | feedback 對齊 INDEX.md（待補） | P3 |

## 7. 對應決策 / 反饋

- 沒有 Decision Log 需求（純 config 修補，非架構選擇）。
- 對應前一次同類事故：`runs/improvements/feedback/20260817-ci-npm-cache-lockfile-drift.md`（同樣是「config 沒同步 deploy 環境」pattern）。
- 對應規範層 rule：`.cursor/rules/016-config-and-tsconfig-discipline.mdc` § 9 surface 必查。
