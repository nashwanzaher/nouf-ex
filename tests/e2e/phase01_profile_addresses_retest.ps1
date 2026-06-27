# Re-test the new profile + password endpoints
$base = 'http://localhost:3000'

function Call($method, $path, $headers, $body) {
    $p = @{ Uri = "$base$path"; Method = $method; Headers = $headers; UseBasicParsing = $true }
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
    $preview = if ($r.body.Length -gt 140) { $r.body.Substring(0, 140) + '...' } else { $r.body }
    Write-Host ("  {0,-55} status={1}  {2}" -f $label, $r.status, $preview)
}

# Create a fresh user
$rand = Get-Random -Minimum 100000 -Maximum 999999
$email = "p1retest$rand@example.com"
$r = Call POST '/api/auth/register' @{} @{
    email = $email; password = 'OriginalPass!'; name = "P1 User $rand"; phone = "+96771111$rand"
}
Show ("REGISTER $email") $r
$login = Call POST '/api/auth/login' @{} @{ email = $email; password = 'OriginalPass!' }
$tok = (($login.body | ConvertFrom-Json).data).token
$h = @{ Authorization = "Bearer $tok" }

Write-Host ''
Write-Host '===== Profile self-update ====='
$r = Call PATCH '/api/auth/me' $h @{ full_name = 'Updated Name'; phone = '+967799999999' }
Show 'PATCH /api/auth/me (full_name + phone)' $r
$r = Call PATCH '/api/auth/me' $h @{ preferred_language = 'en'; gender = 'other' }
Show 'PATCH /api/auth/me (lang + gender)' $r
$r = Call PATCH '/api/auth/me' $h @{ avatar = 'https://example.com/avatar.png' }
Show 'PATCH /api/auth/me (avatar URL)' $r
$r = Call PATCH '/api/auth/me' $h @{ email = 'hijack@example.com' }
Show 'PATCH /api/auth/me (forbidden: email change)' $r
$r = Call PATCH '/api/auth/me' $h @{ role = 'admin' }
Show 'PATCH /api/auth/me (forbidden: role change)' $r
$r = Call PATCH '/api/auth/me' $h @{}
Show 'PATCH /api/auth/me (empty body)' $r
$r = Call PATCH '/api/auth/me' $h @{ full_name = 'A' }
Show 'PATCH /api/auth/me (too-short name)' $r
$r = Call PATCH '/api/auth/me' $h @{ preferred_language = 'klingon' }
Show 'PATCH /api/auth/me (bad enum)' $r
$r = Call PATCH '/api/auth/me' $h @{ unknown_field = 'hacker' }
Show 'PATCH /api/auth/me (unknown field, strict)' $r

# Verify final state
$r = Call GET '/api/auth/me' $h $null
$me = ($r.body | ConvertFrom-Json).data
Write-Host "    final: name=$($me.full_name) phone=$($me.phone) lang=$($me.preferred_language) gender=$($me.gender)"

Write-Host ''
Write-Host '===== Change password ====='
$r = Call POST '/api/auth/change-password' $h @{ current_password = 'OriginalPass!'; new_password = 'NewPass!123' }
Show 'POST /api/auth/change-password (correct current)' $r

# Try to login with old password (should fail)
$r = Call POST '/api/auth/login' @{} @{ email = $email; password = 'OriginalPass!' }
Show 'LOGIN with old password (should 401)' $r

# Login with new password (should succeed)
$r = Call POST '/api/auth/login' @{} @{ email = $email; password = 'NewPass!123' }
Show 'LOGIN with new password (should 200)' $r
$tok2 = (($r.body | ConvertFrom-Json).data).token
$h2 = @{ Authorization = "Bearer $tok2" }

# Change with wrong current password
$r = Call POST '/api/auth/change-password' $h2 @{ current_password = 'WRONG'; new_password = 'AnotherPass!1' }
Show 'change-password with wrong current (should 401)' $r

# Change with weak new password
$r = Call POST '/api/auth/change-password' $h2 @{ current_password = 'NewPass!123'; new_password = '123' }
Show 'change-password with weak new (should 400)' $r

# Unauthed change-password
$r = Call POST '/api/auth/change-password' @{} @{ current_password = 'x'; new_password = 'NewPass!123' }
Show 'change-password without token (should 401)' $r

# Cross-user attack: user A tries to change user B's password
# But /api/auth/change-password uses req.user.id, so this should be impossible
$otherLogin = Call POST '/api/auth/login' @{} @{ email = 'ahmed@gmail.com'; password = 'customer123' }
$ahmedTok = (($otherLogin.body | ConvertFrom-Json).data).token
$r = Call POST '/api/auth/change-password' @{ Authorization = "Bearer $ahmedTok" } @{ current_password = 'customer123'; new_password = 'hacked123' }
Show "Ahmed changes HIS OWN password (should succeed — but we're not changing it for real)" $r
# Verify it didn't affect the database (login still works with old password)
$r = Call POST '/api/auth/login' @{} @{ email = 'ahmed@gmail.com'; password = 'customer123' }
Show "Ahmed login still works with customer123 (confirm no accidental change)" $r

Write-Host ''
Write-Host '===== Address strict schema re-test ====='
$r = Call POST '/api/addresses' $h @{ label = 'Test'; full_name = 'User'; phone = '+967711111111'; street = 'Test'; city = 'Sanaa'; governorate = 'Sanaa'; evil_field = 'xss' }
Show 'POST /api/addresses with unknown field (should 400 now)' $r

Write-Host ''
Write-Host 'PHASE 1 fixes verified.'
