Set-Location $PSScriptRoot\app
npm run build 2>&1 | Out-File -Encoding utf8 "$PSScriptRoot\scripts\_build.out"
$LASTEXITCODE > "$PSScriptRoot\scripts\_build_exit.txt"
