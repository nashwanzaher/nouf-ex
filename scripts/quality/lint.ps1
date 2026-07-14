Set-Location $PSScriptRoot\..\..  # repo root
npm run lint 2>&1 | Out-File -Encoding utf8 "$PSScriptRoot\_lint.out"
$LASTEXITCODE > "$PSScriptRoot\_lint_exit.txt"
