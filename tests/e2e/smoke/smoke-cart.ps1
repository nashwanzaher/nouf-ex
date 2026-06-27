# Test cart + wishlist + order flow with login (using correct schema names)
$email = "ahmed@gmail.com"
$password = "customer123"

# 1. Login
$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
$loginResp = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing
$loginData = ($loginResp.Content | ConvertFrom-Json).data
$token = $loginData.token
$userId = $loginData.user.id
Write-Host "OK login: user_id=$userId"
$headers = @{ Authorization = "Bearer $token" }

# 2. Cart add
$addBody = @{ productId = 1; quantity = 2 } | ConvertTo-Json
$r = Invoke-WebRequest -Uri "http://localhost:3000/api/cart" -Method POST -ContentType "application/json" -Headers $headers -Body $addBody -UseBasicParsing
$data = ($r.Content | ConvertFrom-Json).data
Write-Host "OK addToCart: id=$($data.id)"

# 3. Wishlist add
$addBody = @{ productId = 5 } | ConvertTo-Json
$r = Invoke-WebRequest -Uri "http://localhost:3000/api/wishlist" -Method POST -ContentType "application/json" -Headers $headers -Body $addBody -UseBasicParsing
$data = ($r.Content | ConvertFrom-Json).data
Write-Host "OK addToWishlist: id=$($data.id)"

# 4. Create order (correct schema)
$orderBody = @{
    items = @(@{ productId = 1; quantity = 2; unitPrice = 4500 })
    shippingAddress = @{ city = "Sana'a"; street = "Test 123" }
    paymentMethod = "cod"
    total = 9000
} | ConvertTo-Json -Depth 5
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/orders" -Method POST -ContentType "application/json" -Headers $headers -Body $orderBody -UseBasicParsing
    $data = ($r.Content | ConvertFrom-Json).data
    Write-Host "OK createOrder: id=$($data.id), number=$($data.order_number)"
} catch {
    Write-Host "FAIL createOrder: $($_.Exception.Message)"
    $resp = $_.Exception.Response
    if ($resp) {
        $stream = $resp.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "  body: $($reader.ReadToEnd())"
    }
}

Write-Host "`nCart/Wishlist/Order flow tested."
