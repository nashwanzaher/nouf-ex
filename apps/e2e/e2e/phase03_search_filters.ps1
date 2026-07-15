# PHASE 3: Search + Filters + Pagination
# Tests /api/search (apps/api/src/routes/catalog.ts:387)
# FTS via search_tsv (database/migrations/0009_search_backend.sql)
$base = 'http://localhost:3000'
$ErrorActionPreference = 'Stop'

function Call($method, $path, $headers, $body) {
    $p = @{
        Uri     = "$base$path"
        Method  = $method
        Headers = $headers
        UseBasicParsing = $true
    }
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
function Pass($label) { Write-Host "  [PASS] $label" -ForegroundColor Green }
function Fail($label, $expected, $actual) {
    Write-Host "  [FAIL] $label  expected=$expected actual=$actual" -ForegroundColor Red
    $script:failCount++
}
function Assert($label, $expected, $r) {
    if ($r.status -eq $expected) { Pass "$label (status=$expected)"; $script:passCount++ }
    else { Fail $label $expected $r.status }
}

$script:failCount = 0
$script:passCount = 0

Write-Host '===== PHASE 3: Search + Filters + Pagination =====' -ForegroundColor Cyan

# ============================================================================
# Section 1: Negative (no query / empty query)
# ============================================================================
Write-Host ''
Write-Host '----- 1. Negative: missing/empty q -----'
$r = Call GET '/api/search' @{} $null
Assert 'GET /api/search (no q)' 400 $r

$r = Call GET '/api/search?q=' @{} $null
Assert 'GET /api/search?q= (empty)' 400 $r
Show 'preview' $r

# ============================================================================
# Section 2: Positive — basic queries
# ============================================================================
Write-Host ''
Write-Host '----- 2. Positive: basic queries -----'

# First fetch a real product name to use as query
$r = Call GET '/api/products?limit=5' @{} $null
$firstProducts = ($r.body | ConvertFrom-Json).data.products
$firstProduct = $firstProducts[0]
Write-Host "    Reference product: id=$($firstProduct.id) name_ar=$($firstProduct.name_ar)"

# Use the English name as a search query
$query = $firstProduct.name_en
$r = Call GET "/api/search?q=$query" @{} $null
Assert "GET /api/search?q=$query" 200 $r
$sd = ($r.body | ConvertFrom-Json).data
Write-Host "    query='$query' total=$($sd.total) duration_ms=$($sd.duration_ms)"
if ($sd.total -gt 0) { Pass "search returned hits (total=$($sd.total))"; $script:passCount++ }
else { Fail 'search returned hits' '>0' $sd.total }

# Search by Arabic term
$r = Call GET '/api/search?q=بخور' @{} $null
Assert 'GET /api/search?q=بخور (AR)' 200 $r
$sdar = ($r.body | ConvertFrom-Json).data
Write-Host "    AR query total=$($sdar.total)"

# Search by short letter
$r = Call GET '/api/search?q=a' @{} $null
Assert 'GET /api/search?q=a' 200 $r

# Search no-match
$r = Call GET '/api/search?q=zzzzzzzzzzzz_no_match_term_xyz' @{} $null
Assert 'GET /api/search?q=…no-match' 200 $r
$sdn = ($r.body | ConvertFrom-Json).data
if ($sdn.total -eq 0) { Pass "no-match returns total=0"; $script:passCount++ }
else { Fail 'no-match returns total=0' 0 $sdn.total }

# ============================================================================
# Section 3: Sort variants
# ============================================================================
Write-Host ''
Write-Host '----- 3. Sort variants -----'

$query2 = $firstProduct.name_en
$r = Call GET "/api/search?q=$query2&sort=price_asc" @{} $null
Assert "GET /api/search?q=$query2&sort=price_asc" 200 $r
$sa = ($r.body | ConvertFrom-Json).data
if ($sa.products.Count -gt 1) {
    $prices = @($sa.products | ForEach-Object { [double]$_.price })
    $sorted = $true
    for ($i = 1; $i -lt $prices.Count; $i++) {
        if ($prices[$i] -lt $prices[$i - 1]) { $sorted = $false; break }
    }
    if ($sorted) { Pass 'price_asc ascending'; $script:passCount++ } else { Fail 'price_asc' 'sorted' 'unsorted' }
}

$r = Call GET "/api/search?q=$query2&sort=price_desc" @{} $null
Assert "GET /api/search?q=$query2&sort=price_desc" 200 $r
$sd2 = ($r.body | ConvertFrom-Json).data
if ($sd2.products.Count -gt 1) {
    $prices = @($sd2.products | ForEach-Object { [double]$_.price })
    $sorted = $true
    for ($i = 1; $i -lt $prices.Count; $i++) {
        if ($prices[$i] -gt $prices[$i - 1]) { $sorted = $false; break }
    }
    if ($sorted) { Pass 'price_desc descending'; $script:passCount++ } else { Fail 'price_desc' 'sorted' 'unsorted' }
}

$r = Call GET "/api/search?q=$query2&sort=newest" @{} $null
Assert "GET /api/search?q=$query2&sort=newest" 200 $r
$r = Call GET "/api/search?q=$query2&sort=relevance" @{} $null
Assert "GET /api/search?q=$query2&sort=relevance" 200 $r

# ============================================================================
# Section 4: Filters (category, store, price range)
# ============================================================================
Write-Host ''
Write-Host '----- 4. Filters (category, store, price range) -----'

# Category filter
$r = Call GET '/api/categories' @{} $null
$cat = ($r.body | ConvertFrom-Json).data[0]
$r = Call GET "/api/search?q=$query2&category=$($cat.slug)" @{} $null
Assert "GET /api/search?q=$query2&category=$($cat.slug)" 200 $r
$sc = ($r.body | ConvertFrom-Json).data
Write-Host "    filtered by category='$($cat.slug)' → total=$($sc.total)"

# Store filter
$storeId = $firstProduct.store_id
$r = Call GET "/api/search?q=$query2&store=$storeId" @{} $null
Assert "GET /api/search?q=$query2&store=$storeId" 200 $r
$ss = ($r.body | ConvertFrom-Json).data
Write-Host "    filtered by store=$storeId → total=$($ss.total)"

# Price range
$r = Call GET "/api/search?q=$query2&minPrice=1000&maxPrice=100000" @{} $null
Assert "GET /api/search?q=$query2&minPrice=1000&maxPrice=100000" 200 $r

# Combined filter
$r = Call GET "/api/search?q=$query2&store=$storeId&sort=price_asc&limit=5" @{} $null
Assert "GET /api/search?q=$query2&store=$storeId&sort=price_asc&limit=5" 200 $r
$scombo = ($r.body | ConvertFrom-Json).data
Write-Host "    combined filter → total=$($scombo.total) limit=$($scombo.limit)"

# ============================================================================
# Section 5: Pagination
# ============================================================================
Write-Host ''
Write-Host '----- 5. Pagination -----'

$r = Call GET "/api/search?q=$query2&limit=3" @{} $null
Assert "GET /api/search?q=$query2&limit=3" 200 $r
$sp1 = ($r.body | ConvertFrom-Json).data
Write-Host "    page1: limit=$($sp1.limit) offset=$($sp1.offset) count=$($sp1.products.Count)"
if ($sp1.products.Count -le 3) { Pass "page1.Count<=3"; $script:passCount++ }

$r = Call GET "/api/search?q=$query2&limit=3&offset=3" @{} $null
Assert "GET /api/search?q=$query2&limit=3&offset=3" 200 $r
$sp2 = ($r.body | ConvertFrom-Json).data
Write-Host "    page2: offset=$($sp2.offset) count=$($sp2.products.Count)"

# Edge: limit clamp
$r = Call GET "/api/search?q=$query2&limit=99999" @{} $null
Assert "GET /api/search?q=$query2&limit=99999" 200 $r
$slm = ($r.body | ConvertFrom-Json).data
if ($slm.limit -eq 100) { Pass "limit clamped to 100"; $script:passCount++ }
else { Fail 'limit clamp' 100 $slm.limit }

$r = Call GET "/api/search?q=$query2&limit=0" @{} $null
Assert "GET /api/search?q=$query2&limit=0" 200 $r
$slz = ($r.body | ConvertFrom-Json).data
Write-Host "    limit=0 → limit=$($slz.limit)"

$r = Call GET "/api/search?q=$query2&offset=-5" @{} $null
Assert "GET /api/search?q=$query2&offset=-5" 200 $r
$so = ($r.body | ConvertFrom-Json).data
if ($so.offset -eq 0) { Pass "offset clamped to 0"; $script:passCount++ }
else { Fail 'offset clamp' 0 $so.offset }

# ============================================================================
# Summary
# ============================================================================
Write-Host ''
Write-Host '===== PHASE 3 SUMMARY =====' -ForegroundColor Cyan
Write-Host "  PASS: $($script:passCount)" -ForegroundColor Green
Write-Host "  FAIL: $($script:failCount)" -ForegroundColor $(if ($script:failCount -gt 0) { 'Red' } else { 'Green' })

if ($script:failCount -gt 0) { exit 1 } else { Write-Host 'PHASE 3 complete.' -ForegroundColor Cyan }
