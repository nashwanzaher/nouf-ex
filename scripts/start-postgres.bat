@echo off
REM Nouf-ex — Postgres launcher
REM Starts the local Postgres cluster and pgAdmin.
REM The cluster data directory is at C:\Users\zaher\.noufex-pg-data (clean initdb,
REM superuser password 656650, listening on 127.0.0.1:5435).

set PG_HOME=C:\Program Files\PostgreSQL\17
set PGDATA=C:\Users\zaher\.noufex-pg-data

echo === Nouf-ex Postgres launcher ===

REM If already running, exit early
netstat -ano | findstr :5435 | findstr LISTENING >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Postgres already running on 5435
    goto :pgadmin
)

REM Start the cluster detached
echo Starting Postgres on 127.0.0.1:5435...
"%PG_HOME%\bin\pg_ctl.exe" start -D "%PGDATA%" -l "%PGDATA%\server.log"
if %ERRORLEVEL% NEQ 0 (
    echo [ERR] Failed to start Postgres — see %PGDATA%\server.log
    exit /b 1
)

REM Wait for it to accept connections
:waitloop
timeout /t 1 /nobreak >nul
netstat -ano | findstr :5435 | findstr LISTENING >nul
if %ERRORLEVEL% NEQ 0 goto :waitloop

echo [OK] Postgres is up on 127.0.0.1:5435

:pgadmin
echo Launching pgAdmin 4...
start "" "%PG_HOME%\pgAdmin 4\runtime\pgAdmin4.exe"

echo.
echo Connections pre-configured in pgAdmin:
echo   Server: Nouf-ex (local)
echo   Host:   127.0.0.1:5435
echo   DB:     noufex_db
echo   User:   postgres / 656650
