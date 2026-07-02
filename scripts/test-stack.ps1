$tests = @(
    @{ name = "Vite (5173)"; url = "http://127.0.0.1:5173/" },
    @{ name = "API Health (3000)"; url = "http://127.0.0.1:3000/api/health" },
    @{ name = "API Products"; url = "http://127.0.0.1:3000/api/products?limit=2" },
    @{ name = "API Stats"; url = "http://127.0.0.1:3000/api/stats/home" },
    @{ name = "API Stores"; url = "http://127.0.0.1:3000/api/stores" }
)

foreach ($t in $tests) {
    try {
        $r = Invoke-WebRequest -Uri $t.url -UseBasicParsing -TimeoutSec 5
        Write-Host "OK $($t.name): status=$($r.StatusCode), length=$($r.Content.Length)"
    } catch {
        Write-Host "FAIL $($t.name): $($_.Exception.Message)"
    }
}
