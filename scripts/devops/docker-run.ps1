Set-Location $PSScriptRoot\..
docker rm -f Nouf-ex 2>&1 | Out-Null

$procArgs = @('run', '-d', '--name', 'Nouf-ex', '-p', '3000:3000')
if (Test-Path ".env") { $procArgs += @('--env-file', '.env') }
$procArgs += 'noufex:latest'

& docker @procArgs 2>&1 | Out-File -Encoding utf8 "$PSScriptRoot\_docker_run.out"
$LASTEXITCODE | Out-File -Encoding ascii "$PSScriptRoot\_docker_run_exit.txt"

Write-Host "Waiting 25 seconds for startup..."
Start-Sleep -Seconds 25
Write-Host "--- container status ---"
docker ps --filter name=Nouf-ex
Write-Host "--- last 30 log lines ---"
docker logs --tail 30 Nouf-ex 2>&1
