# Decision：檔案寫入工具選擇優先序（Rule 040）

> 日期：2026-10-26 ｜ 分類：規範層（rules / AGENTS.md / CI gate）

## 背景

盤點 34 個 `.cursor/rules/*.mdc` + 2 個 `AGENTS.md` 後確認：**agents 偏愛寫一次性 Node 腳本，而不是使用 Cursor 的 `Write` / `StrReplace` 工具**，這不是 agent 的自由意志，而是規則文字的副作用。

三條直接來源：

1. **Rule 039 §1 的「Required instead」是三個平級 bullet**（`Write` / `StrReplace` / Node script），沒有優先序；§6 更說「prefer bash / Git Bash **or a Node script** over PowerShell」。
2. **Rule 038 的解方範例全指向 shell**（`Grep` → `Read` → `Shell 腳本`），每個 session 都建立 script-first 肌肉記憶。
3. **一份 2026-08-12 的 decision doc 直接寫「不要用 Write tool 寫中文（會腐化）」**，與 Rule 039 §2「Cursor Write / StrReplace 寫 UTF-8」直接矛盾，且 agent 讀 decision doc 的機率高於讀 rule 細節。

後果已經發生：`scripts/fix-*.cjs` 三支一次性修復腳本進了版本庫；`scripts/.repair-hyperdrive/` 單次 session 產出 1,001 個檔案 / 1.4 MB；`vite-alias-probe.tmp.mjs` 留在 repo 根；`apps/backend/src/__probe_sql.ts` orphan 留在 `src/` 內導致 backend build TS2345。

## 選項與決定

### 選項 A：只在 Rule 039 補一句「優先用 Cursor 工具」

- **優點**：改動最小，1 個檔案。
- **缺點**：Rule 039 的問題正是「平級 bullet 沒優先序」；補一句軟性建議不會改變結構，script-first 的肌肉記憶照舊。**不採用。**

### 選項 B：獨立 Rule 040 定義決策樹 + fallback 量化門檻 + CI gate（✅ 採用）

- 新建 `.cursor/rules/040-file-write-tool-precedence.mdc`（`alwaysApply: true`），定義四步決策樹（新建 → `Write`；改既有 → `Read` + `StrReplace`；≥3 檔機械式重複 → 腳本；全檔重寫 → 分段 `StrReplace`）。
- Node 腳本降級為 fallback，且必須同時滿足三條件：**放 OS temp 目錄 + 用完即刪 + 說明為何 Cursor 工具不適用**；量化門檻「同一 pattern 套用 ≥ 3 個檔案」。
- Rule 039 改寫 §1 / §2 / §6 指向 Rule 040，**PowerShell 禁用清單完全不動**（那部分規則有效）。
- AGENTS.md 兩處（「或用 Node/Python 腳本」）改成指向決策樹第 3 條。
- 新建 `scripts/check-oneoff-scripts.cjs`（exit 0 / 1 / 2，照 `check-migrations-applied.cjs` 形狀）+ root `package.json` `check:oneoff` + CI `oneoff` job + `.gitignore` 規則。
- 修正三份誤導性歷史文件（decision doc 加 superseded、DEV LOG 與 feedback 各加更正註記，**原文保留**，raw data 紀律）。
- 刪除 3 支一次性 `fix-*.cjs` + 未追蹤的 `vite-alias-probe.tmp.mjs`，保留 3 支常態工具（`dev-restart.ps1` / `.cmd` / `health-check.ps1`）與 6 支永久 tracked `tests/probe/*.ts`。

**決定理由**：規則必須寫**優先序**而非列選項；script-first 預設一旦建立，靠軟性措辭改不回來。而且 agent 自律擋不住「這支腳本很有用」的判斷 —— 必須有 CI gate 才有效（本次已實測 negative case：手動製造 3 類違規檔 → gate exit 1 並指名檔案）。

### 選項 C：直接禁止所有 shell 腳本寫檔（含 temp 目錄）

- **優點**：最簡單，零例外。
- **缺點**：同一 pattern 套 10 個檔案時，agent 會被迫做 10 次 `Read` + 10 次 `StrReplace`，且無法保證一致性；且「禁止」不如「明確門檻」可執行。**不採用。**

### 選項 D：把 Node 腳本正式化為 repo 內的 `scripts/` 常態工具（允許但需 code review）

- **優點**：腳本可重用、可審查。
- **缺點**：本次損害全部來自「一次性修復腳本」被當常態工具 commit；正式化等於給一次性產物提供合法棲身處，與要解決的問題相反。**不採用。**

## 影響

### 規範層

- `.cursor/rules/040-file-write-tool-precedence.mdc`（新）成為**寫檔工具選擇的權威來源**；039 退為「PowerShell 禁用 + 註解英文」專責。
- 編號 040 與 INDEX 裡兩個從未落地成檔案的「Rule 040（草案）= Live capture is mandatory」撞號 —— 以**已落地成檔案者優先**，未來落地 Live capture 規則應改用 041。
- Rule 038 的 script-first 副作用**未在本決策內消除**（只改寫檔段落，讀檔段落未動）；若要徹底消除需另開決策改 038 §1。

### 操作層

- 新增 CI job `oneoff`（觸發條件：`scripts/**` / `**/*.cjs` / repo 根 probe 檔），帶 `cache-dependency-path: 'package-lock.json'`（Rule 016 surface 9）。
- root `package.json` 新增 `check:oneoff` script —— **不動任何 dependency，故 `package-lock.json` 不需重產**（npm lockfile 不記錄 scripts）。
- `.gitignore` 新增 `scripts/*.cjs`（以 `!scripts/check-oneoff-scripts.cjs` 除外）+ repo 根 probe 規則。既有 `apps/backend/scripts/probe-*.{ts,mjs,cjs}` 規則保留不動。
- `scripts/` 內容從 6 檔變為 4 檔（3 支常態工具 + 1 支 CI gate）。

### 既有元件與歷史文件

- 三份歷史文件**只加更正註記、不改寫原文**（DEV LOG raw data 紀律）：`runs/decisions/2026-08-12-i18n-test-fix-prompt.md` 加 `Superseded (2026-10-26)` 區塊並改寫其禁止清單條目；DEV LOG L396 與 feedback §5.2 各加一段更正。
- `apps/backend/AGENTS.md` 的 3 層 CORS / migration 段落不涉及寫檔工具，本次不動。
- **無 DB schema 變更、無 migration** → Rule 035 不觸發；**無 shared schema 變更** → Rule 019 四層同步不觸發。

### 未來 session 的約束

- 任何寫檔前必須走 Rule 040 決策樹。
- 腳本 fallback 必須在 commit 訊息或 session 結尾說明為何 Cursor 工具不適用。
- `npm run check:oneoff` 必須 exit 0 才能 close session。
