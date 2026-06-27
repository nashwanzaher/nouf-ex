# Test CRUD: cart update/remove, wishlist remove, address CRUD, notifications
$email = "ahmed@gmail.com"
$password = "customer123"

# Login
$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
$loginResp = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing
$token = ($loginResp.Content | ConvertFrom-Json).data.token
$headers = @{ Authorization = "Bearer $token" }

# Helper for safe API call
function Test-Api {
    param([string]$method, [string]$path, [hashtable]$headers, [string]$body)
    try {
        $params = @{ Uri = "http://localhost:3000$path"; Method = $method; Headers = $headers; UseBasicParsing = $true; ContentType = "application/json" }
        if ($body) { $params.Body = $body }
        $r = Invoke-WebRequest @params
        $data = ($r.Content | ConvertFrom-Json).data
        Write-Host ("OK {0,-6} {1,-40} [{2}]" -f $method, $path, $r.StatusCode)
        return $data
    } catch {
        $code = $_.Exception.Response.StatusCode
        $body = $_.Exception.Response
        Write-Host ("FAIL {0,-6} {1,-40} [{2}]" -f $method, $path, $code)
        return $null
    }
}

# Cart CRUD
Write-Host "`n=== CART CRUD ==="
$cartItem = Test-Api POST "/api/cart" $headers (@{ productId = 3; quantity = 5 } | ConvertTo-Json)
if ($cartItem) {
    Write-Host "  Added cart id=$($cartItem.id)"
    Test-Api DELETE "/api/cart/$($cartItem.id)" $headers
}

# Wishlist CRUD
Write-Host "`n=== WISHLIST CRUD ==="
$wish = Test-Api POST "/api/wishlist" $headers (@{ productId = 7 } | ConvertTo-Json)
if ($wish) {
    Write-Host "  Added wishlist id=$($wish.id)"
    Test-Api DELETE "/api/wishlist/$($wish.id)" $headers
}

# Address CRUD (tests the boolean fix)
Write-Host "`n=== ADDRESS CRUD ==="
$addr = Test-Api POST "/api/addresses" $headers (@{
    label = "Home"
    full_name = "Ahmed Test"
    phone = "+967712345671"
    governorate = "Sana'a"
    city = "Sana'a"
    street = "Test Street 123"
    is_default = $true
} | ConvertTo-Json)
if ($addr) {
    Write-Host "  Added address id=$($addr.id)"
    Test-Api DELETE "/api/addresses/$($addr.id)" $headers
}

# Notifications
Write-Host "`n=== NOTIFICATIONS ==="
$notifs = Test-Api GET "/api/notifications/2" $headers
if ($notifs -and $notifs.Count -gt 0) {
    $firstId = $notifs[0].id
    Test-Api PUT "/api/notifications/$firstId/read" $headers ""
    Test-Api PUT "/api/notifications/read-all" $headers ""
}

# Reviews POST (tests the boolean fix)
Write-Host "`n=== REVIEW POST ==="
# First check if user has purchased product 5
$hasOrdered = Test-Api GET "/api/orders?userId=2" $headers
if ($hasOrdered -and $hasOrdered.Count -gt 0) {
    # Add a review for product 1
    $review = Test-Api POST "/api/reviews" $headers (@{
        productId = 1
        rating = 5
        title = "Great honey!"
        comment = "Best Yemeni honey I've tried."
    } | ConvertTo-Json)
    if ($review) { Write-Host "  Created review id=$($review.id)" }
}

# Coupons apply
Write-Host "`n=== COUPONS ==="
Test-Api GET "/api/coupons" $headers
Test-Api POST "/api/coupons/validate" $headers (@{ code = "WELCOME10"; total = 1000 } | ConvertTo-Json)

# Shipping
Write-Host "`n=== SHIPPING ==="
Test-Api POST "/api/shipping/calculate" $headers (@{ city = "Sana'a"; weight = 1.5 } | ConvertTo-Json)

# Stats
Write-Host "`n=== STATS ==="
Test-Api GET "/api/stats/seller/5" $headers
Test-Api GET "/api/stats/admin" $headers

# 2FA endpoints (need auth)
Write-Host "`n=== 2FA ==="
Test-Api POST "/api/auth/2fa/setup" $headers ""
Test-Api GET "/api/auth/2fa/status" $headers

# Messages
Write-Host "`n=== MESSAGES ==="
Test-Api GET "/api/messages?userId=2" $headers

Write-Host "`nAll CRUD tests complete."
