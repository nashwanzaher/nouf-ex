# ============================================================================
# PHASE 17: Full Regression / Mutations
# Orchestrator: runs every phase script in order, aggregates PASS/FAIL,
# generates a regression summary report.
# ============================================================================
$ErrorActionPreference = 'Stop'

$here = $PSScriptRoot
$reportDir = Join-Path $here '..\reports'
if (-not (Test-Path $reportDir)) { New-Item -ItemType Directory -Path $reportDir -Force | Out-Null }

# Phase scripts to run, in order
$phases = @(
    @{ name = '00 — Health + Auth';                       script = 'phase00_health_auth.ps1' },
    @{ name = '01 — Profile + Addresses';                script = 'phase01_profile_addresses.ps1' },
    @{ name = '01-R — Profile re-test (strict mode)';     script = 'phase01_profile_addresses_retest.ps1' },
    @{ name = '02 — Public Catalog';                      script = 'phase02_public_catalog.ps1' },
    @{ name = '03 — Search + Filters';                    script = 'phase03_search_filters.ps1' },
    @{ name = '04 — Cart (known issues)';                 script = 'phase04_cart.ps1' },
    @{ name = '05 — Orders + Inventory';                  script = 'phase05_orders_inventory.ps1' },
    @{ name = '06 — Coupons + Discounts';                 script = 'phase06_coupons.ps1' },
    @{ name = '07 — Payments + Refunds';                  script = 'phase07_payments_refunds.ps1' },
    @{ name = '08 — Reviews + Ratings';                   script = 'phase08_reviews_ratings.ps1' },
    @{ name = '09 — Wishlist + Store Followers';           script = 'phase09_wishlist_followers.ps1' },
    @{ name = '12 — 2FA + Backup Codes';                  script = 'phase12_2fa_backup.ps1' },
    @{ name = '13 — Notifications + Messages';             script = 'phase13_notifications_messages.ps1' },
    @{ name = '14 — Shipping Methods';                    script = 'phase14_shipping_methods.ps1' },
    @{ name = '15 — Audit Logs';                          script = 'phase15_audit_logs.ps1' },
    @{ name = '16 — Frontend SPA / PWA';                  script = 'phase16_frontend_spa.ps1' }
)

# Reset rate limit once before the run
Write-Host '═══ Resetting rate-limit buckets ═══' -ForegroundColor Cyan
$resetScript = Join-Path $here 'reset-rate-limit.cjs'
if (Test-Path $resetScript) {
    & node $resetScript 2>&1 | Out-Null
    Write-Host "  rate limits cleared"
} else {
    Write-Host "  (reset script not found, skipping)" -ForegroundColor Yellow
}

# Reset again between every phase to avoid bucket exhaustion
function Reset-RateLimit {
    if (Test-Path $resetScript) { & node $resetScript 2>&1 | Out-Null }
}

# Aggregated results
$agg = @()

Write-Host ''
Write-Host '═══════════════════════════════════════════════════════════════════' -ForegroundColor Cyan
Write-Host '  PHASE 17: Full Regression — running all phases sequentially'         -ForegroundColor Cyan
Write-Host '═══════════════════════════════════════════════════════════════════' -ForegroundColor Cyan

foreach ($p in $phases) {
    $scriptPath = Join-Path $here $p.script
    if (-not (Test-Path $scriptPath)) {
        Write-Host ("  [SKIP] {0} — file not found: {1}" -f $p.name, $p.script) -ForegroundColor Yellow
        $agg += [pscustomobject]@{ Phase = $p.name; Status = 'SKIP'; Pass = 0; Fail = 0; Exit = 0 }
        continue
    }
    Write-Host ''
    Write-Host ("─── {0} ───" -f $p.name) -ForegroundColor Green
    Write-Host ("  running: {0}" -f $p.script)

    # Reset rate limits between phases
    Reset-RateLimit

    # Run the phase and capture its output
    $logFile = Join-Path $reportDir ($p.script -replace '\.ps1$', '.log')
    $output = & powershell -ExecutionPolicy Bypass -File $scriptPath 2>&1
    $output | Tee-Object -FilePath $logFile | Out-Null
    $exit = $LASTEXITCODE

    # Parse the summary line: "PASS: X  FAIL: Y" or look for "PHASE N complete"
    $pass = 0
    $fail = 0
    $status = 'OK'
    $line = $output | Select-String -Pattern 'PASS:\s*(\d+)' | Select-Object -First 1
    if ($line) { $pass = [int]$line.Matches[0].Groups[1].Value }
    $line2 = $output | Select-String -Pattern 'FAIL:\s*(\d+)' | Select-Object -First 1
    if ($line2) { $fail = [int]$line2.Matches[0].Groups[1].Value }
    if ($exit -ne 0) { $status = 'FAIL' }
    if ($fail -gt 0) { $status = 'FAIL' }

    Write-Host ("  result: PASS=$pass FAIL=$fail exit=$exit status=$status") -ForegroundColor $(if ($status -eq 'OK') { 'Green' } else { 'Red' })
    $agg += [pscustomobject]@{ Phase = $p.name; Status = $status; Pass = $pass; Fail = $fail; Exit = $exit }
}

# Summary
Write-Host ''
Write-Host '═══════════════════════════════════════════════════════════════════' -ForegroundColor Cyan
Write-Host '  REGRESSION SUMMARY' -ForegroundColor Cyan
Write-Host '═══════════════════════════════════════════════════════════════════' -ForegroundColor Cyan
$totalPass = ($agg | Measure-Object -Property Pass -Sum).Sum
$totalFail = ($agg | Measure-Object -Property Fail -Sum).Sum
$okCount = ($agg | Where-Object { $_.Status -eq 'OK' }).Count
$failCount = ($agg | Where-Object { $_.Status -eq 'FAIL' }).Count
$skipCount = ($agg | Where-Object { $_.Status -eq 'SKIP' }).Count

Write-Host ("  Phases OK:    {0}" -f $okCount) -ForegroundColor Green
Write-Host ("  Phases FAIL:  {0}" -f $failCount) -ForegroundColor $(if ($failCount -gt 0) { 'Red' } else { 'Green' })
Write-Host ("  Phases SKIP:  {0}" -f $skipCount) -ForegroundColor Yellow
Write-Host ("  Total PASS:   {0}" -f $totalPass) -ForegroundColor Green
Write-Host ("  Total FAIL:   {0}" -f $totalFail) -ForegroundColor $(if ($totalFail -gt 0) { 'Red' } else { 'Green' })
Write-Host ''
Write-Host '  Per-phase:'
$agg | ForEach-Object {
    $color = if ($_.Status -eq 'OK') { 'Green' } elseif ($_.Status -eq 'SKIP') { 'Yellow' } else { 'Red' }
    Write-Host ("    [{0}] {1,-55} pass={2,3} fail={3,3}" -f $_.Status, $_.Phase, $_.Pass, $_.Fail) -ForegroundColor $color
}

# Persist summary
$summaryPath = Join-Path $reportDir 'phase17_regression_summary.txt'
$summary = @()
$summary += "Nouf-ex E2E Regression Summary"
$summary += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$summary += "────────────────────────────────────────"
$summary += "Phases OK:    $okCount"
$summary += "Phases FAIL:  $failCount"
$summary += "Phases SKIP:  $skipCount"
$summary += "Total PASS:   $totalPass"
$summary += "Total FAIL:   $totalFail"
$summary += ""
$summary += "Per-phase:"
foreach ($r in $agg) {
    $summary += "  [$($r.Status)] $($r.Phase)  pass=$($r.Pass) fail=$($r.Fail)"
}
$summary | Out-File -FilePath $summaryPath -Encoding utf8
Write-Host ''
Write-Host ("  summary written: {0}" -f $summaryPath) -ForegroundColor Cyan

if ($failCount -gt 0) { exit 1 } else { exit 0 }
