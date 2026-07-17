# Bootstrap admin helper — runs the bootstrap CLI with .env defaults.
# Usage: powershell -File scripts/bootstrap-admin.ps1

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

if (-not (Test-Path ".env")) {
    Write-Error ".env not found at $repoRoot. Copy .env.example to .env and fill BOOTSTRAP_ADMIN_PASSWORD."
    exit 1
}

# Load .env into the process environment.
Get-Content ".env" | ForEach-Object {
    $line = $_.Trim()
    if ($line -match "^\s*#" -or [string]::IsNullOrWhiteSpace($line)) { return }
    if ($line -match "^([^=]+)=(.*)$") {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim().Trim('"', "'")
        Set-Item -Path "Env:$name" -Value $value
    }
}

if (-not $env:BOOTSTRAP_ADMIN_PASSWORD -or $env:BOOTSTRAP_ADMIN_PASSWORD -eq "REPLACE_WITH_STRONG_RANDOM") {
    Write-Host "BOOTSTRAP_ADMIN_PASSWORD is unset or still the placeholder."
    Write-Host "Generate one with:"
    Write-Host "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\""
    exit 1
}

# Bootstrap via tsx so we can import the TS sources.
npx tsx scripts/bootstrap-admin.ts
exit $LASTEXITCODE