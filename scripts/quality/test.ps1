Set-Location $PSScriptRoot\..\app
npm test 2>&1 | Out-File -Encoding utf8 "$PSScriptRoot\_test.out"
$LASTEXITCODE > "$PSScriptRoot\_test_exit.txt"
