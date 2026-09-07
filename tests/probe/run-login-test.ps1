# Run Playwright login flow test
$ErrorActionPreference = "Continue"
Set-Location "c:\Users\user\Desktop\SAOME-REBUILD"
Write-Host "Running production login flow test..."
node tests\probe\login-flow-playwright.mjs
