# E2E test for Notifications PUT /read + Admin PATCH /products
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000'

function Get-Token($email, $password) {
    $r = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST -ContentType 'application/json' -Body (@{email=$email;password=$password} | ConvertTo-Json -Compress) -UseBasicParsing -TimeoutSec 5
    return ($r.Content | ConvertFrom-Json).data.token
}

$total = 0
$ok = 0
$f = 0

function P($method, $ep, $h, $body, $expect) {
    $script:total = $script:total + 1
    try {
        $p = @{Uri = "$base$ep"; Method = $method; Headers = $h; UseBasicParsing = $true; TimeoutSec = 3 }
        if ($body -ne $null) {
            $p['ContentType'] = 'application/json'
            $p['Body'] = ($body | ConvertTo-Json -Compress)
        }
        $r = Invoke-WebRequest @p
        $mark = if ($r.StatusCode -eq $expect) { '✓' } else { '✗' }
        Write-Host "  $mark $($r.StatusCode) $method $ep"
        if ($r.StatusCode -eq $expect) { $script:ok++ } else { $script:f++ }
    } catch {
        $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode.value__ } else { '?' }
        $mark = if ($code -eq $expect) { '✓' } else { '✗' }
        Write-Host "  $mark $code $method $ep"
        if ($code -eq $expect) { $script:ok++ } else { $script:f++ }
    }
}

$ct = Get-Token 'ahmed@gmail.com' 'customer123'
$at = Get-Token 'admin@noufex.com' 'admin123'
$ch = @{Authorization = "Bearer $ct"}
$ah = @{Authorization = "Bearer $at"}

Write-Host "=== NOTIFICATIONS: validation + 404 ==="
P PUT '/api/notifications/abc/read' $ch $null 400
P PUT '/api/notifications/0/read'   $ch $null 400
P PUT '/api/notifications/-1/read'  $ch $null 400
P PUT '/api/notifications/99999/read' $ch $null 404

Write-Host ""
Write-Host "=== NOTIFICATIONS: ownership scoping + idempotency ==="
$listResp = (Invoke-WebRequest -Uri "$base/api/notifications/2" -Headers $ch -UseBasicParsing -TimeoutSec 3).Content | ConvertFrom-Json
Write-Host "  user 2 (ahmed) has $($listResp.data.Count) notifications"
$ownedId = $null
if ($listResp.data.Count -gt 0) {
    $ownedId = $listResp.data[0].id
    Write-Host "  owned notification id: $ownedId"
    P PUT "/api/notifications/$ownedId/read" $ch $null 200
    P PUT "/api/notifications/$ownedId/read" $ch $null 200
    $r = (Invoke-WebRequest -Uri "$base/api/notifications/2" -Headers $ch -UseBasicParsing -TimeoutSec 3).Content | ConvertFrom-Json
    $n = $r.data | Where-Object { $_.id -eq $ownedId } | Select-Object -First 1
    if ($n) {
        Write-Host "  -> id=$($n.id) is_read=$($n.is_read) read_at=$($n.read_at)"
    }
}

Write-Host ""
Write-Host "=== ADMIN PRODUCT PATCH ==="
P PATCH '/api/admin/products/1'     $ah (@{is_active=$true})  200
P PATCH '/api/admin/products/1'     $ah (@{is_featured=$true}) 200
P PATCH '/api/admin/products/1'     $ah (@{is_active=$true; is_featured=$true}) 200
P PATCH '/api/admin/products/1'     $ah (@{})                  400
P PATCH '/api/admin/products/abc'   $ah (@{is_active=$true})  400
P PATCH '/api/admin/products/0'     $ah (@{is_active=$true})  400
P PATCH '/api/admin/products/99999' $ah (@{is_active=$true})  404
P PATCH '/api/admin/products/1'     $ah (@{price=99.99})        400
P PATCH '/api/admin/products/1'     $ah (@{is_active='yes'})   400

Write-Host ""
Write-Host "=== ACCESS CONTROL: customer cannot PATCH admin ==="
P PATCH '/api/admin/products/1' $ch (@{is_active=$true}) 403

Write-Host ""
Write-Host "=== AUDIT LOG: verify entries were written ==="
$r = Invoke-WebRequest -Uri "$base/api/admin/audit-log?action=update_product&limit=3" -Headers $ah -UseBasicParsing -TimeoutSec 3
$j = $r.Content | ConvertFrom-Json
Write-Host "  total update_product entries: $($j.data.total)"
$j.data.log | ForEach-Object { Write-Host "    [$($_.action)] $($_.entity_type) #$($_.entity_id) by user $($_.user_id)" }

Write-Host ""
Write-Host "============================================"
Write-Host "TOTAL: $total | OK: $ok | FAIL: $f"
