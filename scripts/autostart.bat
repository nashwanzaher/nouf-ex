@echo off
REM ============================================================================
REM Nouf-ex — Windows Startup folder entry
REM ----------------------------------------------------------------------------
REM Drop a shortcut to this .bat into:
REM   %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
REM It runs at user logon, starts Docker Desktop if needed, and brings the
REM Nouf-ex container up.
REM ============================================================================
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "d:\source\Nouf-ex\scripts\autostart.ps1" -RunNow
