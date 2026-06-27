# Test login as Merchant (بائع) and Buyer (مشتري/Customer)
$base = "http://localhost:3000"

function Test-Login($email, $password, $label) {
    Write-Host "===== $label ====="
    Write-Host "Email: $email"
    $body = @{ email = $email; password = $password } | ConvertTo-Json
    try {
        $resp = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing
        $data = ($resp.Content | ConvertFrom-Json).data
        Write-Host "Status: $($resp.StatusCode)"
        Write-Host "User ID:    $($data.user.id)"
        Write-Host "Name:       $($data.user.full_name)"
        Write-Host "Email:      $($data.user.email)"
        Write-Host "Role:       $($data.user.role)"
        Write-Host "Verified:   $($data.user.is_verified)"
        Write-Host "Token len:  $($data.token.Length)"
        Write-Host "Token head: $($data.token.Substring(0, 30))..."

        # Decode JWT payload (middle segment, base64url)
        $parts = $data.token.Split('.')
        $payload = $parts[1]
        # pad base64url
        while ($payload.Length % 4 -ne 0) { $payload += '=' }
        $decoded = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($payload.Replace('-', '+').Replace('_', '/')))
        Write-Host "JWT payload: $decoded"
        Write-Host ""

        return @{ Token = $data.token; UserId = $data.user.id; Role = $data.user.role; Headers = @{ Authorization = "Bearer $($data.token)" } }
    } catch {
        $resp = $_.Exception.Response
        if ($resp) {
            $stream = $resp.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            Write-Host "Status: $($resp.StatusCode.Value__) - $($reader.ReadToEnd())"
        } else {
            Write-Host "Error: $($_.Exception.Message)"
        }
        Write-Host ""
        return $null
    }
}

# 1. Login as Merchant (بائع - Fatima)
$merchant = Test-Login "fatima@spice-yemen.com" "merchant123" "1. Merchant Login"

# 2. Login as Buyer (مشتري/Customer - Ahmed)
$buyer = Test-Login "ahmed@gmail.com" "customer123" "2. Buyer (Customer) Login"

# 3. Use merchant token to access seller endpoints
if ($merchant) {
    Write-Host "===== 3. Merchant accesses /auth/me ====="
    $r = Invoke-WebRequest -Uri "$base/api/auth/me" -Headers $merchant.Headers -UseBasicParsing
    $me = ($r.Content | ConvertFrom-Json).data
    Write-Host "GET /auth/me → id=$($me.id), email=$($me.email), role=$($me.role)"
    Write-Host ""

    # 4. Buyer cannot access merchant endpoints (negative test)
    Write-Host "===== 4. Negative test: Buyer token on merchant store create ====="
    $storeBody = @{
        store_name = "Hack Store"
        store_slug = "hack-store"
        description = "Should be rejected"
        location = "Sana'a"
        governorate = "Sana'a"
    } | ConvertTo-Json
    try {
        $r = Invoke-WebRequest -Uri "$base/api/admin/stores" -Method POST -ContentType "application/json" -Headers $buyer.Headers -Body $storeBody -UseBasicParsing
        Write-Host "FAIL: buyer created a store! $($r.Content)"
    } catch {
        $resp = $_.Exception.Response
        $stream = $resp.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "OK buyer rejected: $($reader.ReadToEnd())"
    }
}

# 5. Buyer can fetch their own cart
if ($buyer) {
    Write-Host ""
    Write-Host "===== 5. Buyer accesses /cart/2 ====="
    $r = Invoke-WebRequest -Uri "$base/api/cart/2" -Headers $buyer.Headers -UseBasicParsing
    Write-Host "GET /api/cart/2 → status=$($r.StatusCode)"
}

# 6. Cross-tenant attempt: Merchant trying to access buyer's data
if ($merchant -and $buyer) {
    Write-Host ""
    Write-Host "===== 6. Cross-tenant: Merchant trying to fetch buyer's cart ====="
    try {
        $r = Invoke-WebRequest -Uri "$base/api/cart/2" -Headers $merchant.Headers -UseBasicParsing
        $cart = ($r.Content | ConvertFrom-Json).data
        Write-Host "Status: $($r.StatusCode) (server uses req.user.id from token, so merchant sees OWN cart, not buyer's)"
        Write-Host "Items in merchant's cart: $($cart.Count)"
    } catch {
        Write-Host "Rejected: $($_.Exception.Message)"
    }
}
