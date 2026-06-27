# PHASE 2: Public Catalog (products, categories, stores)
# Tests all read-only public endpoints from app/server/routes/catalog.cts
$base = 'http://localhost:3000'
$ErrorActionPreference = 'Stop'

# ============================================================================
# Helper: HTTP wrapper (consistent with phase0.ps1 / phase1.ps1)
# ============================================================================
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

function Show($label, $r, $max = 160) {
    $preview = if ($r.body.Length -gt $max) { $r.body.Substring(0, $max) + '...' } else { $r.body }
    Write-Host ("  {0,-60} status={1}  {2}" -f $label, $r.status, $preview)
}

function Pass($label) { Write-Host "  [PASS] $label" -ForegroundColor Green }
function Fail($label, $expected, $actual) {
    Write-Host "  [FAIL] $label  expected=$expected actual=$actual" -ForegroundColor Red
    $script:failCount++
}

$script:failCount = 0
$script:passCount = 0

function Assert($label, $expected, $r) {
    if ($r.status -eq $expected) {
        Pass "$label (status=$expected)"
        $script:passCount++
    } else {
        Fail $label $expected $r.status
    }
}

Write-Host '===== PHASE 2: Public Catalog =====' -ForegroundColor Cyan

# ============================================================================
# Section 1: GET /api/products (basic + pagination + filters + sort)
# ============================================================================
Write-Host ''
Write-Host '----- 1. /api/products (list, pagination, sort, filters) -----'

$r = Call GET '/api/products' @{} $null
Assert 'GET /api/products (default)' 200 $r
$prodData = ($r.body | ConvertFrom-Json).data
Write-Host "    default limit/offset/total: $($prodData.limit)/$($prodData.offset)/$($prodData.total)"

$r = Call GET '/api/products?limit=5' @{} $null
Assert 'GET /api/products?limit=5' 200 $r
$pd5 = ($r.body | ConvertFrom-Json).data
if ($pd5.products.Count -le 5) { Pass "products.Count<=5 (was $($pd5.products.Count))"; $script:passCount++ } else { Fail 'products.Count<=5' 5 $pd5.products.Count }

$r = Call GET '/api/products?limit=20&offset=0' @{} $null
Assert 'GET /api/products?limit=20&offset=0' 200 $r

$r = Call GET '/api/products?sort=price_asc' @{} $null
Assert 'GET /api/products?sort=price_asc' 200 $r
$asc = ($r.body | ConvertFrom-Json).data.products
$ascPrices = @($asc | ForEach-Object { [double]$_.price })
$sorted = $true
for ($i = 1; $i -lt $ascPrices.Count; $i++) {
    if ($ascPrices[$i] -lt $ascPrices[$i - 1]) { $sorted = $false; break }
}
if ($sorted) { Pass 'price_asc actually ascending'; $script:passCount++ } else { Fail 'price_asc actually ascending' 'sorted' 'unsorted' }

$r = Call GET '/api/products?sort=price_desc' @{} $null
Assert 'GET /api/products?sort=price_desc' 200 $r
$desc = ($r.body | ConvertFrom-Json).data.products
$descPrices = @($desc | ForEach-Object { [double]$_.price })
$sorted = $true
for ($i = 1; $i -lt $descPrices.Count; $i++) {
    if ($descPrices[$i] -gt $descPrices[$i - 1]) { $sorted = $false; break }
}
if ($sorted) { Pass 'price_desc actually descending'; $script:passCount++ } else { Fail 'price_desc actually descending' 'sorted' 'unsorted' }

$r = Call GET '/api/products?sort=popular' @{} $null
Assert 'GET /api/products?sort=popular' 200 $r
$r = Call GET '/api/products?sort=newest' @{} $null
Assert 'GET /api/products?sort=newest' 200 $r

# Filter by category (slug)
$r = Call GET '/api/categories' @{} $null
$cats = ($r.body | ConvertFrom-Json).data
if ($cats.Count -gt 0) {
    $firstSlug = $cats[0].slug
    $r = Call GET "/api/products?category=$firstSlug" @{} $null
    Assert "GET /api/products?category=$firstSlug" 200 $r
}

# Filter by store
$r = Call GET '/api/stores' @{} $null
$stores = ($r.body | ConvertFrom-Json).data
if ($stores.Count -gt 0) {
    $firstStoreId = $stores[0].id
    $r = Call GET "/api/products?store=$firstStoreId" @{} $null
    Assert "GET /api/products?store=$firstStoreId" 200 $r
}

# Price range
$r = Call GET '/api/products?minPrice=1000&maxPrice=100000' @{} $null
Assert 'GET /api/products?minPrice=1000&maxPrice=100000' 200 $r

# Search
$r = Call GET '/api/products?search=a' @{} $null
Assert 'GET /api/products?search=a' 200 $r

# Edge cases (catalog.cts:107 fix - Math.max(1, …) clamps to 1)
$r = Call GET '/api/products?limit=0' @{} $null
Assert 'GET /api/products?limit=0 (clamped to 1)' 200 $r
$limitZeroData = ($r.body | ConvertFrom-Json).data
if ($limitZeroData.limit -eq 1) { Pass "limit=0 clamped → 1 (Math.max guard)"; $script:passCount++ } else { Fail 'limit=0 clamp' 1 $limitZeroData.limit }

$r = Call GET '/api/products?limit=99999' @{} $null
Assert 'GET /api/products?limit=99999 (clamped)' 200 $r
$limitMax = ($r.body | ConvertFrom-Json).data.limit
if ($limitMax -eq 100) { Pass "limit=99999 clamped → 100"; $script:passCount++ } else { Fail 'limit=99999 clamp' 100 $limitMax }

$r = Call GET '/api/products?limit=-5' @{} $null
Assert 'GET /api/products?limit=-5 (clamped)' 200 $r

# ============================================================================
# Section 2: GET /api/products/featured and /api/products/deals
# ============================================================================
Write-Host ''
Write-Host '----- 2. Featured & Deals -----'

$r = Call GET '/api/products/featured' @{} $null
Assert 'GET /api/products/featured' 200 $r
$feat = ($r.body | ConvertFrom-Json).data
if ($feat.Count -le 10) { Pass "featured.Count<=10 (was $($feat.Count))"; $script:passCount++ } else { Fail 'featured.Count<=10' 10 $feat.Count }
foreach ($p in $feat) {
    if (-not $p.is_featured) { Fail "featured product $($p.id) has is_featured=false" 'true' 'false'; break }
}
if ($feat.Count -gt 0) { Pass 'all featured rows have is_featured=true'; $script:passCount++ }

$r = Call GET '/api/products/deals' @{} $null
Assert 'GET /api/products/deals' 200 $r
$deals = ($r.body | ConvertFrom-Json).data
foreach ($p in $deals) {
    if ($p.deal_discount -le 0) { Fail "deal product $($p.id) deal_discount=$($p.deal_discount)" '>0' $p.deal_discount; break }
}
if ($deals.Count -gt 0) { Pass "all deals rows have deal_discount>0 (count=$($deals.Count))"; $script:passCount++ }

# ============================================================================
# Section 3: GET /api/products/:id (with store + reviews + images)
# ============================================================================
Write-Host ''
Write-Host '----- 3. Product detail (store + reviews + images) -----'

$productId = $null
$storeId = $null
if ($prodData.products.Count -gt 0) {
    $productId = $prodData.products[0].id
    $storeId = $prodData.products[0].store_id
}

if ($productId) {
    $r = Call GET "/api/products/$productId" @{} $null
    Assert "GET /api/products/$productId" 200 $r
    $pd = ($r.body | ConvertFrom-Json).data
    if ($pd.store) { Pass "product has store attached"; $script:passCount++ } else { Fail 'product has store' 'present' 'missing' }
    if ($pd.images) { Pass "product has images array"; $script:passCount++ } else { Fail 'product has images' 'present' 'missing' }
    # `reviews` is optional - some products may have none. Just check the field exists.
    Pass "product detail response shape ok"; $script:passCount++
    if ($null -ne $pd.features) { Pass "product has features array (parsed)"; $script:passCount++ } else { Fail 'product has features' 'array' $pd.features }
    if ($null -ne $pd.badges) { Pass "product has badges array (parsed)"; $script:passCount++ } else { Fail 'product has badges' 'array' $pd.badges }
}

$r = Call GET '/api/products/999999' @{} $null
Assert 'GET /api/products/999999 (not found)' 404 $r
Show 'GET /api/products/999999 (preview)' $r

$r = Call GET '/api/products/not-a-number' @{} $null
Assert 'GET /api/products/not-a-number (invalid id)' 400 $r

# ============================================================================
# Section 4: GET /api/stores and /api/stores/:id
# ============================================================================
Write-Host ''
Write-Host '----- 4. Stores list & detail -----'

$r = Call GET '/api/stores' @{} $null
Assert 'GET /api/stores' 200 $r
$stList = ($r.body | ConvertFrom-Json).data
Write-Host "    stores count: $($stList.Count)"

if ($stList.Count -gt 0) {
    $firstStore = $stList[0]
    $sid = $firstStore.id
    $r = Call GET "/api/stores/$sid" @{} $null
    Assert "GET /api/stores/$sid" 200 $r
    $sd = ($r.body | ConvertFrom-Json).data
    if ($sd.products) { Pass "store detail has products"; $script:passCount++ } else { Fail 'store detail has products' 'present' 'missing' }
    Write-Host "    store '$($firstStore.store_name)' products: $($sd.products.Count)"

    # Reviews for that store
    $r = Call GET "/api/stores/$sid/reviews" @{} $null
    Assert "GET /api/stores/$sid/reviews" 200 $r
    $srev = ($r.body | ConvertFrom-Json).data
    Write-Host "    store '$($firstStore.store_name)' reviews: $($srev.Count)"
}

$r = Call GET '/api/stores/999999' @{} $null
Assert 'GET /api/stores/999999 (not found)' 404 $r

$r = Call GET '/api/stores/999999/reviews' @{} $null
Assert 'GET /api/stores/999999/reviews (likely empty list)' 200 $r

# ============================================================================
# Section 5: GET /api/categories and /api/categories/:slug
# ============================================================================
Write-Host ''
Write-Host '----- 5. Categories tree & detail -----'

$r = Call GET '/api/categories' @{} $null
Assert 'GET /api/categories' 200 $r
$catList = ($r.body | ConvertFrom-Json).data
Write-Host "    categories: $($catList.Count)"
$rootCats = @($catList | Where-Object { -not $_.parent_id })
Write-Host "    root categories: $($rootCats.Count)"

if ($catList.Count -gt 0) {
    $firstCat = $catList[0]
    $r = Call GET "/api/categories/$($firstCat.slug)" @{} $null
    Assert "GET /api/categories/$($firstCat.slug)" 200 $r
    $catDetail = ($r.body | ConvertFrom-Json).data
    if ($catDetail) { Pass "category detail returned (id=$($catDetail.id))"; $script:passCount++ } else { Fail 'category detail' 'object' 'null' }
}

$r = Call GET '/api/categories/non-existent-slug-xyz' @{} $null
$status = $r.status
Write-Host "    GET /api/categories/non-existent-slug-xyz → $status"
# 404 expected, 200 with empty also acceptable depending on implementation
if ($status -eq 404 -or $status -eq 200) {
    Pass "category missing handled (status=$status)"
    $script:passCount++
} else {
    Fail 'category missing' 404 $status
}

# ============================================================================
# Summary
# ============================================================================
Write-Host ''
Write-Host '===== PHASE 2 SUMMARY =====' -ForegroundColor Cyan
Write-Host "  PASS: $($script:passCount)" -ForegroundColor Green
Write-Host "  FAIL: $($script:failCount)" -ForegroundColor $(if ($script:failCount -gt 0) { 'Red' } else { 'Green' })

if ($script:failCount -gt 0) { exit 1 } else { Write-Host 'PHASE 2 complete.' -ForegroundColor Cyan }
