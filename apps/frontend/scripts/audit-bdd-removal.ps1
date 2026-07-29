# BDD Removal Audit Script
# 驗證 BDD 完整移除

param(
    [switch]$Verbose
)

$ErrorCount = 0
$ProjectRoot = "C:/Users/user/Desktop/SAOME-REBUILD"

function Test-Audit {
    param(
        [string]$Description,
        [scriptblock]$Test,
        [string]$Expected
    )

    Write-Host "`n[CHECK] $Description" -ForegroundColor Cyan
    try {
        $result = & $Test
        if ($result) {
            Write-Host "  [PASS] $Expected" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  [FAIL] $Expected" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "  [ERROR] $_" -ForegroundColor Red
        return $false
    }
}

Write-Host "=== BDD Removal Audit ===" -ForegroundColor Yellow
Write-Host "Project: $ProjectRoot"
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# 1. 沒有 .feature 殘留（排除 node_modules）
$featureCount = (Get-ChildItem -Path $ProjectRoot -Filter "*.feature" -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch 'node_modules' } | Measure-Object).Count
if (Test-Audit -Description "沒有 .feature 殘留" -Test { $featureCount -eq 0 } -Expected "0 個 .feature 檔案") {
    # pass
} else {
    Write-Host "  找到 $featureCount 個 .feature 檔案" -ForegroundColor Yellow
    Get-ChildItem -Path $ProjectRoot -Filter "*.feature" -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "    - $($_.FullName)" }
    $ErrorCount++
}

# 2. packages/shared/bdd/ 已刪除
$hasBdd = Test-Path "$ProjectRoot/packages/shared/bdd"
if (Test-Audit -Description "packages/shared/bdd/ 已刪除" -Test { -not $hasBdd } -Expected "bdd/ 目錄不存在") {
    # pass
} else {
    $ErrorCount++
}

# 3. 002-bdd.mdc 已刪除
$hasBddRule = Test-Path "$ProjectRoot/.cursor/rules/002-bdd.mdc"
if (Test-Audit -Description "002-bdd.mdc 已刪除" -Test { -not $hasBddRule } -Expected "002-bdd.mdc 不存在") {
    # pass
} else {
    $ErrorCount++
}

# 4. 012-bdd-workflow.mdc 已刪除
$hasBddWorkflow = Test-Path "$ProjectRoot/.cursor/rules/012-bdd-workflow.mdc"
if (Test-Audit -Description "012-bdd-workflow.mdc 已刪除" -Test { -not $hasBddWorkflow } -Expected "012-bdd-workflow.mdc 不存在") {
    # pass
} else {
    $ErrorCount++
}

# 5. package.json 沒有 test:bdd
$packageJson = Get-Content "$ProjectRoot/package.json" -Raw
$hasTestBdd = $packageJson -match '"test:bdd"'
if (Test-Audit -Description "package.json 沒有 test:bdd" -Test { -not $hasTestBdd } -Expected "test:bdd script 已移除") {
    # pass
} else {
    $ErrorCount++
}

# 6. AGENTS.md BDD 引用 <= 3
$agentsContent = Get-Content "$ProjectRoot/AGENTS.md" -Raw
$agentsBddCount = ([regex]::Matches($agentsContent, 'BDD', [Text.RegularExpressions.RegexOptions]::IgnoreCase)).Count
if (Test-Audit -Description "AGENTS.md BDD 引用 <= 5" -Test { $agentsBddCount -le 5 } -Expected "BDD 引用數: $agentsBddCount (<= 5)") {
    # pass
} else {
    Write-Host "  BDD 引用數: $agentsBddCount" -ForegroundColor Yellow
    $ErrorCount++
}

# 7. saome-task-router/SKILL.md 存在
$hasTaskRouter = Test-Path "$ProjectRoot/.cursor/skills/saome-task-router/SKILL.md"
if (Test-Audit -Description "saome-task-router/SKILL.md 存在" -Test { $hasTaskRouter } -Expected "SKILL.md 已建立") {
    # pass
} else {
    $ErrorCount++
}

# 8. saome-task-router/SKILL.md 不含 intent-router
$taskRouterContent = Get-Content "$ProjectRoot/.cursor/skills/saome-task-router/SKILL.md" -Raw -ErrorAction SilentlyContinue
$hasIntentRouter = $taskRouterContent -match 'intent-router'
if (Test-Audit -Description "saome-task-router 不含 intent-router" -Test { -not $hasIntentRouter } -Expected "無假依賴") {
    # pass
} else {
    Write-Host "  [WARN] 發現 intent-router 引用" -ForegroundColor Yellow
    $ErrorCount++
}

# 9. .cucumber.js 已刪除
$hasCucumber = Test-Path "$ProjectRoot/.cucumber.js"
if (Test-Audit -Description ".cucumber.js 已刪除" -Test { -not $hasCucumber } -Expected ".cucumber.js 不存在") {
    # pass
} else {
    $ErrorCount++
}

# 10. feedback 檔存在
$hasFeedback = Test-Path "$ProjectRoot/runs/improvements/feedback/20260729-bdd-removed.md"
if (Test-Audit -Description "feedback 檔存在" -Test { $hasFeedback } -Expected "20260729-bdd-removed.md 已建立") {
    # pass
} else {
    $ErrorCount++
}

Write-Host "`n=== Audit Summary ===" -ForegroundColor Yellow
if ($ErrorCount -eq 0) {
    Write-Host "[OK] All checks passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "[FAIL] $ErrorCount check(s) failed" -ForegroundColor Red
    exit 1
}
