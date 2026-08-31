# Feedback: SAOME Dev Server 啟動流程自動化 (2026-09-01)

## 背景

今天 (2026-09-01) 在清 port 8687 / 5173 時發現:

- `apps/backend/.wrangler/tmp/` 累積 6 個 orphan 目錄 (`bundle-ciD9iy` / `bundle-mUyKkX` / `bundle-pzaIug` / `dev-IvPqR7` / `dev-QfDU6v` / `dev-t6T2N0`),其中最早一個是 2026-08-31
- `netstat -ano` 顯示 PID 19000 (wrangler) 與 23728 (vite) 兩個都是 IDE 起的 (ancestor PID 4824 = `Code.exe`)
- 每次開新 terminal 重啟 backend + frontend,要手動跑 5-10 分鐘:`netstat` → `taskkill` → `wrangler logout && wrangler login`(token 過期) → `wrangler dev` → `vite`
- 現有 SKILL `saome-dev-servers` 是「4 步手動清單」,對重複啟動的痛點沒任何自動化
- PowerShell zh-TW console 預設 CP950,任何中文輸出都壞(實測剛才 `LastWriteTime` 欄印出 `上午` 變 `W`)

觸發條件:每天至少 1 次重啟,痛點高頻。

## 症狀

1. **`taskkill /IM node.exe /F` 是核武**:會把 Cursor IDE 的 helper node 一起殺掉,IDE 須重啟。實測:目前 wrangler (PID 19000) 跟 vite (PID 23728) 的祖父 process 都是 `Code.exe` (PID 4824),所以殺 wrangler 等於砍 IDE 子樹。
2. **沒有 PID tracking 機制**:re-run `npx wrangler dev --port 8787 --remote` 會跟還在跑的 wrangler 競爭同 port → EADDRINUSE。要先手動 netstat + 比對。
3. **`.wrangler/tmp/dev-*` 沒人清**:wrangler dev 每次會建一個 `dev-<random>` 目錄當 build cache,wrangler crash 或被 kill 時留著。累計 6 個、佔幾十 MB,沒機制清。
4. **Exit 不結構化**:`wrangler dev` 失敗時只印 `Error: ...`,沒有 exit code,腳本無法判斷。
5. **Console encoding**:zh-TW Windows 預設 CP950,新寫的 PS script 不處理 UTF-8,中文輸出全壞。

## 修法

建立 6-phase orchestrator `scripts/dev-restart.ps1` + `.cmd` shim,把 kill / cleanup / start / health 全自動化:

| Phase | 動作 |
|---|---|
| [1/6] Recon | `Get-NetTCPConnection` + `Get-CimInstance Win32_Process` 印 listener table;`wrangler whoami` auth 快速檢查 |
| [2/6] Surgical kill | Port → PID → WMI `ParentProcessId` 走父鏈。祖先含 `Code.exe` / `Cursor.exe` 時只殺 leaf + 警告 user (除非 `-Force`) |
| [3/6] Tmp cleanup | 走 `apps/backend/.wrangler/tmp/dev-*`,B-policy:只清「PID 死掉 + mtime > 24h」,保留最近 build error 給 debug |
| [4/6] Start backend | `Start-Process npx wrangler dev --port 8787 --remote` → `logs/backend.log`(stdout/stderr 各自 redirect) |
| [5/6] Start frontend | 同上,vite → `logs/frontend.log` |
| [6/6] Health check | `Invoke-WebRequest` 30 秒 retry loop;Backend 期望 200-499(Hono 預設 404);Frontend 期望 200 |

**5 flags**:`-Force` (跳過 kill confirmation) / `-SkipCleanup`+`-SkipTmp` (跳過 Phase 3) / `-HealthOnly` (只跑 Recon+Health) / `-Status` (只跑 Recon,read-only)。`-HealthOnly` 跟 `-Status` 互斥,後者優先,同時給 exit 65。

**6 exit codes**:0 (全綠) / 1 (backend fail) / 2 (frontend fail) / 3 (both fail) / 64 (user cancel) / 65 (param error)。

**PowerShell UTF-8 三行**:script 第一行強制設定 `[Console]::OutputEncoding` + `$OutputEncoding` + `chcp 65001`,否則 zh-TW console 全壞。

**PID tracking**:用 `.dev-restart.pids.tmp` (副檔名 `.tmp` 自動被 `.gitignore` 的 `*.tmp` rule 涵蓋),記錄 backend/frontend PID + 啟動時間。`-HealthOnly` 對比 pid file vs current `Get-Process`,知道哪些是我們起的、哪些是外部 IDE helper。

**`.cmd` shim**:3 行 `powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev-restart.ps1" %*`,繞過 PowerShell Execution Policy 預設 Restricted。

## 學習

1. **PowerShell zh-TW console 預設 CP950**:script top-of-file 必須 UTF-8 三行設定,否則任何中文訊息 (Phase 名、Recon 表格的「State / Listen」) 全壞成 `W` 亂碼。
2. **WMI `ParentProcessId` 是 surgical kill 的關鍵**:沒這層就回到 nuclear `taskkill /IM node.exe /F`,每次砍到 IDE 都要重啟 Cursor。
3. **Health check 不能只看 port listen**:port 在 listen 不代表 wrangler 已經 ready(還在 preview upload)。要 `Invoke-WebRequest` 探 HTTP status,Backend 接受 200-499(Hono 預設 404)、Frontend 必須 200。
4. **PID file 不是 best practice 是 necessity**:orchestrator 一定要 hold state,否則 `-HealthOnly` 無法分辨「自己起的」vs「外部 node.exe」(IDE helper)。命名用 `.tmp` 副檔名自動 git-ignore,免改 `.gitignore`。
5. **`.cmd` shim 是 PowerShell 進 Windows 開發環境的最低摩擦入口**:3 行就繞過 Execution Policy;比教 user `Set-ExecutionPolicy RemoteSigned` 友善。
6. **Tmp cleanup B-policy (mtime > 24h)** 比 A-policy (每次清) 安全:保留「wrangler 剛掛掉但 log 還沒看」的 dir,給 debug 留 window。實測今天累積 6 個裡面 3 個 > 24h,3 個 < 24h → B-policy 清 3 個,比「全殺」少刪 50%。

## 後續追蹤

- 觀察 `-Force` 是否常被使用(代表 surgical kill 太保守,可能要改 ancestor 策略)
- 觀察 `-Status` 是否常被使用(代表 debug 「到底有沒有起來」痛點是否仍高頻)
- Phase 6 health probe 目前只看 HTTP status;若要 deep check,可加 backend `/healthz` endpoint(獨立 PR,本任務 out-of-scope)
- 觀察 wrangler token 是否仍每 24h 過期(影響 Phase 1 Recon 的 whoami 警告是否有效)

## 同步狀態

- 本地 commit: pending (single commit with code + feedback + INDEX, per rule 011-dev)
- Remote sync: pending
- Plan 來源: `.cursor/plans/dev-restart_wrapper_a7ba1363.plan.md`
