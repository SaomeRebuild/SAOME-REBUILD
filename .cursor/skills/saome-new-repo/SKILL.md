# SAOME New Repo Skill

> SAOME 系列業主專用 repo（saome-frontend / saome-backend / saome-api-worker / saome-postgresql …）的建立標準。
> 觸發條件：使用者提到「新建 repo」「抽 backend」「建立 saome-xxx」「獨立 repo」時必須引用。

## 目的

把「SAOME-REBUILD 清理 + 抽 frontend 推 saome-frontend」這次成功流程標準化，避免下次新 repo 又踩一樣的坑：
- 把 owner-agent 私房意外推到業主 repo
- 沒有 defensive .gitignore
- 沒有 i18n namespace 雙語 SOP（i18n 已遷移至 `.ts` namespace 格式，見 `023-shared-package.mdc`）

## 適用範圍

> **2026-07-28 更新**：SAOME-REBUILD 已決定保留 monorepo 結構（apps/frontend + apps/backend + packages/shared），不主動拆 repo。本 skill 僅在「使用者明確指示要把子系統獨立成 saome-* repo」時觸發。「禁止把新資料夾建在 SAOME-REBUILD 子目錄」這條舊規則已廢除 — SAOME-REBUILD 本身就是產品的 canonical repo，子目錄加東西是常態。

## 強制規則（任何新 saome-* repo 必須遵守）

### 路徑
新 saome-* repo 應建在 `C:\Users\user\Desktop\saome-<name>\`，與 SAOME-REBUILD 平行。
（不再硬性禁止放在 SAOME-REBUILD 子目錄 — 但若決定放在 SAOME-REBUILD 子目錄，必須在 PR 描述明確說明理由並更新 AGENTS.md。）

### 必含檔案
每個 saome-* repo 必須有：
- `AGENTS.md`（repo 入口、規範摘要）
- `README.md`（repo 對外說明）
- `.gitignore`（defensive 版本，見下方範本）
- `wrangler.jsonc`（若用 Cloudflare Workers）
- i18n 命名空間結構（見下方 i18n 章節）

### i18n 雙語 SOP

新 repo 若涉及 UI 字串，必須依 `023-shared-package.mdc` 建立 i18n 結構：
1. `packages/shared/i18n/` 放 per-namespace `.ts` 檔（如 `auth.zh-TW.ts`、`auth.en.ts`）
2. namespace key 必為 camelCase（如 `auth`、`dashboard`）
3. 禁止 `translation` namespace（已拆分為 feature namespace）
4. 翻譯紀律：zh-TW 全中文、en 全英文，禁止中英夾雜

### Defensive .gitignore 範本（所有 saome-* repo 必含）

```
# Owner-agent private state — 不應出現在任何 saome-* repo
.cursor/
runs/improvements/    # 規範層 feedback 留在 SAOME-REBUILD，不要外洩到業主 repo
mu-plugins/
specs/                # 規格只在 SAOME-REBUILD，不要外洩
SAOME-REBUILD/        # 防誤把上游 monorepo 整包拷進來

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

> **2026-07-28 更新**：從範本移除 `DEV/` 與 `AGENTS.md` — 開發紀錄（DEV）與規範入口（AGENTS.md）現在是 SAOME-REBUILD monorepo 內的「**操作層**」內容，會 commit + push。新拆出的業主 repo 仍應自帶 AGENTS.md（規範入口是每個 repo 必須的），但 DEV/ 開發紀錄不需要外洩。

### 來自 SAOME-REBUILD 的搬入流程

從 `C:\Users\user\Desktop\SAOME-REBUILD\` 抽出 source 進 saome-* repo：
1. 確認 source 在 SAOME-REBUILD 已通過 `tsc --noEmit` + `vitest run` + `npm run build`
2. 用 `git check-ignore -v` 驗證 owner-agent 私房已被 SAOME-REBUILD .gitignore 鎖住
3. 用 `git add -A --dry-run` 驗證 saome-* repo 內 staged 清單不含私房路徑
4. 複製必要檔案 + commit（**不 push**；push 必須等使用者明確指示）

### 禁止

- 把 `.cursor/`、`runs/improvements/`、`AGENTS.md`（SAOME-REBUILD 上游那份）、`specs/`、`mu-plugins/` 推到業主 repo
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