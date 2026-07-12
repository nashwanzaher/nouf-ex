$tests = @(
    "/api/health",
    "/api/products?limit=2",
    "/api/categories",
    "/api/stores",
    "/api/products/1",
    "/api/products/featured",
    "/api/products/deals",
    "/api/search?q=coffee"
)
foreach ($p in $tests) {
    $r = Invoke-WebRequest -Uri "http://localhost:3000$p" -UseBasicParsing
    $line = ($r.Content -split "`n")[0]
    $preview = $line.Substring(0, [Math]::Min(80, $line.Length))
    Write-Host ("OK {0,-32} [{1}] {2}" -f $p, $r.StatusCode, $preview)
}
