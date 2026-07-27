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

---

## 2026-07-27 更新：採用 A 方案，npx wrangler deploy 改為 auto-deploy

### 問題演化

第一次 build log（2026-07-26T23:51）：

```
Executing user deploy command: npx wrangler deploy
npm error Cannot read properties of undefined (reading 'extraneous')
```

第二次 build log（2026-07-27T00:27，commit `998016c` 已 push）：

```
⛅️ wrangler 4.114.0  ← wrangler 順利載入（從 node_modules/.bin）
✘ [ERROR] The directory specified by the "assets.directory" field in your
  configuration file does not exist:
  /opt/buildhome/repo/apps/frontend/dist
```

### 根因

CF Pages 設 Root directory = `/apps/frontend`，build 完成後 wrangler CWD 是
`/opt/buildhome/repo/apps/frontend`。但 `wrangler.jsonc` 在 repo root，內容
`assets.directory: "./apps/frontend/dist"` 被 CWD 解析成
`apps/frontend/apps/frontend/dist` → 不存在。

### 解法：採用 A 方案 — 不跑 wrangler CLI

CF Pages **原設計就是 auto-upload build output**，不需要 wrangler CLI。
`wrangler pages deploy` 只在 GitHub Actions / local CLI 才用。

### Dashboard 設定（A 方案最終值）

| 欄位 | 值 |
|---|---|
| Build command | `npm run pages:build` |
| Root directory | `/apps/frontend` |
| Deploy command | **(留空)** ← 關鍵改動 |
| Build output directory | `dist` |

CF 會自動把 `apps/frontend/dist/` 上傳到 Pages project `saome-frontend`。

### 程式端變更（commit `998016c`）

- `apps/frontend/package.json` 新增 `wrangler@^4.34.0` 到 devDependencies
  （預裝避免 npx 下載 metadata 觸發 npm bug）
- 新增 `pages:deploy` script（保留給手動 / CI 部署用，不會被 CF Pages 跑）

### 為何保留 wrangler devDep + pages:deploy script？

- wrangler 在 devDep 沒有成本（CF Pages 只裝 `devDependencies` 因為
  `pages:build` 跑 `npm install --include=dev`）
- `pages:deploy` 保留給 GitHub Actions 或本地手動部署時使用
- 對 CF Pages auto-deploy 完全不影響 — CF 直接讀 build output，不碰 wrangler
