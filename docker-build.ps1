Set-Location "D:\source\Nouf-ex"
# Pass build args from .env if present; otherwise image uses build-time defaults.
$envFile = ".env"
$buildArgs = @()
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
        $kv = $_ -split '=', 2
        if ($kv.Length -eq 2) {
            $key = $kv[0].Trim()
            $val = $kv[1].Trim()
            $buildArgs += "--build-arg=$key=$val"
        }
    }
}
$argString = $buildArgs -join ' '
Write-Host "Build args: $argString"
Invoke-Expression "docker build -t noufex:latest $argString ." 2>&1 | Out-File -Encoding utf8 "D:\source\Nouf-ex\scripts\_docker_build.out"
$LASTEXITCODE > "D:\source\Nouf-ex\scripts\_docker_build_exit.txt"
