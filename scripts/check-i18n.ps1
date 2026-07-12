# Check i18n keys
$enJson = Get-Content apps\web\src\i18n\locales\en.json -Raw | ConvertFrom-Json
$arJson = Get-Content apps\web\src\i18n\locales\ar.json -Raw | ConvertFrom-Json
$zhJson = Get-Content apps\web\src\i18n\locales\zh.json -Raw | ConvertFrom-Json

$keys = @(
    'tabEmail', 'tabPhone', 'tabQr',
    'phone', 'phonePlaceholder',
    'detectedEmail', 'detectedPhone', 'invalidPhone',
    'showPassword', 'hidePassword', 'capsLockOn',
    'rememberMe', 'signingIn', 'verifying', 'verify',
    'retryHint', 'changeLanguage', 'backToHome',
    'qrTitle', 'qrHelp',
    'useEmailInstead', 'usePhoneInstead', 'useQr',
    'sslSecured', 'twoFactorAvailable', 'recoverAccess'
)

Write-Host '=== i18n keys verification ==='
foreach ($key in $keys) {
    $enVal = $enJson.authLogin.($key)
    $arVal = $arJson.authLogin.($key)
    $zhVal = $zhJson.authLogin.($key)

    $status = "✅"
    if (-not $enVal) { $status = "❌ en" }
    elseif (-not $arVal) { $status = "❌ ar" }
    elseif (-not $zhVal) { $status = "❌ zh" }

    Write-Host ("  {0} {1,-20} | en: {2,-30} | ar: {3}" -f $status, $key, ($enVal -as [string]), ($arVal -as [string]))
}
