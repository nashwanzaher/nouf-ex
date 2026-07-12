# Test Register validation
Write-Host '=== Test weak password (should fail) ==='
try {
    $csrfRes = Invoke-WebRequest -Uri "http://localhost:8080/api/auth/csrf" -Method GET -UseBasicParsing -TimeoutSec 5 -SessionVariable session
    $csrfToken = ($csrfRes.Content | ConvertFrom-Json).data.token

    $body = '{"email":"weak' + (Get-Random) + '@test.com","password":"weak","name":"Test"}'
    $r = Invoke-WebRequest -Uri "http://localhost:8080/api/auth/register" -Method POST -ContentType "application/json" -Headers @{"x-csrf-token"=$csrfToken} -Body $body -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    $json = $r.Content | ConvertFrom-Json
    Write-Host "   Status: $($r.StatusCode)"
    Write-Host "   Error: $($json.error)"
} catch { Write-Host "   Error: $_" }

Write-Host ''
Write-Host '=== Test strong password but no name (should fail) ==='
try {
    $csrfRes = Invoke-WebRequest -Uri "http://localhost:8080/api/auth/csrf" -Method GET -UseBasicParsing -TimeoutSec 5 -SessionVariable session
    $csrfToken = ($csrfRes.Content | ConvertFrom-Json).data.token

    $body = '{"email":"noname' + (Get-Random) + '@test.com","password":"MyStr0ng!Pass","name":""}'
    $r = Invoke-WebRequest -Uri "http://localhost:8080/api/auth/register" -Method POST -ContentType "application/json" -Headers @{"x-csrf-token"=$csrfToken} -Body $body -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    $json = $r.Content | ConvertFrom-Json
    Write-Host "   Status: $($r.StatusCode)"
    Write-Host "   Error: $($json.error)"
} catch { Write-Host "   Error: $_" }

Write-Host ''
Write-Host '=== Test invalid email (should fail) ==='
try {
    $csrfRes = Invoke-WebRequest -Uri "http://localhost:8080/api/auth/csrf" -Method GET -UseBasicParsing -TimeoutSec 5 -SessionVariable session
    $csrfToken = ($csrfRes.Content | ConvertFrom-Json).data.token

    $body = '{"email":"notanemail","password":"MyStr0ng!Pass","name":"Test"}'
    $r = Invoke-WebRequest -Uri "http://localhost:8080/api/auth/register" -Method POST -ContentType "application/json" -Headers @{"x-csrf-token"=$csrfToken} -Body $body -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    $json = $r.Content | ConvertFrom-Json
    Write-Host "   Status: $($r.StatusCode)"
    Write-Host "   Error: $($json.error)"
} catch { Write-Host "   Error: $_" }
