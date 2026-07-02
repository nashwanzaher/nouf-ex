# ============================================================================
# Nouf-ex — install Startup folder shortcut (no admin required)
# ----------------------------------------------------------------------------
# Creates a Windows shortcut in the current user's Startup folder that
# launches scripts/autostart.bat on logon.
# ============================================================================
$ErrorActionPreference = 'Stop'

$Startup = [Environment]::GetFolderPath('Startup')
$ProjectRoot = $PSScriptRoot\..
$BatFile = Join-Path $ProjectRoot 'scripts\autostart.bat'
$Shortcut = Join-Path $Startup 'Nouf-ex Auto-Start.lnk'

if (-not (Test-Path $BatFile)) {
    Write-Error "Missing $BatFile"
    exit 1
}

# Use the Shell COM object to create a real .lnk
$WshShell = New-Object -ComObject WScript.Shell
$ShortcutObj = $WshShell.CreateShortcut($Shortcut)
$ShortcutObj.TargetPath = $BatFile
$ShortcutObj.WorkingDirectory = $ProjectRoot
$ShortcutObj.WindowStyle = 7  # minimized, no window flash
$ShortcutObj.IconLocation = 'shell32.dll,12'  # generic app icon
$ShortcutObj.Description = 'Starts Docker Desktop and brings up the Nouf-ex container.'
$ShortcutObj.Save()

Write-Host "Shortcut created: $Shortcut"
Write-Host "It will run at next logon."
Write-Host ""
Write-Host "To remove: delete the shortcut from $Startup"
