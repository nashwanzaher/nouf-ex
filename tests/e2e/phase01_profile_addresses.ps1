# PHASE 1: User Profile Editing + Address Management (CORRECT endpoints)
$base = 'http://localhost:3000'

function Call($method, $path, $headers, $body) {
    $p = @{ Uri = "$base$path"; Method = $method; Headers = $headers; UseBasicParsing = $true }
    if ($body) { $p['ContentType'] = 'application/json'; $p['Body'] = ($body | ConvertTo-Json -Depth 5) }
    try {
        $r = Invoke-WebRequest @p
        return @{ ok = $true; status = $r.StatusCode; body = $r.Content }
    } catch {
        $resp = $_.Exception.Response
        $status = if ($resp) { [int]$resp.StatusCode } else { 0 }
        $b = ''
        if ($resp) { $reader = New-Object System.IO.StreamReader($resp.GetResponseStream()); $b = $reader.ReadToEnd() }
        return @{ ok = $false; status = $status; body = $b }
    }
}

function Show($label, $r) {
    $preview = if ($r.body.Length -gt 150) { $r.body.Substring(0, 150) + '...' } else { $r.body }
    Write-Host ("  {0,-60} status={1}  {2}" -f $label, $r.status, $preview)
}

function Login($email, $pwd) {
    $r = Call POST '/api/auth/login' @{} @{ email = $email; password = $pwd }
    if ($r.ok) { return ($r.body | ConvertFrom-Json).data.token }
    return $null
}

$tokCust = Login 'ahmed@gmail.com' 'customer123'
$tokMerch = Login 'fatima@spice-yemen.com' 'merchant123'
$tokAdmin = Login 'admin@noufex.com' 'admin123'
Write-Host "Tokens: cust=$(if ($tokCust){'OK'}else{'FAIL'}), merch=$(if ($tokMerch){'OK'}else{'FAIL'}), admin=$(if ($tokAdmin){'OK'}else{'FAIL'})"
Write-Host ''

# ===================================================================
# 1. PROFILE SELF-UPDATE (PATCH /api/auth/me)
# ===================================================================
Write-Host '===== 1. Profile self-update (PATCH /api/auth/me) ====='
$r = Call PATCH '/api/auth/me' @{ Authorization = "Bearer $tokCust" } @{
    full_name = 'Ahmed Updated'; phone = '+967700000002'
}
Show 'PATCH /api/auth/me (customer updates name+phone)' $r

$r = Call GET '/api/auth/me' @{ Authorization = "Bearer $tokCust" } $null
$me = ($r.body | ConvertFrom-Json).data
Write-Host "  After update: full_name=$($me.full_name) phone=$($me.phone) lang=$($me.preferred_language) gender=$($me.gender)"

$r = Call PATCH '/api/auth/me' @{ Authorization = "Bearer $tokCust" } @{ preferred_language = 'en' }
Show 'PATCH /api/auth/me (set lang=en)' $r

$r = Call PATCH '/api/auth/me' @{ Authorization = "Bearer $tokCust" } @{ gender = 'male' }
Show 'PATCH /api/auth/me (set gender=male)' $r

$r = Call PATCH '/api/auth/me' @{ Authorization = "Bearer $tokCust" } @{ gender = 'invalid_value' }
Show 'PATCH /api/auth/me (invalid gender, should 400)' $r

$r = Call PATCH '/api/auth/me' @{ Authorization = "Bearer $tokCust" } @{ preferred_language = 'klingon' }
Show 'PATCH /api/auth/me (invalid language, should 400)' $r

$r = Call PATCH '/api/auth/me' @{ Authorization = "Bearer $tokCust" } @{}
Show 'PATCH /api/auth/me (empty body, should 200)' $r

$r = Call PATCH '/api/auth/me' @{} @{ full_name = 'hacked' }
Show 'PATCH /api/auth/me without auth (should 401)' $r

Write-Host ''

# ===================================================================
# 2. CHANGE PASSWORD (POST /api/auth/change-password)
# ===================================================================
Write-Host '===== 2. Change password ====='
$r = Call POST '/api/auth/change-password' @{ Authorization = "Bearer $tokCust" } @{
    current_password = 'customer123'; new_password = 'NewPass1234'
}
Show 'POST /api/auth/change-password (ahmed changes pw)' $r

$tokCust2 = Login 'ahmed@gmail.com' 'NewPass1234'
Write-Host "  Login with new password: $(if ($tokCust2){'OK'}else{'FAIL'})"

$r = Call POST '/api/auth/change-password' @{ Authorization = "Bearer $tokCust2" } @{
    current_password = 'NewPass1234'; new_password = 'customer123'
}
Show 'POST /api/auth/change-password (change back)' $r
$tokCust = Login 'ahmed@gmail.com' 'customer123'

$r = Call POST '/api/auth/change-password' @{ Authorization = "Bearer $tokCust" } @{
    current_password = 'WRONG'; new_password = 'Another1234'
}
Show 'POST /api/auth/change-password (wrong current, should 401)' $r

$r = Call POST '/api/auth/change-password' @{ Authorization = "Bearer $tokCust" } @{
    current_password = 'customer123'; new_password = '123'
}
Show 'POST /api/auth/change-password (weak new, should 400)' $r

$r = Call POST '/api/auth/change-password' @{ Authorization = "Bearer $tokCust" } @{
    current_password = 'customer123'; new_password = 'customer123'
}
Show 'POST /api/auth/change-password (same as current, should 400)' $r

$r = Call POST '/api/auth/change-password' @{ Authorization = "Bearer $tokCust" } @{ new_password = 'NewPass1234' }
Show 'POST /api/auth/change-password (no current, should 400)' $r

$r = Call POST '/api/auth/change-password' @{} @{ current_password = 'customer123'; new_password = 'NewPass1234' }
Show 'POST /api/auth/change-password without auth (should 401)' $r

Write-Host ''

# ===================================================================
# 3. ADDRESS CRUD
# ===================================================================
Write-Host '===== 3. Address CRUD ====='
$r = Call GET '/api/addresses?user_id=2' @{ Authorization = "Bearer $tokCust" } $null
$list = ($r.body | ConvertFrom-Json).data
Write-Host "  Existing addresses for ahmed: $($list.Count)"

$r = Call POST '/api/addresses' @{ Authorization = "Bearer $tokCust" } @{
    label = 'Office'; full_name = 'Ahmed'; phone = '+967712345671'
    governorate = 'Sana'; city = 'Sana'; street = 'Test St 42'
    is_default = $false
}
$addrId = (($r.body | ConvertFrom-Json).data).id
Show 'POST /api/addresses (create Office)' $r

$r = Call PUT "/api/addresses/$addrId" @{ Authorization = "Bearer $tokCust" } @{
    label = 'Office Updated'; full_name = 'Ahmed'; phone = '+967712345671'
    governorate = 'Aden'; city = 'Aden'; street = 'New St 99'; is_default = $false
}
Show 'PUT /api/addresses/<id> (update Office)' $r

$r = Call PUT "/api/addresses/$addrId" @{ Authorization = "Bearer $tokCust" } @{
    label = 'Office Updated'; full_name = 'Ahmed'; phone = '+967712345671'
    governorate = 'Aden'; city = 'Aden'; street = 'New St 99'; is_default = $true
}
Show 'PUT /api/addresses/<id> (set as default)' $r

$r = Call GET '/api/addresses?user_id=2' @{ Authorization = "Bearer $tokCust" } $null
$defaults = (($r.body | ConvertFrom-Json).data) | Where-Object is_default -eq $true
Write-Host "  Default addresses after set: $(($defaults | Measure-Object).Count) (should be 1)"

$r = Call DELETE "/api/addresses/$addrId" @{ Authorization = "Bearer $tokCust" } $null
Show 'DELETE /api/addresses/<id>' $r

Write-Host ''

# ===================================================================
# 4. ADDRESS VALIDATION & SECURITY
# ===================================================================
Write-Host '===== 4. Address validation & security ====='
$r = Call POST '/api/addresses' @{ Authorization = "Bearer $tokCust" } @{
    label = 'NoStreet'; full_name = 'Ahmed'; phone = '+967712345671'
    governorate = 'Sana'; city = 'Sana'
}
Show 'POST /api/addresses (missing street, should 400)' $r

$r = Call POST '/api/addresses' @{ Authorization = "Bearer $tokCust" } @{
    label = 'WithUnknown'; full_name = 'Ahmed'; phone = '+967712345671'
    governorate = 'Sana'; city = 'Sana'; street = 'X'
    malicious_field = 'injection'
}
Show 'POST /api/addresses (unknown field, should 400)' $r

$r = Call GET '/api/addresses?user_id=2' @{ Authorization = "Bearer $tokCust" } $null
$victimId = (($r.body | ConvertFrom-Json).data)[0].id
$r = Call DELETE "/api/addresses/$victimId" @{ Authorization = "Bearer $tokMerch" } $null
Show 'DELETE buyer address as MERCHANT (should 404)' $r

$r = Call PUT "/api/addresses/$victimId" @{ Authorization = "Bearer $tokMerch" } @{
    label = 'Hacked'; full_name = 'X'; phone = '+967712345671'
    governorate = 'X'; city = 'X'; street = 'X'
}
Show 'PUT buyer address as MERCHANT (should 400/404)' $r

$r = Call GET '/api/addresses?user_id=2' @{} $null
Show 'GET /api/addresses without auth (should 401)' $r

Write-Host ''
Write-Host 'PHASE 1 complete.'
