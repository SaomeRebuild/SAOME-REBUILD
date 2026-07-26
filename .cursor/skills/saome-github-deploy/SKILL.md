# SAOME GitHub Deploy Skill

> 標準化 GitHub repo 建立與部署流程。

## 何時使用

當使用者提到以下關鍵字時，**必須**引用此 skill：

- 「上傳到 GitHub」
- 「建立新 repo」
- 「push 到 origin」
- 「初始化新專案」
- 「同步到 GitHub」

## 觸發流程

```
┌─────────────────────────────────────────────┐
│  1. 識別專案類型                              │
│     ├── frontend → saome-frontend            │
│     ├── backend → saome-backend              │
│     └── api → saome-api                      │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│  2. 預檢查（Pre-flight Check）               │
│     ├── tsc --noEmit                        │
│     ├── npm run build                       │
│     └── 必要檔案存在？                        │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│  3. GitHub 建立 Repo                         │
│     └── 開啟網頁讓 user 建立：                │
│         github.com/new                       │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│  4. Git 初始化與推送                         │
│     ├── git init (如需要)                    │
│     ├── git add . && git commit             │
│     ├── git branch -M main                  │
│     ├── git remote add origin               │
│     └── git push -u origin main             │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│  5. 清理舊分支                               │
│     └── 刪除 master/development             │
└─────────────────────────────────────────────┘
```

## 詳細步驟指令

### Step 1：識別專案類型

根據本地資料夾判斷 repo 名稱：

| 本地資料夾 | Repo 名稱 | 技術棧 |
|-----------|-----------|--------|
| `frontend/` | `saome-frontend` | React 19 / Vite / TypeScript |
| `backend/` | `saome-backend` | Hono / Cloudflare Workers |
| `api/` | `saome-api` | Hono / Edge Functions |
| `supabase/` | `saome_db` | Supabase（不在此規範） |

### Step 2：預檢查

在 git 操作前，**必須**執行：

```powershell
# TypeScript 檢查
npm run typecheck  # 或 npx tsc --noEmit

# Build 檢查
npm run build

# 必要檔案檢查
Test-Path AGENTS.md
Test-Path README.md
Test-Path .gitignore
```

### Step 3：GitHub 建立 Repo

**由使用者親自建立**（需要 GitHub 登入）：

```
https://github.com/new
```

Repo 設定：
- Repository name：`saome-frontend` / `saome-backend` / `saome-api`
- Private / Public：依需求
- **不要勾選**「Initialize this repository with a README」（稍後手動建立）
- Default branch：`main`

### Step 4：Git 初始化與推送

```powershell
# 如果是新專案（沒有 .git）
git init

# 確保在正確目錄
Set-Location "path/to/repo"

# 建立必要檔案
# （如果還沒有 AGENTS.md, README.md, .gitignore）
# 見下方「必要檔案範本」

# Stage 與 Commit
git add .
git commit -m "chore: initial commit"

# 設定 main 分支
git branch -M main

# 關聯遠端
git remote add origin https://github.com/SaomeRebuild/{repo名}.git

# 推送
git push -u origin main
```

### Step 5：清理舊分支

```powershell
# 刪除 master（如果存在）
git push origin --delete master 2>$null

# 刪除其他舊分支
git push origin --delete development 2>$null
git push origin --delete dev 2>$null
```

## 必要檔案範本

### AGENTS.md（必要）

每個 repo 必須有 `AGENTS.md`，內容需包含：

```markdown
# {Repo 名稱} Agent 入口

> 技術棧：{技術棧}
> 建立日期：{日期}

## 技術棧

- {技術 1}
- {技術 2}

## 啟動

```bash
npm install
npm run dev
```

## 架構

（簡短描述專案結構）

## 已知問題

（目前沒有 / 待修復的問題）
```

### README.md

```markdown
# {Repo 名稱}

> 簡短描述

## 技術棧

- 技術 1
- 技術 2

## 開始使用

```bash
npm install
npm run dev
```

## 環境變數

請參考 `.env.example`。
```

### .gitignore（Frontend 範本）

```
node_modules/
dist/
.env
.env.local
.env.production
*.log
.DS_Store
```

### .gitignore（Backend 範本）

```
node_modules/
dist/
.env
.wrangler/
.dev.vars
*.log
```

## 驗證清單

Deploy 完成後，**必須**確認：

- [ ] GitHub 上 repo 可見
- [ ] 點擊 repo 可看到程式碼
- [ ] `main` 是預設分支
- [ ] 舊分支已刪除
- [ ] 沒有 `.env` 或 credentials 在 repo 中

## 錯誤處理

| 錯誤 | 解決方式 |
|------|---------|
| `refusing to delete the current branch` | 先切換到 main，再刪除舊分支 |
| `remote origin already exists` | `git remote set-url origin {新 url}` |
| `master` 無法刪除 | 透過 GitHub Web UI 刪除 |
| `Authentication failed` | 檢查 GitHub token 權限 |

## 與其他規則的關係

- `008-github-repo-structure.mdc`：定義 repo 結構標準
- `011-dev.mdc`：每次 commit 需記錄 GitHub sync 狀態
- `006-verification.mdc`：完成後需驗證
