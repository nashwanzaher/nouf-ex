@echo off
REM ============================================================================
REM scripts/maintenance/start-api.bat
REM Starts the Nouf-ex API server in development mode using tsx.
REM Sources credentials from .env (gitignored) — never hardcode secrets.
REM ============================================================================

REM Add Node.js to PATH
for /f "tokens=*" %%i in ('where node 2^>nul') do (
    set "NODE_PATH=%%~dpi"
    goto :found_node
)
set "PATH=C:\Program Files\nodejs;%PATH%"
:found_node

REM Ensure we are in the correct directory for the API server
cd /d "%~dp0..\..\apps\api"

REM Run with --env-file so Node 20+'s built-in env loader reads .env
npx tsx --env-file=..\..\env src\index.ts
