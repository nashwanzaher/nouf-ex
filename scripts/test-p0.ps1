$cookieFile = "$env:TEMP\noufex-csrf-final.txt"
if (Test-Path $cookieFile) { Remove-Item $cookieFile -Force }

$json = '{"email":"admin@noufex.com","password":"656650"}'
$json | Out-File -Encoding utf8 "$env:TEMP\login.json"

$json3 = '{"value":"sk_live_FINAL_test_value"}'
$json3 | Out-File -Encoding utf8 "$env:TEMP\secret.json"

Write-Host "=== Step 1: get CSRF ==="
$resp = curl.exe -s -c $cookieFile -X GET "http://localhost:8080/api/auth/csrf"
Write-Host "  $resp"
$csrf = (Get-Content $cookieFile | Select-String "noufex_csrf	" | ForEach-Object { $_.Line.Split("`t")[-1].Trim() })
Write-Host "  CSRF=$csrf"
Write-Host ""

Write-Host "=== Step 2: login ==="
$resp = curl.exe -s -b $cookieFile -c $cookieFile -X POST "http://localhost:8080/api/auth/login" -H "Content-Type: application/json" -H "x-csrf-token: $csrf" --data-binary "@$env:TEMP\login.json"
Write-Host ("  " + $resp.Substring(0, [Math]::Min(60, $resp.Length)) + "...")
Write-Host ""

$csrf = (Get-Content $cookieFile | Select-String "noufex_csrf	" | ForEach-Object { $_.Line.Split("`t")[-1].Trim() })
Write-Host "=== Step 3: set STRIPE_SECRET_KEY (CSRF=$csrf) ==="
$resp = curl.exe -s -b $cookieFile -X PATCH "http://localhost:8080/api/admin/settings/STRIPE_SECRET_KEY" -H "Content-Type: application/json" -H "x-csrf-token: $csrf" --data-binary "@$env:TEMP\secret.json" -w " [%{http_code}]"
Write-Host "  $resp"
Write-Host ""

Write-Host "=== Step 4: audit log (latest should be REDACTED) ==="
$env:PGPASSWORD = "656650"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h 127.0.0.1 -p 5435 -U postgres -d noufex_db -c "SELECT entity_id, new_values, created_at FROM admin_audit_log WHERE action = 'set_setting' AND entity_id = 'STRIPE_SECRET_KEY' ORDER BY created_at DESC LIMIT 3;"
