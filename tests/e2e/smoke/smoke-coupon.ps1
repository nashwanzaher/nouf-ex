$loginBody = @{ email = "ahmed@gmail.com"; password = "customer123" } | ConvertTo-Json
$loginResp = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing
$token = ($loginResp.Content | ConvertFrom-Json).data.token
$headers = @{ Authorization = "Bearer $token" }

# Test coupon validate with correct schema
$body = @{
    code = "WELCOME10"
    user_id = 2
    order_subtotal = 10000
} | ConvertTo-Json

try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/coupons/validate" -Method POST -ContentType "application/json" -Headers $headers -Body $body -UseBasicParsing
    Write-Host "OK validate: $($r.Content)"
} catch {
    $errBody = $_.Exception.Response
    if ($errBody) {
        $stream = $errBody.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "FAIL: $($reader.ReadToEnd())"
    } else {
        Write-Host "FAIL: $_"
    }
}

# Test shipping methods
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/shipping/methods" -UseBasicParsing
    Write-Host "OK shipping/methods: $($r.Content)"
} catch {
    Write-Host "FAIL shipping/methods: $_"
}

# Test messages inbox
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/messages/inbox" -Headers $headers -UseBasicParsing
    Write-Host "OK messages/inbox: $($r.Content)"
} catch {
    Write-Host "FAIL messages/inbox: $_"
}
