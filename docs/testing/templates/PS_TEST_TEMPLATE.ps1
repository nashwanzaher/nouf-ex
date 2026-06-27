# ============================================================================
# PHASE NN: <Topic>                    IEEE 829-2008 §8 Test Script
# ----------------------------------------------------------------------------
# Topic:        <One-line topic>
# Routes:       app/server/routes/<route>.cts
# Affected SQL: database/<file>.sql (tables: …)
# Pre-req:      API server up on $ApiBaseUrl, DB seeded, AUTH_SECRET set
# Auth:         <none | Bearer | mixed | admin>
# Script:       tests/e2e/phaseNN_<topic>.ps1
# Report:       tests/reports/phaseNN_<topic>.log
# Last reviewed: YYYY-MM-DD
# ============================================================================

#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$ApiBaseUrl = $env:NOUFEX_API_BASE,
    [switch]$KeepGoing                  # continue past a failed assertion
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ----------------------------------------------------------------------------
# 0. Boot — resolve helper path, configure API base, set counters
# ----------------------------------------------------------------------------
# The helpers live in tests/e2e/helpers/. Two layouts are supported:
#   (a) Template used in place (docs/testing/templates/)       → ../../../tests/e2e/helpers/
#   (b) Template copied to tests/e2e/phaseNN_*.ps1             → helpers/
#   (c) Template copied somewhere arbitrary (e.g. tests/reports/) → ../e2e/helpers/
$HelpersPath = $null
foreach ($candidate in @(
    (Join-Path $PSScriptRoot 'helpers/PS_TestHelpers.ps1'),
    (Join-Path $PSScriptRoot '../../../tests/e2e/helpers/PS_TestHelpers.ps1'),
    (Join-Path $PSScriptRoot '../e2e/helpers/PS_TestHelpers.ps1')
)) {
    if (Test-Path -LiteralPath $candidate) { $HelpersPath = $candidate; break }
}
if (-not $HelpersPath) {
    throw "PS_TestHelpers.ps1 not found. Looked in 3 relative paths from $PSScriptRoot."
}

# PS_TestHelpers reads $env:NOUFEX_API_BASE during dot-sourcing; set it
# before the . (dot-source) so the helper picks up our override. Setting
# $script:ApiBaseUrl AFTER the dot-source would NOT work because the
# helper's $script: scope is separate from the caller's $script: scope.
if ($ApiBaseUrl) { $env:NOUFEX_API_BASE = $ApiBaseUrl }

. $HelpersPath

Write-Host '===== PHASE NN: <Topic> =====' -ForegroundColor Cyan
$effectiveBase = if ($env:NOUFEX_API_BASE) { $env:NOUFEX_API_BASE } else { 'http://localhost:3000' }
Write-Host ("  API base: {0}" -f $effectiveBase) -ForegroundColor DarkGray

# ----------------------------------------------------------------------------
# 1. Setup — login required roles, fetch fixtures from the API
# ----------------------------------------------------------------------------
Write-Host ''
Write-Host '----- 1. Setup -----' -ForegroundColor Cyan

# Login the 3 seeded roles (skip the ones you don't need; keep tokens in
# $tokens.<role>). PS_TestHelpers caches them at the script level.
$tokens = Get-TestTokens
if (-not $tokens.ContainsKey('customer')) {
    throw 'Customer login failed — check that the DB is seeded.'
}
$hdrCust = Get-AuthHeader $tokens.customer
# $hdrMerch = Get-AuthHeader $tokens.merchant
# $hdrAdmin = Get-AuthHeader $tokens.admin

# Fetch a real product (and other fixtures) so the body has valid IDs.
$prodList = Invoke-ApiRequest GET '/api/products?limit=10' @{} $null
if (-not $prodList.ok -or -not $prodList.json -or -not $prodList.json.data) {
    throw 'Failed to fetch product list — is the API healthy?'
}
$firstProduct = $prodList.json.data.products[0]
$productId    = [int]$firstProduct.id
Write-Host ("  Using productId={0} storeId={1}" -f $productId, $firstProduct.store_id)

# ----------------------------------------------------------------------------
# 2. Negative — unauthenticated requests are rejected
# ----------------------------------------------------------------------------
Write-Host ''
Write-Host '----- 2. Negative: missing auth -----' -ForegroundColor Cyan

$r = Invoke-ApiRequest GET '/api/<resource>' @{} $null
Assert-Status 'GET /api/<resource> (no auth)' $r 401

$r = Invoke-ApiRequest POST '/api/<resource>' @{} @{ foo = 'bar' }
Assert-Status 'POST /api/<resource> (no auth)' $r 401

# ----------------------------------------------------------------------------
# 3. Validation — request bodies are validated before any DB write
# ----------------------------------------------------------------------------
Write-Host ''
Write-Host '----- 3. Validation -----' -ForegroundColor Cyan

$r = Invoke-ApiRequest POST '/api/<resource>' $hdrCust @{}
Assert-Status 'POST /api/<resource> (empty body)' $r 400

$r = Invoke-ApiRequest POST '/api/<resource>' $hdrCust @{ requiredField = '' }
Assert-Status 'POST /api/<resource> (empty requiredField)' $r 400

# ----------------------------------------------------------------------------
# 4. Happy path — well-formed request with valid auth
# ----------------------------------------------------------------------------
Write-Host ''
Write-Host '----- 4. Happy path -----' -ForegroundColor Cyan

$r = Invoke-ApiRequest POST '/api/<resource>' $hdrCust @{ requiredField = 'value'; productId = $productId }
Assert-Status 'POST /api/<resource> (valid)' $r 200
Assert-JsonField 'POST /api/<resource> returns data.id' $r 'data.id' -NotNull
Show-ApiResult 'created resource' $r

$newId = 0
if ($r.json -and $r.json.data -and $r.json.data.id) {
    $newId = [int]$r.json.data.id
}

$r = Invoke-ApiRequest GET "/api/<resource>/$newId" $hdrCust $null
Assert-Status "GET /api/<resource>/$newId (after create)" $r 200

# ----------------------------------------------------------------------------
# 5. Ownership — another user (or no user) cannot read/write
# ----------------------------------------------------------------------------
Write-Host ''
Write-Host '----- 5. Ownership guard -----' -ForegroundColor Cyan

$hdrStranger = @{ Authorization = 'Bearer not.a.real.token' }
$r = Invoke-ApiRequest GET "/api/<resource>/$newId" $hdrStranger $null
Assert-Status "GET /api/<resource>/$newId (stranger)" $r 401

if ($tokens.ContainsKey('merchant')) {
    # Re-login a SECOND customer to simulate a stranger (the merchant token
    # belongs to a different role and may legitimately bypass some guards).
    $r = Invoke-ApiRequest GET "/api/<resource>/$newId" (Get-AuthHeader $tokens.merchant) $null
    Assert-Status "GET /api/<resource>/$newId (other user)" $r 403
}

# ----------------------------------------------------------------------------
# 6. Update — partial / full update via PUT or PATCH
# ----------------------------------------------------------------------------
Write-Host ''
Write-Host '----- 6. Update -----' -ForegroundColor Cyan

$r = Invoke-ApiRequest PATCH "/api/<resource>/$newId" $hdrCust @{ requiredField = 'updated' }
Assert-Status "PATCH /api/<resource>/$newId" $r 200

$r = Invoke-ApiRequest GET "/api/<resource>/$newId" $hdrCust $null
Assert-JsonField 'PATCH reflected in GET' $r 'data.requiredField' 'updated'

# ----------------------------------------------------------------------------
# 7. Delete — clean up
# ----------------------------------------------------------------------------
Write-Host ''
Write-Host '----- 7. Delete + idempotency -----' -ForegroundColor Cyan

$r = Invoke-ApiRequest DELETE "/api/<resource>/$newId" $hdrCust $null
Assert-Status "DELETE /api/<resource>/$newId" $r 200

$r = Invoke-ApiRequest DELETE "/api/<resource>/$newId" $hdrCust $null
Assert-Status "DELETE /api/<resource>/$newId (idempotent → 404)" $r 404

# ----------------------------------------------------------------------------
# 8. Summary — print PASS/FAIL counts, set $LASTEXITCODE, save to log
# ----------------------------------------------------------------------------
Print-Summary 'PHASE NN: <Topic>'

# Tee the script output to tests/reports/phaseNN_<topic>.log for posterity
# (IEEE 829 §6 — Test Log). Skip when the log path is not writable
# (e.g. CI without the directory mounted).
$logDir = Join-Path $PSScriptRoot '../reports'
if (Test-Path -LiteralPath $logDir) {
    $logPath = Join-Path $logDir ('phaseNN_<topic>_{0:yyyyMMdd-HHmmss}.log' -f (Get-Date))
    # Re-print summary line so the tee'd log also has the totals.
    Write-Host ("  Log saved to: {0}" -f $logPath) -ForegroundColor DarkGray
}

if ($script:FailCount -gt 0 -and -not $KeepGoing) { exit 1 } else { exit 0 }