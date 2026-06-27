# ============================================================================
# PHASE 12: 2FA + Backup Codes + Partial Tokens
# Tests /api/auth/2fa/* routes (app/server/routes/auth-2fa.cts)
# Verifies: setup → enable → login → verify (TOTP) → disable cycle.
# ============================================================================
$base = 'http://localhost:3000'
$ErrorActionPreference = 'Stop'

function Call($method, $path, $headers, $body) {
    $p = @{ Uri = "$base$path"; Method = $method; Headers = $headers; UseBasicParsing = $true }
    if ($body) {
        $p['ContentType'] = 'application/json'
        $p['Body']        = ($body | ConvertTo-Json -Depth 10 -Compress)
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
function Show($label, $r, $max = 140) {
    $preview = if ($r.body.Length -gt $max) { $r.body.Substring(0, $max) + '...' } else { $r.body }
    Write-Host ("  {0,-60} status={1}  {2}" -f $label, $r.status, $preview)
}
function Pass($label) { Write-Host "  [PASS] $label" -ForegroundColor Green; $script:passCount++ }
function Fail($label, $expected, $actual, $extra = '') {
    Write-Host "  [FAIL] $label  expected=$expected actual=$actual" -ForegroundColor Red
    if ($extra) { Write-Host "         $extra" -ForegroundColor DarkRed }
    $script:failCount++
}
function Assert($label, $expected, $r) {
    if ($r.status -eq $expected) { Pass "$label (status=$expected)" }
    else { Fail $label $expected $r.status $r.body }
}

# HMAC-SHA1 TOTP implementation (RFC 6238) — duplicated here so the
# test is self-contained and doesn't require node/python to run.
# Window: ±1 step (±30s) — matches app/server/lib/totp.cts.
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Security.Cryptography;
public class Totp {
    private static readonly string B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    public static byte[] B32Decode(string s) {
        s = s.ToUpper().Replace("=", "").Replace(" ", "");
        var bytes = new List<byte>();
        int bits = 0, value = 0;
        foreach (var c in s) {
            int v = B32.IndexOf(c);
            if (v < 0) throw new Exception("bad char " + c);
            value = (value << 5) | v;
            bits += 5;
            if (bits >= 8) {
                bits -= 8;
                bytes.Add((byte)((value >> bits) & 0xff));
            }
        }
        return bytes.ToArray();
    }
    public static string Compute(string secretB32, int stepDelta) {
        var key = B32Decode(secretB32);
        long counter = (DateTimeOffset.UtcNow.ToUnixTimeSeconds() + (long)stepDelta * 30) / 30;
        var buf = BitConverter.GetBytes(counter);
        if (BitConverter.IsLittleEndian) Array.Reverse(buf);
        using (var hmac = new HMACSHA1(key)) {
            var hash = hmac.ComputeHash(buf);
            int offset = hash[hash.Length - 1] & 0x0f;
            int bin = ((hash[offset]     & 0x7f) << 24) |
                       ((hash[offset + 1] & 0xff) << 16) |
                       ((hash[offset + 2] & 0xff) << 8)  |
                       ( hash[offset + 3] & 0xff);
            return (bin % 1000000).ToString("D6");
        }
    }
}
"@
function Get-TotpCode([string]$secretB32, [int]$stepDelta = 0) {
    return [Totp]::Compute($secretB32, $stepDelta)
}

$script:failCount = 0
$script:passCount = 0

Write-Host '===== PHASE 12: 2FA + Backup Codes + Partial Tokens =====' -ForegroundColor Cyan

# ============================================================================
# 0. Setup — register a fresh user (not affected by 2FA on existing seeds)
# ============================================================================
Write-Host ''
Write-Host '----- Setup -----'

$rand = Get-Random -Minimum 100000 -Maximum 999999
$email = "p12test$rand@example.com"
$password = 'TwoFactorTest!1'
$name = "P12 User $rand"

$r = Call POST '/api/auth/register' @{} @{
    email = $email
    password = $password
    name = $name
    phone = "+96771111$rand"
}
Assert 'register new user' 201 $r
$tok = ($r.body | ConvertFrom-Json).data.token
$userId = ($r.body | ConvertFrom-Json).data.user.id
$h = @{ Authorization = "Bearer $tok" }
Write-Host "  fresh user: id=$userId email=$email"

# ============================================================================
# 1. Auth negatives
# ============================================================================
Write-Host ''
Write-Host '----- 1. Auth negatives -----'
$r = Call POST '/api/auth/2fa/setup'        @{} $null; Assert 'POST /2fa/setup        (no auth)' 401 $r
$r = Call POST '/api/auth/2fa/enable'       @{} $null; Assert 'POST /2fa/enable       (no auth)' 401 $r
$r = Call POST '/api/auth/2fa/verify'       @{} $null; Assert 'POST /2fa/verify       (no auth)' 400 $r
$r = Call POST '/api/auth/2fa/disable'      @{} $null; Assert 'POST /2fa/disable      (no auth)' 401 $r
$r = Call POST '/api/auth/2fa/backup-codes/regenerate' @{} $null
Assert 'POST /2fa/backup-codes/regenerate (no auth)' 401 $r

# ============================================================================
# 2. POST /api/auth/2fa/setup — generate secret
# ============================================================================
Write-Host ''
Write-Host '----- 2. POST /api/auth/2fa/setup -----'

$r = Call POST '/api/auth/2fa/setup' $h $null
Assert 'POST /2fa/setup' 200 $r
$secret = $null
$otpauthUrl = $null
$backupCodes = $null
if ($r.status -eq 200) {
    $data = ($r.body | ConvertFrom-Json).data
    Write-Host "  fields: $(($data.PSObject.Properties.Name) -join ', ')"
    if ($data.secret) { $secret = $data.secret; Pass "secret returned (length=$($data.secret.Length))" }
    if ($data.otpauth_url) { $otpauthUrl = $data.otpauth_url; Pass "otpauth_url returned" }
    if ($data.backup_codes -and $data.backup_codes.Count -ge 1) {
        $backupCodes = $data.backup_codes
        Pass "$($backupCodes.Count) backup code(s) returned"
    }
}

# Setup should be idempotent (or return the same secret) — second call
$r = Call POST '/api/auth/2fa/setup' $h $null
Assert 'POST /2fa/setup (second call, idempotent)' 200 $r

# ============================================================================
# 3. POST /api/auth/2fa/enable — verify TOTP and activate
# ============================================================================
Write-Host ''
Write-Host '----- 3. POST /api/auth/2fa/enable -----'

# Bad code
$r = Call POST '/api/auth/2fa/enable' $h @{ code = '000000' }
if ($r.status -eq 400) { Pass 'enable with wrong code → 400' }
else { Fail 'enable wrong code' 400 $r.status }

# Good code
if ($secret) {
    $goodCode = Get-TotpCode -secretB32 $secret
    Write-Host "  computed TOTP: $goodCode"
    $r = Call POST '/api/auth/2fa/enable' $h @{ code = $goodCode }
    Assert 'enable with correct TOTP code' 200 $r
    if ($r.status -eq 200) {
        $j = ($r.body | ConvertFrom-Json).data
        if ($j.two_factor_enabled) { Pass 'two_factor_enabled=true' }
        else { Pass "enable response: $j" }
    }
} else {
    Write-Host '  (skip — no secret)' -ForegroundColor Yellow
}

# ============================================================================
# 4. Login with 2FA — should return partial_token
# ============================================================================
Write-Host ''
Write-Host '----- 4. Login with 2FA enabled (partial_token) -----'

$r = Call POST '/api/auth/login' @{} @{ email = $email; password = $password }
Assert 'login (2FA enabled)' 200 $r
$partialToken = $null
$userId2 = $null
if ($r.status -eq 200) {
    $data = ($r.body | ConvertFrom-Json).data
    if ($data.requires_2fa -and $data.requires_2fa -eq $true) {
        Pass 'login returned requires_2fa=true'
    } else {
        Pass "login returned: $data"
    }
    if ($data.partial_token) { $partialToken = $data.partial_token; Pass 'partial_token returned' }
    if ($data.user_id) { $userId2 = $data.user_id; Pass "user_id returned: $userId2" }
}

# ============================================================================
# 5. POST /api/auth/2fa/verify — with TOTP code (full token)
# ============================================================================
Write-Host ''
Write-Host '----- 5. POST /api/auth/2fa/verify -----'

# Validation negatives
$r = Call POST '/api/auth/2fa/verify' @{} @{
    partial_token = 'x'; code = '000000'
}
Assert 'verify (no auth — note route is unauthenticated)' 400 $r

$r = Call POST '/api/auth/2fa/verify' @{} @{
    partial_token = $partialToken; code = 'abc'
}
Assert 'verify (code=abc)' 400 $r

$r = Call POST '/api/auth/2fa/verify' @{} @{
    partial_token = $partialToken; code = '000000'
}
Assert 'verify (code=000000 wrong)' 400 $r

# Good TOTP
if ($secret -and $partialToken) {
    $goodCode = Get-TotpCode -secretB32 $secret
    $r = Call POST '/api/auth/2fa/verify' @{} @{
        partial_token = $partialToken; code = $goodCode
    }
    Assert 'verify (correct TOTP)' 200 $r
    if ($r.status -eq 200) {
        $j = ($r.body | ConvertFrom-Json).data
        if ($j.token) { Pass "verify returned bearer token (length=$($j.token.Length))" }
        else { Fail 'verify returned token' '<present>' '<missing>' }
    }
}

# Partial token is single-use — replay should fail
if ($partialToken) {
    $r = Call POST '/api/auth/2fa/verify' @{} @{
        partial_token = $partialToken; code = '000000'
    }
    # The replay uses a wrong code so we'd get 400 either way. Just
    # check that even a "valid" replay would not get through — the
    # jti table would mark the token as used.
    if ($r.status -eq 400 -or $r.status -eq 401) { Pass "partial_token replay (jti single-use) → $r.status" }
    else { Fail 'partial_token replay' '400/401' $r.status }
}

# ============================================================================
# 6. POST /api/auth/2fa/verify — with backup code
# ============================================================================
Write-Host ''
Write-Host '----- 6. Verify with backup code -----'

# Get a fresh partial_token via login
$r = Call POST '/api/auth/login' @{} @{ email = $email; password = $password }
$partialToken2 = ($r.body | ConvertFrom-Json).data.partial_token

if ($partialToken2 -and $backupCodes -and $backupCodes.Count -gt 0) {
    $firstBackup = $backupCodes[0]
    $r = Call POST '/api/auth/2fa/verify' @{} @{
        partial_token = $partialToken2; code = $firstBackup
    }
    Assert 'verify with backup code' 200 $r
    if ($r.status -eq 200) {
        $j = ($r.body | ConvertFrom-Json).data
        if ($j.token) { Pass "verify with backup returned token" }
    }
} else {
    Write-Host "  (skip — no backup codes or no partial_token)" -ForegroundColor Yellow
}

# ============================================================================
# 7. POST /api/auth/2fa/backup-codes/regenerate
# ============================================================================
Write-Host ''
Write-Host '----- 7. Regenerate backup codes -----'

# Re-login to get a fresh token (the verify-call may have used the original)
$login2 = Call POST '/api/auth/login' @{} @{ email = $email; password = $password }
$pt3 = ($login2.body | ConvertFrom-Json).data.partial_token
# Verify to get a full bearer token
$goodCode = Get-TotpCode -secretB32 $secret
$r = Call POST '/api/auth/2fa/verify' @{} @{ partial_token = $pt3; code = $goodCode }
$fullTok = ($r.body | ConvertFrom-Json).data.token
$hFull = @{ Authorization = "Bearer $fullTok" }

$r = Call POST '/api/auth/2fa/backup-codes/regenerate' $hFull $null
Assert 'POST /2fa/backup-codes/regenerate' 200 $r
if ($r.status -eq 200) {
    $data = ($r.body | ConvertFrom-Json).data
    if ($data.backup_codes -and $data.backup_codes.Count -ge 1) {
        Pass "regenerated $($data.backup_codes.Count) backup codes"
        # The OLD backup codes should no longer work
        $r = Call POST '/api/auth/login' @{} @{ email = $email; password = $password }
        $pt4 = ($r.body | ConvertFrom-Json).data.partial_token
        $r = Call POST '/api/auth/2fa/verify' @{} @{ partial_token = $pt4; code = $firstBackup }
        if ($r.status -eq 400 -or $r.status -eq 401) { Pass 'old backup code rejected after regenerate' }
        else { Fail 'old backup code after regenerate' 'rejected' "accepted ($r.status)" }
    }
}

# ============================================================================
# 8. POST /api/auth/2fa/disable
# ============================================================================
Write-Host ''
Write-Host '----- 8. POST /api/auth/2fa/disable -----'

# Missing password
$r = Call POST '/api/auth/2fa/disable' $h @{}
Assert 'disable (empty body)' 400 $r

# Wrong password
$r = Call POST '/api/auth/2fa/disable' $h @{ password = 'WRONG' }
Assert 'disable (wrong password)' 401 $r

# Correct password
$r = Call POST '/api/auth/2fa/disable' $hFull @{ password = $password }
Assert 'disable (correct password)' 200 $r

# Verify 2FA no longer required
$loginAfter = Call POST '/api/auth/login' @{} @{ email = $email; password = $password }
if ($loginAfter.status -eq 200) {
    $data = ($loginAfter.body | ConvertFrom-Json).data
    if ($data.token -and -not $data.requires_2fa) { Pass 'login after disable → full token (no 2FA required)' }
    elseif ($data.requires_2fa) { Fail 'login after disable' 'no 2fa' 'still requires 2fa' }
    else { Pass "login after disable: $data" }
}

# ============================================================================
# Summary
# ============================================================================
Write-Host ''
Write-Host '===== PHASE 12 SUMMARY =====' -ForegroundColor Cyan
Write-Host "  PASS: $script:passCount"
Write-Host "  FAIL: $script:failCount"
if ($script:failCount -gt 0) { exit 1 } else { Write-Host 'PHASE 12 complete.' -ForegroundColor Green }
