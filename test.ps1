Set-Location "D:\source\Nouf-ex\app"
npm test 2>&1 | Out-File -Encoding utf8 "D:\source\Nouf-ex\scripts\_test.out"
$LASTEXITCODE > "D:\source\Nouf-ex\scripts\_test_exit.txt"
