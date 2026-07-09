# Switch the live API container to talk to a different database.
# Usage: powershell -File scripts/switch-db.ps1 noufex_db_fresh
param([Parameter(Mandatory=$true)][string]$DbName)
$ErrorActionPreference = 'Stop'
$currentUrl = (Select-String -Path .env -Pattern '^DATABASE_URL=').Line -replace '^DATABASE_URL=',''
$currentUser = if ($currentUrl -match '://([^:]+):') { $Matches[1] } else { 'noufex_app' }
$currentHost = if ($currentUrl -match '@([^:/]+)') { $Matches[1] } else { 'host.docker.internal' }
$currentPort = if ($currentUrl -match ':([0-9]+)/') { $Matches[1] } else { '5432' }
$env = Get-Content .env | ForEach-Object {
    if ($_ -match '^DATABASE_URL=') { "DATABASE_URL=postgresql://${currentUser}@${currentHost}:${currentPort}/${DbName}" }
    elseif ($_ -match '^DB_NAME=') { "DB_NAME=$DbName" }
    else { $_ }
}
Set-Content .env $env -NoNewline
Write-Host "Switched .env to $DbName. Restart the container to apply."
