# PHASE 0: Auth + Health comprehensive audit
$base = 'http://localhost:3000'

function Call($method, $path, $headers, $body) {
    $p = @{
        Uri = "$base$path"
        Method = $method
        Headers = $headers
        UseBasicParsing = $true
    }
    if ($body) {
        $p['ContentType'] = 'application/json'
        $p['Body'] = ($body | ConvertTo-Json -Depth 5)
    }
    try {
        $r = Invoke-WebRequest @p
        return @{ ok = $true; status = $r.StatusCode; body = $r.Content }
    } catch {
        $resp = $_.Exception.Response
        $status = if ($resp) { [int]$resp.StatusCode } else { 0 }
        $b = ''
        if ($resp) {
            $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $b = $reader.ReadToEnd()
        }
        return @{ ok = $false; status = $status; body = $b }
    }
}

function Show($label, $r) {
    $preview = if ($r.body.Length -gt 150) { $r.body.Substring(0, 150) + '...' } else { $r.body }
    Write-Host ("  {0,-55} status={1}  {2}" -f $label, $r.status, $preview)
}

# ===================================================================
# 1. HEALTH & READINESS
# ===================================================================
Write-Host '===== 1. Health endpoints ====='
$r = Call GET '/api/health' @{} $null
Show 'GET /api/health' $r
$r = Call GET '/api/ready' @{} $null
Show 'GET /api/ready' $r

# ===================================================================
# 2. DB CONNECTIVITY via real-data endpoints
# ===================================================================
Write-Host ''
Write-Host '===== 2. DB connectivity (real data) ====='
$r = Call GET '/api/products?limit=1' @{} $null
Show 'GET /api/products?limit=1' $r
$r = Call GET '/api/categories' @{} $null
$data = ($r.body | ConvertFrom-Json).data
Write-Host ("  categories: total={0} sample={1}" -f $data.Count, $data[0].name_en)

$r = Call GET '/api/stores' @{} $null
$data = ($r.body | ConvertFrom-Json).data
Write-Host ("  stores: total={0}" -f $data.Count)

# ===================================================================
# 3. LOGIN for all 3 roles
# ===================================================================
Write-Host ''
Write-Host '===== 3. Login for all 3 roles ====='
$roles = @(
    @{ email = 'ahmed@gmail.com'; password = 'customer123'; label = 'Customer (buyer)' },
    @{ email = 'fatima@spice-yemen.com'; password = 'merchant123'; label = 'Merchant' },
    @{ email = 'admin@noufex.com'; password = 'admin123'; label = 'Admin' }
)
$tokens = @{}
foreach ($r in $roles) {
    $resp = Call POST '/api/auth/login' @{} @{ email = $r.email; password = $r.password }
    Show ("LOGIN $($r.label)") $resp
    if ($resp.ok) {
        $tokens[$r.label] = ($resp.body | ConvertFrom-Json).data.token
    }
}

# ===================================================================
# 4. /auth/me with each token
# ===================================================================
Write-Host ''
Write-Host '===== 4. /auth/me round-trip ====='
foreach ($label in @('Customer (buyer)', 'Merchant', 'Admin')) {
    $tok = $tokens[$label]
    if (-not $tok) { continue }
    $resp = Call GET '/api/auth/me' @{ Authorization = "Bearer $tok" } $null
    Show ("GET /auth/me as $label") $resp
}

# ===================================================================
# 5. BAD CREDENTIALS
# ===================================================================
Write-Host ''
Write-Host '===== 5. Bad credentials ====='
$resp = Call POST '/api/auth/login' @{} @{ email = 'ahmed@gmail.com'; password = 'wrong' }
Show 'LOGIN with wrong password' $resp
$resp = Call POST '/api/auth/login' @{} @{ email = 'nobody@example.com'; password = 'whatever' }
Show 'LOGIN with unknown email' $resp
$resp = Call POST '/api/auth/login' @{} @{ email = ''; password = '' }
Show 'LOGIN with empty body' $resp

# ===================================================================
# 6. INVALID TOKEN
# ===================================================================
Write-Host ''
Write-Host '===== 6. Invalid / missing tokens ====='
$resp = Call GET '/api/auth/me' @{ Authorization = 'Bearer not-a-real-token' } $null
Show '/auth/me with garbage token' $resp
$resp = Call GET '/api/auth/me' @{} $null
Show '/auth/me without token' $resp

# ===================================================================
# 7. REGISTRATION
# ===================================================================
Write-Host ''
Write-Host '===== 7. Registration ====='
$rand = Get-Random -Minimum 100000 -Maximum 999999
$newEmail = "test$rand@example.com"
$resp = Call POST '/api/auth/register' @{} @{
    email = $newEmail
    password = 'NewUserPass1!'
    name = "Test User $rand"
    phone = "+96771111$rand"
}
Show ("REGISTER new user ($newEmail)") $resp

# Duplicate email
$resp = Call POST '/api/auth/register' @{} @{
    email = 'ahmed@gmail.com'
    password = 'AnotherPass1!'
    name = 'Imposter'
}
Show 'REGISTER duplicate email (should 409)' $resp

# Weak password (less than 8 chars)
$resp = Call POST '/api/auth/register' @{} @{
    email = "weak$rand@example.com"
    password = '123'
    name = 'Weak User'
}
Show 'REGISTER weak password (should 400)' $resp

# Missing fields
$resp = Call POST '/api/auth/register' @{} @{ email = "missing$rand@example.com" }
Show 'REGISTER missing password' $resp

# Bad email format
$resp = Call POST '/api/auth/register' @{} @{
    email = 'not-an-email'
    password = 'NewUserPass1!'
    name = 'Bad Email'
}
Show 'REGISTER bad email format (should 400)' $resp

# Login with the new user we just created
$resp = Call POST '/api/auth/login' @{} @{ email = $newEmail; password = 'NewUserPass1!' }
Show ("LOGIN as newly-registered user") $resp

Write-Host ''
Write-Host 'Phase 0 complete.'
