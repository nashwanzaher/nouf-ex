<#
.SYNOPSIS
    Format all source files with Prettier (write mode).
#>
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..\..  # repo root
Write-Host '==> Running Prettier --write on apps/web/ ...' -ForegroundColor Cyan
npm run format
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host '==> Format complete.' -ForegroundColor Green
exit 0