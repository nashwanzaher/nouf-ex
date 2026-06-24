Set-Location "D:\source\Nouf-ex\app"
npm run build 2>&1 | Out-File -Encoding utf8 "D:\source\Nouf-ex\scripts\_build.out"
$LASTEXITCODE > "D:\source\Nouf-ex\scripts\_build_exit.txt"
