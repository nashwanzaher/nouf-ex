# ============================================================================
# PS_TestHelpers.ps1 — Reusable PowerShell Test Helpers for Nouf-ex E2E Tests
# ============================================================================
# Source of truth: IEEE 829-2008 "Standard for Software and System Test
# Documentation" — Test Script section (clause 8).
#
# Provides common helpers used by all phase*.ps1 scripts:
#   - Invoke-ApiRequest : HTTP wrapper with structured logging
#   - Show-ApiResult    : Compact status + payload preview
#   - Get-TestToken     : Cached login helper for the 3 seeded roles
#   - Assert-Status     : Pass/Fail assertions with PASS/FAIL counters
#   - Get-PassRate      : Final summary
#
# Usage in a phase script:
#   . "$PSScriptRoot\helpers\PS_TestHelpers.ps1"
#   $tokens = Get-TestTokens
#   $result = Invoke-ApiRequest GET '/api/products' @{} $null
#   Assert-Status 'GET /api/products' $result 200
# ============================================================================

#Disable Strict-Mode globally for these helpers (we intentionally use
#some loose typing to match the dynamic JSON payloads).
Set-StrictMode -Version Latest

# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------
$script:ApiBaseUrl = $env:NOUFEX_API_BASE
if (-not $script:ApiBaseUrl) { $script:ApiBaseUrl = 'http://localhost:3000' }

$script:PassCount = 0
$script:FailCount = 0
$script:Failures  = @()

# ----------------------------------------------------------------------------
# Invoke-ApiRequest — Single HTTP call with structured response envelope
# ----------------------------------------------------------------------------
# Parameters
#   Method      : GET | POST | PUT | PATCH | DELETE
#   Path        : e.g. '/api/auth/login' (no host)
#   Headers     : Hashtable, e.g. @{ Authorization = "Bearer $tok" }
#   Body        : Hashtable or $null
#
# Returns a hashtable:
#   @{ ok = $true|$false; status = <int>; body = <string>; json = <PSObject> }
# ----------------------------------------------------------------------------
function Invoke-ApiRequest {
    param(
        [Parameter(Mandatory)] [string] $Method,
        [Parameter(Mandatory)] [string] $Path,
        [hashtable] $Headers = @{},
        $Body = $null
    )
    $uri = "$script:ApiBaseUrl$Path"
    $params = @{
        Uri             = $uri
        Method          = $Method
        Headers         = $Headers
        UseBasicParsing = $true
        TimeoutSec      = 15
    }
    if ($null -ne $Body) {
        $params['ContentType'] = 'application/json; charset=utf-8'
        $params['Body'] = ($Body | ConvertTo-Json -Depth 10 -Compress)
    }
    try {
        $r = Invoke-WebRequest @params
        $respBody = $r.Content
        $json = $null
        if ($r.Content -and $r.Content.Trim().Length -gt 0) {
            try { $json = ($r.Content | ConvertFrom-Json) } catch { $json = $null }
        }
        return @{ ok = $true; status = [int]$r.StatusCode; body = $respBody; json = $json }
    } catch {
        $resp = $_.Exception.Response
        $status = if ($resp) { [int]$resp.StatusCode } else { 0 }
        $b = ''
        if ($resp) {
            try {
                $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
                $b = $reader.ReadToEnd()
            } catch { $b = '' }
        }
        $json = $null
        if ($b -and $b.Trim().Length -gt 0) {
            try { $json = ($b | ConvertFrom-Json) } catch { $json = $null }
        }
        return @{ ok = $false; status = $status; body = $b; json = $json }
    }
}

# ----------------------------------------------------------------------------
# Show-ApiResult — Compact one-line result printer (educational + minimal)
# ----------------------------------------------------------------------------
function Show-ApiResult {
    param(
        [Parameter(Mandatory)] [string] $Label,
        [Parameter(Mandatory)] $Result
    )
    $preview = if ($Result.body.Length -gt 120) {
        $Result.body.Substring(0, 120) + '...'
    } else {
        $Result.body
    }
    Write-Host ("  {0,-60} status={1,3}  {2}" -f $Label, $Result.status, $preview)
}

# ----------------------------------------------------------------------------
# Assert-Status — Pass/Fail assertion with counter
# ----------------------------------------------------------------------------
function Assert-Status {
    param(
        [Parameter(Mandatory)] [string] $Label,
        [Parameter(Mandatory)] $Result,
        [Parameter(Mandatory)] [int]    $Expected
    )
    if ($Result.status -eq $Expected) {
        $script:PassCount++
        Write-Host ("  [PASS] {0,-60} status={1}" -f $Label, $Result.status) -ForegroundColor Green
    } else {
        $script:FailCount++
        $script:Failures += @{ Label = $Label; Expected = $Expected; Actual = $Result.status; Body = $Result.body }
        Write-Host ("  [FAIL] {0,-60} expected={1} actual={2}" -f $Label, $Expected, $Result.status) -ForegroundColor Red
        Show-ApiResult $Label $Result
    }
}

# ----------------------------------------------------------------------------
# Assert-JsonField — Field-level assertion (drill into the JSON envelope)
# ----------------------------------------------------------------------------
function Assert-JsonField {
    param(
        [Parameter(Mandatory)] [string] $Label,
        [Parameter(Mandatory)] $Result,
        [Parameter(Mandatory)] [string] $Path,         # PowerShell dot-path, e.g. 'data.id'
        $Expected = $null,                              # optional expected value
        [switch] $NotNull                               # just check the field is present
    )
    $json = $Result.json
    $actual = $null
    $resolved = $false
    if ($json) {
        $segments = $Path -split '\.'
        $cursor = $json
        foreach ($seg in $segments) {
            if ($null -eq $cursor) { break }
            if ($cursor.PSObject.Properties.Name -contains $seg) {
                $cursor = $cursor.$seg
                $resolved = $true
            } else {
                $resolved = $false
                break
            }
        }
        $actual = $cursor
    }
    if ($NotNull) {
        if ($resolved -and $null -ne $actual -and "$actual".Length -gt 0) {
            $script:PassCount++
            Write-Host ("  [PASS] {0,-60} {1}={2}" -f $Label, $Path, $actual) -ForegroundColor Green
        } else {
            $script:FailCount++
            $script:Failures += @{ Label = "$Label ($Path)"; Expected = 'NotNull'; Actual = $actual }
            Write-Host ("  [FAIL] {0,-60} expected={1} actual={2}" -f $Label, 'NotNull', $actual) -ForegroundColor Red
        }
    } elseif ($null -ne $Expected) {
        if ($actual -eq $Expected) {
            $script:PassCount++
            Write-Host ("  [PASS] {0,-60} {1}={2}" -f $Label, $Path, $actual) -ForegroundColor Green
        } else {
            $script:FailCount++
            $script:Failures += @{ Label = "$Label ($Path)"; Expected = $Expected; Actual = $actual }
            Write-Host ("  [FAIL] {0,-60} expected={1} actual={2}" -f $Label, $Expected, $actual) -ForegroundColor Red
        }
    }
}

# ----------------------------------------------------------------------------
# Get-TestTokens — Logs in the 3 seeded roles; returns a hashtable
# ----------------------------------------------------------------------------
function Get-TestTokens {
    $map = @{
        'customer' = @{ email = 'ahmed@gmail.com';         password = 'customer123' }
        'merchant' = @{ email = 'fatima@spice-yemen.com'; password = 'merchant123' }
        'admin'    = @{ email = 'admin@noufex.com';       password = 'admin123' }
    }
    $tokens = @{}
    foreach ($role in @('customer', 'merchant', 'admin')) {
        $r = Invoke-ApiRequest POST '/api/auth/login' @{} $map[$role]
        if ($r.ok -and $r.json -and $r.json.data -and $r.json.data.token) {
            $tokens[$role] = $r.json.data.token
        } else {
            Write-Warning "Login failed for $role — token not captured"
        }
    }
    return $tokens
}

# ----------------------------------------------------------------------------
# Get-AuthHeader — Convenience wrapper
# ----------------------------------------------------------------------------
function Get-AuthHeader {
    param([Parameter(Mandatory)] [string] $Token)
    return @{ Authorization = "Bearer $Token" }
}

# ----------------------------------------------------------------------------
# Print-Summary — Final test summary (printed at the end of each phase script)
# ----------------------------------------------------------------------------
function Print-Summary {
    param([string] $PhaseName)
    $total = $script:PassCount + $script:FailCount
    Write-Host ''
    Write-Host ('════════════════════════════════════════════════════════════════') -ForegroundColor Cyan
    Write-Host ("  PHASE SUMMARY: {0}" -f $PhaseName) -ForegroundColor Cyan
    Write-Host ("  Total:  {0}" -f $total) -ForegroundColor Cyan
    Write-Host ("  Passed: {0}" -f $script:PassCount) -ForegroundColor Green
    Write-Host ("  Failed: {0}" -f $script:FailCount) -ForegroundColor $(if ($script:FailCount -gt 0) { 'Red' } else { 'Green' })
    if ($script:FailCount -gt 0) {
        Write-Host ''
        Write-Host '  Failures:' -ForegroundColor Red
        foreach ($f in $script:Failures) {
            Write-Host ("    - {0}: expected={1} actual={2}" -f $f.Label, $f.Expected, $f.Actual) -ForegroundColor Red
        }
    }
    Write-Host ('════════════════════════════════════════════════════════════════') -ForegroundColor Cyan
}

# ----------------------------------------------------------------------------
# Reset-Counters — Re-initialize counters between sub-suites
# ----------------------------------------------------------------------------
function Reset-Counters {
    $script:PassCount = 0
    $script:FailCount = 0
    $script:Failures  = @()
}
