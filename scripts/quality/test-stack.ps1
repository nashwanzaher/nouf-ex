$api = "http://127.0.0.1:3000"
$failed = 0

function Test-Endpoint {
    param($Name, $Url, $ExpectStatus, $ExpectJsonPath)
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
        $ok = $r.StatusCode -eq $ExpectStatus
        if ($ExpectJsonPath) {
            $json = $r.Content | ConvertFrom-Json
            $val = & { $json.$ExpectJsonPath }
            $ok = $ok -and ($null -ne $val)
        }
        if ($ok) {
            Write-Host "  ✓ $Name (status=$($r.StatusCode))" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $Name (expected $ExpectStatus, got $($r.StatusCode))" -ForegroundColor Red
            $script:failed++
        }
    } catch {
        Write-Host "  ✗ $Name — $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
    }
}

Write-Host "`nStack Health Check" -ForegroundColor Cyan
Write-Host "──────────────────"

Test-Endpoint "API Health"  "$api/api/health" 200 "status"
Test-Endpoint "API Ready"   "$api/api/ready" 200 "status"
Test-Endpoint "API Stats"   "$api/api/stats/home" 200 "success"
Test-Endpoint "Products"    "$api/api/products?limit=1" 200 "success"
Test-Endpoint "Categories"  "$api/api/categories" 200 "success"
Test-Endpoint "Stores"      "$api/api/stores" 200 "success"

Write-Host ""
if ($failed -eq 0) {
    Write-Host "All checks passed." -ForegroundColor Green
} else {
    Write-Host "$failed check(s) failed." -ForegroundColor Red
    exit 1
}
