Set-Location $PSScriptRoot\..\app
npm run typecheck
$LASTEXITCODE > "$PSScriptRoot\_tc_exit.txt"
