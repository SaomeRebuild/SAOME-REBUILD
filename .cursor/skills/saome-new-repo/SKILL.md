# SAOME New Repo Skill

> SAOME 系列所有業主專用 repo（saome-frontend / saome-backend / saome-api-worker / saome-postgresql …）的建立標準。
> 觸發條件：使用者提到「新建 repo」「抽 backend」「建立 saome-xxx」「獨立 repo」時必須引用。

## 目的

把「SAOME-REBUILD 清理 + 抽 frontend 推 saome-frontend」這次成功流程標準化，避免下次新 repo 又踩一樣的坑：
- 把 owner-agent 私房（.cursor/、DEV/、runs/、AGENTS.md、specs/、mu-plugins/）意外推到業主 repo
- 沒有 defensive .gitignore
- 沒有 i18n 雙語 SOP
- 沒有 owner-agent 私房鎖定規範

## 強制規則（所有 saome-* repo 必須遵守）

### 路徑
所有 saome-* repo 必須建在 `C:\Users\user\Desktop\saome-<name>\`，與 SAOME-REBUILD 平行。**禁止**建在 SAOME-REBUILD 子目錄。

### 必含檔案
每個 saome-* repo 必須有：
- `AGENTS.md`（repo 入口、規範摘要）
- `README.md`（repo 對外說明）
- `.gitignore`（defensive 版本，見下方範本）
- `wrangler.jsonc`（若用 Cloudflare Workers）

### Defensive .gitignore 範本（所有 saome-* repo 必含）

```
# Owner-agent private state — 不應出現在任何 saome-* repo
.cursor/
DEV/
runs/
mu-plugins/
AGENTS.md
specs/
shared/
design-system/
backend/
SAOME-REBUILD/

# Build artifacts
node_modules/
dist/
dist-ssr/
build/
.wrangler/

# Logs
*.log
logs/

# Environment
.env
.env.local
.env.*.local

# OS files
.DS_Store
Thumbs.db

# Editor
.vscode/*
!.vscode/extensions.json
.idea
*.sw?
*.suo

# Coverage
coverage/
```

### 來自 SAOME-REBUILD 的搬入流程

從 `C:\Users\user\Desktop\SAOME-REBUILD\` 抽出 source 進 saome-* repo：
1. 確認 source 在 SAOME-REBUILD 已通過 `tsc --noEmit` + `vitest run` + `npm run build`
2. 用 `git check-ignore -v` 驗證 owner-agent 私房已被 SAOME-REBUILD .gitignore 鎖住
3. 用 `git add -A --dry-run` 驗證 saome-* repo 內 staged 清單不含私房路徑
4. 複製必要檔案 + commit（**不 push**；push 必須等使用者明確指示）

### 禁止

- 把 `.cursor/`、`DEV/`、`runs/`、`AGENTS.md`、`specs/`、`mu-plugins/` 推到任何 saome-* repo
- 在 saome-* repo 寫 emoji
- 在 saome-* repo 寫 hard-code secrets
- 在 saome-* repo 寫 console.log / debug
- 跳過 defensive .gitignore 直接 `git init`
- 未經使用者明確指示就 `git push` 到任何 remote

## 觸發關鍵字

- 「新建 repo」「開新 repo」「建立 repo」
- 「saome-backend」「saome-api-worker」「saome-postgresql」
- 「抽 backend」「獨立 repo」「分離 repo」

## 與其他 skill 的關係

- `saome-github-deploy`：本 skill 處理「建 repo 前 + 抽出 source」的標準，它處理「建 repo 後 + push」的標準
- `saome-self-improvement`：本 skill 是結構規範，它負責 session 結束的反省紀錄
- AGENTS.md 列規範，本 skill 補規範缺失