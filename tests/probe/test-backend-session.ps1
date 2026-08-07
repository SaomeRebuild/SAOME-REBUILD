# Test backend session persistence
$backend = "https://saome-backend.josh1989213.workers.dev"
$cookieJar = "C:\Users\user\AppData\Local\Temp\saome-cookies.txt"

# Clear cookies
if (Test-Path $cookieJar) { Remove-Item $cookieJar }

Write-Host "=== Step 1: Login ===" -ForegroundColor Cyan
$loginResp = Invoke-WebRequest -Uri "$backend/api/auth/login" -Method POST -Headers @{
    "Content-Type" = "application/json"
    "Origin" = "http://localhost:5173"
} -Body '{"email":"admin@saome.org","password":"Qwww123123!"}' -SessionVariable sess -UseBasicParsing
Write-Host "Status: $($loginResp.StatusCode)"
Write-Host "Response headers:"
foreach ($h in $loginResp.Headers.GetEnumerator()) {
    Write-Host "  $($h.Key): $($h.Value -join ', ')"
}

# Print cookie jar
Write-Host "`n=== Cookie Jar ===" -ForegroundColor Cyan
Get-Content $cookieJar | Select-String "saome_refresh"

Write-Host "`n=== Step 2: Try refresh ===" -ForegroundColor Cyan
$refreshResp = Invoke-WebRequest -Uri "$backend/api/auth/refresh" -Method POST -Headers @{
    "Content-Type" = "application/json"
    "Origin" = "http://localhost:5173"
} -WebSession $sess -UseBasicParsing
Write-Host "Status: $($refreshResp.StatusCode)"
Write-Host "Body: $($refreshResp.Content)"

Write-Host "`n=== Step 3: Try /me ===" -ForegroundColor Cyan
$meResp = Invoke-WebRequest -Uri "$backend/api/auth/me" -Method GET -Headers @{
    "Content-Type" = "application/json"
    "Origin" = "http://localhost:5173"
    "Authorization" = "Bearer $(($refreshResp.Content | ConvertFrom-Json).accessToken)"
} -WebSession $sess -UseBasicParsing
Write-Host "Status: $($meResp.StatusCode)"
Write-Host "Body: $($meResp.Content)"