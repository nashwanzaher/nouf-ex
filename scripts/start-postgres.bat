@echo off
REM Nouf-ex — Postgres launcher
REM Starts the local Postgres cluster and pgAdmin.
REM The cluster data directory is at C:\Users\zaher\.noufex-pg-data. The
REM superuser password is read from PG_SUPERUSER_PASSWORD in the host's
REM environment (do not hard-code it here). Default listen port: 5435.

if "%PG_SUPERUSER_PASSWORD%"=="" (
    echo [ERR] PG_SUPERUSER_PASSWORD is not set in the environment.
    echo        Set it before running this script, e.g.:
    echo            setx PG_SUPERUSER_PASSWORD "your-secret"
    exit /b 1
)

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
echo   User:   postgres / ^<set via PG_SUPERUSER_PASSWORD^>
