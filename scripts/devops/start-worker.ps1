# ============================================================================
# Noufex — Worker entrypoint (PowerShell) (Tier 1.4).
# ----------------------------------------------------------------------------
# Local-dev companion to `npm run dev`. Boots the RabbitMQ consumers
# without booting the HTTP server. Useful for:
#   - running workers on a different machine than the API,
#   - debugging a stuck consumer without restarting the API,
#   - horizontal scaling experiments.
# ============================================================================

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

# Load .env into the current process (simple parser; no quoting edge cases).
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        $line = $_.Trim()
        if ($line -match "^\s*#" -or [string]::IsNullOrWhiteSpace($line)) { return }
        if ($line -match "^([^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"', "'")
            Set-Item -Path "Env:$name" -Value $value
        }
    }
}

Write-Host "▶ noufex-worker (local): starting from $repoRoot"
& npx tsx apps/api/src/worker.ts
exit $LASTEXITCODE