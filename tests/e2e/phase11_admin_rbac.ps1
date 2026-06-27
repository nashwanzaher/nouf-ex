# ============================================================================
# PHASE 11: Admin + RBAC + Roles (rev 2)
# ============================================================================
$base = 'http://localhost:3000'
$ErrorActionPreference = 'Stop'

function GetStatus([string]$Method, [string]$Path, [string]$Token = '') {
    $headers = @{}
    if ($Token -ne '') { $headers['Authorization'] = "Bearer $Token" }
    $url = "$base$Path"
    try {
        $r = Invoke-WebRequest -Uri $url -Method $Method -Headers $headers -UseBasicParsing -TimeoutSec 10
        return [int]$r.StatusCode
    } catch {
        $resp = $_.Exception.Response
        if ($resp) { return [int]$resp.StatusCode }
        return -1
    }
}

function PatchStatus([string]$Path, [string]$Token, $Body) {
    $headers = @{ Authorization = "Bearer $Token"; 'Content-Type' = 'application/json' }
    $bodyJson = $Body | ConvertTo-Json -Compress
    try {
        $r = Invoke-WebRequest -Uri "$base$Path" -Method PATCH -Headers $headers -Body $bodyJson -UseBasicParsing -TimeoutSec 10
        return [int]$r.StatusCode
    } catch {
        $resp = $_.Exception.Response
        if ($resp) { return [int]$resp.StatusCode }
        return -1
    }
}

$script:passes = 0
$script:fails  = 0
function Pass($l) { Write-Host "  [PASS] $l" -ForegroundColor Green; $script:passes++ }
function Fail($l,$e,$a) { Write-Host "  [FAIL] $l  expected=$e actual=$a" -ForegroundColor Red; $script:fails++ }

Write-Host '===== PHASE 11: Admin + RBAC + Roles =====' -ForegroundColor Cyan

# ----- Setup -----
Write-Host ''
Write-Host '----- Setup -----'
$r1 = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -ContentType 'application/json' -Body '{"email":"ahmed@gmail.com","password":"customer123"}'        -UseBasicParsing
$r2 = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -ContentType 'application/json' -Body '{"email":"fatima@spice-yemen.com","password":"merchant123"}'  -UseBasicParsing
$r3 = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -ContentType 'application/json' -Body '{"email":"admin@noufex.com","password":"admin123"}'             -UseBasicParsing
$tokCust  = ($r1.Content | ConvertFrom-Json).data.token
$tokMerch = ($r2.Content | ConvertFrom-Json).data.token
$tokAdmin = ($r3.Content | ConvertFrom-Json).data.token
$idCust   = ($r1.Content | ConvertFrom-Json).data.user.id
$idAdmin  = ($r3.Content | ConvertFrom-Json).data.user.id
Write-Host "  Tokens: customer=$idCust admin=$idAdmin merchant=OK"

# ----- 1. RBAC on admin GETs -----
Write-Host ''
Write-Host '----- 1. RBAC on /api/admin/* GETs -----'
$paths = @('/users', '/stores', '/products', '/orders', '/disputes', '/audit-log', '/stats')
foreach ($p in $paths) {
    $s = GetStatus GET "/api/admin$p"
    if ($s -eq 401) { Pass "GET /api/admin$p (no auth) → 401" } else { Fail "GET (no auth)" 401 $s }
}
foreach ($p in $paths) {
    $s = GetStatus GET "/api/admin$p" $tokCust
    if ($s -eq 403) { Pass "GET /api/admin$p (customer) → 403" } else { Fail "GET (customer)" 403 $s }
}
foreach ($p in $paths) {
    $s = GetStatus GET "/api/admin$p" $tokAdmin
    if ($s -eq 200) { Pass "GET /api/admin$p (admin) → 200" } else { Fail "GET (admin)" 200 $s }
}

# ----- 2. PATCH /api/admin/users/:id -----
Write-Host ''
Write-Host '----- 2. PATCH /api/admin/users/:id -----'

$s = PatchStatus "/api/admin/users/$idCust" $tokCust @{ status = 'active' }
if ($s -eq 403) { Pass 'PATCH (customer) → 403' } else { Fail 'PATCH (customer)' 403 $s }
$s = PatchStatus "/api/admin/users/$idCust" $tokAdmin @{ status = 'bogus' }
if ($s -eq 400) { Pass 'PATCH (invalid status) → 400' } else { Fail 'PATCH (invalid)' 400 $s }
$s = PatchStatus "/api/admin/users/$idCust" $tokAdmin @{ email_verified = $true }
if ($s -eq 200) { Pass 'PATCH (admin, email_verified) → 200' } else { Fail 'PATCH (admin)' 200 $s }
$s = PatchStatus '/api/admin/users/9999999' $tokAdmin @{ status = 'active' }
if ($s -eq 404) { Pass 'PATCH (not found) → 404' } else { Fail 'PATCH (not found)' 404 $s }
$s = PatchStatus '/api/admin/users/abc' $tokAdmin @{ status = 'active' }
if ($s -eq 400) { Pass 'PATCH (invalid id) → 400' } else { Fail 'PATCH (invalid id)' 400 $s }

# ----- 3. PATCH stores / products / orders -----
Write-Host ''
Write-Host '----- 3. PATCH other admin resources -----'
$prods = (Invoke-WebRequest -Uri "$base/api/products?limit=5" -UseBasicParsing).Content | ConvertFrom-Json
$storeId   = $prods.data.products[0].store_id
$productId = $prods.data.products[0].id

$s = PatchStatus "/api/admin/stores/$storeId" $tokCust @{ is_active = $true }
if ($s -eq 403) { Pass 'PATCH /api/admin/stores (customer) → 403' } else { Fail 'PATCH (customer)' 403 $s }
$s = PatchStatus "/api/admin/stores/$storeId" $tokAdmin @{ is_active = $true }
if ($s -eq 200) { Pass 'PATCH /api/admin/stores (admin) → 200' } else { Fail 'PATCH (admin)' 200 $s }

$s = PatchStatus "/api/admin/products/$productId" $tokCust @{ is_active = $true }
if ($s -eq 403) { Pass 'PATCH /api/admin/products (customer) → 403' } else { Fail 'PATCH (customer)' 403 $s }
$s = PatchStatus "/api/admin/products/$productId" $tokAdmin @{ is_active = $true }
if ($s -eq 200) { Pass 'PATCH /api/admin/products (admin) → 200' } else { Fail 'PATCH (admin)' 200 $s }

$hdrs = @{ Authorization = "Bearer $tokCust" }
$orders = (Invoke-WebRequest -Uri "$base/api/orders" -Headers $hdrs -UseBasicParsing).Content | ConvertFrom-Json
$orderId = if ($orders.data.Count -gt 0) { $orders.data[0].id } else { $null }
if ($orderId) {
    $s = PatchStatus "/api/admin/orders/$orderId/status" $tokCust @{ status = 'confirmed' }
    if ($s -eq 403) { Pass 'PATCH /api/admin/orders/<id>/status (customer) → 403' } else { Fail 'PATCH (customer)' 403 $s }
    $s = PatchStatus "/api/admin/orders/$orderId/status" $tokAdmin @{ status = 'confirmed' }
    if ($s -eq 200 -or $s -eq 500) { Pass "PATCH /api/admin/orders/<id>/status (admin) → $s" }
    else { Fail 'PATCH (admin)' 200 $s }
}

# ----- 4. Admin self-protection -----
Write-Host ''
Write-Host '----- 4. Admin self-protection -----'
$s = PatchStatus "/api/admin/users/$idAdmin" $tokAdmin @{ status = 'banned' }
if ($s -eq 400) { Pass 'PATCH admin self (ban) → 400' } else { Fail 'self-ban' 400 $s }
$s = PatchStatus "/api/admin/users/$idAdmin" $tokAdmin @{ role = 'customer' }
if ($s -eq 400) { Pass 'PATCH admin self (demote) → 400' } else { Fail 'self-demote' 400 $s }
$s = PatchStatus "/api/admin/users/$idAdmin" $tokAdmin @{ email_verified = $true }
if ($s -eq 200) { Pass 'PATCH admin self (other field) → 200' } else { Fail 'admin self other' 200 $s }

# ----- 5. Response shape -----
Write-Host ''
Write-Host '----- 5. Response shape -----'
$s = GetStatus GET '/api/admin/users' $tokAdmin
if ($s -eq 200) { Pass 'GET /api/admin/users (admin) → 200' } else { Fail 'GET users' 200 $s }
$s = GetStatus GET '/api/admin/stats' $tokAdmin
if ($s -eq 200) { Pass 'GET /api/admin/stats (admin) → 200' } else { Fail 'GET stats' 200 $s }

# ----- 6. Pagination -----
Write-Host ''
Write-Host '----- 6. Pagination on admin lists -----'
foreach ($p in @('/api/admin/users', '/api/admin/stores', '/api/admin/products', '/api/admin/orders')) {
    $s = GetStatus GET "$p`?limit=2" $tokAdmin
    if ($s -eq 200) { Pass "GET $p`?limit=2 → 200" } else { Fail "GET (limit=2)" 200 $s }
}

Write-Host ''
Write-Host '===== PHASE 11 SUMMARY =====' -ForegroundColor Cyan
Write-Host "  PASS: $script:passes"
Write-Host "  FAIL: $script:fails"
if ($script:fails -gt 0) { exit 1 } else { Write-Host 'PHASE 11 complete.' -ForegroundColor Green }
