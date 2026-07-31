# SAOME Self-Improvement Skill

> 觸發條件：任何一次 session 結束前、或是同一個錯誤/盲點第二次出現時，必須引用此 skill。

## 目的

讓每次 session 的「教訓」真的會累積，避免 agent 重複犯同一個錯。
這條 skill 是「補上 AGENTS.md 列的 SAOME 鐵律實際只有一部分存在於磁碟」的斷裂點。

## 何時必須觸發

下列任一情況發生時，**必須**立即引用此 skill：

1. session 結束、要關掉 cursor 之前
2. 同一個結構性問題第二次出現（root cause 重複）
3. 使用者明確要求「反省」「檢討」「改善」「self-improvement」「今天學到什麼」
4. `.cursor/rules/` 內任何檔案被引用卻發現磁碟上不存在
5. `runs/improvements/feedback/` 內有同日多於 1 個 feedback
6. 同一類 deploy / CI 錯誤連續 2 次出現於不同平台（例如 GitHub Actions 與 Cloudflare Pages 同源）

## 流程

### Step 1：寫 feedback
新增檔案 `runs/improvements/feedback/YYYYMMDD-<topic>.md`，至少包含：
- 背景（什麼情境）
- 根因（不是症狀）
- 修法（這次具體做了什麼）
- 學習（下次怎麼預防）

### Step 2：決定要不要 sync 到 rules/skills
如果根因是「規範本身缺失或過時」：
- 在 `.cursor/rules/` 新增或更新對應的 `.mdc`
- 或在 `.cursor/skills/` 新增對應的 `SKILL.md`
- 同步更新 `AGENTS.md` 的索引段

如果根因是「agent 沒照規範做」：
- 加強觸發關鍵字（讓規範更容易被自動引用）
- 或在 `AGENTS.md` 的強制檢查清單加上對應條目

### Step 3：commit（依層級決定 push）

把舊的二極化規則（純反思不 push / 例外可 push）改為「三層決策表」：

| 層級 | 內容範例 | push | commit 標記 |
|------|----------|------|-------------|
| 規範層 | `.cursor/rules/*.mdc`、`AGENTS.md`、`runs/improvements/feedback/*` | **預設 push** | footer `Self-improvement:` + feedback 連結 |
| 操作層 | `apps/frontend/*.config.ts`、`package.json`、`wrangler.jsonc`、CI workflow、`.github/dependabot.yml`、`DEV/` 開發紀錄 | **push** | 一般 `feat:` / `fix:` / `chore:` |
| 私人層 | `projects/`、`.cursor/agents/`、個人 cursor state | **`.gitignore` 鎖住**，不進 commit | 不適用 |

> **2026-07-28 更新**：DEV/ 開發紀錄從「私人層」改為「操作層」 — 你說「開發紀錄要備份」。DEV/ 仍受版控，但 commit 用一般 `feat:` / `fix:` / `chore:` 而非 `Self-improvement:` 標記，因為它不是規範變更。`projects/` 與 `.cursor/agents/` 仍維持私人層。

#### 三層範例

```bash
# 規範層：feedback 修復被誤刪的 rules
git add .cursor/rules/000-modular-design.mdc runs/improvements/feedback/20260727-rules-overwritten-by-speckit-merge.md
git commit -m "fix(rules): restore spec-kit-demo merge 誤刪 12 rules

Self-improvement: runs/improvements/feedback/20260727-rules-overwritten-by-speckit-merge.md"
git push origin main

# 操作層：lockfile 跨平台 binding 重建
git add package-lock.json
git commit -m "fix(deps): regenerate lockfile with --include=optional for cross-platform native bindings"
git push origin main

# 私人層：根本不入 commit，gitignore 直接擋
echo "DEV/" >> .gitignore
echo ".cursor/agents/" >> .gitignore
```

#### 舊規則（已廢除）

~~「純反思不 push / 例外可 push」~~ 二極化規則已於 2026-07-27 廢除。
理由：規範層與操作層的 feedback 不 push 會讓下個 session agent 看不到教訓，誤刪無法還原（見 `runs/improvements/feedback/20260727-rules-overwritten-by-speckit-merge.md`）。

### Step 4：建立下一個 session 的起點
把這次 session 的關鍵決策寫進 `DEV/<MM>-YYYY/<DD>-dev.md`（操作層 — commit + push），讓下次開新 session 第一件事就是讀這份。

## 與其他 skill 的關係

- `saome-github-deploy`：本 skill 處理「deploy 後的反省」，它處理「deploy 本身」
- `saome-new-repo`：本 skill 與它互補——一個管反省、一個管 SOP
- `article-writing`：本 skill 跟 article writing 是兩件事。article 是給讀者看的散文，DEV LOG 是給未來的自己看的 trace。如果使用者說「DEV LOG」「debug log」「事故記錄」「寫個 trace」，走 `saome-dev-logging` skill；說「寫文章」「polish」「polish 一篇」，走 `article-writing` skill。混用會破壞兩者的目的。
- `saome-form-integrity`：debug autofill / schema drift 時的 probe 樣板可參考
- `AGENTS.md`：本 skill 是它的執行延伸——AGENTS.md 列規範，本 skill 補規範缺失

### DEV LOG vs article 判斷口訣

| 訊號 | 走向 |
|---|---|
| 「DEV LOG」「開發日誌」「事故記錄」「debug log」「trace」「寫個 reproduction」 | `saome-dev-logging` |
| 「寫文章」「寫一篇」「polish」「給讀者看」「要發布」 | `article-writing` |
| 修改 `runs/dev/*.md`、`DEV/**/*.md` | 走 DEV LOG 紀律（raw data 優先） |
| 修改 `runs/articles/*.md` | 走 article-style rule（讀者舒服優先） |
| 使用者沒講 | 預設 DEV LOG（SAOME 內部居多） |

## 禁止

- 寫得太長（AI 痕跡風險）
- 寫進 emoji
- 規範層 commit 不寫 `Self-improvement:` 標記
- 跳過 Step 1 直接改 rules