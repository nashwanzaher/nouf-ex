# Noufex — Search reindex wrapper (PowerShell)
# Tier 1.2 — runs scripts/search/reindex.ts via tsx.
# Usage: powershell -File scripts/search/reindex.ps1
#        powershell -File scripts/search/reindex.ps1 -Only products

param(
    [ValidateSet("all", "products", "stores", "categories")]
    [string]$Only = "all",
    [int]$Batch = 500
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

if (-not (Test-Path ".env")) {
    Write-Error ".env not found at $repoRoot. Copy .env.example to .env first."
    exit 1
}

# Load .env into the current process (simple parser; no quoting edge cases).
Get-Content ".env" | ForEach-Object {
    $line = $_.Trim()
    if ($line -match "^\s*#" -or [string]::IsNullOrWhiteSpace($line)) { return }
    if ($line -match "^([^=]+)=(.*)$") {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim().Trim('"', "'")
        Set-Item -Path "Env:$name" -Value $value
    }
}

if (-not $env:DATABASE_URL) {
    Write-Error "DATABASE_URL is not set in .env"
    exit 1
}
if (-not $env:ELASTICSEARCH_URL) {
    Write-Error "ELASTICSEARCH_URL is not set in .env"
    exit 1
}

Write-Host "▶ Reindex (only=$Only, batch=$Batch)"
Write-Host "  DATABASE_URL = $($env:DATABASE_URL.Substring(0, [Math]::Min(40, $env:DATABASE_URL.Length)))..."
Write-Host "  ELASTICSEARCH_URL = $env:ELASTICSEARCH_URL"
Write-Host "  ELASTICSEARCH_INDEX_PREFIX = $($env:ELASTICSEARCH_INDEX_PREFIX ?? 'noufex')"

$args = @("--experimental-strip-types", "scripts/search/reindex.ts")
if ($Only -ne "all") { $args += "--only"; $args += $Only }
if ($Batch -ne 500) { $args += "--batch"; $args += $Batch.ToString() }

& npx @args
exit $LASTEXITCODE