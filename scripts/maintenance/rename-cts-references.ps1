# Bulk update .cts -> .ts in import statements
Get-ChildItem -Recurse -File -Path 'app\server' -Include '*.ts' | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $newContent = $content -replace "from\s+(['" + [char]34 + '][^' + [char]39 + [char]34 + ']+)\.cts(['" + [char]34 + [char]39 + "])", 'from $1.ts$2'
    if ($newContent -ne $content) {
        Set-Content -Path $_.FullName -Value $newContent -NoNewline
        Write-Host "Updated: $($_.FullName -replace '.+\\nouf-ex\\','')"
    }
}
Write-Host '---DONE---'
