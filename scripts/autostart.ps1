# ============================================================================
# Nouf-ex — Windows auto-start script
# ----------------------------------------------------------------------------
# Run this once as Administrator to register Nouf-ex with Task Scheduler.
# It will start Docker Desktop (if not running) and bring up the container
# every time the user logs in.
#
# Usage (elevated PowerShell):
#   powershell -ExecutionPolicy Bypass -File $PSScriptRoot\..\scripts\autostart.ps1 -Register
#   powershell -ExecutionPolicy Bypass -File $PSScriptRoot\..\scripts\autostart.ps1 -Unregister
#   powershell -ExecutionPolicy Bypass -File $PSScriptRoot\..\scripts\autostart.ps1 -RunNow
# ============================================================================
param(
    [switch]$Register,
    [switch]$Unregister,
    [switch]$RunNow
)

$ErrorActionPreference = 'Stop'
$TaskName = 'Nouf-ex Auto-Start'
$ProjectRoot = $PSScriptRoot\..
$LogFile = Join-Path $ProjectRoot 'logs\autostart.log'

# --- helpers --------------------------------------------------------------
function Write-Log($msg) {
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    $line = "[$ts] $msg"
    Write-Host $line
    $logDir = Split-Path $LogFile -Parent
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    Add-Content -Path $LogFile -Value $line
}

function Test-DockerRunning {
    try {
        $null = & docker info 2>&1
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
}

function Wait-DockerRunning([int]$TimeoutSec = 60) {
    $start = Get-Date
    while ((New-TimeSpan -Start $start -End (Get-Date)).TotalSeconds -lt $TimeoutSec) {
        if (Test-DockerRunning) { return $true }
        Write-Log "Docker not ready, retrying in 3s..."
        Start-Sleep -Seconds 3
    }
    return $false
}

function Start-Noufex {
    Write-Log '=== Nouf-ex auto-start run ==='
    if (-not (Test-DockerRunning)) {
        Write-Log 'Docker Desktop not running, attempting to start it...'
        $dockerDesktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
        if (Test-Path $dockerDesktop) {
            Start-Process -FilePath $dockerDesktop
        } else {
            Write-Log "Docker Desktop not found at $dockerDesktop — abort."
            return 1
        }
        if (-not (Wait-DockerRunning 90)) {
            Write-Log 'Docker did not become ready within 90s — abort.'
            return 1
        }
    }
    Write-Log 'Docker is up. Running: docker compose up -d --no-build'
    Push-Location $ProjectRoot
    try {
        & docker compose up -d --no-build 2>&1 | ForEach-Object { Write-Log "  docker: $_" }
        $code = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    if ($code -ne 0) {
        Write-Log "docker compose exited with code $code"
        return $code
    }
    Write-Log 'Nouf-ex container is up.'
    return 0
}

# --- actions --------------------------------------------------------------
if ($Register) {
    if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Error 'Registration requires Administrator privileges. Re-run from an elevated PowerShell.'
        exit 1
    }
    $script = $MyInvocation.MyCommand.Path
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -RunNow"
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'Starts Docker Desktop and brings up the Nouf-ex container at user logon.' -Force | Out-Null
    Write-Log "Registered task '$TaskName' to run at logon."
    exit 0
}

if ($Unregister) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Log "Unregistered task '$TaskName'."
    exit 0
}

if ($RunNow) {
    $code = Start-Noufex
    exit $code
}

# Default: show usage
Write-Host 'Usage:'
Write-Host '  -Register   Register a Task Scheduler entry (requires Administrator)'
Write-Host '  -Unregister Remove the Task Scheduler entry'
Write-Host '  -RunNow     Run the startup logic immediately'
