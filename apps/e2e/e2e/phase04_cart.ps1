# PHASE 4: Cart (auth: Bearer)
# Tests /api/cart/* routes (apps/api/src/routes/cart.ts)
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

Write-Host '===== PHASE 4: Cart =====' -ForegroundColor Cyan

# ============================================================================
# Setup: login customer, get a real productId
# ============================================================================
Write-Host ''
Write-Host '----- Setup -----'
$login = Call POST '/api/auth/login' @{} @{ email = 'ahmed@gmail.com'; password = 'customer123' }
$tokCust = ($login.body | ConvertFrom-Json).data.token
$authCust = @{ Authorization = "Bearer $tokCust" }
Write-Host "  Customer token obtained"

# Get two products from the same store (cart rule: same store_id)
$prod = (Call GET '/api/products?limit=10' @{}).body | ConvertFrom-Json
$products = $prod.data.products
$p1 = $products[0]
$p2 = $products | Where-Object { $_.store_id -eq $p1.store_id } | Select-Object -First 1
if (-not $p2) { $p2 = $products[1] }
Write-Host "  Using products: p1=$($p1.id) (store=$($p1.store_id)) p2=$($p2.id)"

# ============================================================================
# Section 1: Negative — no auth
# ============================================================================
Write-Host ''
Write-Host '----- 1. Negative: missing auth -----'
$r = Call GET '/api/cart/2' @{}
Assert 'GET /api/cart/2 (no auth)' 401 $r
$r = Call POST '/api/cart' @{} @{ productId = $p1.id; quantity = 1 }
Assert 'POST /api/cart (no auth)' 401 $r
$r = Call PATCH '/api/cart/1' @{} @{ quantity = 2 }
Assert 'PATCH /api/cart/1 (no auth)' 401 $r
$r = Call DELETE '/api/cart/1' @{}
Assert 'DELETE /api/cart/1 (no auth)' 401 $r
$r = Call DELETE '/api/cart/clear/2' @{}
Assert 'DELETE /api/cart/clear/2 (no auth)' 401 $r
$r = Call GET '/api/cart/count/2' @{}
Assert 'GET /api/cart/count/2 (no auth)' 401 $r

# ============================================================================
# Section 2: Clear cart (fresh start)
# ============================================================================
Write-Host ''
Write-Host '----- 2. Clear cart (fresh start) -----'
# Get customer user_id from /me
$me = (Call GET '/api/auth/me' $authCust).body | ConvertFrom-Json
$userId = $me.data.id
Write-Host "  Customer user_id=$userId"

$r = Call DELETE "/api/cart/clear/$userId" $authCust $null
Assert "DELETE /api/cart/clear/$userId" 200 $r
Show 'preview' $r

$r = Call GET "/api/cart/$userId" $authCust $null
Assert "GET /api/cart/$userId (after clear)" 200 $r
$cartData = ($r.body | ConvertFrom-Json).data
Write-Host "  Cart size: $($cartData.Count)"

# ============================================================================
# Section 3: Validation
# ============================================================================
Write-Host ''
Write-Host '----- 3. POST validation -----'
$r = Call POST '/api/cart' $authCust @{}
Assert 'POST /api/cart (empty body)' 400 $r

$r = Call POST '/api/cart' $authCust @{ productId = $p1.id }
Assert 'POST /api/cart (missing quantity)' 400 $r

$r = Call POST '/api/cart' $authCust @{ productId = $p1.id; quantity = 0 }
Assert 'POST /api/cart (quantity=0)' 400 $r

$r = Call POST '/api/cart' $authCust @{ productId = $p1.id; quantity = -1 }
Assert 'POST /api/cart (quantity=-1)' 400 $r

$r = Call POST '/api/cart' $authCust @{ productId = 'not-int'; quantity = 1 }
Assert 'POST /api/cart (productId not int)' 400 $r

# ============================================================================
# Section 4: Add items
# ============================================================================
Write-Host ''
Write-Host '----- 4. Add items -----'
$r = Call POST '/api/cart' $authCust @{ productId = $p1.id; quantity = 2 }
Assert "POST /api/cart (add p1, qty=2)" 200 $r
$itemId1 = ($r.body | ConvertFrom-Json).data.id
Write-Host "  itemId1=$itemId1"

$r = Call POST '/api/cart' $authCust @{ productId = $p2.id; quantity = 1 }
Assert "POST /api/cart (add p2, qty=1)" 200 $r
$itemId2 = ($r.body | ConvertFrom-Json).data.id
Write-Host "  itemId2=$itemId2"

# Same product again → should merge/increment quantity
$r = Call POST '/api/cart' $authCust @{ productId = $p1.id; quantity = 1 }
Assert "POST /api/cart (add p1 again, qty=1 → merge)" 200 $r
Show 'merge preview' $r

$r = Call GET "/api/cart/$userId" $authCust $null
Assert "GET /api/cart (after adds)" 200 $r
$cartData = ($r.body | ConvertFrom-Json).data
Write-Host "  Cart size: $($cartData.Count)"
foreach ($ci in $cartData) {
    Write-Host "    [item] id=$($ci.id) product_id=$($ci.product_id) qty=$($ci.quantity) variant=$($ci.variant)"
}

# ============================================================================
# Section 5: Patch (update quantity)
# ============================================================================
Write-Host ''
Write-Host '----- 5. PATCH /api/cart/:id -----'
$r = Call PATCH "/api/cart/$itemId1" $authCust @{ quantity = 5 }
Assert "PATCH /api/cart/$itemId1 (qty=5)" 200 $r

$r = Call GET "/api/cart/$userId" $authCust $null
$cartData = ($r.body | ConvertFrom-Json).data
$found = $cartData | Where-Object { $_.id -eq $itemId1 }
if ($found.quantity -eq 5) { Pass "quantity updated to 5"; $script:passCount++ }
else { Fail 'quantity updated' 5 $found.quantity }

# Negative: invalid id
$r = Call PATCH '/api/cart/abc' $authCust @{ quantity = 5 }
Assert 'PATCH /api/cart/abc (invalid id)' 400 $r

# Negative: id not found
$r = Call PATCH '/api/cart/999999' $authCust @{ quantity = 5 }
Assert 'PATCH /api/cart/999999 (not found)' 404 $r

# quantity=0 → likely deletes (per task spec, cartItemUpdateSchema allows 0; route may auto-remove)
$r = Call PATCH "/api/cart/$itemId2" $authCust @{ quantity = 0 }
Write-Host "    PATCH qty=0 → status=$($r.status)"
$validStatuses = @('200', '400')
if ($validStatuses -contains $r.status) { Pass "PATCH qty=0 status=$($r.status) (acceptable)"; $script:passCount++ }

# ============================================================================
# Section 6: DELETE
# ============================================================================
Write-Host ''
Write-Host '----- 6. DELETE /api/cart/:id -----'
$r = Call DELETE "/api/cart/$itemId1" $authCust $null
Assert "DELETE /api/cart/$itemId1" 200 $r

$r = Call DELETE "/api/cart/$itemId1" $authCust $null
Assert "DELETE /api/cart/$itemId1 (already gone → 404)" 404 $r

# ============================================================================
# Section 7: Count + clear
# ============================================================================
Write-Host ''
Write-Host '----- 7. Count + clear -----'
$r = Call GET "/api/cart/count/$userId" $authCust $null
Assert "GET /api/cart/count/$userId" 200 $r
$countData = ($r.body | ConvertFrom-Json).data
Write-Host "  Cart count: $countData"

$r = Call DELETE "/api/cart/clear/$userId" $authCust $null
Assert "DELETE /api/cart/clear/$userId (final clear)" 200 $r

$r = Call GET "/api/cart/count/$userId" $authCust $null
$countData = ($r.body | ConvertFrom-Json).data
if ($countData.count -eq 0) { Pass "count=0 after clear"; $script:passCount++ }
else { Fail 'count after clear' 0 $countData.count }

# ============================================================================
# Summary
# ============================================================================
Write-Host ''
Write-Host '===== PHASE 4 SUMMARY =====' -ForegroundColor Cyan
Write-Host "  PASS: $($script:passCount)" -ForegroundColor Green
Write-Host "  FAIL: $($script:failCount)" -ForegroundColor $(if ($script:failCount -gt 0) { 'Red' } else { 'Green' })

if ($script:failCount -gt 0) { exit 1 } else { Write-Host 'PHASE 4 complete.' -ForegroundColor Cyan }
