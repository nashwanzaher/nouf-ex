# ============================================================================
# run-all.ps1 — Execute all E2E test phases in sequence
# ============================================================================
# This is the entry script referenced by apps/e2e/package.json "test" command.
# Each phase is a standalone PowerShell script that tests a specific area.
# If any phase fails, the script reports the failure and continues.
#
# Usage:
#   pwsh -NoProfile -File ./run-all.ps1          # from apps/e2e/
#   pwsh -NoProfile -File ./run-all.ps1 -Phase 3  # run only phase 3
# ============================================================================
param(
	[int]$Phase = 0
)

$ErrorActionPreference = 'Continue'
$scriptDir = Join-Path $PSScriptRoot 'e2e'
$failed = @()
$passed = @()
$skipped = @()

# Determine which phases to run
$allPhases = @(0..17)
if ($Phase -gt 0) {
	$allPhases = @($Phase)
}

foreach ($p in $allPhases) {
	$padded = $p.ToString().PadLeft(2, '0')
	$script = Join-Path $scriptDir "phase${padded}_*.ps1"
	$files = Get-ChildItem -Path $script -ErrorAction SilentlyContinue

	if (-not $files -or $files.Count -eq 0) {
		$skipped += "phase$padded"
		Write-Host "[SKIP] Phase $padded — no script found" -ForegroundColor Yellow
		continue
	}

	$file = $files[0]
	$name = $file.Name
	Write-Host "`n══════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
	Write-Host "  Phase $padded : $name" -ForegroundColor Cyan
	Write-Host "══════════════════════════════════════════════════════════════" -ForegroundColor DarkGray

	try {
		& pwsh -NoProfile -File $file.FullName
		if ($LASTEXITCODE -eq 0) {
			$passed += "phase$padded"
			Write-Host "  ✓ Phase $padded PASSED" -ForegroundColor Green
		} else {
			$failed += "phase$padded"
			Write-Host "  ✗ Phase $padded FAILED (exit $LASTEXITCODE)" -ForegroundColor Red
		}
	} catch {
		$failed += "phase$padded"
		Write-Host "  ✗ Phase $padded FAILED: $($_.Exception.Message)" -ForegroundColor Red
	}
}

# Summary
Write-Host "`n══════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  E2E SUMMARY" -ForegroundColor White
Write-Host "══════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "  Passed:  $($passed.Count)" -ForegroundColor Green
Write-Host "  Failed:  $($failed.Count)" -ForegroundColor $(if ($failed.Count -gt 0) { 'Red' } else { 'Green' })
Write-Host "  Skipped: $($skipped.Count)" -ForegroundColor Yellow

if ($failed.Count -gt 0) {
	Write-Host "`n  Failed phases: $($failed -join ', ')" -ForegroundColor Red
	exit 1
}
