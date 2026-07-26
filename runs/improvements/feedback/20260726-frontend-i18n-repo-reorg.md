# Feedback: 2026-07-26 一日 6 個問題 — 根因 + 修法

**日期**: 2026-07-26
**嚴重性**: 🟠 important
**影響範圍**: Repo 結構 / CI/CD / i18n / 文件

## 背景

2026-07-26 一日內 agent 完成多項任務（legal pages i18n、repo reorganize、CI workflow、Cloudflare deploy），但同時暴露 6 個結構性問題。本篇回饋紀錄每個問題的根因、修法與學習。

## 6 個問題的根因 + 修法

### 1. frontend 檔案亂丟根目錄
**症狀**：使用者報告「agent 把 frontend 的檔案亂丟到根目錄，導致 localhost 抓不到」
**根因**：commit `c975d1f feat: reorganize repo + complete legal pages full bilingual i18n` 用 `git mv` 把 root 全部搬到 `frontend/`，**留下一個空白倉庫**：

- `pic/` — 已被 `.gitignore` 排除（legacy），但工作目錄還在
- `shared/` `design-system/` `backend/` — 只有 build artifact（`.turbo` `dist` `node_modules`），沒 source
- root `node_modules/` — monorepo 實驗留下的

**修法**：
- 接受現狀：保留 `shared/` `design-system/`，標 TODO
- 移除 `pic/` legacy 內容（已 ignore，無 git 影響）

**學習**：大改結構（rename + reorganize）必走 `specs/spec/structure-reorg/` 流程，含明確的 rollback 計畫 + 每階段驗證。

### 2. 混亂 CI/CD 永遠在跟 PR 打架
**症狀**：使用者感覺「混亂的 ci/cd 永遠在跟 PR 打架」
**根因**（**這是今天最嚴重的發現**）：

**`.cursor/` 整個被 `.gitignore` 排除！**

```gitignore
# .gitignore L37
.cursor/
```

這代表 `.cursor/rules/` 跟 `.cursor/skills/` **永遠不會被 commit**。所以：

- 每個新 agent 進場只看 system prompt 注入的 rules 摘要
- 看不到任何本地 rule / skill（除了 system prompt）
- AGENTS.md 列的「16 條 SAOME 鐵律」全部**不存在磁碟上**（只有 system prompt 注入的 always-applied 區段）
- 規則共享機制**完全失效**

加上：

- CI workflow 兩份（root `pnpm` 跟 frontend/ `npm`）—— 你已選擇「兩者都留」
- Cloudflare Dashboard build command 用 `wrangler versions upload`（preview only），不 promote production

**修法**（已實作）：
- 從 `.gitignore` 移除 `.cursor/`
- 新增 `.cursorignore` 擋 Cursor IDE 個人狀態（`agent-transcripts/` `projects/` `plans/` `mcps/`）
- 從今起 `.cursor/rules/*.mdc` 跟 `.cursor/skills/*/SKILL.md` **會被 commit + shared**

**學習**：`.gitignore` 排除整個目錄是危險的；改成精細 ignore（只排除真正該排除的）。

### 3. legal 頁面的 i18n 重構問題
**症狀**：第一輪 commit `b76de54` 之後切英文仍有中文硬編碼
**根因**：第一輪只 cover `TermsPage`，剩 `PrivacyPage` 跟 `GDPRPage` 漏：

- 兩頁共 85 個硬編碼中文字串
- 初次嘗試 `split(/[：:]/)` 拆中文字串 hack（對英文無 separator）→ 後改 `purposeLabel` + `purposeDesc` 雙 key

**修法**：commit `c975d1f` 補完，新增 85 個 leaf i18n keys + 用雙 key 取代 string split hack。

**學習**：

- i18n 重構流程必走：先 scan 所有 page → 列出硬編碼位置 → 補 key → 改 code → 驗證。
- 用 string split 拆中英文 hack 是反模式，必拆雙 key。
- 測試若有硬編碼中文，應該用 `t(...)` 取得後比對，避免 typo（今天發生「協議」vs「協定」一字之差 bug）。

### 4. wrangler.jsonc 位置
**症狀**：wrangler.jsonc 在 root（`commit 8ebdd27 fix(deploy): move wrangler.jsonc to repo root`），使用者不確定是否正確
**根因**：Cloudflare Workers **convention** 預期 `wrangler.jsonc` 在 repo 根。`assets.directory: "./frontend/dist"` 指 subfolder 是野生解法（Cloudflare 對 monorepo 支援有限）。

**修法**：保留 root 位置 + 加註解解釋：

```jsonc
// Why this file is at repo root (not frontend/):
// - Cloudflare Workers conventionally looks for wrangler.jsonc at the repo root
// - Our frontend lives in frontend/ subfolder (monorepo layout), so
//   `assets.directory` points into that subfolder.
```

**學習**：Cloudflare 工具對 monorepo 支援有限，必查官方文件確認 convention。

### 5. DEV doc 跟 large commit 混在一起
**症狀**：commit `c975d1f` 一次混 100+ 檔案 rename + DEV doc + i18n
**根因**：commit message 內部有「Major changes in 3 logical sections」分段，但**實際上是 1 個 commit**。

**修法**（已部分實作）：**從今起嚴格執行「一個 commit 一件事」**。本次 cleanup 拆成：

- `docs(readme): rewrite root README to reflect SAOME frontend reality`
- `chore(wrangler): add explanatory comments for monorepo layout`
- `chore(gitignore): whitelist .cursor/, add .cursorignore for personal state`
- `docs(structure): mark shared/ and design-system/ as TODO placeholders`
- `docs(feedback): record today's 6 issues and root causes`

**學習**：

- 一個 commit 一個 logical change
- Rename 100+ 檔必走 spec + 多個 commit（每個目錄一個）
- DEV doc 必獨立 commit

### 6. Frontend README 永遠不更新
**症狀**：root `README.md` 從 13h 前 initial commit 開始就是 Vite 預設 template
**根因**：agent 從未主動對齊 README 與現實；沒人指派「README 也要更新」

**修法**（已實作）：重寫 root `README.md`：

- 標題改為「SAOME — 多租戶會員忠誠平台」
- 移除 Vite 預設模板文字
- 加：線上環境、技術棧、repo 結構、開發流程、規範

**學習**：每完成一個 PR，README 必須一起 review（如果結構有變）。

---

## 額外發現

- **AGENTS.md 列的 16 個 rules 只有 `008-github-repo-structure.mdc` 真的存在**——其餘 15 個從未寫入磁碟，僅在 system prompt 注入。
- **`.github/workflows/deploy.yml` 兩份**（root pnpm 跟 frontend/ npm）——已決定保留兩份。
- **`backend/` `shared/` `design-system/` 只有 build artifact**——已加 `TODO.md` 標記未來才重建。

---

## 對應規則 / Skill

新發現必須 reflect 到 rules：

- `001-methodology.mdc`：加 i18n 重構 SOP（先 scan → 補 key → 改 code）
- `008-github-repo-structure.mdc`：加 monorepo 結構提醒
- `011-dev.mdc`：加「一個 commit 一件事」鐵律
- 新建 `009-monorepo.mdc`：定義 monorepo 完整前提（root package.json + pnpm-workspace.yaml + turbo.json 缺一不可）

---

## 後續 Action

- [ ] 驗證 cleanup PR 完整（tsc / vitest / build / push → Cloudflare 自動 deploy）
- [ ] 等 backend 真正啟動時，重建 `shared/` 跟 `design-system/`
- [ ] 每週 review 一次 `runs/improvements/feedback/` 並合併到 rules

---

## 影響評估

| 面向 | 影響 |
|------|------|
| 生產力 | 一天浪費 3-4 hr 在結構問題 |
| 規範 | `.cursor/` 被 git ignore 整個規範失效 |
| 預防 | 沒有 self-improvement 流程 |