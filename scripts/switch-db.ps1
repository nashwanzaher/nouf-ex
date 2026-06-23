# Switch the live API container to talk to a different database.
# Usage: powershell -File scripts/switch-db.ps1 noufex_db_fresh
param([Parameter(Mandatory=$true)][string]$DbName)
$ErrorActionPreference = 'Stop'
$env = Get-Content .env | ForEach-Object {
    if ($_ -match '^DATABASE_URL=') { "DATABASE_URL=postgresql://noufex_app:CHANGE_ME_APP@host.docker.internal:5432/$DbName" }
    elseif ($_ -match '^DB_NAME=') { "DB_NAME=$DbName" }
    else { $_ }
}
Set-Content .env $env -NoNewline
Write-Host "Switched .env to $DbName. Restart the container to apply."
