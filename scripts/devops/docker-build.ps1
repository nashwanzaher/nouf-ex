# =============================================================================
# docker-build.ps1 — build the noufex image WITHOUT leaking .env secrets.
# =============================================================================
# SECURITY: the previous version of this script passed every key in
# .env as a --build-arg. Build args are persisted in image layers and
# visible via `docker history` to anyone with image pull rights. We
# now only forward the small allowlist of non-secret variables that
# the Dockerfile actually consumes. Runtime secrets (DB_PASSWORD,
# AUTH_SECRET, etc.) are read by the container from .env via the
# compose `env_file:` directive, NEVER from build args.
# =============================================================================

Set-Location $PSScriptRoot\..

# Allowlist of variables the Dockerfile's ARG block references.
# Anything not in this list is silently dropped from .env so it never
# reaches the build context. If you add a new ARG to the Dockerfile,
# also add the key here.
$allowed = @(
    'NODE_VERSION',
    'BUILD_DATE',
    'VCS_REF',
    'NODE_ENV'
)

$envFile = Join-Path $PSScriptRoot '..\.env'
$buildArgs = @()

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
        $kv = $_ -split '=', 2
        if ($kv.Length -ne 2) { return }
        $key = $kv[0].Trim()
        $val = $kv[1].Trim()
        if ($allowed -contains $key) {
            $buildArgs += "--build-arg=$key=$val"
        }
    }
}

$argString = $buildArgs -join ' '
Write-Host "[docker-build] passing $($buildArgs.Count) build args (allowlist):"
foreach ($a in $buildArgs) { Write-Host "  $a" }
Write-Host "[docker-build] all other .env values are forwarded only at runtime via env_file"

# Use the array form of & docker so we never go through Invoke-Expression
# (which was the second CVE pattern of the previous version).
$logFile = Join-Path $PSScriptRoot '_docker_build.out'
$argList = @('build', '-t', 'noufex:latest')
if ($buildArgs.Count -gt 0) {
    $argList += $buildArgs
}
$argList += '.'

& docker @argList 2>&1 | Out-File -Encoding utf8 $logFile
$LASTEXITCODE > (Join-Path $PSScriptRoot '_docker_build_exit.txt')
exit $LASTEXITCODE
