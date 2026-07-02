Set-Location $PSScriptRoot\app
npm test 2>&1 | Out-File -Encoding utf8 "$PSScriptRoot\scripts\_test.out"
$LASTEXITCODE > "$PSScriptRoot\scripts\_test_exit.txt"
