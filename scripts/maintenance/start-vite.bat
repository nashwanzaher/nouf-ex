@echo off
REM ============================================================================
REM scripts/maintenance/start-vite.bat
REM Starts the Nouf-ex Vite dev server on port 8080 with API proxy.
REM ============================================================================

REM Add Node.js to PATH
for /f "tokens=*" %%i in ('where node 2^>nul') do (
    set "NODE_PATH=%%~dpi"
    goto :found_node
)
set "PATH=C:\Program Files\nodejs;%PATH%"
:found_node

REM Ensure we are in the correct directory for the web app
cd /d "%~dp0..\..\apps\web"

REM Start Vite dev server on port 8080 (proxies /api to port 3000)
npx vite --port 8080 --host
