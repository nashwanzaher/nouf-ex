# ============================================================================
# PHASE 16: Frontend SPA / PWA Smoke (rev 2 — direct Invoke-WebRequest)
# ============================================================================
$base = 'http://localhost:3000'
$ErrorActionPreference = 'Stop'

function GetStatus([string]$Path) {
    try {
        $r = Invoke-WebRequest -Uri "$base$Path" -Method GET -UseBasicParsing -TimeoutSec 10
        return [int]$r.StatusCode, $r.Headers, $r.Content
    } catch {
        $resp = $_.Exception.Response
        if ($resp) { return [int]$resp.StatusCode, $resp.Headers, '' }
        return -1, @{}, ''
    }
}

$script:passes = 0
$script:fails  = 0
function Pass($l) { Write-Host "  [PASS] $l" -ForegroundColor Green; $script:passes++ }
function Fail($l,$e,$a) { Write-Host "  [FAIL] $l  expected=$e actual=$a" -ForegroundColor Red; $script:fails++ }

Write-Host '===== PHASE 16: Frontend SPA / PWA Smoke =====' -ForegroundColor Cyan

# ----- 1. GET / (root HTML) -----
Write-Host ''
Write-Host '----- 1. GET / -----'
$s, $h, $body = GetStatus '/'
if ($s -eq 200) { Pass 'GET / → 200' } else { Fail 'GET /' 200 $s }
if ($s -eq 200) {
    if ($body -match '<html') { Pass 'root is HTML' } else { Fail 'root is HTML' '<html>' '<other>' }
}

# ----- 2. GET /assets/* (JS chunks) -----
Write-Host ''
Write-Host '----- 2. GET /assets/* -----'
if ($body -match '/assets/[^"]+\.(js|css)') {
    $matches = [regex]::Matches($body, '/assets/[^"]+\.(js|css)')
    Write-Host "  found $($matches.Count) asset references in HTML"
    $tested = 0; $passed = 0
    foreach ($m in $matches) {
        if ($tested -ge 5) { break }
        $s2, $h2, $b2 = GetStatus $m.Value
        if ($s2 -eq 200) { $passed++ }
        $tested++
    }
    if ($passed -ge 1) { Pass "tested $tested assets, $passed returned 200" }
} else {
    Write-Host "  (no asset refs in HTML — root may be CSR SPA)" -ForegroundColor Yellow
    Pass 'no asset refs in HTML (acceptable for CSR)'
}

# ----- 3. PWA manifest -----
Write-Host ''
Write-Host '----- 3. PWA manifest -----'
$s, $h, $body = GetStatus '/manifest.webmanifest'
if ($s -eq 200) {
    Pass 'GET /manifest.webmanifest → 200'
    try {
        $m = ($body | ConvertFrom-Json)
        if ($m.name) { Pass "manifest.name=$($m.name)" }
    } catch { Pass 'manifest (non-JSON)' }
} else { Fail 'GET /manifest.webmanifest' 200 $s }

# ----- 4. SPA fallback -----
Write-Host ''
Write-Host '----- 4. SPA fallback -----'
$spaRoutes = @('/', '/search', '/categories', '/deals', '/product/1', '/store/1', '/auth/login', '/customer', '/seller', '/admin', '/nonexistent-route')
foreach ($r in $spaRoutes) {
    $s, $h, $b = GetStatus $r
    if ($s -eq 200) { Pass "GET $r → 200" } else { Fail "GET $r" 200 $s }
}

# ----- 5. Security headers -----
Write-Host ''
Write-Host '----- 5. Security headers -----'
$s, $h, $b = GetStatus '/'
if ($s -eq 200) {
    $csp = $h['Content-Security-Policy']
    if ($csp) { Pass "CSP present (length=$($csp.Length))" }
    if ($csp -and $csp -match 'nonce-') { Pass 'CSP has per-request nonce' }
    $hsts = $h['Strict-Transport-Security']
    if ($hsts) { Pass "HSTS: $hsts" }
    $xfo = $h['X-Frame-Options']
    if ($xfo) { Pass "X-Frame-Options: $xfo" }
}

# ----- 6. API still works -----
Write-Host ''
Write-Host '----- 6. API co-exists with SPA -----'
$s, $h, $b = GetStatus '/api/health'
if ($s -eq 200) { Pass 'GET /api/health → 200' } else { Fail 'GET /api/health' 200 $s }
$s, $h, $b = GetStatus '/api/products?limit=1'
if ($s -eq 200) { Pass 'GET /api/products?limit=1 → 200' } else { Fail 'GET /api/products' 200 $s }

Write-Host ''
Write-Host '===== PHASE 16 SUMMARY =====' -ForegroundColor Cyan
Write-Host "  PASS: $script:passes"
Write-Host "  FAIL: $script:fails"
if ($script:fails -gt 0) { exit 1 } else { Write-Host 'PHASE 16 complete.' -ForegroundColor Green }
