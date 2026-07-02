Set-Location $PSScriptRoot\..\app
npm run build 2>&1 | Out-File -Encoding utf8 "$PSScriptRoot\_build.out"
$LASTEXITCODE > "$PSScriptRoot\_build_exit.txt"
