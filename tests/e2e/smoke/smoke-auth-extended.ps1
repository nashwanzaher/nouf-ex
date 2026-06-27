# Test registration, password reset, validation, duplicate emails
$tests = @()

# 1. Valid registration (use unique email)
$uniqueEmail = "test_$(Get-Random)@example.com"
$regBody = @{
    email = $uniqueEmail
    password = "TestPass123!"
    name = "Test User"
    phone = "+967700000999"
} | ConvertTo-Json
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/register" -Method POST -ContentType "application/json" -Body $regBody -UseBasicParsing
    $data = ($r.Content | ConvertFrom-Json).data
    Write-Host "OK register: user_id=$($data.user.id), email=$($data.user.email)"
} catch {
    $body = $_.Exception.Response
    if ($body) {
        $stream = $body.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "FAIL register: $($reader.ReadToEnd())"
    } else {
        Write-Host "FAIL register: $_"
    }
}

# 2. Duplicate email registration (should fail)
$dupBody = @{
    email = "ahmed@gmail.com"  # already exists
    password = "TestPass123!"
    name = "Duplicate"
} | ConvertTo-Json
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/register" -Method POST -ContentType "application/json" -Body $dupBody -UseBasicParsing
    Write-Host "FAIL: duplicate email accepted"
} catch {
    Write-Host "OK duplicate rejected: $($_.Exception.Response.StatusCode)"
}

# 3. Invalid email format
$badEmail = @{
    email = "not-an-email"
    password = "TestPass123!"
    name = "Bad Email"
} | ConvertTo-Json
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/register" -Method POST -ContentType "application/json" -Body $badEmail -UseBasicParsing
    Write-Host "FAIL: invalid email accepted"
} catch {
    Write-Host "OK bad email rejected: $($_.Exception.Response.StatusCode)"
}

# 4. Weak password
$weakPw = @{
    email = "weak_$(Get-Random)@example.com"
    password = "123"  # too short
    name = "Weak"
} | ConvertTo-Json
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/register" -Method POST -ContentType "application/json" -Body $weakPw -UseBasicParsing
    Write-Host "FAIL: weak password accepted"
} catch {
    Write-Host "OK weak password rejected: $($_.Exception.Response.StatusCode)"
}

# 5. Forgot password
$forgotBody = @{ email = "ahmed@gmail.com" } | ConvertTo-Json
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/forgot-password" -Method POST -ContentType "application/json" -Body $forgotBody -UseBasicParsing
    $data = ($r.Content | ConvertFrom-Json).data
    $msg = if ($data.message) { $data.message } else { 'sent' }
    Write-Host "OK forgot-password: $msg"
} catch {
    $body = $_.Exception.Response
    if ($body) {
        $stream = $body.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "FAIL forgot: $($reader.ReadToEnd())"
    }
}

# 6. Reset password with bad token
$resetBody = @{
    token = "invalid-token-xyz"
    newPassword = "NewPass123!"
} | ConvertTo-Json
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/reset-password" -Method POST -ContentType "application/json" -Body $resetBody -UseBasicParsing
    Write-Host "FAIL: bad token accepted"
} catch {
    Write-Host "OK bad token rejected: $($_.Exception.Response.StatusCode)"
}

# 7. Login then logout flow
$loginBody = @{ email = "ahmed@gmail.com"; password = "customer123" } | ConvertTo-Json
$loginResp = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing
$loginData = ($loginResp.Content | ConvertFrom-Json).data
$token = $loginData.token
$headers = @{ Authorization = "Bearer $token" }

# 8. Check current user
$r = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/me" -Headers $headers -UseBasicParsing
$me = ($r.Content | ConvertFrom-Json).data
Write-Host "OK /auth/me: id=$($me.id), role=$($me.role)"

# 9. Verify rate-limit kicks in after many login attempts
Write-Host "--- rate limit test ---"
$count429 = 0
for ($i = 0; $i -lt 30; $i++) {
    try {
        Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body (@{ email = "ahmed@gmail.com"; password = "wrong" } | ConvertTo-Json) -UseBasicParsing | Out-Null
    } catch {
        if ($_.Exception.Response.StatusCode -eq 429) { $count429++ }
    }
}
Write-Host "Rate limit hits in 30 attempts: $count429"

Write-Host "`nAuth extended tests complete."
