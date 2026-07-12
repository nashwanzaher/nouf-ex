# Test Login page rendering
Write-Host '=== Test 1: Login page HTML loads ==='
try {
    $r = Invoke-WebRequest -Uri "http://localhost:8080/auth/login" -Method GET -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "   Status: $($r.StatusCode)"
    Write-Host "   Has #root div: $(if ($r.Content -match 'id="root"') {'YES'} else {'NO'})"
    Write-Host "   Has /src/main.tsx: $(if ($r.Content -match '/src/main.tsx') {'YES'} else {'NO'})"
} catch { Write-Host "   Error: $_" }

Write-Host ''
Write-Host '=== Test 2: main.tsx loads ==='
try {
    $r = Invoke-WebRequest -Uri "http://localhost:8080/src/main.tsx" -Method GET -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "   Status: $($r.StatusCode), Size: $($r.Content.Length) bytes"
} catch { Write-Host "   Error: $_" }

Write-Host ''
Write-Host '=== Test 3: Login.tsx loads ==='
try {
    $r = Invoke-WebRequest -Uri "http://localhost:8080/src/features/auth/components/Login.tsx" -Method GET -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "   Status: $($r.StatusCode), Size: $($r.Content.Length) bytes"
    # Check for syntax errors in transformed output
    if ($r.Content -match 'SyntaxError|Cannot find|TS\d+') {
        Write-Host "   ⚠️ Possible error in transformed output:"
        $r.Content -split "`n" | Select-String -Pattern 'SyntaxError|Cannot find|TS\d+' | Select-Object -First 5 | ForEach-Object { Write-Host "     $_" }
    } else {
        Write-Host "   ✅ No obvious errors"
    }
} catch { Write-Host "   Error: $_" }

Write-Host ''
Write-Host '=== Test 4: Login.module.css loads ==='
try {
    $r = Invoke-WebRequest -Uri "http://localhost:8080/src/features/auth/components/Login.module.css" -Method GET -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "   Status: $($r.StatusCode), Size: $($r.Content.Length) bytes"
} catch { Write-Host "   Error: $_" }

Write-Host ''
Write-Host '=== Test 5: i18n locale loads ==='
try {
    $r = Invoke-WebRequest -Uri "http://localhost:8080/src/i18n/locales/en.json" -Method GET -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "   Status: $($r.StatusCode), Size: $($r.Content.Length) bytes"
    $json = $r.Content | ConvertFrom-Json
    $count = ($json.PSObject.Properties | Measure-Object).Count
    Write-Host "   Top-level keys: $count"
} catch { Write-Host "   Error: $_" }
