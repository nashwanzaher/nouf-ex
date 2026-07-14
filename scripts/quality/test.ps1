Set-Location $PSScriptRoot\..\..  # repo root
npm run test --workspaces --if-present 2>&1 | Out-File -Encoding utf8 "$PSScriptRoot\_test.out"
$LASTEXITCODE > "$PSScriptRoot\_test_exit.txt"
