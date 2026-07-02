Set-Location $PSScriptRoot\app
npm run lint 2>&1 | Out-File -Encoding utf8 "$PSScriptRoot\scripts\_lint.out"
$LASTEXITCODE > "$PSScriptRoot\scripts\_lint_exit.txt"
