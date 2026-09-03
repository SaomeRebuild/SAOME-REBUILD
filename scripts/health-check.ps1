# SAOME Dev Server Health Check
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=== SAOME Server Health Check ===" -ForegroundColor Cyan

# Check ports
Write-Host "`n[1] Checking ports..." -ForegroundColor Yellow
$backendPort = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
$frontendPort = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue

if ($backendPort) {
    Write-Host "  Backend (8787): LISTENING on PID $($backendPort.OwningProcess)" -ForegroundColor Green
} else {
    Write-Host "  Backend (8787): NOT listening" -ForegroundColor Red
}

if ($frontendPort) {
    Write-Host "  Frontend (5173): LISTENING on PID $($frontendPort.OwningProcess)" -ForegroundColor Green
} else {
    Write-Host "  Frontend (5173): NOT listening" -ForegroundColor Red
}

# HTTP health check
Write-Host "`n[2] HTTP health check..." -ForegroundColor Yellow
$backendOk = $false
$frontendOk = $false

try {
    $r = Invoke-WebRequest http://127.0.0.1:8787 -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
    if ($r.StatusCode -ge 200 -and $r.StatusCode -le 499) {
        Write-Host "  Backend: HTTP $($r.StatusCode) OK" -ForegroundColor Green
        $backendOk = $true
    }
} catch {
    Write-Host "  Backend: Not reachable" -ForegroundColor Red
}

try {
    $r2 = Invoke-WebRequest http://localhost:5173 -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
    if ($r2.StatusCode -eq 200) {
        Write-Host "  Frontend: HTTP $($r2.StatusCode) OK" -ForegroundColor Green
        $frontendOk = $true
    }
} catch {
    Write-Host "  Frontend: Not reachable" -ForegroundColor Red
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
if ($backendOk -and $frontendOk) {
    Write-Host "All servers healthy!" -ForegroundColor Green
    exit 0
} elseif ($backendOk) {
    Write-Host "Backend OK, Frontend starting..." -ForegroundColor Yellow
    exit 2
} elseif ($frontendOk) {
    Write-Host "Frontend OK, Backend starting..." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "Both servers still starting..." -ForegroundColor Yellow
    exit 3
}
