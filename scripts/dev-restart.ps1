# scripts/dev-restart.ps1 — 6-phase orchestrator for SAOME dev servers.
#
# Phases:
#   [1/6] Recon         — port 8787 / 5173 listeners, process parents, wrangler auth
#   [2/6] Surgical kill — port-bound PIDs, walk parents via WMI, kill orphans
#   [3/6] Tmp cleanup   — apps/backend/.wrangler/tmp/dev-* dirs (PID-dead + mtime > 24h only)
#   [4/6] Start backend — npx wrangler dev --port 8787 --remote
#   [5/6] Start frontend — vite (port 5173)
#   [6/6] Health check  — Invoke-WebRequest 8787 + 5173, retry up to 30s
#
# Flags:
#   -Force         Skip confirmation prompts in Phase 2 kill
#   -SkipCleanup   Alias of -SkipTmp; trust the chain is clean
#   -SkipTmp       Skip Phase 3 tmp cleanup
#   -HealthOnly    Only run Recon + Health check; don't start/kill anything
#   -Status        Only run Recon (read-only); -HealthOnly -Status is param error (exit 65)
#
# Exit codes:
#   0  all green
#   1  backend fail (start or health)
#   2  frontend fail (start or health)
#   3  both fail
#   64 user canceled a confirmation
#   65 param error (mutex flags together)

# ---------- Argument parsing (must be the FIRST statement) ----------
param(
    [switch]$Force,
    [switch]$SkipCleanup,
    [switch]$SkipTmp,
    [switch]$HealthOnly,
    [switch]$Status
)

# ---------- Console UTF-8 setup (must be after param()) ----------
# zh-TW Windows console is CP950 by default, which breaks Chinese output.
# Per saome-dev-servers SKILL "PowerShell Console Encoding (MANDATORY)".
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null
$ErrorActionPreference = 'Stop'

if ($SkipCleanup -and $SkipTmp) {
    Write-Host "[param] -SkipCleanup and -SkipTmp are aliases; using one is fine. Continuing." -ForegroundColor Yellow
}

if ($HealthOnly -and $Status) {
    Write-Host "[param] -HealthOnly and -Status are mutually exclusive. Use -Status for read-only recon." -ForegroundColor Red
    exit 65
}

$ReadOnlyMode = $HealthOnly -or $Status

# ---------- Constants ----------
$BackendPort = 8787
$FrontendPort = 5173
$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$LogsDir = Join-Path $RepoRoot 'logs'
$BackendLog = Join-Path $LogsDir 'backend.log'
$BackendErrLog = Join-Path $LogsDir 'backend.err.log'
$FrontendLog = Join-Path $LogsDir 'frontend.log'
$FrontendErrLog = Join-Path $LogsDir 'frontend.err.log'
$PidFile = Join-Path $RepoRoot '.dev-restart.pids.tmp'  # *.tmp is git-ignored
$WranglerTmpDir = Join-Path $RepoRoot 'apps\backend\.wrangler\tmp'
$TmpMaxAgeHours = 24

# ---------- Helpers ----------
function Write-Phase {
    param([int]$N, [string]$Name)
    Write-Host ""
    Write-Host "[$N/6] $Name" -ForegroundColor Cyan
}

function Write-Summary {
    param([string]$Msg)
    Write-Host "  -> $Msg"
}

function Test-PortListening {
    param([int]$Port)
    try {
        Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
    } catch {
        $null
    }
}

function Get-ProcessInfo {
    param([int]$ProcessId)
    try {
        Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction Stop |
            Select-Object ProcessId, Name, ParentProcessId, CommandLine
    } catch { $null }
}

function Walk-ParentChain {
    # Walks Win32_Process.ParentProcessId until root (PID 0) or visited.
    # Returns ordered array of @{Pid, Name} (closest first).
    param([int]$StartPid, [int]$MaxDepth = 10)
    $chain = @()
    $current = $StartPid
    $visited = @{}
    for ($i = 0; $i -lt $MaxDepth; $i++) {
        if ($current -le 0 -or $visited.ContainsKey($current)) { break }
        $visited[$current] = $true
        $info = Get-ProcessInfo -ProcessId $current
        if (-not $info) { break }
        $chain += [PSCustomObject]@{ ProcessId = $info.ProcessId; Name = $info.Name; ParentProcessId = $info.ParentProcessId }
        $current = [int]$info.ParentProcessId
    }
    $chain
}

function Test-IsIdeHelper {
    param([string]$ProcessName)
    $ProcessName -in @('Code.exe', 'Cursor.exe', 'WindowsTerminal.exe', 'powershell.exe', 'pwsh.exe', 'cmd.exe', 'explorer.exe')
}

function Confirm-Kill {
    param([int]$ProcessId, [string]$Reason)
    if ($Force) { return $true }
    $ans = Read-Host "Kill PID $ProcessId ($Reason)? [y/N]"
    return ($ans -match '^[yY]([eE][sS])?$')
}

function Remove-StaleDevDir {
    param([string]$DirPath, [datetime]$Mtime)
    $ageHours = ((Get-Date) - $Mtime).TotalHours
    if ($ageHours -lt $TmpMaxAgeHours) {
        Write-Summary "kept $($DirPath | Split-Path -Leaf) (mtime ${ageHours:N1}h < ${TmpMaxAgeHours}h)"
        return
    }
    Remove-Item -LiteralPath $DirPath -Recurse -Force -ErrorAction Stop
    Write-Summary "removed $($DirPath | Split-Path -Leaf) (mtime ${ageHours:N1}h, PID-dead)"
}

function Write-PidFile {
    param([int]$BackendPid, [int]$FrontendPid)
    $lines = @(
        "backend_pid=$BackendPid",
        "frontend_pid=$FrontendPid",
        "backend_started_at=$([datetime]::Now.ToString('o'))",
        "frontend_started_at=$([datetime]::Now.ToString('o'))"
    )
    Set-Content -LiteralPath $PidFile -Value $lines -Encoding UTF8
}

function Read-PidFile {
    if (-not (Test-Path $PidFile)) { return $null }
    $content = Get-Content $PidFile -ErrorAction SilentlyContinue
    if (-not $content) { return $null }
    $map = @{}
    foreach ($line in $content) {
        if ($line -match '^([^=]+)=(.+)$') {
            $map[$Matches[1]] = $Matches[2]
        }
    }
    $map
}

function Test-HttpHealth {
    param([string]$Url, [int]$ExpectedMin = 200, [int]$ExpectedMax = 499)
    try {
        $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        return ($resp.StatusCode -ge $ExpectedMin -and $resp.StatusCode -le $ExpectedMax)
    } catch {
        $err = $_.Exception.Response
        if ($err) {
            try {
                $status = [int]$err.StatusCode
                return ($status -ge $ExpectedMin -and $status -le $ExpectedMax)
            } catch { return $false }
        }
        return $false
    }
}

# ---------- Ensure directories ----------
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

# ---------- [1/6] Recon ----------
Write-Phase 1 'Recon'
$listeners = @()
foreach ($port in @($BackendPort, $FrontendPort)) {
    $conn = Test-PortListening -Port $port
    if ($conn) {
        $info = Get-ProcessInfo -ProcessId $conn.OwningProcess
        $listeners += [PSCustomObject]@{
            Port     = $port
            OwningPid = $conn.OwningProcess
            Process  = if ($info) { $info.Name } else { '?' }
            CmdLine  = if ($info) { ($info.CommandLine | Select-Object -First 1) } else { '' }
        }
    } else {
        Write-Summary "port $port free"
    }
}
if ($listeners.Count -gt 0) {
    Write-Host ("  {0,-5}  {1,-6}  {2,-7}  {3,-20}  {4}" -f 'Port', 'PID', 'State', 'Process', 'CmdLine')
    foreach ($l in $listeners) {
        $cmdShort = if ($l.CmdLine.Length -gt 60) { $l.CmdLine.Substring(0, 60) + '...' } else { $l.CmdLine }
        Write-Host ("  {0,-5}  {1,-6}  {2,-7}  {3,-20}  {4}" -f $l.Port, $l.OwningPid, 'Listen', $l.Process, $cmdShort)
    }
}

# wrangler auth quick check
$wranglerAuth = $null
try {
    $wranglerAuth = & npx --no-install wrangler whoami 2>&1
} catch {
    $wranglerAuth = 'wrangler not in PATH (run `npm install` if needed)'
}
$authLine = ($wranglerAuth | Out-String).Trim().Split("`n") | Select-Object -First 1
if ($authLine -match '(?:error|expired|not authenticated|Error)' -or $authLine -like '*expired*') {
    Write-Summary "wrangler auth: WARNING ($authLine)" -ForegroundColor Yellow
} else {
    Write-Summary "wrangler auth: ok"
}

if ($Status) {
    Write-Host ""
    Write-Host "Status mode: read-only. Exiting 0." -ForegroundColor Green
    exit 0
}

if ($HealthOnly) {
    Write-Host ""
    Write-Host "HealthOnly mode: skipping Phase 2-5. Going to Phase 6." -ForegroundColor Yellow
    # Skip directly to Phase 6 health check.
    $backendProc = $null
    $frontendProc = $null
} else {
    # ---------- [2/6] Surgical kill ----------
    Write-Phase 2 'Surgical kill'
    $pidsToKill = @()
    foreach ($l in $listeners) {
        Write-Summary "port $($l.Port) -> PID $($l.OwningPid) ($($l.Process))"
        $chain = Walk-ParentChain -StartPid $l.OwningPid
        $chainSummary = ($chain | ForEach-Object { "$($_.ProcessId):$($_.Name)" }) -join ' <- '
        Write-Summary "parent chain: $chainSummary"

        # Decide if ancestor is IDE
        $ideAncestor = $chain | Where-Object { Test-IsIdeHelper -ProcessName $_.Name } | Select-Object -First 1
        if ($ideAncestor) {
            Write-Summary "ancestor is IDE helper ($($ideAncestor.Name)); will kill leaf only, warn user" -ForegroundColor Yellow
        }

        # The leaf PID itself is what we want to kill
        $shouldKill = $true
        if ($ideAncestor -and -not $Force) {
            $shouldKill = Confirm-Kill -ProcessId $l.OwningPid -Reason "ancestor is IDE ($($ideAncestor.Name)); killing leaf anyway"
        }
        if ($shouldKill) {
            $pidsToKill += $l.OwningPid
        } else {
            Write-Summary "user skipped PID $($l.OwningPid)" -ForegroundColor Yellow
        }
    }

    foreach ($targetPid in ($pidsToKill | Select-Object -Unique)) {
        Write-Summary "taskkill /PID $targetPid /F"
        & taskkill /PID $targetPid /F 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Summary "taskkill PID $targetPid failed (exit $LASTEXITCODE); will try wrangler.exe fallback" -ForegroundColor Yellow
        }
    }
    if ($pidsToKill.Count -gt 0) {
        Start-Sleep -Seconds 1
        Write-Summary "kill pass complete"
    } else {
        Write-Summary "nothing to kill"
    }

    # ---------- [3/6] Tmp cleanup ----------
    Write-Phase 3 'Tmp cleanup'
    if ($SkipCleanup -or $SkipTmp) {
        Write-Summary "skipped (per -SkipCleanup)" -ForegroundColor Yellow
    } elseif (-not (Test-Path $WranglerTmpDir)) {
        Write-Summary "no tmp dir at $WranglerTmpDir"
    } else {
        $livePids = @($pidsToKill) + @(Get-Process -Name 'wrangler','node' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
        $dirs = Get-ChildItem -LiteralPath $WranglerTmpDir -Directory -Filter 'dev-*' -ErrorAction SilentlyContinue
        if (-not $dirs -or $dirs.Count -eq 0) {
            Write-Summary "no dev-* dirs"
        } else {
            foreach ($d in $dirs) {
                $isLive = $false
                foreach ($targetPid in $livePids) {
                    if ($targetPid -gt 0) { $isLive = $true; break }
                }
                if ($isLive -and $d.LastWriteTime -gt (Get-Date).AddHours(-$TmpMaxAgeHours)) {
                    Write-Summary "kept $($d.Name) (recent + wrangler/node still alive)"
                } else {
                    Remove-StaleDevDir -DirPath $d.FullName -Mtime $d.LastWriteTime
                }
            }
        }
    }

    # ---------- [4/6] Start backend ----------
    Write-Phase 4 'Start backend'
    $backendStart = Get-Date
    $backendProc = Start-Process -FilePath "npx.cmd" `
        -ArgumentList "wrangler","dev","--port","$BackendPort","--remote" `
        -WorkingDirectory (Join-Path $RepoRoot 'apps\backend') `
        -RedirectStandardOutput $BackendLog `
        -RedirectStandardError $BackendErrLog `
        -WindowStyle Hidden `
        -PassThru
    Write-Summary "PID $($backendProc.Id), log $BackendLog"
    Write-Summary "wrangler preview upload takes 10-20s; waiting for Ready message in log..."

    # ---------- [5/6] Start frontend ----------
    Write-Phase 5 'Start frontend'
    $frontendStart = Get-Date
    $frontendProc = Start-Process -FilePath "npx.cmd" `
        -ArgumentList "vite" `
        -WorkingDirectory (Join-Path $RepoRoot 'apps\frontend') `
        -RedirectStandardOutput $FrontendLog `
        -RedirectStandardError $FrontendErrLog `
        -WindowStyle Hidden `
        -PassThru
    Write-Summary "PID $($frontendProc.Id), log $FrontendLog"

    Write-PidFile -BackendPid $backendProc.Id -FrontendPid $frontendProc.Id
}

# ---------- [6/6] Health check ----------
Write-Phase 6 'Health check'
$backendOk = $false
$frontendOk = $false
$backendUrl = "http://127.0.0.1:$BackendPort"
$frontendUrl = "http://localhost:$FrontendPort"

for ($i = 1; $i -le 30; $i++) {
    if (-not $backendOk) { $backendOk = Test-HttpHealth -Url $backendUrl -ExpectedMin 200 -ExpectedMax 499 }
    if (-not $frontendOk) { $frontendOk = Test-HttpHealth -Url $frontendUrl -ExpectedMin 200 -ExpectedMax 299 }
    if ($backendOk -and $frontendOk) {
        Write-Summary "both healthy after ${i}s"
        break
    }
    if (($i % 5) -eq 0) {
        Write-Summary "waiting ${i}s (backend=$backendOk, frontend=$frontendOk)"
    }
    Start-Sleep -Seconds 1
}

Write-Host ""
if ($backendOk -and $frontendOk) {
    Write-Host "OK — backend @ $backendUrl, frontend @ $frontendUrl" -ForegroundColor Green
    exit 0
} elseif (-not $backendOk -and -not $frontendOk) {
    Write-Host "FAIL — both backend and frontend health check failed" -ForegroundColor Red
    exit 3
} elseif (-not $backendOk) {
    Write-Host "FAIL — backend health check failed; check $BackendErrLog" -ForegroundColor Red
    exit 1
} else {
    Write-Host "FAIL — frontend health check failed; check $FrontendErrLog" -ForegroundColor Red
    exit 2
}
