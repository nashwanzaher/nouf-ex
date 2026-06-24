<#
.SYNOPSIS
    Verify all source files match Prettier formatting (CI mode, no changes).
#>
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\app
Write-Host '==> Running Prettier --check on app/ ...' -ForegroundColor Cyan
npm run format:check
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host '==> Format check passed.' -ForegroundColor Green
exit 0