@echo off
REM ============================================================================
REM scripts/start-api.bat (SECURE REWRITE 2026-07-03)
REM
REM SECURITY: this script previously hard-coded a live DB password and
REM AUTH_SECRET (HMAC signing key). That leak was the worst credential
REM exposure in the repo and was already in git history. The leaked
REM secrets MUST be rotated:
REM
REM   1. Rotate the noufex_app PostgreSQL password in the DB cluster.
REM      Example (psql):
REM          ALTER USER noufex_app WITH PASSWORD '...';
REM      Then update .env (which is gitignored) accordingly.
REM
REM   2. Generate a new AUTH_SECRET (>=32 chars). Example:
REM          node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
REM      Then update .env with the new value.
REM
REM   3. PURGE the old secrets from git history. See docs/operations/
REM      for the recommended `git filter-repo` command (force-push
REM      required; coordinate with all contributors).
REM
REM USAGE: this script now sources credentials from .env (gitignored).
REM Do NOT edit .env to add live secrets — only use .env.example as a
REM template and fill in real values locally.
REM ============================================================================

REM Default PORT/HOST if not in .env
if not defined API_PORT set API_PORT=3000
if not defined HOST set HOST=0.0.0.0
if not defined NODE_ENV set NODE_ENV=production
if not defined SERVE_STATIC set SERVE_STATIC=true

REM Add Node.js to PATH
set PATH=C:\Users\%USERNAME%\AppData\Local\Programs\nodejs;%PATH%

REM Ensure .env exists. .env is gitignored — copy from .env.example on
REM first checkout, then fill in real values locally.
if not exist "..\\.env" (
    echo [ERROR] ..\\.env not found.
    echo Copy ..\\.env.example to ..\\.env and fill in the secrets locally.
    exit /b 1
)

REM Load .env into the current cmd process so tsx inherits them.
REM Using a small inline script (avoids needing extra deps like dotenv-cli).
for /f "usebackq tokens=1,* delims==" %%a in ("..\\.env") do (
    REM skip blank lines and comments
    if not "%%a"=="" if not "%%a:~0,1"=="#" set "%%a=%%b"
)

cd /d "%~dp0..\\app"

REM Run with --env-file so Node 20+'s built-in env loader reads .env
REM in addition to the process env we just populated.
.\node_modules\.bin\tsx.cmd --env-file=..\\.env server/index.ts