$email = "ahmed@gmail.com"
$password = "customer123"
$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
$loginResp = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -UseBasicParsing
$token = (($loginResp.Content | ConvertFrom-Json).data).token
$headers = @{ Authorization = "Bearer $token" }

$r = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/2fa/setup" -Method POST -Headers $headers -UseBasicParsing
$status = $r.StatusCode
$data = ($r.Content | ConvertFrom-Json).data
Write-Host "OK 2fa/setup: status=$status, secret_len=$(([string]$data.secret).Length), otpauth=$(([bool]$data.otpauth))"
Write-Host "  qrDataUrl_len=$(([string]$data.qrDataUrl).Length)"
