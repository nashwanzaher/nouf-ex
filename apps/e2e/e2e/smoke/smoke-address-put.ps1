$base = 'http://localhost:3000'
$body = @{ email = 'ahmed@gmail.com'; password = 'customer123' } | ConvertTo-Json
$r = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -ContentType 'application/json' -Body $body -UseBasicParsing
$tok = (($r.Content | ConvertFrom-Json).data).token
$h = @{ Authorization = "Bearer $tok" }

$r = Invoke-WebRequest -Uri "$base/api/addresses" -Method POST -ContentType 'application/json' -Headers $h -Body (@{
    label = 'Original'; full_name = 'Ahmed'; phone = '+967712345671'
    street = 'Original St'; city = "Sana'a"; governorate = "Sana'a"; country = 'YE'
    is_default = $false
} | ConvertTo-Json) -UseBasicParsing
$id = (($r.Content | ConvertFrom-Json).data).id
Write-Host "OK POST: id=$id status=$($r.StatusCode)"

$r = Invoke-WebRequest -Uri "$base/api/addresses/$id" -Method PUT -ContentType 'application/json' -Headers $h -Body (@{
    label = 'Updated'; full_name = 'Ahmed'; phone = '+967712345671'
    street = 'Updated St 123'; city = "Sana'a"; governorate = "Sana'a"; country = 'YE'
    is_default = $false
} | ConvertTo-Json) -UseBasicParsing
$updated = ($r.Content | ConvertFrom-Json).data
Write-Host "OK PUT: status=$($r.StatusCode) label=$($updated.label) street=$($updated.street)"

$r = Invoke-WebRequest -Uri "$base/api/addresses?user_id=2" -Headers $h -UseBasicParsing
$list = (($r.Content | ConvertFrom-Json).data) | Where-Object id -eq $id
Write-Host "OK GET: label=$($list.label) street=$($list.street)"

$tok2 = ((Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -ContentType 'application/json' -Body (@{email='fatima@spice-yemen.com';password='merchant123'} | ConvertTo-Json) -UseBasicParsing).Content | ConvertFrom-Json).data.token
try {
    Invoke-WebRequest -Uri "$base/api/addresses/$id" -Method PUT -ContentType 'application/json' -Headers @{Authorization="Bearer $tok2"} -Body (@{label='hacked'} | ConvertTo-Json) -UseBasicParsing | Out-Null
    Write-Host "FAIL cross-tenant allowed"
} catch {
    $resp = $_.Exception.Response
    $s = if ($resp) { [int]$resp.StatusCode } else { 0 }
    Write-Host "OK cross-tenant blocked: status=$s"
}

Invoke-WebRequest -Uri "$base/api/addresses/$id" -Method DELETE -Headers $h -UseBasicParsing | Out-Null
Write-Host "OK cleanup: deleted id=$id"
