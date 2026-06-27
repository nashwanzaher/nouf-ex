# Test notifications mark-as-read + cart remove/update + order status transitions
$email = "ahmed@gmail.com"
$password = "customer123"

$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
$loginResp = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing
$loginData = ($loginResp.Content | ConvertFrom-Json).data
$token = $loginData.token
Write-Host "OK login: user_id=$($loginData.user.id)"
$headers = @{ Authorization = "Bearer $token" }

# Get unread notifications
$nResp = Invoke-WebRequest -Uri "http://localhost:3000/api/notifications/2" -Headers $headers -UseBasicParsing
$notifs = ($nResp.Content | ConvertFrom-Json).data
$unread = $notifs | Where-Object { -not $_.is_read } | Select-Object -First 1
Write-Host "OK notifications: total=$($notifs.Count), unread=$((($notifs | Where-Object { -not $_.is_read }).Count))"

if ($unread) {
    # Mark single notification as read
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/notifications/$($unread.id)/read" -Method POST -Headers $headers -UseBasicParsing
    Write-Host "OK markNotificationAsRead: id=$($unread.id) → status=$($r.StatusCode)"
}

# Get cart items
$cResp = Invoke-WebRequest -Uri "http://localhost:3000/api/cart/2" -Headers $headers -UseBasicParsing
$cart = ($cResp.Content | ConvertFrom-Json).data
Write-Host "OK cart items: count=$($cart.Count)"

if ($cart.Count -gt 0) {
    $first = $cart[0]
    # Update quantity (PUT or PATCH depending on the route)
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3000/api/cart/$($first.id)" -Method PATCH -ContentType "application/json" -Headers $headers -Body (@{ quantity = 5 } | ConvertTo-Json) -UseBasicParsing
        Write-Host "OK updateCartItem: id=$($first.id) → status=$($r.StatusCode)"
    } catch {
        Write-Host "INFO updateCartItem PATCH: $($_.Exception.Message)"
    }

    # Remove the item
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/cart/$($first.id)" -Method DELETE -Headers $headers -UseBasicParsing
    Write-Host "OK removeCartItem: id=$($first.id) → status=$($r.StatusCode)"

    # Clear remaining cart
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/cart/clear/2" -Method DELETE -Headers $headers -UseBasicParsing
    Write-Host "OK clearCart: status=$($r.StatusCode)"
}

# Order list - get the first pending order
$oResp = Invoke-WebRequest -Uri "http://localhost:3000/api/orders?userId=2" -Headers $headers -UseBasicParsing
$orders = ($oResp.Content | ConvertFrom-Json).data
$pending = $orders | Where-Object { $_.status -eq 'pending' } | Select-Object -First 1
Write-Host "OK orders: count=$($orders.Count), pending=$((($orders | Where-Object { $_.status -eq 'pending' }).Count))"

if ($pending) {
    # Get order details
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/orders/$($pending.id)" -Headers $headers -UseBasicParsing
    Write-Host "OK orderDetails: id=$($pending.id) → status=$($r.StatusCode)"

    # Cancel the pending order (legal transition)
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3000/api/orders/$($pending.id)/cancel" -Method POST -Headers $headers -UseBasicParsing
        Write-Host "OK cancelOrder: id=$($pending.id) → status=$($r.StatusCode)"
    } catch {
        $resp = $_.Exception.Response
        if ($resp) {
            $stream = $resp.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            Write-Host "INFO cancelOrder: status=$($resp.StatusCode.Value__) body=$($reader.ReadToEnd())"
        } else {
            Write-Host "INFO cancelOrder: $($_.Exception.Message)"
        }
    }
}

Write-Host "`nMutation tests done."
