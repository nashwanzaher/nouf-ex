# Test order placement flow
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'

# Login
$login = (Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -ContentType 'application/json' -Body (@{email='ahmed@gmail.com';password='customer123'} | ConvertTo-Json) -UseBasicParsing).Content | ConvertFrom-Json
$token = $login.data.token
$headers = @{Authorization="Bearer $token"}

Write-Host "─── Create Order ───"
$body = @{
    items = @(@{productId=1;quantity=2;unitPrice=15000})
    subtotal = 30000
    shippingCost = 1000
    discount = 0
    total = 31000
    shippingAddress = @{
        city = 'Sana''a'
        name = 'Test User'
        phone = '+967711111111'
        street = 'Test St'
    }
    paymentMethod = 'cod'
    notes = 'Test order from e2e'
} | ConvertTo-Json -Depth 5

try {
    $r = Invoke-WebRequest -Uri "$base/api/orders" -Method POST -Headers $headers -ContentType 'application/json' -Body $body -UseBasicParsing
    $data = ($r.Content | ConvertFrom-Json).data
    Write-Host ("  OK order created: id={0}, order_number={1}, total={2}" -f $data.id, $data.order_number, $data.total)
    $orderId = $data.id
} catch {
    Write-Host "  FAIL: $($_.Exception.Message)"
    $_.Exception.Response
    $reader = New-Object System.IO.StreamReader $_.Exception.Response.GetResponseStream()
    Write-Host "  Body: $($reader.ReadToEnd())"
}

Write-Host ""
Write-Host "─── Fetch Order ───"
try {
    $r = Invoke-WebRequest -Uri "$base/api/orders/$orderId" -Headers $headers -UseBasicParsing
    $data = ($r.Content | ConvertFrom-Json).data
    Write-Host ("  OK order fetched: order_number={0}, status={1}, total={2}" -f $data.order_number, $data.status, $data.total)
} catch {
    Write-Host "  FAIL: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "─── Cancel Order ───"
try {
    $r = Invoke-WebRequest -Uri "$base/api/orders/$orderId/cancel" -Method POST -Headers $headers -UseBasicParsing
    $data = ($r.Content | ConvertFrom-Json).data
    Write-Host ("  OK order cancelled: status={0}" -f $data.status)
} catch {
    Write-Host "  FAIL: $($_.Exception.Message)"
}
