# CF Pages saome-frontend 修正指南

> 目標 repo: SaomeRebuild/SAOME-REBUILD
> Wrangler config 已在 root: `wrangler.jsonc` → assets `apps/frontend/dist`

## 為什麼 Pages build #8c5a0899 fail

CF Pages 設定：
- Root directory = `/apps/frontend`
- Build command = `npm run build`
- Deploy command = `npx wrangler deploy`

但：
1. `apps/frontend/package.json` 用 `pnpm hoist` 把所有 deps 裝在 root `node_modules/`
2. CF Pages 在 `apps/frontend` 跑 `npm clean-install`，跳過 devDeps（行為被「production-like」污染）
3. `tsc -b` 找不到 tsc binary → `sh: 1: tsc: not found`
4. **就算裝好，wrangler deploy 也找不到 `wrangler.jsonc`**（它在 repo root，不在 apps/frontend）

## 修法（A 方案 — 推薦）

改 CF Pages 設定：

| 設定 | 改後值 |
|---|---|
| Root directory | （留空 / 不設） |
| Build command | `npm install --include=dev && npm run build` |
| Build output directory | `apps/frontend/dist` |
| Deploy command | `npx wrangler deploy` |

為何這樣：
- Root 不設 → CF 從 repo root clone，把所有 monorepo deps 看見
- `npm install --include=dev` 在 root 跑 hoisted install
- `npm run build` → 透過 root package.json 的 workspace script `npm --workspace=apps/frontend run build`
- 產物在 `apps/frontend/dist`（CF 自動抓到）
- wrangler deploy 用 root 的 `wrangler.jsonc`（assets.directory 指到 `apps/frontend/dist`）

## 修法（B 方案 — 替代）

保留 `Root dir = apps/frontend`，但：

1. 加 `apps/frontend/wrangler.jsonc`（內容同 root 版本），讓 wrangler 在 apps/frontend 找得到
2. 改 Build command = `npm install --include=dev && npm run build`
3. Root dir 限制 CF 只看 apps/frontend（會跳過 root package.json 的 workspace）

**缺點**：CF Pages 不會跑 root install，所有 deps 必須裝進 `apps/frontend/node_modules/`。但 `apps/frontend/package.json` 沒有 `engines`、`packageManager`，npm 行為不確定。

## 建議：選 A

A 方案是 CF Pages 官方 recommended pattern（single source）。

## 已完成 vs 待做

- ✅ submodule fix `e9af751` 已 push
- ✅ wrangler.jsonc 對齊 Pages project name `saome-frontend`（commit 7fcf62c）
- ⏳ A 方案需要 owner-agent 進 CF Pages dashboard 改設定
- ⏳ 之後 CF 自動 build → preview URL `saome-frontend.pages.dev`
