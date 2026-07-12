$body = '{"email":"admin@noufex.com","password":"admin123"}'
$r = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
Write-Host "=== Response Headers ==="
$r.Headers.Keys | ForEach-Object {
    $k = $_
    $v = $r.Headers[$k]
    if ($v -is [array]) {
        $v | ForEach-Object { Write-Host ("  {0}: {1}" -f $k, $_) }
    } else {
        Write-Host ("  {0}: {1}" -f $k, $v)
    }
}
