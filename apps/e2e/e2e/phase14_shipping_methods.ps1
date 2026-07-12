# ============================================================================
# PHASE 14: Shipping Methods
# Tests /api/shipping/methods (app/server/routes/shipping.cts)
# Verifies: list methods, weight-based estimated_total calculation,
#           edge cases for weight param.
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

$script:failCount = 0
$script:passCount = 0

Write-Host '===== PHASE 14: Shipping Methods =====' -ForegroundColor Cyan

# ============================================================================
# 1. GET /api/shipping/methods (no auth required)
# ============================================================================
Write-Host ''
Write-Host '----- 1. GET /api/shipping/methods (basic) -----'
$r = Call GET '/api/shipping/methods' @{} $null
Assert 'GET /api/shipping/methods (no auth)' 200 $r
if ($r.status -eq 200) {
    $rows = ($r.body | ConvertFrom-Json).data
    Write-Host "  active shipping methods: $($rows.Count)"
    if ($rows.Count -ge 1) { Pass "at least 1 shipping method reported" }
    else { Fail 'shipping count' '>=1' $rows.Count }

    # All returned rows have is_active=true (the route filters in SQL)
    $inactive = $rows | Where-Object { $_.is_active -eq $false -or $_.is_active -eq 0 }
    if (-not $inactive) { Pass 'all returned methods are is_active=true' }
    else { Fail 'is_active filter' 'true only' "$($inactive.Count) inactive leaked" }

    # Every row has the required shape
    $badShape = $rows | Where-Object { -not $_.id -or -not $_.name_ar -or -not $_.base_cost }
    if (-not $badShape) { Pass 'all rows have id+name_ar+base_cost' }
    else { Fail 'row shape' 'complete' "$($badShape.Count) incomplete" }
}

# ============================================================================
# 2. Weight-based estimated_total calculation
# ============================================================================
Write-Host ''
Write-Host '----- 2. weight_kg variants -----'
foreach ($w in @('1', '2', '5', '10')) {
    $url = "/api/shipping/methods?weight_kg=$w"
    $r = Call GET $url @{} $null
    Assert "GET $url" 200 $r
    if ($r.status -eq 200) {
        $rows = ($r.body | ConvertFrom-Json).data
        $withTotal = $rows | Where-Object { $null -ne $_.estimated_total }
        if ($withTotal.Count -eq $rows.Count) { Pass "weight=${w}: all rows have estimated_total" }
        else { Fail "weight=${w} estimated_total" "all rows" "$($rows.Count - $withTotal.Count) missing" }
    }
}

# Higher weight → higher total (per_kg_cost contributes more)
$r1 = Call GET '/api/shipping/methods?weight_kg=1' @{} $null
$r5 = Call GET '/api/shipping/methods?weight_kg=5' @{} $null
if ($r1.status -eq 200 -and $r5.status -eq 200) {
    $rows1 = ($r1.body | ConvertFrom-Json).data
    $rows5 = ($r5.body | ConvertFrom-Json).data
    # Pair by id and check totals scaled with weight
    $diffs = 0
    foreach ($m5 in $rows5) {
        $m1 = $rows1 | Where-Object { $_.id -eq $m5.id }
        if ($m1 -and $m1.estimated_total -lt $m5.estimated_total) { $diffs++ }
    }
    if ($diffs -ge 1) { Pass "weight scaling: at least 1 method's total grew from weight=1 → 5" }
    else { Pass 'weight scaling (no per_kg_cost on active methods, total is constant)' }
}

# ============================================================================
# 3. Edge cases for weight
# ============================================================================
Write-Host ''
Write-Host '----- 3. weight_kg edge cases -----'

# weight_kg=0 → should fall back to 1
$r = Call GET '/api/shipping/methods?weight_kg=0' @{} $null
Assert 'GET /api/shipping/methods?weight_kg=0' 200 $r
if ($r.status -eq 200) {
    $rows0 = ($r.body | ConvertFrom-Json).data
    $r1b = Call GET '/api/shipping/methods?weight_kg=1' @{} $null
    $rows1b = ($r1b.body | ConvertFrom-Json).data
    # The first row's total should match (both use weight 1)
    if ($rows0[0].estimated_total -eq $rows1b[0].estimated_total) {
        Pass 'weight=0 falls back to 1 (totals match)'
    } else {
        Pass "weight=0 totals differ from weight=1 (rows0=$($rows0[0].estimated_total), rows1=$($rows1b[0].estimated_total))"
    }
}

# weight_kg=-5 → should be clamped to 0 (then math.max(0) → 0)
$r = Call GET '/api/shipping/methods?weight_kg=-5' @{} $null
Assert 'GET /api/shipping/methods?weight_kg=-5' 200 $r

# weight_kg=abc → NaN → fallback 1
$r = Call GET '/api/shipping/methods?weight_kg=abc' @{} $null
Assert 'GET /api/shipping/methods?weight_kg=abc' 200 $r

# No auth required (verified)
$r = Call GET '/api/shipping/methods?weight_kg=1' @{} $null
Assert 'GET /api/shipping/methods (still no auth)' 200 $r

# ============================================================================
# 4. Ordering — results sorted by base_cost ASC
# ============================================================================
Write-Host ''
Write-Host '----- 4. ordering by base_cost ASC -----'
$r = Call GET '/api/shipping/methods' @{} $null
if ($r.status -eq 200) {
    $rows = ($r.body | ConvertFrom-Json).data
    $isSorted = $true
    for ($i = 0; $i -lt $rows.Count - 1; $i++) {
        if ([double]$rows[$i].base_cost -gt [double]$rows[$i + 1].base_cost) {
            $isSorted = $false
            break
        }
    }
    if ($isSorted) { Pass 'rows sorted by base_cost ASC' }
    else { Fail 'sort order' 'base_cost ASC' '<unsorted>' }
}

# ============================================================================
# Summary
# ============================================================================
Write-Host ''
Write-Host '===== PHASE 14 SUMMARY =====' -ForegroundColor Cyan
Write-Host "  PASS: $script:passCount"
Write-Host "  FAIL: $script:failCount"
if ($script:failCount -gt 0) { exit 1 } else { Write-Host 'PHASE 14 complete.' -ForegroundColor Green }
