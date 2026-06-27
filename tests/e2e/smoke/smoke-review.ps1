$loginBody = @{ email = "ahmed@gmail.com"; password = "customer123" } | ConvertTo-Json
$loginResp = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing
$token = ($loginResp.Content | ConvertFrom-Json).data.token
$headers = @{ Authorization = "Bearer $token" }

# Try creating a review with correct schema
$review = @{
    productId = 1
    rating = 5
    title = "Great honey!"
    comment = "Best Yemeni honey I've tried."
} | ConvertTo-Json

try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/reviews" -Method POST -ContentType "application/json" -Headers $headers -Body $review -UseBasicParsing
    Write-Host "OK review create: $($r.Content)"
} catch {
    $body = $_.Exception.Response
    if ($body) {
        $stream = $body.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "FAIL: $($reader.ReadToEnd())"
    }
}
