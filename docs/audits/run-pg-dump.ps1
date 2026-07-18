$env:PGPASSWORD = '656650'
$stamp = (Get-Date -Format 'yyyyMMdd-HHmmss')
$backup = "docs/audits/db-backup-noufex_db-$stamp.sql"
$pgdump = 'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe'
& $pgdump --host=127.0.0.1 --port=5435 --username=postgres --dbname=noufex_db --no-owner --no-privileges --quote-all-identifiers --file $backup 2>&1 | Select-Object -Last 6 | ForEach-Object { Write-Output $_ }
if (Test-Path -LiteralPath $backup) {
    $size = (Get-Item -LiteralPath $backup).Length
    $sha = (Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash
    $lines = (Get-Content -LiteralPath $backup).Count
    Write-Output "BACKUP=$backup"
    Write-Output "SIZE_BYTES=$size"
    Write-Output "SHA256=$sha"
    Write-Output "LINES=$lines"
    Write-Output "FIRST_3:"
    Get-Content -LiteralPath $backup -TotalCount 3 | ForEach-Object { Write-Output $_ }
    Write-Output "LAST_3:"
    Get-Content -LiteralPath $backup | Select-Object -Last 3 | ForEach-Object { Write-Output $_ }
    $secret = (Select-String -LiteralPath $backup -Pattern '656650|admin123|customer123|merchant123' -AllMatches).Count
    $ph = (Select-String -LiteralPath $backup -Pattern 'scrypt\$' -AllMatches).Count
    $iu = (Select-String -LiteralPath $backup -Pattern 'INSERT INTO public\.users' -AllMatches).Count
    $ist = (Select-String -LiteralPath $backup -Pattern 'INSERT INTO public\.stores' -AllMatches).Count
    $crt = (Select-String -LiteralPath $backup -Pattern 'CREATE DATABASE' -AllMatches).Count
    $trn = (Select-String -LiteralPath $backup -Pattern 'TRUNCATE' -AllMatches).Count
    Write-Output "SECRET_HITS=$secret"
    Write-Output "PASSWORD_HASHES=$ph"
    Write-Output "INSERT_USERS=$iu"
    Write-Output "INSERT_STORES=$ist"
    Write-Output "CREATE_DATABASE=$crt"
    Write-Output "TRUNCATE=$trn"
    $destSha = (Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash
    $destSize = (Get-Item -LiteralPath $backup).Length
    $metaPath = $backup + '.sha256'
    Set-Content -LiteralPath $metaPath -Value "$destSha  $backup`nsize=$destSize"
    Write-Output "META=$metaPath"
} else {
    Write-Output 'BACKUP_FAILED'
}
