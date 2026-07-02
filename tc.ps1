Set-Location $PSScriptRoot\app
npm run typecheck
$LASTEXITCODE > "$PSScriptRoot\scripts\_tc_exit.txt"
