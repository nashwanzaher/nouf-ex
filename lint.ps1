Set-Location "D:\source\Nouf-ex\app"
npm run lint 2>&1 | Out-File -Encoding utf8 "D:\source\Nouf-ex\scripts\_lint.out"
$LASTEXITCODE > "D:\source\Nouf-ex\scripts\_lint_exit.txt"
