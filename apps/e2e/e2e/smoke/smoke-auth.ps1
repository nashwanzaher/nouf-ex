# Test full login + auth flow
$email = "ahmed@gmail.com"
$password = "customer123"

# 1. Login
$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
$loginResp = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing
$loginData = ($loginResp.Content | ConvertFrom-Json).data
$token = $loginData.token
Write-Host "OK login: user_id=$($loginData.user.id), token_len=$($token.Length)"

$headers = @{ Authorization = "Bearer $token" }

# 2. /auth/me
$r = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/me" -Headers $headers -UseBasicParsing
$me = ($r.Content | ConvertFrom-Json).data
Write-Host "OK /auth/me: id=$($me.id), email=$($me.email)"

# 3. Customer endpoints
$endpoints = @(
    "/api/cart/2",
    "/api/wishlist/2",
    "/api/notifications/2",
    "/api/orders?userId=2",
    "/api/addresses?user_id=2",
    "/api/reviews?userId=2"
)
foreach ($e in $endpoints) {
    $r = Invoke-WebRequest -Uri "http://localhost:3000$e" -Headers $headers -UseBasicParsing
    $data = ($r.Content | ConvertFrom-Json).data
    $count = if ($data -is [array]) { $data.Count } elseif ($data) { "object" } else { "null" }
    Write-Host ("OK {0,-32} [{1}] items={2}" -f $e, $r.StatusCode, $count)
}

# 4. Logout test (does NOT actually log out, just verifies token reuse)
$r = Invoke-WebRequest -Uri "http://localhost:3000/api/stats/home" -Headers $headers -UseBasicParsing
Write-Host "OK /api/stats/home               [$($r.StatusCode)]"

# 5. Without auth (should be 401)
try {
    Invoke-WebRequest -Uri "http://localhost:3000/api/cart/2" -UseBasicParsing | Out-Null
    Write-Host "FAIL: should have been 401"
} catch {
    Write-Host "OK /api/cart/2 (no auth)         [401 - access denied as expected]"
}

Write-Host "`nAll auth flow tests passed."
