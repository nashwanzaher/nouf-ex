$ErrorActionPreference = 'Stop'
# .env is loaded by `dotenv/config` inside the API. To override the
# DATABASE_URL without touching the file, we rely on dotenv's
# default behavior of NOT overriding existing env. So we must
# make sure the parent process already has the new DATABASE_URL
# BEFORE node is launched, and we must NOT use Start-Process
# (which would inherit the parent env but never have a chance
# to be inspected by dotenv because dotenv only reads the
# .env file and skips keys already present).
#
# Strategy: set the env in *this* PowerShell session, then
# spawn node directly. Dotenv will see DATABASE_URL already
# populated and skip the .env value.
$env:NODE_ENV = 'production'
$env:DATABASE_URL = 'postgresql://postgres:656650@127.0.0.1:5435/noufex_clean_verify'
$env:API_PORT = '3001'
$env:AUTH_SECRET = 'test-secret-must-be-at-least-32-chars-long-xyz123'
$env:REDIS_URL = ''
$env:RABBITMQ_URL = ''
$env:ELASTICSEARCH_URL = ''
$env:SENTRY_DSN = ''
$env:OTEL_EXPORTER_OTLP_ENDPOINT = ''
$env:PUBLIC_FRONTEND_URL = 'https://noufex.local'
$env:DB_SSL = 'false'
$env:LOG_LEVEL = 'info'

# Sanity check: print what the API will see.
Write-Output "PARENT_DATABASE_URL=$env:DATABASE_URL"
Write-Output "PARENT_API_PORT=$env:API_PORT"

Set-Location -LiteralPath 'C:\Users\zaher\Documents\Projects\nouf-ex'
Write-Output "CWD=$(Get-Location)"

$logOut = Join-Path $PSScriptRoot 'api-clean.log'
$logErr = Join-Path $PSScriptRoot 'api-clean.err.log'
Remove-Item $logOut,$logErr -ErrorAction SilentlyContinue

# Use the dotnet-friendly approach: redirect via cmd /c so we can
# capture both streams reliably. We pass the env explicitly with
# the prefix on the same line so node inherits it.
$cmd = "set NODE_ENV=production& set DATABASE_URL=postgresql://postgres:656650@127.0.0.1:5435/noufex_clean_verify& set API_PORT=3001& set AUTH_SECRET=test-secret-must-be-at-least-32-chars-long-xyz123& set PUBLIC_FRONTEND_URL=https://noufex.local& set DB_SSL=false& set LOG_LEVEL=info& set REDIS_URL=& set RABBITMQ_URL=& set ELASTICSEARCH_URL=& set SENTRY_DSN=& set OTEL_EXPORTER_OTLP_ENDPOINT=& node apps\api\dist\index.js > `"$logOut`" 2> `"$logErr`""
$proc = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmd -WindowStyle Hidden -PassThru
Write-Output "API_PID=$($proc.Id)"
Start-Sleep -Seconds 8
if (Test-Path $logOut) { Get-Content $logOut | Select-Object -First 30 }
Write-Output '---STDERR---'
if (Test-Path $logErr) { Get-Content $logErr | Select-Object -First 30 }
