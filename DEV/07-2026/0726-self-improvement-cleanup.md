# 2026-07-26 Self-Improvement Cleanup

## Session Summary

### 任務
延續昨日（`DEV/07-2026/0726-dev.md` + `DEV/07-2026/0726-legal-pages-i18n.md`）的反饋：使用者要求做反省與改正 6 個結構性問題。

### 6 個問題（使用者列舉）

1. frontend 檔案亂丟根目錄
2. 混亂的 CI/CD 永遠跟 PR 打架
3. legal 頁面 i18n 重構問題
4. wrangler.jsonc 位置不確定
5. DEV 跟 large commit 混在一起
6. frontend README 永遠不更新

### 最重要的根因發現

**`.cursor/` 在 `.gitignore` 內被完全排除**，導致：

- 所有 rules/ 跟 skills/ 永遠不會被 commit
- 新 agent 進場看不到磁碟上的規則，只能依賴 system prompt 注入
- AGENTS.md 列的「16 條 SAOME 鐵律」實際只有 `008-github-repo-structure.mdc` 真的存在
- 「CI/CD 跟 PR 打架」的實際原因之一：rules 沒 commit → agent 規範無從驗證

### 進行的 SDD/BDD/TDD 流程

不走 SDD 流程（這是 retroactive cleanup，沒新功能）。

### 修改的檔案

#### Commit 1: README 重寫（`2489862`）
- `README.md` — 從 Vite 預設 template 改為 SAOME 多租戶 SaaS landing page

#### Commit 2: wrangler.jsonc 註解（`a58020e`）
- `wrangler.jsonc` — 加註解解釋為什麼 root 位置（Cloudflare convention）

#### Commit 3: gitignore + cursorignore + .cursor track（`949e898`）
- `.gitignore` — 移除 `.cursor/`，加 `coverage/`，改 `runs/` whitelist 邏輯
- `.cursorignore` — 新增，擋 Cursor IDE 個人狀態
- `.cursor/rules/008-github-repo-structure.mdc` — 首次 commit
- `.cursor/skills/saome-github-deploy/SKILL.md` — 首次 commit

#### Commit 4: shared/ design-system/ TODO（`56ee7d9`）
- `shared/TODO.md` — 新增，標記 placeholder 用途
- `design-system/TODO.md` — 新增，標記 MASTER.md 已完整、其餘待補

#### Commit 5: feedback 紀錄（`e09ff34`）
- `runs/improvements/feedback/20260726-frontend-i18n-repo-reorg.md` — 新增，本日反省紀錄

#### Commit 6: 既有 feedback 補 commit（`fa02e6d`）
- `runs/improvements/feedback/20260726-css-tailwind-overridden.md` — 既存但之前被 gitignore 排除，現在補進 track

### 設計決策

1. **保留兩個 CI workflow**（使用者選擇「keep both」）：
   - root `.github/workflows/deploy.yml`（pnpm-based，GitHub 認）
   - `frontend/.github/workflows/deploy.yml`（npm-based，GitHub 不會跑但保留）
2. **`shared/` `design-system/` 保留並加 TODO**（使用者選擇「keep as TODO」）：
   - 等 backend 真正啟動才重建
   - 不污染當前 deploy
3. **`.cursor/` 開放 commit + `.cursorignore` 擋個人狀態**（使用者選擇「whitelist-cursor」）：
   - 從今起 rules/skills 可被 team 共享
   - Cursor 個人狀態（agent-transcripts, projects, plans, mcps）仍被擋

### Verification 結果

- `tsc --noEmit` 0 error ✅
- `npm run build` 成功產出 `frontend/dist`（1839 modules） ✅
- `vitest run` 126/126 全綠 ✅
- 6 個 commit 都成功 push 到 `origin/chore/2026-07-26-self-improvement-cleanup` ✅

### 下一步

- 在 GitHub 開 PR：https://github.com/SaomeRebuild/saome-frontend/pull/new/chore/2026-07-26-self-improvement-cleanup
- merge 到 main → 觸發 Cloudflare Dashboard 自動 deploy（如果 deploy command 改為 `wrangler deploy`）
- 驗證 production URL：https://saome-frontend.josh1989213.workers.dev 顯示 README/wrangler.jsonc 內容（README 變化從 `/` 看，wrangler 透過 build log 看）
- 等 backend 真正啟動時，重建 `shared/` 與 `design-system/`

### 失敗記錄（附錄）

無失敗。所有 commit 一次通過。

### i18n 重要設計

本日無 i18n 變更。

### 與昨日的關聯

- 昨日 `c975d1f` 包含 100+ rename + DEV doc + i18n（mixed commit），今天拆分為 6 個獨立 commit
- 昨日 `b76de54` 漏掉 PrivacyPage / GDPRPage i18n，今天確認已被 `c975d1f` 補完（commit message 內有說明）
- 昨日 `8ebdd27` 移動 wrangler.jsonc 到 root，今天確認這是 Cloudflare convention 並加註解