$env:PGPASSWORD = '656650'
$pg = 'C:\Program Files\PostgreSQL\17\bin'
$exists = & "$pg\psql.exe" --host=127.0.0.1 --port=5435 --username=postgres --dbname=postgres --tuples-only --no-align --command "SELECT 1 FROM pg_database WHERE datname='noufex_clean_verify'" 2>&1
if ($LASTEXITCODE -ne 0) { Write-Output "PSQL_FAILED=$LASTEXITCODE"; exit 1 }
if ($exists -match '^1$') {
    Write-Output "STATUS=EXISTS"
} else {
    & "$pg\createdb.exe" --host=127.0.0.1 --port=5435 --username=postgres --owner=postgres noufex_clean_verify 2>&1 | ForEach-Object { Write-Output $_ }
}
& "$pg\psql.exe" --host=127.0.0.1 --port=5435 --username=postgres --dbname=postgres --tuples-only --no-align --command "SELECT datname,pg_size_pretty(pg_database_size(datname)) FROM pg_database WHERE datname IN ('noufex_db','noufex_clean_verify') ORDER BY datname" 2>&1 | ForEach-Object { Write-Output "DB_INFO=$_" }
