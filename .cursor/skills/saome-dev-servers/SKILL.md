---
name: saome-dev-servers
description: 啟動 SAOME 前後端開發伺服器。當用戶說「開啟」、「啟動」、「重啟」、「開發環境」、「前後端」時使用此 skill。
---

# SAOME Dev Servers

## 環境架構

```
Cloudflare Workers (Backend)
         ↓
    Hyperdrive (連線池化)
         ↓
  遠端 PostgreSQL (雲端)
```

**重要：** Backend 透過 Hyperdrive 直接連到雲端資料庫，無需本地 DB。

## 工作流程

> **強烈建議改用 `scripts\dev-restart.cmd` wrapper**。下面的 Step 2-7 是 wrapper 內部的 manual fallback，留給 wrapper 沒覆蓋的 edge case（例如 IDE 開新 terminal 想單獨起 backend）。

### Step 1: 重啟開發環境（推薦 wrapper）

```powershell
# 完整重啟（kill old + start new + health check）
.\scripts\dev-restart.cmd -Force

# 只看狀態，不動 system（debug 用）
.\scripts\dev-restart.cmd -Status

# 只驗證健康，不重啟
.\scripts\dev-restart.cmd -HealthOnly
```

預期輸出：

| Phase | 預期 |
|---|---|
| [1/6] Recon | listener table（含 parent chain）+ wrangler auth 狀態 |
| [2/6] Surgical kill | 列出要殺的 PID 與祖先鏈，問 confirmation（除非 `-Force`） |
| [3/6] Tmp cleanup | 列出要清的 `dev-*` dir 與保留的 |
| [4/6] Start backend | `logs/backend.log` + PID 寫入 `.dev-restart.pids.tmp` |
| [5/6] Start frontend | `logs/frontend.log` + PID 寫入 `.dev-restart.pids.tmp` |
| [6/6] Health check | 30s retry loop，最後 exit 0/1/2/3 |

**Exit codes**：

| Code | 意義 |
|---|---|
| 0 | 全綠（兩個 listener 都健康）|
| 1 | Backend fail |
| 2 | Frontend fail |
| 3 | Both fail |
| 64 | User canceled confirmation |
| 65 | Param error（`-HealthOnly` + `-Status` 互斥同時給）|

### Step 2: Manual Recon（Phase 1 detail）

```powershell
# 8787 / 5173 listener
Get-NetTCPConnection -LocalPort 8787,5173 -State Listen |
    Select-Object LocalPort, OwningProcess, State

# 對應 process
Get-CimInstance Win32_Process -Filter "ProcessId=<PID>" |
    Select-Object ProcessId, Name, ParentProcessId, CommandLine

# Wrangler auth
npx wrangler whoami
```

### Step 3: Surgical Kill（Phase 2 detail）

WMI parent walk 範本（殺 leaf PID 但先警告 user 若祖先含 IDE）：

```powershell
function Walk-ParentChain {
    param([int]$StartPid, [int]$MaxDepth = 10)
    $chain = @(); $current = $StartPid; $visited = @{}
    for ($i = 0; $i -lt $MaxDepth; $i++) {
        if ($current -le 0 -or $visited[$current]) { break }
        $visited[$current] = $true
        $info = Get-CimInstance Win32_Process -Filter "ProcessId=$current" -ErrorAction Stop
        $chain += [PSCustomObject]@{ Pid = $info.ProcessId; Name = $info.Name; ParentPid = $info.ParentProcessId }
        $current = [int]$info.ParentProcessId
    }
    $chain
}

$chain = Walk-ParentChain -StartPid <LEAF_PID>
$chain | Format-Table -AutoSize
# If ancestor contains Code.exe / Cursor.exe, ask before killing leaf.
```

### Step 4: Start Backend（Phase 4 detail）

```powershell
Start-Process -FilePath "npx.cmd" `
    -ArgumentList "wrangler","dev","--port","8787","--remote" `
    -WorkingDirectory "$PSScriptRoot\..\apps\backend" `
    -RedirectStandardOutput "$PSScriptRoot\..\logs\backend.log" `
    -RedirectStandardError  "$PSScriptRoot\..\logs\backend.err.log" `
    -WindowStyle Hidden `
    -PassThru | % { $_.Id } | Out-Null
```

### Step 5: Start Frontend（Phase 5 detail）

```powershell
Start-Process -FilePath "npx.cmd" `
    -ArgumentList "vite" `
    -WorkingDirectory "$PSScriptRoot\..\apps\frontend" `
    -RedirectStandardOutput "$PSScriptRoot\..\logs\frontend.log" `
    -RedirectStandardError  "$PSScriptRoot\..\logs\frontend.err.log" `
    -WindowStyle Hidden `
    -PassThru | % { $_.Id } | Out-Null
```

### Step 6: Health Check（Phase 6 detail）

```powershell
$backendOk = $false; $frontendOk = $false
for ($i = 1; $i -le 30; $i++) {
    try {
        $b = Invoke-WebRequest http://127.0.0.1:8787 -UseBasicParsing -TimeoutSec 2
        $backendOk = ($b.StatusCode -ge 200 -and $b.StatusCode -le 499)
    } catch { $backendOk = $false }
    try {
        $f = Invoke-WebRequest http://localhost:5173 -UseBasicParsing -TimeoutSec 2
        $frontendOk = ($f.StatusCode -eq 200)
    } catch { $frontendOk = $false }
    if ($backendOk -and $frontendOk) { break }
    Start-Sleep -Seconds 1
}
```

### Step 7: Status Mode

`.\scripts\dev-restart.cmd -Status` 是純讀：跑 Phase 1 Recon、印 listener table、exit 0。適合「不確定現在 8787 / 5173 是誰在聽」的 debug 場景。

## 常見錯誤排查

### ECONNREFUSED 127.0.0.1:8787

**原因：** Frontend 先啟動，Backend 還在 deploy。

**解決：** 正常現象，等待 Backend 出現 `Ready on http://127.0.0.1:8787` 即可。Phase 6 health check 30s retry loop 會自動 catch。

### 多個 node.exe 占用端口

**徵兆：** `netstat -ano | findstr "8787"` 出現多個 PID。

**原因：** 多個 Vite / wrangler 進程殘留，導致新進程無法綁定端口。

**解決：**
- **推薦：** 用 wrapper `.\scripts\dev-restart.cmd -Force`，會自動 surgical kill。
- **Manual fallback：** 先 `.\scripts\dev-restart.cmd -Status` 看 parent chain，再對每個 PID 跑 `Walk-ParentChain` 判斷要不要殺。
- **核武 fallback（會誤殺 IDE helper）：** `taskkill /IM node.exe /F`

### ECONNRESET（陸續多筆）

**原因：** Backend 在運行中被終止（crash / token 過期 / 手動關閉）。

**解決：** 重啟 Backend：`.\scripts\dev-restart.cmd -Force`。

### wrangler "Failed to establish remote session"

```
[ERROR] Failed to establish remote session due to an authentication issue.
Your credentials may have expired or been revoked.
```

**原因：** Cloudflare wrangler 認證 token 過期（約 24 小時）。

**解決：**
```powershell
npx wrangler logout
npx wrangler login
```

然後重新啟動 Backend。Phase 1 Recon 會 warn 這個狀態。

### wrangler 一直顯示 "Refreshing preview token..."

**原因：** 同上，token 即將過期或已過期，wrangler 在不斷重試。

**解決：** 立即執行 `wrangler logout && wrangler login` 並重啟 Backend。

## Wrangler 認證管理

### 檢查認證狀態
```powershell
npx wrangler whoami
```

### 更新認證
```powershell
npx wrangler logout
npx wrangler login
```

### 長時間開發建議

- Wrangler `--remote` mode 的 token 約 24 小時過期
- 過夜開發時，隔天可能需要重新 login
- Frontend (Vite) 可以一直運行，Backend 重啟後前端 proxy 會自動恢復連線

## PowerShell Console Encoding（MANDATORY）

zh-TW Windows 預設 console 是 CP950，直接 `Write-Host "啟動中"` 會切成亂碼（實測 `LastWriteTime` 欄變 `W`）。

任何新的 `.ps1` 開頭**必須**加：

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null
```

`scripts/dev-restart.ps1` 已內建。但手寫 script 仍要遵守。

## Quick Copy

### 推薦（full reset）
```powershell
.\scripts\dev-restart.cmd -Force
```

### 只看狀態
```powershell
.\scripts\dev-restart.cmd -Status
```

### 只驗健康
```powershell
.\scripts\dev-restart.cmd -HealthOnly
```

### Manual fallback（無 wrapper 環境）

```powershell
# Phase 1+2 kill
Get-NetTCPConnection -LocalPort 8787,5173 -State Listen |
    ForEach-Object { taskkill /PID $_.OwningProcess /F }

# Phase 4-5 start
cd apps/backend; npx wrangler dev --port 8787 --remote &
cd apps/frontend; npm run dev

# Phase 6 verify
curl http://127.0.0.1:8787 ; curl http://localhost:5173
```
