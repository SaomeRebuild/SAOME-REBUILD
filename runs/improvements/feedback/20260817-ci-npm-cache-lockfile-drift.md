# 2026-08-17 CI npm cache drift（package-lock.json 未綁定 cache key）

## 背景

`apps/frontend/package.json` 新增 `zustand@^5.0.15` dependency。root `package-lock.json` 已有正確 entry（`npm install --include=optional` 在本地生成）。push 到 main 後 CI 仍 fail：

```
npm error Missing: zustand@5.0.15 from lock file
```

## 根因分析

`.github/workflows/deploy.yml` 的 `actions/setup-node@v4` 設定：

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'          # ← 只綁定 package.json
    # cache-dependency-path: 'package-lock.json'  ← 沒寫
```

`cache: 'npm'` 的預設 dependency path 是 `package.json`。當 `package.json` 內容沒變（只有 lockfile 內容變），CI restore cache 時：

1. Cache key = `npm-` + `package.json` hash
2. `package.json` hash 與上次相同 → restore 舊 cache
3. 舊 cache 含舊 `node_modules/` + 舊 `package-lock.json`
4. `npm ci` 用 restore 的 lockfile（缺 zustand entry）校驗 → **fail**

本地 `npm install` 成功是因為它**不校驗** lockfile 完整性，自動修補 drift。CI 的 `npm ci` **強制校驗**，發現不一致就 fail。

## 修法

所有 3 個 job（typecheck / lint / test）的 `setup-node` 都加上：

```yaml
cache-dependency-path: 'package-lock.json'
```

commit `1583d00` 已 push 到 main。

## 未來如何避開

### 規範層（rule）

現有 rule `.cursor/rules/016-config-and-tsconfig-discipline.mdc` 的 7 個 surface 清單**未涵蓋** CI cache binding。需補充：

> 新增第 8 surface：`.github/workflows/*.yml` 的 `cache-dependency-path` 必須綁定 `package-lock.json`。

### 操作層（trigger keyword）

觸發時機：
- 修改 `apps/*/package.json` 的 `dependencies` 或 `devDependencies`
- 新增 workspace 或刪除 workspace
- 任何 `package-lock.json` 有變更但 `package.json` 無變更的 commit

**觸發關鍵字**：「加 dependency」「新增套件」「npm install」。

### 自動偵測（可選）

加一條 pre-commit hook 或 CI lint step，斷言 workflow 的 cache path 包含 lockfile：

```bash
# .github/workflows/ 內所有 cache: 'npm' 必須有 cache-dependency-path: 'package-lock.json'
grep -r "cache: 'npm'" .github/workflows/ | grep -v "cache-dependency-path"
# 若有 output → fail
```

## 學習

| 項目 | 說明 |
|---|---|
| `npm install` vs `npm ci` | `install` 容忍 drift，`ci` 強制校驗 |
| `cache: 'npm'` 預設行為 | 綁定 `package.json`，不綁定 lockfile |
| CI cache restore 時機 | 基於 cache key，key 基於 dependency path |
| 本地成功不等於 CI 成功 | 本地 `npm install` 修補 drift，CI `npm ci` 不會 |

## 參照

- `.cursor/rules/016-config-and-tsconfig-discipline.mdc` — 7 surfaces（需補第 8）
- `.cursor/rules/015-cloudflare-pages-deploy.mdc` — lockfile sync
- GitHub Actions `setup-node` 文件：[Caching dependencies](https://github.com/actions/setup-node#caching-packages)
