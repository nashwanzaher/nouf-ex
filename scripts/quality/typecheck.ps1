Set-Location $PSScriptRoot\..\..  # repo root
npm run typecheck
$LASTEXITCODE > "$PSScriptRoot\_tc_exit.txt"
