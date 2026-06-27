$email = "ahmed@gmail.com"
$password = "customer123"
$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
$loginResp = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing
$token = (($loginResp.Content | ConvertFrom-Json).data).token
$headers = @{ Authorization = "Bearer $token" }

# Add to cart first
$addBody = @{ productId = 1; quantity = 1 } | ConvertTo-Json
$r = Invoke-WebRequest -Uri "http://localhost:3000/api/cart" -Method POST -ContentType "application/json" -Headers $headers -Body $addBody -UseBasicParsing
$cartId = (($r.Content | ConvertFrom-Json).data).id
Write-Host "OK addToCart: id=$cartId"

# Update via PATCH (new endpoint)
$patchBody = @{ quantity = 3 } | ConvertTo-Json
$r = Invoke-WebRequest -Uri "http://localhost:3000/api/cart/$cartId" -Method PATCH -ContentType "application/json" -Headers $headers -Body $patchBody -UseBasicParsing
Write-Host "OK PATCH /api/cart/$cartId : status=$($r.StatusCode) body=$($r.Content)"

# Verify via GET
$r = Invoke-WebRequest -Uri "http://localhost:3000/api/cart/2" -Headers $headers -UseBasicParsing
$cart = (($r.Content | ConvertFrom-Json).data) | Where-Object id -eq $cartId
Write-Host "OK GET cart: qty=$($cart.quantity) (expected 3)"

# Test overshoot
$patchBody = @{ quantity = 999 } | ConvertTo-Json
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/cart/$cartId" -Method PATCH -ContentType "application/json" -Headers $headers -Body $patchBody -UseBasicParsing
    Write-Host "FAIL overshoot: status=$($r.StatusCode)"
} catch {
    $resp = $_.Exception.Response
    $stream = $resp.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "OK overshoot rejected: $($reader.ReadToEnd())"
}

# Remove item
Invoke-WebRequest -Uri "http://localhost:3000/api/cart/$cartId" -Method DELETE -Headers $headers -UseBasicParsing | Out-Null
Write-Host "OK removeCart: deleted id=$cartId"
