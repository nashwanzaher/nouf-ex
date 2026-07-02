<#
.SYNOPSIS
    Format all source files with Prettier (write mode).
#>
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..\app
Write-Host '==> Running Prettier --write on app/ ...' -ForegroundColor Cyan
npm run format
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host '==> Format complete.' -ForegroundColor Green
exit 0