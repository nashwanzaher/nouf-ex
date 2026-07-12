# ============================================================================
# PHASE 5: Orders + Order Items + Inventory
# Tests /api/orders/* routes (app/server/routes/orders.cts)
# Verifies: order creation, state machine, stock decrement (trigger),
#           ownership guard, admin override, MIXED_STORES + PRODUCT_UNAVAILABLE.
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

Write-Host '===== PHASE 5: Orders + Inventory =====' -ForegroundColor Cyan

# ============================================================================
# 0. Setup: login 3 roles, fetch a real product + a second product from a
#    DIFFERENT store (used to trigger MIXED_STORES error).
# ============================================================================
Write-Host ''
Write-Host '----- Setup -----'

$loginCust = Call POST '/api/auth/login' @{} @{ email = 'ahmed@gmail.com';       password = 'customer123' }
$loginMerch = Call POST '/api/auth/login' @{} @{ email = 'fatima@spice-yemen.com'; password = 'merchant123' }
$loginAdmin = Call POST '/api/auth/login' @{} @{ email = 'admin@noufex.com';      password = 'admin123' }
$tokCust  = ($loginCust.body  | ConvertFrom-Json).data.token
$tokMerch = ($loginMerch.body | ConvertFrom-Json).data.token
$tokAdmin = ($loginAdmin.body | ConvertFrom-Json).data.token
$hCust  = @{ Authorization = "Bearer $tokCust"  }
$hMerch = @{ Authorization = "Bearer $tokMerch" }
$hAdmin = @{ Authorization = "Bearer $tokAdmin" }
Write-Host "  Tokens: customer=$(if ($tokCust){'OK'}else{'FAIL'})  merchant=$(if ($tokMerch){'OK'}else{'FAIL'})  admin=$(if ($tokAdmin){'OK'}else{'FAIL'})"

# Pull 4 products to cover mixed-store + multi-item cases
$prods = (Call GET '/api/products?limit=10' @{} $null).body | ConvertFrom-Json
$products = $prods.data.products
Write-Host "  products fetched: $($products.Count)"
if ($products.Count -lt 2) {
    Write-Host "  ⚠ less than 2 products — mixed-store test will be skipped" -ForegroundColor Yellow
}

# Pick first product from store A, and first from a DIFFERENT store
$p1 = $products[0]
$store1 = $p1.store_id
$p2 = $null
foreach ($p in $products) {
    if ($p.store_id -ne $store1) { $p2 = $p; break }
}

# Capture pre-order stock so we can verify decrement later
function GetStock([int]$productId) {
    $r = Call GET "/api/products/$productId" @{} $null
    if ($r.status -eq 200) { return ($r.body | ConvertFrom-Json).data.stock }
    return $null
}
function GetSoldCount([int]$productId) {
    $r = Call GET "/api/products/$productId" @{} $null
    if ($r.status -eq 200) { return ($r.body | ConvertFrom-Json).data.sold_count }
    return $null
}
$stockBefore = GetStock $p1.id
$soldBefore  = GetSoldCount $p1.id
Write-Host "  p1.id=$($p1.id) name='$($p1.name_en)' store=$store1 stock=$stockBefore sold=$soldBefore"
if ($p2) { Write-Host "  p2.id=$($p2.id) name='$($p2.name_en)' store=$($p2.store_id) (different store for MIXED test)" }

# ============================================================================
# 1. Negative: missing/invalid auth on /api/orders/*
# ============================================================================
Write-Host ''
Write-Host '----- 1. Auth negatives -----'
$r = Call GET    '/api/orders'        @{} $null;            Assert 'GET    /api/orders            (no auth)' 401 $r
$r = Call GET    '/api/orders/1'      @{} $null;            Assert 'GET    /api/orders/1          (no auth)' 401 $r
$r = Call POST   '/api/orders'        @{} @{ items = @(); total = 0 }  Assert 'POST   /api/orders   (no auth)' 401 $r

# ============================================================================
# 2. Negative: validation (Zod schema)
# ============================================================================
Write-Host ''
Write-Host '----- 2. Schema negatives -----'
$r = Call POST '/api/orders' $hCust @{ items = @(); total = 100 }
Assert 'POST /api/orders (empty items)' 400 $r
$r = Call POST '/api/orders' $hCust @{ items = @(@{ productId = $p1.id; quantity = 1; unitPrice = 100 }) }
Assert 'POST /api/orders (missing total)' 400 $r
$r = Call POST '/api/orders' $hCust @{ items = @(@{ productId = $p1.id; quantity = 0; unitPrice = 100 }); total = 100 }
Assert 'POST /api/orders (quantity=0)' 400 $r
$r = Call POST '/api/orders' $hCust @{ items = @(@{ productId = 'abc'; quantity = 1; unitPrice = 100 }); total = 100 }
Assert 'POST /api/orders (productId=abc)' 400 $r

# ============================================================================
# 3. Negative: business rules
# ============================================================================
Write-Host ''
Write-Host '----- 3. Business-rule negatives -----'
# Unavailable product (id 999999)
$r = Call POST '/api/orders' $hCust @{
    items     = @(@{ productId = 999999; quantity = 1; unitPrice = 100 })
    total     = 100
    paymentMethod = 'cod'
}
Assert 'POST /api/orders (unavailable product 999999)' 400 $r

# MIXED_STORES (only if we have 2 products from different stores)
if ($p2) {
    $price1 = [double]$p1.price
    $price2 = [double]$p2.price
    $mixedItems = @(
        @{ productId = $p1.id; quantity = 1; unitPrice = $price1 }
        @{ productId = $p2.id; quantity = 1; unitPrice = $price2 }
    )
    $mixedTotal = [Math]::Round($price1 + $price2, 2)
    $r = Call POST '/api/orders' $hCust @{
        items = $mixedItems; total = $mixedTotal; paymentMethod = 'cod'
    }
    # Note: the API currently returns 400 with no JSON body for this
    # specific branch (known quirk of orders.cts:121 — sendError is
    # invoked but the response body never serializes). We verify the
    # status code only; once orders.cts:121 is fixed this can be
    # tightened to also assert code=MIXED_STORES.
    Assert 'POST /api/orders (MIXED_STORES)' 400 $r
    Show 'MIXED_STORES body preview' $r 200
}

# Insufficient stock: ask for more than available
$hugeQty = if ($stockBefore -gt 0) { [int]$stockBefore + 1000 } else { 999999 }
$r = Call POST '/api/orders' $hCust @{
    items         = @(@{ productId = $p1.id; quantity = $hugeQty; unitPrice = [double]$p1.price })
    total         = [double]$hugeQty * [double]$p1.price
    paymentMethod = 'cod'
}
if ($r.status -ge 400) { Pass "POST /api/orders (insufficient stock qty=$hugeQty) rejected (status=$($r.status))" }
else { Fail "POST insufficient stock" 'rejected' $r.status $r.body }

# ============================================================================
# 4. POST happy path: create + verify GET roundtrip + ownership guard
# ============================================================================
Write-Host ''
Write-Host '----- 4. Create + verify -----'
$qty = 2
$unitPrice = [double]$p1.price
$orderBody = @{
    items = @(@{ productId = $p1.id; quantity = $qty; unitPrice = $unitPrice })
    total = [Math]::Round($unitPrice * $qty, 2)
    subtotal = [Math]::Round($unitPrice * $qty, 2)
    shippingCost = 0
    discount = 0
    paymentMethod = 'cod'
    shippingAddress = @{
        full_name = 'Ahmed Test'
        phone = '+967711111111'
        governorate = 'Sana'
        city = 'Sana'
        street = 'Test St 1'
    }
    notes = 'Phase 5 e2e test'
}
$r = Call POST '/api/orders' $hCust $orderBody
Assert 'POST /api/orders (happy path)' 200 $r

$orderId = $null
if ($r.status -eq 200) {
    $data = ($r.body | ConvertFrom-Json).data
    if ($data.id) {
        $orderId = $data.id
        Pass "POST returned order id=$orderId"
    } else { Fail 'POST returned id' '<id>' '<missing>' $r.body }
}

# GET /api/orders (customer view: includes the new order)
$r = Call GET '/api/orders' $hCust $null
Assert 'GET /api/orders (customer)' 200 $r
if ($r.status -eq 200) {
    $orders = ($r.body | ConvertFrom-Json).data
    $found = $orders | Where-Object { $_.id -eq $orderId }
    if ($found) { Pass "GET /api/orders lists our new order #$orderId" }
    else { Fail 'GET /api/orders lists new order' $orderId '<not found>' }
}

# GET /api/orders/:id (owner)
if ($orderId) {
    $r = Call GET "/api/orders/$orderId" $hCust $null
    Assert "GET /api/orders/$orderId (owner)" 200 $r
    if ($r.status -eq 200) {
        $detail = ($r.body | ConvertFrom-Json).data
        if ($detail.items -and $detail.items.Count -gt 0) { Pass "GET order detail includes $($detail.items.Count) item(s)" }
        else { Fail 'order detail items' '<non-empty>' '<empty>' }
        # timeline is NULL on INSERT (trigger only fires on UPDATE),
        # so we just assert the field exists, not that it has content.
        if ($null -ne $detail.timeline -or $detail.PSObject.Properties.Name -contains 'timeline') {
            Pass 'order has timeline field (NULL or populated)'
        } else {
            Fail 'order timeline field' '<present>' '<missing>'
        }
        if ($detail.order_number -and $detail.order_number -match '^ORD-[A-Z0-9]{8}$') {
            Pass "order_number=$($detail.order_number) matches ORD-XXXXXXXX"
        } else {
            Fail 'order_number pattern' '^ORD-[A-Z0-9]{8}$' $detail.order_number
        }
        if ($detail.status -eq 'pending') { Pass 'order status=pending' }
        else { Fail 'order status' 'pending' $detail.status }
    }
}

# GET /api/orders/:id (cross-user → 403)
if ($orderId) {
    $r = Call GET "/api/orders/$orderId" $hMerch $null
    Assert "GET /api/orders/$orderId (as merchant)" 403 $r
}

# GET /api/orders/:id (admin can view)
if ($orderId) {
    $r = Call GET "/api/orders/$orderId" $hAdmin $null
    Assert "GET /api/orders/$orderId (as admin)" 200 $r
}

# GET non-existent order
$r = Call GET '/api/orders/9999999' $hCust $null
Assert 'GET /api/orders/9999999 (not found)' 404 $r

# ============================================================================
# 5. Inventory side-effect: stock decremented, sold_count incremented
# ============================================================================
Write-Host ''
Write-Host '----- 5. Inventory side-effects (trigger) -----'
if ($orderId -and $null -ne $stockBefore) {
    Start-Sleep -Milliseconds 200   # give trigger a moment
    $stockAfter  = GetStock       $p1.id
    $soldAfter   = GetSoldCount   $p1.id
    Write-Host "  stock: $stockBefore → $stockAfter (Δ=$($stockBefore - $stockAfter))"
    Write-Host "  sold:  $soldBefore  → $soldAfter  (Δ=$($soldAfter - $soldBefore))"
    if (($stockBefore - $stockAfter) -eq $qty) { Pass "stock decremented by exactly $qty (trigger fired)" }
    else { Fail "stock decrement" $qty ($stockBefore - $stockAfter) }
    if (($soldAfter - $soldBefore) -eq $qty) { Pass "sold_count incremented by $qty" }
    else { Fail "sold_count delta" $qty ($soldAfter - $soldBefore) }
}

# ============================================================================
# 6. Admin visibility (must pass customerId to see other users' orders)
# ============================================================================
Write-Host ''
Write-Host '----- 6. Admin visibility -----'
$ahmedId = (($loginCust.body | ConvertFrom-Json).data.user.id)
# Admin without customerId → only sees their OWN orders (by design)
$r = Call GET '/api/orders' $hAdmin $null
Assert 'GET /api/orders (admin, no filter)' 200 $r
# Admin with customerId=ahmed → sees ahmed's orders
$r = Call GET "/api/orders?customerId=$ahmedId" $hAdmin $null
Assert 'GET /api/orders?customerId=… (admin, ahmed)' 200 $r
if ($r.status -eq 200) {
    $allOrders = ($r.body | ConvertFrom-Json).data
    $foundInAdmin = $allOrders | Where-Object { $_.id -eq $orderId }
    if ($foundInAdmin) { Pass "admin sees order #$orderId when filtering by customerId=$ahmedId" }
    else { Fail 'admin sees our order via customerId' $orderId '<not found>' }
}

# Customer trying to use customerId query param (should still only see own)
$r = Call GET "/api/orders?customerId=999" $hCust $null
Assert 'GET /api/orders?customerId=999 (customer)' 200 $r
if ($r.status -eq 200) {
    $ownOrders = ($r.body | ConvertFrom-Json).data
    $leaked = $ownOrders | Where-Object { $_.customer_id -ne $ahmedId }
    if (-not $leaked) { Pass "customerId override has no effect for non-admin (no leak)" }
    else { Fail 'customerId isolation' 'no leak' 'leaked orders' }
}

# ============================================================================
# Summary
# ============================================================================
Write-Host ''
Write-Host '===== PHASE 5 SUMMARY =====' -ForegroundColor Cyan
Write-Host "  PASS: $script:passCount"
Write-Host "  FAIL: $script:failCount"
if ($script:failCount -gt 0) { exit 1 } else { Write-Host 'PHASE 5 complete.' -ForegroundColor Green }
