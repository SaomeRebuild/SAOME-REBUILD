# Feedback 20260727：Cloudflare Pages Deploy — npm workspace + lockfile 衝突

## 背景

2026-07-27，嘗試將前端（`apps/frontend`）部署至 Cloudflare Workers，過程遇到多個錯誤表象。

## 根因分析（重要！）

**真正的根因不是 TypeScript 程式碼錯誤，而是 npm workspace + lockfile 衝突**：

| 層面 | 問題 |
|------|------|
| lockfile 格式衝突 | 根目錄 `package-lock.json` 含 `.pnpm/... link entries`，但 CI 用 npm 10 |
| 雙 lockfile | 同時存在 `root/package-lock.json` + `apps/frontend/package-lock.json` |
| workspace 邊界模糊 | npm 在 workspace 子目錄執行時，向上識別 workspace root |
| 安裝結果不可用 | npm 宣稱 "added X packages"，但 `.bin/tsc` 未建立 |

## 三種錯誤表象

| 平台 | 錯誤訊息 | 實際原因 |
|------|----------|----------|
| GitHub Actions | `Cannot read properties of undefined (reading 'extraneous')` | npm Arborist 分析損壞的 dependency tree |
| Cloudflare | `sh: 1: tsc: not found` | `.bin/tsc` 未建立 |
| Cloudflare (降級 TS5.7) | `error TS2688: Cannot find type definition file for 'node'` | TypeScript 存在但 @types/node 位置錯誤 |

## 修法

| 檔案 | 改動 | 說明 |
|------|------|------|
| `apps/frontend/package.json` | `wrangler deploy` → `npx wrangler deploy` | wrangler 不在 Cloudflare Pages 全域 PATH |
| `apps/frontend/wrangler.jsonc` | `"assets": { "binding": "ASSETS", "source": "./dist" }` → `"assets": { "directory": "./dist" }"` | Pages 格式不適用於 Worker-only 專案 |
| Cloudflare Pages 設定 | 加入 `SKIP_DEPENDENCY_INSTALL=true` | 避免 Cloudflare 自動 npm install 衝突 |
| **核心修法（待做）** | 統一 lockfile 策略 | 移除 pnpm-style entries，確保單一 lockfile |

## 學習（下次怎麼預防）

- ❌ **不要**在 build script 裡刪 `node_modules/typescript`（只是清症狀）
- ❌ **不要**用 `node ../../node_modules/typescript/bin/tsc`（繞過問題）
- ❌ **不要**單純升降 TypeScript 版本（沒解決根本問題）
- ✅ **真正需要回答**：「此 repository 由哪一份 lockfile、在哪一個 workspace root、使用哪一種 package manager」
- ✅ **未來遇到 `tsc: not found` / `npm Arborist crash`**：優先檢查 lockfile 是否含 pnpm-style entries

## 觸發後續動作

- [x] 寫本 feedback
- [x] 建立新規範 `.cursor/rules/015-cloudflare-pages-deploy.mdc`
- [x] 更新 `saome-github-deploy/SKILL.md` 加入 Cloudflare Pages 檢查表
- [x] 統一 lockfile 策略（2026-07-27 phase 2 — 見下）

## Phase 2（2026-07-27 21:00+8）— Cross-Platform Native Bindings

前次留下的「統一 lockfile 策略」長期問題，今天又被 CI 與 Cloudflare Pages 觸發：

### 症狀（第三次爆發，三平台同時 fail）

| 平台 | 錯誤訊息 | 真正缺少的 binding |
|------|---------|--------------------|
| GitHub Actions（lint job） | `Cannot find module '@oxlint/binding-linux-x64-gnu'` | `@oxlint/binding-linux-x64-gnu` |
| GitHub Actions（test job） | `Cannot find module '@rollup/rollup-linux-x64-gnu'` | `@rollup/rollup-linux-x64-gnu` |
| Cloudflare Pages build | `Cannot find module '@rolldown/binding-linux-x64-gnu'` | `@rolldown/binding-linux-x64-gnu` |

### 真正的根因（這次不是 lockfile 衝突，是 lockfile 內容不完整）

PR #62 的 `package-lock.json` 是 Windows 開發者（`josh1989213`，local Node 24）產出。
npm 11 之前的版本（PR #8184 / 11.3.0 才修）對「跨平台 optional dependency」有 pruning bug：

- `package.json` 宣告 `oxlint@1.75.0` 有 17 個 platform optional deps（含 `@oxlint/binding-linux-x64-gnu`、`@oxlint/binding-linux-x64-musl`、…）
- 在 Windows 跑 `npm install` 後，npm 11.0–11.2 把非 Windows 的條目從 lockfile 內的 `packages.*.optionalDependencies` 修剪掉
- `npm ci` 在 Linux runner 嚴格按 lockfile 安裝 → 找不到 binding → `require()` throw

參考：npm/cli#4828、#7961、#8320。

### 修法

唯一最小變更：重新生成 `package-lock.json`。

```
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install --include=optional --no-audit --no-fund \
  --os=linux --cpu=x64 --libc=glibc
npm install --include=optional --no-audit --no-fund   # 拿回 Windows binding
```

- `--include=optional` 確保 optionalDependencies 真的寫進 lockfile
- `--os/cpu/libc` flags 提示 npm 為目標平台保留 metadata 條目
- **未動** `apps/frontend/package.json`、`.github/workflows/deploy.yml`、`.gitignore`、wrangler、tsconfig、vitest config
- Diff 範圍：僅 `package-lock.json`（+3073/-220，3293 行）

### 驗證（per `.cursor/rules/006-verification.mdc`）

| 項目 | 結果 |
|------|------|
| lockfile audit（10 個 Linux binding） | 全數 present，exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0（oxlint 通過） |
| `npm test` | 133/133 passed across 16 test files |
| `npm run build` | exit 0，`dist/index.html` + `dist/assets/index-*.js` 415.76 kB |
| `wrangler deploy --dry-run --outdir=dist` | 讀 17 個 assets，exit 0 |

### 學習

- **這是 npm CLI 上游 bug**，不是 SAOME 專案結構問題，所以不要浪費時間改 wrangler / tsc / package.json。
- `--include=optional` 不是預設值；跨平台 CI 必須明確傳入。
- 重新生成 lockfile 時 `node -e` 的 lockfile audit script 是最快的 regression check，比直接重跑 CI 快很多。
- 本地重裝兩次（先 `--os=linux` 補 Linux binding，再預設拿回 Windows binding）是因為 `--os=linux` 會排除 Windows；CI 端不需要這個二次重裝，lockfile 已含全平台 metadata。
- 若有人從 macOS/Linux dev 端跑 `npm install` 又沒帶 `--include=optional`，會把這個 lockfile 修法吃掉，**建議在 CI workflow 明確寫死 `--include=optional`**（未來 spec 項目）。

### 預防 checklist（未來 PR）

- [ ] 修改 `package.json` 後必須 `rm -rf node_modules && rm package-lock.json && npm install --include=optional` 重新生成 lockfile
- [ ] 用 `node -e` 跑 audit script 確認 `node_modules/<各平台 binding>` 都存在再 commit
- [ ] 至少在 PR description 列出 6 個關鍵 binding（oxlint / rollup / rolldown / tailwindcss-oxide / esbuild / workerd）的 lockfile 條目
- [ ] CI workflow 加 `--include=optional` 確保未來即使 lockfile 漏欄位也能裝到 binding（待 spec 評估）
