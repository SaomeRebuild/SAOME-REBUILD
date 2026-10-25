# Node script bias 根因分析 — agents 為什麼偏愛寫腳本而不是用 Cursor 工具

> 日期：2026-10-26 ｜ 分類：規範層（rules / AGENTS.md / feedback）｜ 級距：L3 Heavy

## 背景

盤點 34 個 `.cursor/rules/*.mdc` + `AGENTS.md` + `apps/backend/AGENTS.md` 後發現：**agents 偏愛 Node 腳本不是自由意志，而是三條規則文字的副作用**。當時 repo 內已累積多支一次性修復腳本與 probe 殘留。

觀察到的實際損害：

| 產物 | 狀態 | 證據 |
|---|---|---|
| `scripts/fix-powershell-encoding-corruption.cjs` | tracked | 一次性修復腳本進了版本庫 |
| `scripts/fix-missing-paren.cjs` | tracked | 同上 |
| `scripts/fix-corrupted-regex-broader.cjs` | tracked | 同上 |
| `scripts/.repair-hyperdrive/` | 已刪 | 單次 session 產出 **1,001 個檔案 / 1.4 MB**（8 支 probe 腳本 + 1000+ extracted 片段）|
| `vite-alias-probe.tmp.mjs` | untracked，留在 repo 根 | `git status` 可見 |
| `apps/backend/src/__probe_sql.ts` | orphan，留在 `src/` 內 | 導致 backend build 失敗 TS2345 |

## 根因（不是症狀）

### 原因 1 — Rule 039 把 Node 腳本寫成「第三種合法選項」

`.cursor/rules/039-powershell-free-code-authoring.mdc` §1 的「Required instead」原本是三個**平級** bullet：

```
- Cursor's `Write` tool for new files.
- Cursor's `StrReplace` tool for edits to existing files (...)
- A Node.js script for programmatic or bulk edits, always with an explicit UTF-8 encoding
```

三個選項沒有優先序，只標了「programmatic or bulk edits」這個模糊條件。agent 面對模糊條件會選**最不容易出錯**的路徑 —— 腳本可重跑、可 diff、可驗證，`StrReplace` 失敗就整段卡住。

§6 更直接推一把：

> When an interactive shell is needed, prefer **bash / Git Bash** or a **Node script** over PowerShell.

Rule 039 全文 16 次提到 Node/Python，AGENTS.md 4 次（兩處寫「或用明確指定 UTF-8 的 Node/Python 腳本」）。

### 原因 2 — Rule 038 明確指示「改用腳本處理」

`.cursor/rules/038-context-budget-discipline.mdc` 是 alwaysApply，解方範例全是 `Grep` → `Read` → `Shell` 腳本。配合 `runs/improvements/feedback/20261025-successful-session-pattern-and-sustainment.md` §4.2 B8：

> agent 的 Read 數逼近 12 → 主動收手：把「讀檔」換成「Grep + Shell 腳本 / byte-level 腳本」處理

B5 又說「throwaway probe 一律放 OS temp 目錄」—— 這是在**建立 script-first 的預設**。Rule 038 解決的是 context 爆掉，但副作用是每個 session 都先建立「跑腳本」的肌肉記憶。

### 原因 3 — 一份舊 decision doc 直接說「Write tool 會腐化」

`runs/decisions/2026-08-12-i18n-test-fix-prompt.md` 原文：

> **UTF-8 編碼**：寫入中文時用 `node -e "..."` 或 `.mjs` 腳本，**不要**用 Write tool 直接寫中文（會腐化）

L135 再加一刀「❌ 用 Write tool 直接寫入大量中文（會腐化）」。

這跟 Rule 039 §2 的「Cursor `Write` / `StrReplace`（these write UTF-8）」**直接矛盾**，而且寫在 `runs/decisions/` 裡 —— agent 讀 decision doc 的機率遠高於讀 rule 的細節。這份 doc 是 2026-08-12 的，比 Rule 039 早，但沒被標記 superseded。

### 原因 4 — DEV LOG / feedback 把「StrReplace 拼 CJK 會壞」的因果寫錯

`DEV/10-2026/1012-step8-passcreator-api-implementation-master-dev-log.md` L396：

> 大規模 test rewrite 走 StrReplace 拼 CJK 字串容易把檔案弄壞 ... **下次改 test file 整個文件時用 Python script 一次寫完整 utf-8 編碼，不要走 Shell StrReplace 拼字串**

`runs/improvements/feedback/20261012-step8-passcreator-v12-followup-primary-secondary.md` §5.2 第 2 條同義重述。

問題在於這把「**Shell** StrReplace」（把 StrReplace 內容經 PowerShell 傳遞）誤寫成「StrReplace 本身不適合 CJK」。真正的根因是**Shell 管道**，不是 Cursor 的 StrReplace tool。這個錯誤診斷被寫進 feedback 後，就變成「下次改大檔用 Python script」—— 正好指向 scripts。

## 修法（7 個 phase）

### Phase 1 — 新建 Rule 040：檔案寫入工具選擇優先序

新檔 `.cursor/rules/040-file-write-tool-precedence.mdc`（`alwaysApply: true`），建立明確三層優先序，取代 Rule 039 的平級三選一：

1. **新建檔** → Cursor `Write` tool，沒有例外
2. **修改既有檔** → Cursor `Read` + `StrReplace`
3. **同一 pattern 套用到 ≥ 3 個檔案**（機械式重複）→ 才用 Node 腳本，且必須同時滿足三條件：放 OS temp 目錄 / 用完即刪 / 說明為何 Cursor 工具不適用
4. **全檔重寫**（> 300 行且改動 > 50%）→ 仍用 `Read` + 分段 `StrReplace`；連續 2 次失敗才升級

量化門檻「≥ 3 檔」是為了防止 agent 自我合理化（「這個檔案很大，StrReplace 不好用」）。

### Phase 2 — 改寫 Rule 039 §1 / §2 / §6

- §1 三個平級 bullet → 改成指向 Rule 040 的單一權威段落
- §2 補一句明說：**Cursor 的 Write / StrReplace 本身不會腐化中文**，腐化只發生在 shell 管道
- §6 「prefer bash / Git Bash or a Node script over PowerShell」→ 改成「read-only shell 用 bash；寫檔一律回到 Cursor 工具」
- PowerShell 禁用清單**完全不動** —— 那部分規則是對的

### Phase 3 — 修正三份誤導性歷史文件

1. `runs/decisions/2026-08-12-i18n-test-fix-prompt.md` → 加 `Superseded (2026-10-26)` 區塊 + 改寫禁止清單條目
2. `DEV/10-2026/1012-...-master-dev-log.md` L396 → 保留原文（DEV LOG 是 raw data），同段加更正註記
3. `runs/improvements/feedback/20261012-...-followup-primary-secondary.md` §5.2 第 2 條 → 補更正註記

### Phase 4 — AGENTS.md 對齊

L147（強制檢查清單）+ L214（禁止清單）兩處「或用明確指定 UTF-8 的 Node/Python 腳本」改成指向 Rule 040 決策樹第 3 條；強制檢查清單另加一條 Rule 040 條目。

### Phase 5 — 清理既有一次性腳本

先做 destructive audit（`git ls-tree -r HEAD --name-only -- scripts/` = 6 檔），刪 3 檔、留 3 檔：

| 動作 | 檔案 | 理由 |
|---|---|---|
| 刪 | `scripts/fix-powershell-encoding-corruption.cjs` | 一次性修復，編碼問題已由 Rule 039 根治 |
| 刪 | `scripts/fix-missing-paren.cjs` | 一次性修復 |
| 刪 | `scripts/fix-corrupted-regex-broader.cjs` | 一次性修復 |
| 保留 | `scripts/dev-restart.ps1` / `.cmd` | 常態工具（saome-dev-servers skill 依賴）|
| 保留 | `scripts/health-check.ps1` | 常態工具 |

另刪未追蹤的 `vite-alias-probe.tmp.mjs`（repo 根）。

**保留確認**：`tests/probe/*.ts` 6 檔是**永久** tracked probe（`register-probe.ts` 被 Rule 018 引用為範本），不在本次刪除範圍。

### Phase 6 — CI gate 擋復發

新檔 `scripts/check-oneoff-scripts.cjs`（exit 0 / 1 / 2，形狀照 `apps/backend/scripts/check-migrations-applied.cjs`），檢查三件事：

1. `scripts/` 下除白名單外不得有 `.cjs` / `.mjs` / `.ts`
2. `apps/backend/src/`、`apps/frontend/src/`、`packages/shared/` 內不得有 `__probe_*` / `*probe*.ts`
3. repo 根不得有 `*.tmp.mjs` / `*.tmp.cjs` / `vite-*-probe.*`

配套：root `package.json` 加 `"check:oneoff"`；`.github/workflows/deploy.yml` 加 `oneoff` job（含 `cache-dependency-path: 'package-lock.json'`，Rule 016 surface 9）；`.gitignore` 補 `scripts/*.cjs`（`!scripts/check-oneoff-scripts.cjs` 除外）+ repo 根 probe 規則。

### Phase 7 — Feedback + INDEX + Decision Log

本檔 + `runs/improvements/INDEX.md` pending entry + `runs/decisions/2026-10-26-file-write-tool-precedence.md`。

## 學習

### (1) 「允許 A 或 B」在 agent 規則裡等於「允許 A」

把 Node 腳本寫成跟 Cursor 工具**平級**的合法選項，agent 就會選它 —— 因為 script-first 對 agent 成本更低（可重跑、可 diff、可驗證），而 `StrReplace` 失敗就整段卡住。**規則要寫優先序，不是列選項。** 平級 bullet 是最容易被 agent 忽略的寫法。

### (2) 規則的副作用可能比規則的目標更持久

Rule 038 的目標是「防止 context 爆掉」，做法指向 shell 腳本 —— 副作用是每個 session 建立 script-first 肌肉記憶。**新增規則前要問：這條規則的解方會不會建立另一種預設？**

### (3) 歷史文件的錯誤診斷會蓋過現行規則

`runs/decisions/2026-08-12-...` 說「Write tool 會腐化」，跟 Rule 039 直接矛盾，但 agent 讀 decision doc 的機率遠高於讀 rule 細節。**規則更新時必須同步標記 superseded 的歷史文件**，否則舊診斷會持續生產新 script。

### (4) 診斷錯根因會把修法引到錯的工具上

「Shell StrReplace 拼 CJK 會壞」vs「StrReplace 不適合 CJK」—— 差一個詞，修法完全不同：前者是「不要經 shell 傳遞」，後者是「改用 Python script」。**寫事故紀錄時要區分『哪一層出錯』**（編輯器工具 / shell 傳遞 / 檔案系統編碼）。

### (5) 沒有量化門檻的規則會被 agent 自我合理化繞過

「bulk edits」聽起來合理，但 1 個檔案也可以叫 bulk。`≥ 3 檔 + temp 目錄 + 用完即刪 + 說明原因` 四條件並存才過關。

### (6) 一次性產物要靠 CI gate 擋，不能靠 agent 自律

三支 `fix-*.cjs` 都是 agent 自認「這支腳本很有用」時建立的，靠 rule 文字擋不住。`check:oneoff` 這個 179 行的腳本比任何一段 rule 文字都有效。

### (7) 守門腳本本身要測「會 fail」

跟 2026-10-26 CardBuilder i18n feedback 的第 3 條教訓同源：永遠 pass 的守門比沒有守門更危險。本次已實測 negative case（手動製造 `scripts/foo.cjs` + `apps/backend/src/__probe_tmp.ts` + `vite-test-probe.tmp.mjs` → gate exit 1 並指名 3 個檔案）。

## 順帶發現（未處理，記錄待辦）

- `runs/improvements/INDEX.md` 有兩處引用「**Rule 040**（草案）= Live capture is mandatory」（2026-10-18 / 2026-10-19 的 passcreator feedback）。那是**從未落地成檔案的草案提案**，與本次 Rule 040（file write tool precedence）編號撞號。本次以「已落地成檔案者優先」為準 —— 檔案優先序（040 → 041）被草案引用優先序。**未來若要落地 Live capture 規則，應改用 041。**
- `.cursor/rules/038-context-budget-discipline.mdc` 的 script-first 副作用仍在（本次只改 Rule 039 / AGENTS.md 的寫檔段落，038 的讀檔段落未動）。若要徹底消除 script-first 預設，038 §1 需補「寫檔回 Cursor 工具」的交叉引用。
- Rule 037 §6 的 pre-commit hook 至今 0 個落地（屬既有 S4 待辦，不在本次範圍）。

## 參照

- `.cursor/rules/040-file-write-tool-precedence.mdc` — 本次新建的權威優先序
- `.cursor/rules/039-powershell-free-code-authoring.mdc` §1 / §2 / §6 — 本次改寫處
- `runs/decisions/2026-10-26-file-write-tool-precedence.md` — 三段式決策紀錄
- `scripts/check-oneoff-scripts.cjs` — CI gate 實作
- `runs/improvements/feedback/20261026-cardbuilder-step8-i18n-object-key.md` — 同一週的「守門有效性必測」教訓
