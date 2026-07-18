$env:PGPASSWORD = '656650'
$pg = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
$db = 'noufex_clean_verify'
$conn = "-h127.0.0.1","-p5435","-Upostgres","-d$db","-t","-A"
function Run([string]$sql) {
    $output = & $pg @conn -c $sql 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Output "PSQL_ERROR=$LASTEXITCODE"
        Write-Output $output
        return $null
    }
    return ($output | Where-Object { $_ -is [string] } | ForEach-Object { $_.TrimEnd() }) -join "`n"
}
$tables = @(
    'users','stores','products','orders','order_items','payments','refunds','reviews',
    'addresses','messages','notifications','wishlist','cart_items','store_followers',
    'transactions','store_balance','subscriptions','disputes','delivery_agents',
    'delivery_agent_assignments','coupons','coupon_usage','admin_audit_log',
    'product_images','product_variants','webhook_events','used_jtis',
    'rate_limit_buckets','search_logs','inventory_log','flash_sales',
    'flash_sale_items','loyalty_points','loyalty_transactions','loyalty_config',
    'bundle_deals','bundle_deal_items'
)
Write-Output 'TABLE_COUNTS:'
foreach ($t in $tables) {
    $n = Run "SELECT COUNT(*) FROM public.$t"
    if ($null -ne $n) { Write-Output ("{0,-35} {1}" -f $t, $n) }
}
Write-Output '---'
Write-Output 'REFERENCE_DATA:'
$r = Run "SELECT 'categories=' || (SELECT COUNT(*) FROM public.categories) || ', shipping_methods=' || (SELECT COUNT(*) FROM public.shipping_methods) || ', app_settings=' || (SELECT COUNT(*) FROM public.app_settings) || ', schema_migrations=' || (SELECT COUNT(*) FROM public.schema_migrations)"
if ($r) { Write-Output $r }
Write-Output 'LEAK_CHECKS:'
$a = Run "SELECT COUNT(*) FROM public.users WHERE email IN ('admin@noufex.com') OR password_hash LIKE '%admin123%'"
if ($a) { Write-Output "admin_in_users=$a" }
$d = Run "SELECT COUNT(*) FROM public.users WHERE email = ANY(ARRAY['ahmed@gmail.com','sara@gmail.com','omar@gmail.com','fatima@spice-yemen.com','hassan@dates-yemen.com','mohammed@handicrafts-yemen.com','khalid@electronics-yemen.com','noor@perfume-yemen.com','layla@mokha-coffee.com','ahmed.delivery@noufex.com','mohammed.delivery@noufex.com','sara.delivery@noufex.com'])"
if ($d) { Write-Output "demo_user_emails=$d" }
