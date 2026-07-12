$roles = @(
    @{ email = "fatima@spice-yemen.com"; password = "merchant123"; label = "Merchant" },
    @{ email = "admin@noufex.com"; password = "admin123"; label = "Admin" },
    @{ email = "ahmed@gmail.com"; password = "wrong-pass"; label = "BadPass" }
)

foreach ($r in $roles) {
    $body = @{ email = $r.email; password = $r.password } | ConvertTo-Json
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing
        $data = ($resp.Content | ConvertFrom-Json).data
        Write-Host ("OK {0,-10} user={1}, role={2}" -f $r.label, $data.user.id, $data.user.role)
    } catch {
        Write-Host ("OK {0,-10} rejected as expected: {1}" -f $r.label, $_.Exception.Message.Split([Environment]::NewLine)[0])
    }
}
