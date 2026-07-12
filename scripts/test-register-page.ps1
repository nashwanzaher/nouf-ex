# Test Register page
Write-Host '=== 1. Register page loads in Vite ==='
try {
    $r = Invoke-WebRequest -Uri "http://localhost:8080/auth/register" -Method GET -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "   Status: $($r.StatusCode)"
} catch { Write-Host "   Error: $_" }

Write-Host ''
Write-Host '=== 2. Register.tsx loads via Vite (check for transform errors) ==='
try {
    $r = Invoke-WebRequest -Uri "http://localhost:8080/src/features/auth/components/Register.tsx" -Method GET -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "   Status: $($r.StatusCode), Size: $($r.Content.Length) bytes"
    if ($r.Content -match 'SyntaxError|Cannot find|TS\d+') {
        Write-Host "   ⚠️ Transform errors found"
        $r.Content -split "`n" | Select-String -Pattern 'SyntaxError|Cannot find|TS\d+' | Select-Object -First 5 | ForEach-Object { Write-Host "     $_" }
    } else {
        Write-Host "   ✅ No transform errors"
    }
} catch { Write-Host "   Error: $_" }

Write-Host ''
Write-Host '=== 3. Test register API via Vite proxy ==='
try {
    # Get CSRF first
    $csrfRes = Invoke-WebRequest -Uri "http://localhost:8080/api/auth/csrf" -Method GET -UseBasicParsing -TimeoutSec 5 -SessionVariable session
    $csrfJson = $csrfRes.Content | ConvertFrom-Json
    $csrfToken = $csrfJson.data.token

    $body = '{"email":"newuser_' + (Get-Random) + '@test.com","password":"MyStr0ng!Pass","name":"Test User","role":"customer"}'
    Write-Host "   Body: $body"
    $r = Invoke-WebRequest -Uri "http://localhost:8080/api/auth/register" -Method POST -ContentType "application/json" -Headers @{"x-csrf-token"=$csrfToken} -Body $body -UseBasicParsing -TimeoutSec 5 -SessionVariable $session -ErrorAction SilentlyContinue
    Write-Host "   Status: $($r.StatusCode)"
    $json = $r.Content | ConvertFrom-Json
    Write-Host "   Success: $($json.success)"
    if ($json.data) {
        Write-Host "   Role: $($json.data.user.role)"
        Write-Host "   Has token: $(if ($json.data.token) {'YES'} else {'NO'})"
    }
    if ($json.error) {
        Write-Host "   Error: $($json.error)"
    }
} catch { Write-Host "   Error: $_" }
