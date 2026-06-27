# Test role-based access control (RBAC) for merchant vs buyer
$base = "http://localhost:3000"

function Login($email, $pwd) {
    $body = @{ email = $email; password = $pwd } | ConvertTo-Json
    $r = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing
    return @{ Token = (($r.Content | ConvertFrom-Json).data).token; Headers = @{ Authorization = "Bearer $(((($r.Content | ConvertFrom-Json).data).token))" } }
}

$merchant = Login "fatima@spice-yemen.com" "merchant123"
$buyer    = Login "ahmed@gmail.com" "customer123"

Write-Host "===== Seller endpoints ====="
$sellerEndpoints = @(
    @{ Method = "GET"; Path = "/api/seller/products" },
    @{ Method = "GET"; Path = "/api/seller/orders" },
    @{ Method = "GET"; Path = "/api/seller/dashboard" }
)
foreach ($e in $sellerEndpoints) {
    Write-Host ""
    Write-Host "  $($e.Method) $($e.Path)"
    Write-Host "    merchant → $(try { (Invoke-WebRequest -Uri "$base$($e.Path)" -Method $e.Method -Headers $merchant.Headers -UseBasicParsing).StatusCode } catch { $_.Exception.Response.StatusCode.Value__ })"
    Write-Host "    buyer    → $(try { (Invoke-WebRequest -Uri "$base$($e.Path)" -Method $e.Method -Headers $buyer.Headers -UseBasicParsing).StatusCode } catch { $_.Exception.Response.StatusCode.Value__ })"
}

Write-Host ""
Write-Host "===== Admin endpoints ====="
$adminEndpoints = @(
    @{ Method = "GET"; Path = "/api/admin/users" },
    @{ Method = "GET"; Path = "/api/admin/stores" },
    @{ Method = "GET"; Path = "/api/admin/audit-log" }
)
foreach ($e in $adminEndpoints) {
    Write-Host ""
    Write-Host "  $($e.Method) $($e.Path)"
    Write-Host "    merchant → $(try { (Invoke-WebRequest -Uri "$base$($e.Path)" -Method $e.Method -Headers $merchant.Headers -UseBasicParsing).StatusCode } catch { $_.Exception.Response.StatusCode.Value__ })"
    Write-Host "    buyer    → $(try { (Invoke-WebRequest -Uri "$base$($e.Path)" -Method $e.Method -Headers $buyer.Headers -UseBasicParsing).StatusCode } catch { $_.Exception.Response.StatusCode.Value__ })"
    Write-Host "    no auth  → $(try { (Invoke-WebRequest -Uri "$base$($e.Path)" -Method $e.Method -UseBasicParsing).StatusCode } catch { $_.Exception.Response.StatusCode.Value__ })"
}

Write-Host ""
Write-Host "===== Customer endpoints ====="
Write-Host "  /api/cart/2"
Write-Host "    merchant → $(try { (Invoke-WebRequest -Uri "$base/api/cart/2" -Headers $merchant.Headers -UseBasicParsing).StatusCode } catch { $_.Exception.Response.StatusCode.Value__ })"
Write-Host "    buyer    → $(try { (Invoke-WebRequest -Uri "$base/api/cart/2" -Headers $buyer.Headers -UseBasicParsing).StatusCode } catch { $_.Exception.Response.StatusCode.Value__ })"
