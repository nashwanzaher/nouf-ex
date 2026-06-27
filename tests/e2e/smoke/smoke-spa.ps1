# Test SPA routes get correct CSP nonce + no SW cached version
$routes = @("/", "/search", "/categories", "/deals", "/auth/login", "/auth/register", "/auth/forgot-password", "/auth/reset-password", "/customer", "/customer/orders", "/customer/wishlist", "/customer/reviews", "/customer/addresses", "/customer/notifications", "/seller", "/admin", "/nonexistent-route")

foreach ($r in $routes) {
    $resp = Invoke-WebRequest -Uri "http://localhost:3000$r" -UseBasicParsing
    $html = $resp.Content
    $hasNonce = $html -match 'nonce="[^"]+"'
    $hasCspMeta = $html -match 'name="csp-nonce"'
    $hasMainScript = $html -match '/assets/index-[^"]+\.js'
    $scriptMatch = [regex]::Match($html, '<script nonce="([^"]+)"[^>]*src="/assets/index-([^"]+)\.js"')
    $status = if ($hasNonce -and $hasCspMeta -and $scriptMatch.Success) { "OK" } else { "FAIL" }
    Write-Host ("{0,-4} {1,-40} nonce={2}, csp-meta={3}, bundle={4}" -f $status, $r, $hasNonce, $hasCspMeta, $scriptMatch.Groups[2].Value)
}
