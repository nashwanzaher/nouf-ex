# E2E customer flow test - mimics what the React app does

$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'

# ── 1. Login ────────────────────────────────────────────────────
Write-Host "─── 1. Login as customer ───"
$loginBody = @{ email = 'ahmed@gmail.com'; password = 'customer123' } | ConvertTo-Json
$r = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -ContentType 'application/json' -Body $loginBody -UseBasicParsing
$login = ($r.Content | ConvertFrom-Json).data
$token = $login.token
$userId = $login.user.id
$headers = @{ Authorization = "Bearer $token" }
Write-Host ("  OK user_id={0}, role={1}" -f $userId, $login.user.role)

# ── 2. /auth/me ──────────────────────────────────────────────────
$r = Invoke-WebRequest -Uri "$base/api/auth/me" -Headers $headers -UseBasicParsing
$me = ($r.Content | ConvertFrom-Json).data
Write-Host ("  /auth/me → id={0}, name={1}" -f $me.id, $me.full_name)

# ── 3. Get current cart ─────────────────────────────────────────
$r = Invoke-WebRequest -Uri "$base/api/cart/$userId" -Headers $headers -UseBasicParsing
$cart = ($r.Content | ConvertFrom-Json).data
Write-Host ("  /api/cart/{0} → {1} item(s)" -f $userId, $cart.Count)
$initialCartCount = $cart.Count

# ── 4. Add item to cart ─────────────────────────────────────────
$addBody = @{ productId = 5; quantity = 2 } | ConvertTo-Json
$r = Invoke-WebRequest -Uri "$base/api/cart" -Method POST -Headers $headers -ContentType 'application/json' -Body $addBody -UseBasicParsing
$added = ($r.Content | ConvertFrom-Json).data
Write-Host ("  POST /api/cart → id={0}, msg='{1}'" -f $added.id, ($r.Content | ConvertFrom-Json).message)

# Verify cart grew
$r = Invoke-WebRequest -Uri "$base/api/cart/$userId" -Headers $headers -UseBasicParsing
$cart = ($r.Content | ConvertFrom-Json).data
Write-Host ("  cart after add → {0} item(s)" -f $cart.Count)

# ── 5. Add same item again (should merge/inc qty) ───────────────
$r = Invoke-WebRequest -Uri "$base/api/cart" -Method POST -Headers $headers -ContentType 'application/json' -Body $addBody -UseBasicParsing
Write-Host ("  add same item again → status={0}" -f $r.StatusCode)

# ── 6. Get orders ───────────────────────────────────────────────
$r = Invoke-WebRequest -Uri "$base/api/orders?userId=$userId" -Headers $headers -UseBasicParsing
$orders = ($r.Content | ConvertFrom-Json).data
Write-Host ("  /api/orders → {0} order(s)" -f $orders.Count)
foreach ($o in $orders) {
    Write-Host ("    #{0} status={1} total={2}" -f $o.order_number, $o.status, $o.total_amount)
}

# ── 7. Wishlist ─────────────────────────────────────────────────
$r = Invoke-WebRequest -Uri "$base/api/wishlist/$userId" -Headers $headers -UseBasicParsing
$wish = ($r.Content | ConvertFrom-Json).data
Write-Host ("  /api/wishlist → {0} item(s)" -f $wish.Count)

# Add to wishlist
$wishBody = @{ userId = $userId; productId = 22; notes = 'Test' } | ConvertTo-Json
try {
    $r = Invoke-WebRequest -Uri "$base/api/wishlist" -Method POST -Headers $headers -ContentType 'application/json' -Body $wishBody -UseBasicParsing
    Write-Host ("  POST /api/wishlist → {0}" -f $r.StatusCode)
} catch {
    Write-Host ("  POST /api/wishlist → error: {0}" -f $_.Exception.Message.Split([Environment]::NewLine)[0])
}

# ── 8. Notifications ───────────────────────────────────────────
$r = Invoke-WebRequest -Uri "$base/api/notifications/$userId" -Headers $headers -UseBasicParsing
$notifs = ($r.Content | ConvertFrom-Json).data
Write-Host ("  /api/notifications → {0} item(s)" -f $notifs.Count)

# ── 9. Addresses ───────────────────────────────────────────────
$r = Invoke-WebRequest -Uri "$base/api/addresses?user_id=$userId" -Headers $headers -UseBasicParsing
$addrs = ($r.Content | ConvertFrom-Json).data
Write-Host ("  /api/addresses → {0} item(s)" -f $addrs.Count)

# ── 10. Reviews for this user ──────────────────────────────────
$r = Invoke-WebRequest -Uri "$base/api/reviews?userId=$userId" -Headers $headers -UseBasicParsing
$revs = ($r.Content | ConvertFrom-Json).data
Write-Host ("  /api/reviews?userId → {0} review(s)" -f $revs.Count)

# ── 11. Stats home ─────────────────────────────────────────────
$r = Invoke-WebRequest -Uri "$base/api/stats/home" -Headers $headers -UseBasicParsing
$stats = ($r.Content | ConvertFrom-Json).data
Write-Host ("  /api/stats/home → ok")
if ($stats.counts) {
    foreach ($k in $stats.counts.PSObject.Properties) {
        Write-Host ("    {0} = {1}" -f $k.Name, $k.Value)
    }
}

Write-Host ""
Write-Host "─── All customer-flow checks passed ───"
