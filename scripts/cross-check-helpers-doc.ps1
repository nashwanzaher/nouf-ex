# Cross-check PS_TESTHELPERS_REFERENCE.md against PS_TestHelpers.ps1
$refPath = 'd:\source\Nouf-ex\docs\testing\templates\PS_TESTHELPERS_REFERENCE.md'
$srcPath = 'd:\source\Nouf-ex\tests\e2e\helpers\PS_TestHelpers.ps1'

Write-Host '=== Cross-check: PS_TESTHELPERS_REFERENCE.md ↔ PS_TestHelpers.ps1 ===' -ForegroundColor Cyan
Write-Host ''

# Get functions from source (full names like Invoke-ApiRequest)
$srcFunctions = @{}
$content = Get-Content $srcPath -Raw
$matches = [regex]::Matches($content, 'function\s+([A-Z][a-zA-Z-]+)')
foreach ($m in $matches) {
    $name = $m.Groups[1].Value
    if (-not $srcFunctions.ContainsKey($name)) {
        $srcFunctions[$name] = $true
    }
}

Write-Host ("Functions in source ({0}):" -f $srcFunctions.Count) -ForegroundColor Yellow
$srcFunctions.Keys | Sort-Object | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
Write-Host ''

# Get functions documented in reference (full names)
$refContent = Get-Content $refPath -Raw
$refMatches = [regex]::Matches($refContent, '## \d+\.\s+`?([A-Z][a-zA-Z-]+)`?')
$refFunctions = @{}
foreach ($m in $refMatches) {
    $name = $m.Groups[1].Value
    if (-not $refFunctions.ContainsKey($name)) {
        $refFunctions[$name] = $true
    }
}

Write-Host ("Functions documented in reference ({0}):" -f $refFunctions.Count) -ForegroundColor Yellow
$refFunctions.Keys | Sort-Object | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
Write-Host ''

# Cross-check
$missing = @()
foreach ($fn in $srcFunctions.Keys) {
    if (-not $refFunctions.ContainsKey($fn)) {
        $missing += $fn
    }
}
$extra = @()
foreach ($fn in $refFunctions.Keys) {
    if (-not $srcFunctions.ContainsKey($fn)) {
        $extra += $fn
    }
}

if ($missing.Count -eq 0 -and $extra.Count -eq 0) {
    Write-Host '[OK] All source functions documented, no extras' -ForegroundColor Green
} else {
    if ($missing.Count -gt 0) {
        Write-Host '[FAIL] Missing from reference:' -ForegroundColor Red
        $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    }
    if ($extra.Count -gt 0) {
        Write-Host '[WARN] In reference but not in source (deprecated?):' -ForegroundColor Yellow
        $extra | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    }
}

Write-Host ''
Write-Host ("Stats: {0} lines, {1} bytes" -f (Get-Content $refPath | Measure-Object -Line).Lines, (Get-Item $refPath).Length) -ForegroundColor Gray
