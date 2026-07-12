# Test Vite proxy + CSRF + login via Vite
Write-Host '=== 1. Fetch CSRF token from Vite (proxies to :3000) ==='
try {
    $csrf = Invoke-WebRequest -Uri "http://localhost:8080/api/auth/csrf" -Method GET -UseBasicParsing -TimeoutSec 5 -SessionVariable session
    Write-Host "   Status: $($csrf.StatusCode)"
    foreach ($h in $csrf.Headers.Keys) {
        $v = $csrf.Headers[$h]
        if ($h -like '*Cookie*' -or $h -like '*CSRF*') {
            if ($v -is [array]) {
                $v | ForEach-Object { Write-Host ("   {0}: {1}" -f $h, $_) }
            } else {
                Write-Host ("   {0}: {1}" -f $h, $v)
            }
        }
    }
    $json = $csrf.Content | ConvertFrom-Json
    Write-Host "   Token: $($json.data.token.Substring(0, 30))..."
} catch { Write-Host "   Error: $_" }

Write-Host ''
Write-Host '=== 2. Login via Vite (proxied) with CORRECT creds ==='
try {
    # Get CSRF first
    $csrfRes = Invoke-WebRequest -Uri "http://localhost:8080/api/auth/csrf" -Method GET -UseBasicParsing -TimeoutSec 5 -SessionVariable session
    $csrfJson = $csrfRes.Content | ConvertFrom-Json
    $csrfToken = $csrfJson.data.token

    $body = '{"email":"ahmed@gmail.com","password":"customer123"}'
    $r = Invoke-WebRequest -Uri "http://localhost:8080/api/auth/login" -Method POST -ContentType "application/json" -Headers @{"x-csrf-token"=$csrfToken} -Body $body -UseBasicParsing -TimeoutSec 5 -SessionVariable $session -ErrorAction SilentlyContinue
    Write-Host "   Status: $($r.StatusCode)"
    $json = $r.Content | ConvertFrom-Json
    Write-Host "   Success: $($json.success)"
    Write-Host "   Role: $($json.data.user.role)"
    foreach ($h in $r.Headers.Keys) {
        if ($h -like '*Cookie*') {
            $v = $r.Headers[$h]
            if ($v -is [array]) {
                $v | ForEach-Object { Write-Host ("   {0}: {1}" -f $h, $_) }
            } else {
                Write-Host ("   {0}: {1}" -f $h, $v)
            }
        }
    }
} catch { Write-Host "   Error: $_" }
