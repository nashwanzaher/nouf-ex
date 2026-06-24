Set-Location "D:\source\Nouf-ex"
docker rm -f Nouf-ex 2>&1 | Out-Null
$envFileArgs = @()
if (Test-Path ".env") { $envFileArgs = @("--env-file", ".env") }
$cmd = "docker run -d --name Nouf-ex -p 3000:3000 " + ($envFileArgs -join ' ') + " noufex:latest"
Invoke-Expression $cmd 2>&1 | Out-File -Encoding utf8 "D:\source\Nouf-ex\scripts\_docker_run.out"
$LASTEXITCODE | Out-File -Encoding ascii "D:\source\Nouf-ex\scripts\_docker_run_exit.txt"
Write-Host "Waiting 25 seconds for startup..."
Start-Sleep -Seconds 25
Write-Host "--- container status ---"
docker ps --filter name=Nouf-ex
Write-Host "--- last 30 log lines ---"
docker logs --tail 30 Nouf-ex 2>&1
