# Test remaining flows
$base = 'http://localhost:3000'

function Login($email, $pwd) {
    $body = @{ email = $email; password = $pwd } | ConvertTo-Json
    $r = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -ContentType 'application/json' -Body $body -UseBasicParsing
    $tok = (($r.Content | ConvertFrom-Json).data).token
    return @{ Token = $tok; Headers = @{ Authorization = "Bearer $tok" } }
}

$buyer    = Login 'ahmed@gmail.com' 'customer123'
$merchant = Login 'fatima@spice-yemen.com' 'merchant123'
$admin    = Login 'admin@noufex.com' 'admin123'

function Call($method, $path, $headers, $body) {
    $params = @{ Uri = "$base$path"; Method = $method; Headers = $headers; UseBasicParsing = $true }
    if ($body) {
        $params['ContentType'] = 'application/json'
        $params['Body'] = ($body | ConvertTo-Json -Depth 5)
    }
    try {
        $r = Invoke-WebRequest @params
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

function Show($label, $r) {
    $preview = if ($r.body.Length -gt 120) { $r.body.Substring(0, 120) + '...' } else { $r.body }
    Write-Host ("  {0,-45} status={1}  {2}" -f $label, $r.status, $preview)
}

Write-Host '===== 1. Wishlist ====='
$r = Call POST '/api/wishlist' $buyer.Headers @{ productId = 10 }
$wid = (($r.body | ConvertFrom-Json).data).id
Show ('POST /api/wishlist (add id=' + $wid + ')') $r
$r = Call DELETE "/api/wishlist/$wid" $buyer.Headers
Show 'DELETE /api/wishlist/<id>' $r
$r = Call DELETE "/api/wishlist/$wid" $buyer.Headers
Show 'DELETE again (idempotent?)' $r

Write-Host ''
Write-Host '===== 2. Address CRUD ====='
$r = Call POST '/api/addresses' $buyer.Headers @{
    label='Home'; full_name='Ahmed'; phone='+967712345671'
    street='Test St 1'; city="Sana'a"; governorate="Sana'a"; country='YE'
    is_default=$true
}
$addrId = (($r.body | ConvertFrom-Json).data).id
Show ('POST /api/addresses (id=' + $addrId + ')') $r
$r = Call PUT "/api/addresses/$addrId" $buyer.Headers @{
    label='Home (updated)'; full_name='Ahmed'; phone='+967712345671'
    street='Test St 2'; city="Sana'a"; governorate="Sana'a"; country='YE'
    is_default=$false
}
Show 'PUT /api/addresses/<id>' $r
$r = Call DELETE "/api/addresses/$addrId" $buyer.Headers
Show 'DELETE /api/addresses/<id>' $r

Write-Host ''
Write-Host '===== 3. Notification mark-as-read (PUT) ====='
$r = Call GET '/api/notifications/2' $buyer.Headers
$notifs = (($r.body | ConvertFrom-Json).data)
$unread = $notifs | Where-Object { -not $_.is_read } | Select-Object -First 1
if ($unread) {
    Write-Host "  unread: id=$($unread.id) title=$($unread.title)"
    $r = Call PUT "/api/notifications/$($unread.id)/read" $buyer.Headers
    Show 'PUT /api/notifications/<id>/read' $r
    $r = Call GET '/api/notifications/2' $buyer.Headers
    $updated = (($r.body | ConvertFrom-Json).data) | Where-Object id -eq $unread.id
    Write-Host "  after PUT: is_read=$($updated.is_read)"
} else {
    Write-Host '  no unread notifications'
}

Write-Host ''
Write-Host '===== 4. Profile endpoints ====='
foreach ($ep in @('/api/auth/profile', '/api/users/me', '/api/users/2', '/api/auth/me')) {
    $r = Call GET $ep $buyer.Headers
    Show ("GET $ep") $r
}

Write-Host ''
Write-Host '===== 5. Store followers ====='
$storeId = 1
$r = Call POST '/api/store-followers' $buyer.Headers @{ storeId = $storeId }
Show 'POST /api/store-followers (follow)' $r
$r = Call GET "/api/store-followers/$storeId" $buyer.Headers
Show ("GET /api/store-followers/$storeId") $r
$r = Call DELETE "/api/store-followers/$storeId" $buyer.Headers
Show ("DELETE /api/store-followers/$storeId") $r

Write-Host ''
Write-Host '===== 6. Order status transitions ====='
$r = Call POST '/api/orders' $buyer.Headers @{
    items = @(@{ productId = 2; quantity = 1; unitPrice = 4500 })
    shippingAddress = @{ city = "Sana'a"; street = 'Test 123' }
    paymentMethod = 'cod'
    total = 4500
}
$orderId = (($r.body | ConvertFrom-Json).data).id
Write-Host "  created order id=$orderId"
if ($orderId) {
    $r = Call PUT "/api/orders/$orderId/status" $buyer.Headers @{ status = 'cancelled' }
    Show 'PUT status as BUYER (should be 403)' $r
    $r = Call PUT "/api/orders/$orderId/status" $merchant.Headers @{ status = 'confirmed' }
    Show 'PUT status as MERCHANT' $r
    $r = Call PUT "/api/orders/$orderId/status" $admin.Headers @{ status = 'shipped' }
    Show 'PUT status as ADMIN' $r
}

Write-Host ''
Write-Host '===== 7. Refunds ====='
$r = Call GET "/api/refunds?orderId=$orderId" $buyer.Headers
Show ("GET /api/refunds?orderId=$orderId") $r
$r = Call POST '/api/refunds' $buyer.Headers @{ orderId = $orderId; reason = 'damaged' }
Show 'POST /api/refunds' $r

Write-Host ''
Write-Host '===== 8. Payments ====='
$r = Call GET "/api/payments?orderId=$orderId" $buyer.Headers
Show ("GET /api/payments?orderId=$orderId") $r
$r = Call POST '/api/payments' $buyer.Headers @{
    orderId = $orderId; amount = 4500; method = 'stripe'; transactionId = 'txn_test_123'
}
Show 'POST /api/payments' $r

Write-Host ''
Write-Host '===== 9. Messages ====='
$r = Call GET '/api/messages/inbox/2' $buyer.Headers
Show 'GET /api/messages/inbox/2' $r
$r = Call POST '/api/messages' $buyer.Headers @{
    recipientId = 5
    subject = 'Question about Sidr Honey'
    body = 'Do you ship internationally?'
}
Show 'POST /api/messages' $r

Write-Host ''
Write-Host 'All done.'
