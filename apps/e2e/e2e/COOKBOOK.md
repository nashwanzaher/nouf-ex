# Nouf-ex E2E Test Cookbook

> **Audience:** authors of `tests/e2e/phaseNN_*.ps1` scripts.
> **Companion:** [`../docs/testing/templates/PS_TEST_TEMPLATE.ps1`](../../docs/testing/templates/PS_TEST_TEMPLATE.ps1) · [`../docs/testing/templates/PS_TESTHELPERS_REFERENCE.md`](../../docs/testing/templates/PS_TESTHELPERS_REFERENCE.md)
> **Standard:** [ISTQB CTFL v4.0](https://www.istqb.org/) test techniques
> **Last reviewed:** 2026-06-28

Copy-paste recipes for the most common E2E patterns in Nouf-ex.
Each recipe includes: when to use it, the smallest possible code, and the
real bug it caught the first time we wrote it.

---

## 📖 Table of Contents

**Required by gap #13 spec:**
- [R-A: How to test an admin endpoint](#r-a-how-to-test-an-admin-endpoint)
- [R-B: How to test rate-limited endpoints](#r-b-how-to-test-rate-limited-endpoints)
- [R-C: How to handle a stateful flow (create → act → verify)](#r-c-how-to-handle-a-stateful-flow-create--act--verify)
- [R-D: How to test a webhook](#r-d-how-to-test-a-webhook)
- [R-E: How to handle 4xx vs 5xx correctly](#r-e-how-to-handle-4xx-vs-5xx-correctly)

**Extended recipes (16):**
1. [Login + capture a token](#1-login--capture-a-token)
2. [Build an Authorization header](#2-build-an-authorization-header)
3. [Boundary value: numeric field at 0](#3-boundary-value-numeric-field-at-0)
4. [Boundary value: string field at min/max length](#4-boundary-value-string-field-at-minmax-length)
5. [Equivalence partitioning: email field](#5-equivalence-partitioning-email-field)
6. [Ownership guard: cross-user access returns 403](#6-ownership-guard-cross-user-access-returns-403)
7. [Idempotency: DELETE twice → 200 then 404](#7-idempotency-delete-twice--200-then-404)
8. [Idempotency: POST same body twice → merge](#8-idempotency-post-same-body-twice--merge)
9. [State transition: order lifecycle](#9-state-transition-order-lifecycle)
10. [Decision table: 2FA flow](#10-decision-table-2fa-flow)
11. [Test a paginated list endpoint](#11-test-a-paginated-list-endpoint)
12. [Assert a sorted result](#12-assert-a-sorted-result)
13. [Test an upload endpoint (multipart/form-data)](#13-test-an-upload-endpoint-multipartform-data)
14. [Wait for a background job to finish](#14-wait-for-a-background-job-to-finish)
15. [Capture a fixture ID once, reuse across sections](#15-capture-a-fixture-id-once-reuse-across-sections)
16. [Re-run a failed phase with `-KeepGoing` for debugging](#16-re-run-a-failed-phase-with--keepgoing-for-debugging)

---

# Required recipes (gap #13)

## R-A: How to test an admin endpoint

**When:** the endpoint requires `role='admin'` (or any other role-gated route).

**Pattern:** acquire the admin token explicitly, then assert that the customer
gets **403** while the admin gets **200**.

```powershell
. "$PSScriptRoot\helpers\PS_TestHelpers.ps1"

$tokens  = Get-TestTokens                          # customer + merchant + admin
$hdrCust = Get-AuthHeader $tokens.customer
$hdrAdm  = Get-AuthHeader $tokens.admin

# Customer must NOT be able to call an admin-only route
$r = Invoke-ApiRequest GET '/api/admin/users' $hdrCust $null
Assert-Status 'GET /api/admin/users (customer → 403)' $r 403
Assert-JsonField 'body has FORBIDDEN code' $r 'code' 'FORBIDDEN'

# Admin can
$r = Invoke-ApiRequest GET '/api/admin/users' $hdrAdm $null
Assert-Status      'GET /api/admin/users (admin → 200)'     $r 200
Assert-JsonField   'returns data array'                      $r 'data' -NotNull
```

**Variants:**

| Need | Variation |
|------|-----------|
| Admin-only mutation | `Invoke-ApiRequest PATCH '/api/admin/users/3' $hdrCust @{ role = 'merchant' }` → expect 403 |
| Admin disables themselves | assert response is `200` and a follow-up login returns `401` |

---

## R-B: How to test rate-limited endpoints

**When:** verifying that the bucket actually limits traffic (vs the bucket being a no-op).

**Pattern:** the auth bucket is `20 / 15 min`. Hit it 21 times and expect `429`.

```powershell
. "$PSScriptRoot\helpers\PS_TestHelpers.ps1"

# Always start clean
node tests/e2e/reset-rate-limit.cjs | Out-Null

# Burn through login attempts (all hit the auth bucket)
$hitLimitAt = -1
for ($i = 1; $i -le 25; $i++) {
    $r = Invoke-ApiRequest POST '/api/auth/login' @{} @{
        email    = 'no-such-user@example.com'
        password = 'wrong-password'
    }
    if ($r.status -eq 429) {
        $hitLimitAt = $i
        break
    }
}

if ($hitLimitAt -gt 0) {
    Assert-Status ("hit 429 after $hitLimitAt requests") $r 429
} else {
    Write-Host "  Rate limit did NOT trigger — adjust bucket size in rateLimit()." -ForegroundColor Yellow
}
```

**Variants:**

| Need | Variation |
|------|-----------|
| Per-endpoint bucket | `/api/products` and `/api/cart/count` use different buckets — hit each independently |
| Window expiry | wait 15 min, or call `node tests/e2e/reset-rate-limit.cjs` |

---

## R-C: How to handle a stateful flow (create → act → verify)

**When:** the test must create something, then act on it, then verify side-effects
(orders, payments, refunds, cart → checkout, etc.).

**Pattern:** capture an id from the response, use it in the next call, verify the
side-effect.

```powershell
. "$PSScriptRoot\helpers\PS_TestHelpers.ps1"

$tokens  = Get-TestTokens
$hdrCust = Get-AuthHeader $tokens.customer

# Step 1: create the parent entity (an order)
$orderResp = Invoke-ApiRequest POST '/api/orders' $hdrCust @{
    items        = @(@{ productId = 11; quantity = 2; unitPrice = 18000 })
    total        = 36000
    paymentMethod = 'cod'
}
Assert-Status   'POST /api/orders' $orderResp 200
Assert-JsonField 'returns id'      $orderResp 'data.id' -NotNull
$orderId = $orderResp.json.data.id

# Step 2: act on it (initiate a payment)
$payResp = Invoke-ApiRequest POST '/api/payments' $hdrCust @{
    order_id = $orderId
    amount   = 36000
    currency = 'YER'
    method   = 'cod'
}
Assert-Status 'POST /api/payments' $payResp 200

# Step 3: verify side-effect (stock decremented)
$prodResp = Invoke-ApiRequest GET '/api/products/11' @{} $null
Assert-JsonField 'stock decremented' $prodResp 'data.stock' 38
```

**Variants:**

| Need | Variation |
|------|-----------|
| Order → refund | create order → pay → request refund → admin resolves refund |
| Cart → checkout | add to cart → checkout → verify cart empty + order created |
| Login → 2FA | POST `/api/auth/login` → if `requires_2fa`, POST `/api/auth/2fa/verify` |

---

## R-D: How to test a webhook

**When:** the API fires a webhook to an external URL (e.g. payment provider callback).

**Pattern:** stand up a local HTTP listener that captures the call, then trigger
the webhook, then assert what arrived.

```powershell
. "$PSScriptRoot\helpers\PS_TestHelpers.ps1"

# 1. Start a tiny TCP listener on a free port
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:9876/')
$listener.Start()
$captured = $null

# 2. Background job to grab the first request
$job = Start-Job {
    param($listener)
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $body = (New-Object System.IO.StreamReader($req.InputStream)).ReadToEnd()
    return @{ url = $req.Url.AbsolutePath; method = $req.HttpMethod; body = $body }
} -ArgumentList $listener

# 3. Trigger the webhook (e.g. confirm a payment)
$tokens  = Get-TestTokens
$hdrCust = Get-AuthHeader $tokens.customer
$hdrAdm  = Get-AuthHeader $tokens.admin

# ... (create order + payment as in R-C) ...

$r = Invoke-ApiRequest POST '/api/payments/12/confirm' $hdrAdm $null
Assert-Status 'confirm payment (triggers webhook)' $r 200

# 4. Wait for the webhook
$captured = Receive-Job $job -Wait -Timeout 15

# 5. Assert
if ($captured) {
    Assert-Status 'webhook arrived' @{ status = 200; body = $captured.body; json = ($captured.body | ConvertFrom-Json) } 200
    # Verify the payload
    $payload = $captured.body | ConvertFrom-Json
    if ($payload.payment_id -ne 12) { Fail 'webhook payload' 12 $payload.payment_id }
}

$listener.Stop()
```

**Variants:**

| Need | Variation |
|------|-----------|
| Webhook with signature | expect header `X-Signature: <hmac>` and verify it |
| Idempotent webhook | POST same event twice → backend should de-dupe (no double-side-effect) |

---

## R-E: How to handle 4xx vs 5xx correctly

**When:** every assertion. The principle: **4xx is "the request was bad", 5xx is "the server crashed".**

| Status | Means | Test expectation |
|--------|-------|-------------------|
| 400 | Bad Request — body or params failed validation | assert specific code in body, e.g. `'MIXED_STORES'` |
| 401 | Unauthorized — no/invalid token | assert NO body data leaked |
| 403 | Forbidden — token OK but role/owner mismatch | assert body has `code: 'FORBIDDEN'` |
| 404 | Not Found — id doesn't exist | assert `code: 'NOT_FOUND'` if router returns one |
| 409 | Conflict — duplicate / state mismatch | assert `code: 'EMAIL_TAKEN'` etc. |
| 429 | Too Many Requests — rate limit hit | assert bucket cleared, then retry |
| **5xx** | **Server error — actual bug** | **fail loudly with the full body — never silently accept** |

```powershell
# BAD — silently accepts 500 as "expected"
Assert-Status 'POST /api/cart' $r 500

# GOOD — fail loudly on 5xx (server bugs are NEVER expected)
if ($r.status -ge 500 -and $r.status -lt 600) {
    Write-Host "  [FAIL] 5xx unexpected — server bug" -ForegroundColor Red
    Show-ApiResult 'POST /api/cart' $r
    $script:FailCount++
    continue
}
Assert-Status 'POST /api/cart (validation error)' $r 400
```

**Variants:**

| Need | Variation |
|------|-----------|
| Distinguish 400 vs 422 | some routers use 422 for "validation OK but business rule fails" — read the route |
| Catch 503 from upstream | rate limit on a downstream API → 503 + `Retry-After` header → mark test as `SKIP` not `FAIL` |

---

## 1. Login + capture a token

**When:** every phase that needs an authenticated request.

**Pattern:**

```powershell
. "$PSScriptRoot\helpers\PS_TestHelpers.ps1"
$tokens = Get-TestTokens                  # logs in all 3 seeded roles
$hdrCust = Get-AuthHeader $tokens.customer
```

**Why not inline:** `Get-TestTokens` caches at script scope so subsequent
sections don't re-hit `/api/auth/login`. This avoids the rate limiter
(5/min on `/api/auth/login`).

**Bug it caught:** phase 6 re-logged in for every coupon test, hit the
rate limit, and reported 15 phantom failures from the rate limiter, not
the coupon code. Centralising the login fixed it.

---

## 2. Build an Authorization header

**When:** you need to call a protected endpoint and you already have the
token string.

**Pattern:**

```powershell
$hdr = Get-AuthHeader $tokens.merchant
Invoke-ApiRequest GET '/api/merchant/products' $hdr $null
```

**The bug:** PowerShell hashtable with `'Bearer '` (note the trailing
space). Forgetting the space gives a malformed header and the server
returns 401. `Get-AuthHeader` never forgets.

---

## 3. Boundary value: numeric field at 0

**When:** a numeric field has `min > 0` in its schema.

**Pattern (ISTQB CTFL — Boundary Value Analysis):**

```powershell
$r = Invoke-ApiRequest POST '/api/cart' $hdrCust @{
    productId = $p1.id
    quantity  = 0          # invalid: minimum is 1
}
Assert-Status 'POST /api/cart (qty=0)' $r 400

$r = Invoke-ApiRequest POST '/api/cart' $hdrCust @{
    productId = $p1.id
    quantity  = 1          # valid boundary
}
Assert-Status 'POST /api/cart (qty=1)' $r 200
```

**Off-by-one bug it caught:** schema said `quantity >= 1` but the route
allowed `0` because the comparison was `if (qty) {...}` (truthy) rather
than `if (qty < 1)`. BVA at exactly 0 caught it.

---

## 4. Boundary value: string field at min/max length

**When:** a string field has `min(N)` / `max(M)` constraints in zod.

**Pattern:**

```powershell
# Min boundary — should reject empty
$r = Invoke-ApiRequest POST '/api/auth/register' @{} @{
    name     = ''
    email    = 'a@b.com'
    password = 'Aa1!aaaa'
}
Assert-Status 'POST /api/auth/register (empty name)' $r 400

# Max boundary — should reject strings longer than N chars
$longName = 'A' * 300
$r = Invoke-ApiRequest POST '/api/auth/register' @{} @{
    name     = $longName
    email    = 'a@b.com'
    password = 'Aa1!aaaa'
}
Assert-Status 'POST /api/auth/register (300-char name)' $r 400
```

---

## 5. Equivalence partitioning: email field

**When:** a string field has format constraints (regex).

**Pattern (ISTQB CTFL — Equivalence Partitioning):**

```powershell
# Invalid class 1: empty string
$r = Invoke-ApiRequest POST '/api/auth/register' @{} @{
    name = 'X'; email = ''; password = 'Aa1!aaaa'
}
Assert-Status 'register (empty email)' $r 400

# Invalid class 2: missing @
$r = Invoke-ApiRequest POST '/api/auth/register' @{} @{
    name = 'X'; email = 'notanemail'; password = 'Aa1!aaaa'
}
Assert-Status 'register (no @)' $r 400

# Invalid class 3: missing TLD
$r = Invoke-ApiRequest POST '/api/auth/register' @{} @{
    name = 'X'; email = 'a@b'; password = 'Aa1!aaaa'
}
Assert-Status 'register (no TLD)' $r 400

# Valid class
$r = Invoke-ApiRequest POST '/api/auth/register' @{} @{
    name = 'X'; email = 'valid@example.com'; password = 'Aa1!aaaa'
}
Assert-Status 'register (valid email)' $r 201
```

---

## 6. Ownership guard: cross-user access returns 403

**When:** a resource has an `owner_user_id` and the route enforces
`req.user.id === owner`.

**Pattern:**

```powershell
# Customer A creates a resource
$r = Invoke-ApiRequest POST '/api/addresses' $hdrAlice @{
    label = 'Home'; full_name = 'Alice'
}
$addrId = $r.json.data.id

# Customer B (a different logged-in user) tries to read it
$r = Invoke-ApiRequest GET "/api/addresses/$addrId" $hdrBob $null
Assert-Status 'Bob reads Alice address → 403' $r 403
Assert-JsonField 'forbidden code' $r 'code' 'FORBIDDEN'

# Admin can read anything
$r = Invoke-ApiRequest GET "/api/addresses/$addrId" $hdrAdmin $null
Assert-Status 'admin reads Alice address → 200' $r 200
```

**The bug:** a missing `if (req.user.id !== owner && req.user.role !== 'admin')`
let user A read user B's data. This pattern caught it in
`apps/api/src/routes/cart.ts` (A.1).

---

## 7. Idempotency: DELETE twice → 200 then 404

**When:** a DELETE should be safely retried.

**Pattern:**

```powershell
$r = Invoke-ApiRequest DELETE "/api/addresses/$addrId" $hdrAlice $null
Assert-Status 'DELETE /api/addresses/$addrId (first)' $r 200

$r = Invoke-ApiRequest DELETE "/api/addresses/$addrId" $hdrAlice $null
Assert-Status 'DELETE /api/addresses/$addrId (second → 404)' $r 404
```

**The bug:** returning 200 on the second call masked a real-world race
where two parallel DELETEs each "succeeded" and the second one left
the row gone but the test green. The 404 surfaces the race.

---

## 8. Idempotency: POST same body twice → merge

**When:** "add to cart" should increment quantity if the item is already
there, not create a duplicate row.

**Pattern:**

```powershell
# First add → new row
$r = Invoke-ApiRequest POST '/api/cart' $hdrCust @{ productId = $p.id; quantity = 2 }
$firstId = $r.json.data.id
Assert-Status 'add (first)' $r 200

# Same product again → returns the SAME id, quantity now 3
$r = Invoke-ApiRequest POST '/api/cart' $hdrCust @{ productId = $p.id; quantity = 1 }
$secondId = $r.json.data.id
Assert-Status 'add (merge)' $r 200
if ($firstId -eq $secondId) { Pass 'same row id returned' }
else { Fail 'same row id' $firstId $secondId }

# Verify quantity
$r = Invoke-ApiRequest GET "/api/cart/$userId" $hdrCust $null
$item = $r.json.data | Where-Object { $_.id -eq $firstId }
if ($item.quantity -eq 3) { Pass 'quantity merged to 3' }
else { Fail 'merged quantity' 3 $item.quantity }
```

---

## 9. State transition: order lifecycle

**When:** the resource has an explicit state machine (orders, disputes,
shipments).

**Pattern (ISTQB CTFL — State Transition Testing):**

```powershell
# Create the order → state = pending
$order = Invoke-ApiRequest POST '/api/orders' $hdrCust @{ ... }
$orderId = $order.json.data.id
Assert-JsonField 'initial state' $order 'data.state' 'pending'

# Walk valid transitions
$valid = @('pending', 'confirmed', 'processing', 'shipped', 'delivered')
for ($i = 1; $i -lt $valid.Count; $i++) {
    $next = $valid[$i]
    $r = Invoke-ApiRequest PATCH "/api/orders/$orderId/state" $hdrAdmin @{
        state = $next
    }
    Assert-Status "PATCH order → $next" $r 200
}

# Try an invalid transition (delivered → pending)
$r = Invoke-ApiRequest PATCH "/api/orders/$orderId/state" $hdrAdmin @{
    state = 'pending'
}
Assert-Status 'PATCH order delivered → pending (invalid)' $r 409
Assert-JsonField 'invalid transition code' $r 'code' 'INVALID_STATE'
```

---

## 10. Decision table: 2FA flow

**When:** the endpoint behavior depends on a combination of boolean
factors (password correct × TOTP enabled × TOTP valid × backup code used).

**Pattern (ISTQB CTFL — Decision Table Testing):**

```powershell
$cases = @(
    @{ pw='valid';  totp=$false; code=$null;  expect=200; label='pw only' }
    @{ pw='valid';  totp=$true;  code='good'; expect=200; label='pw + valid TOTP' }
    @{ pw='valid';  totp=$true;  code='bad';  expect=401; label='pw + invalid TOTP' }
    @{ pw='valid';  totp=$true;  code=$null;  expect=401; label='pw + 2FA enabled but no code' }
    @{ pw='bad';    totp=$false; code=$null;  expect=401; label='bad pw' }
)
foreach ($c in $cases) {
    $body = @{ email = 'admin@noufex.com'; password = $c.pw }
    if ($c.totp -and $c.code) { $body.totp = $c.code }
    $r = Invoke-ApiRequest POST '/api/auth/login' @{} $body
    Assert-Status "login ($($c.label))" $r $c.expect
}
```

**The bug it caught:** 2FA was being skipped when the user had TOTP
*enrolled* but the request body didn't include the code. The decision
table makes the 4 possible combinations impossible to forget.

---

## 11. Test a paginated list endpoint

**When:** the endpoint supports `?limit=N&offset=M` (or page numbers).

**Pattern:**

```powershell
# Page 1
$r = Invoke-ApiRequest GET '/api/products?limit=10&offset=0' @{} $null
Assert-Status 'page 1' $r 200
$page1 = $r.json.data.products
if ($page1.Count -le 10) { Pass 'page 1 size ≤ 10' }

# Page 2 — IDs must NOT overlap with page 1
$r = Invoke-ApiRequest GET '/api/products?limit=10&offset=10' @{} $null
Assert-Status 'page 2' $r 200
$page2 = $r.json.data.products
$ids1 = $page1 | ForEach-Object { $_.id }
$ids2 = $page2 | ForEach-Object { $_.id }
$overlap = $ids1 | Where-Object { $ids2 -contains $_ }
if (-not $overlap) { Pass 'no ID overlap between pages' }
else { Fail 'no overlap' '<none>' $overlap }

# Last page — total is reachable
$r = Invoke-ApiRequest GET '/api/products?limit=10000' @{} $null
$total = $r.json.data.products.Count
Assert-JsonField 'total count present' $r 'data.total' -NotNull
```

---

## 12. Assert a sorted result

**When:** the endpoint guarantees a sort order (e.g. `?sort=price_asc`).

**Pattern:**

```powershell
$r = Invoke-ApiRequest GET '/api/products?sort=price_asc&limit=20' @{} $null
$prices = $r.json.data.products | ForEach-Object { [decimal]$_.price }
$sorted = $prices | Sort-Object
if (($prices -join ',') -eq ($sorted -join ',')) {
    Pass 'prices are ascending'
} else {
    Fail 'prices ascending' 'sorted' 'unsorted'
}
```

---

## 13. Test an upload endpoint (multipart/form-data)

**When:** the endpoint accepts `multipart/form-data` (image uploads, CSV
imports).

**Pattern:**

```powershell
# Create a 1×1 PNG in memory
$png = [Convert]::FromBase64String(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg=='
)
$tmpFile = Join-Path $env:TEMP "test-$(Get-Random).png"
[System.IO.File]::WriteAllBytes($tmpFile, $png)

# POST it
$r = Invoke-WebRequest -Uri "$script:ApiBaseUrl/api/upload" -Method Post `
    -Headers $hdrCust `
    -Form @{ file = Get-Item $tmpFile; type = 'product' } `
    -UseBasicParsing

Remove-Item $tmpFile -Force
Assert-Status 'POST /api/upload' $r 200
```

---

## 14. Wait for a background job to finish

**When:** the endpoint triggers a job (email send, image processing,
report generation) that completes asynchronously.

**Pattern:**

```powershell
$r = Invoke-ApiRequest POST '/api/reports/generate' $hdrAdmin @{ type = 'sales' }
$jobId = $r.json.data.jobId

# Poll up to 30 times with 1s between
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    $r = Invoke-ApiRequest GET "/api/reports/jobs/$jobId" $hdrAdmin $null
    if ($r.json.data.status -eq 'done') { break }
    if ($r.json.data.status -eq 'failed') {
        Fail "report job failed" 'done' 'failed'
        return
    }
}
Assert-JsonField 'job finished' $r 'data.status' 'done'
```

---

## 15. Capture a fixture ID once, reuse across sections

**When:** you need a real `productId` / `storeId` / `userId` for many
requests.

**Pattern:**

```powershell
# Setup: fetch one product, use it everywhere
$prod = (Invoke-ApiRequest GET '/api/products?limit=10' @{} $null).json.data.products[0]
$productId = $prod.id
$storeId = $prod.store_id

# Section 4: add to cart
$r = Invoke-ApiRequest POST '/api/cart' $hdrCust @{ productId = $productId; quantity = 1 }

# Section 5: PATCH
$r = Invoke-ApiRequest PATCH "/api/cart/$itemId" $hdrCust @{ quantity = 5 }

# Section 6: delete
$r = Invoke-ApiRequest DELETE "/api/cart/$itemId" $hdrCust $null
```

**Tip:** when the resource is store-scoped (cart rule), fetch a SECOND
product from the same store so the test exercises the "same store"
path:

```powershell
$p2 = $prod.data.products | Where-Object { $_.store_id -eq $storeId -and $_.id -ne $productId } | Select-Object -First 1
```

---

## 16. Re-run a failed phase with `-KeepGoing` for debugging

**When:** a phase script crashes early and you want to see which
assertions were reached.

**Pattern:**

```powershell
# Default: stops at first failure
& powershell -File tests/e2e/phase04_cart.ps1

# Continue past failures (still exits non-zero at end, but prints full summary):
& powershell -File tests/e2e/phase04_cart.ps1 -KeepGoing

# Pipe output to a file for later inspection:
& powershell -File tests/e2e/phase04_cart.ps1 -KeepGoing | Tee-Object -FilePath tests/reports/phase04_cart.log
```

This is exactly what `PS_TEST_TEMPLATE.ps1` (A.2) supports out of the box.

---

## 🧰 Helper snippets

### Build a dynamic JSON body with computed IDs

```powershell
$newId = 1
$body = @{
    userId    = $userId
    productId = $productId
    metadata  = @{
        source    = 'e2e-test'
        timestamp = [int][double]::Parse((Get-Date -UFormat %s))
    }
}
$r = Invoke-ApiRequest POST '/api/something' $hdrCust $body
```

### Compare two responses for equality (deep)

```powershell
function Compare-JsonEq($a, $b) {
    $aj = $a | ConvertTo-Json -Depth 10 -Compress
    $bj = $b | ConvertTo-Json -Depth 10 -Compress
    return $aj -eq $bj
}
```

### Generate a unique test email

```powershell
$testEmail = "test-$(Get-Random -Minimum 100000 -Maximum 999999)@example.com"
```

### Read a JSON list length

```powershell
$list = $r.json.data.products
Write-Host "  Got $($list.Count) products"
```

---

## 🚫 Anti-patterns

| Anti-pattern | Why it's bad | Use instead |
|--------------|-------------|-------------|
| Inline `$tokens.customer = Invoke-ApiRequest POST '/api/auth/login'` | Bypasses cache; hits rate limit | `Get-TestTokens` |
| Re-implementing `Call`, `Show`, `Pass`, `Fail` in each phase | 18 copies of the same code | Dot-source `PS_TestHelpers.ps1` |
| `Write-Host "test passed"` instead of `Pass '...'` | No counter, no summary | `Pass`/`Fail` or `Assert-Status` |
| Hardcoded `$userId = 7` | Breaks when seed changes | Read from `/api/auth/me` |
| Asserting on the response body **shape** instead of the status code | Brittle when fields are added | `Assert-Status` first, drill into JSON only for the specific field you care about |
| Forgetting `-KeepGoing` during local dev | Hides downstream assertions | Use `-KeepGoing` until green |

---

## 📚 Related references

- [`docs/testing/templates/PS_TEST_TEMPLATE.ps1`](../../docs/testing/templates/PS_TEST_TEMPLATE.ps1) — start here
- [`docs/testing/templates/PS_TESTHELPERS_REFERENCE.md`](../../docs/testing/templates/PS_TESTHELPERS_REFERENCE.md) — every helper function
- [`docs/testing/templates/JS_INTEGRATION_TEST_TEMPLATE.ts`](../../docs/testing/templates/JS_INTEGRATION_TEST_TEMPLATE.ts) — Vitest equivalent
- [`docs/testing/standards/IEEE-829.md`](../standards/IEEE-829.md) — IEEE 829 §8 mapping
- [`docs/testing/standards/ISTQB-CTFL.md`](../standards/ISTQB-CTFL.md) — techniques used in these recipes
- [`tests/e2e/README.md`](../README.md) — running the suite
---

# 📌 Required recipes (from gap #13 spec)

The 5 recipes below are the **explicit deliverables** requested by `PHASE_TEST_TASKS.md` gap #13.
They are cross-referenced from the extended recipes above.

## R-A: How to test an admin endpoint

**When:** the endpoint requires `role='admin'` (or any other role-gated route).

**Pattern:** acquire the admin token explicitly, then assert that the customer
gets **403** while the admin gets **200**.

```powershell
. "$PSScriptRoot\helpers\PS_TestHelpers.ps1"

$tokens  = Get-TestTokens                          # customer + merchant + admin
$hdrCust = Get-AuthHeader $tokens.customer
$hdrAdm  = Get-AuthHeader $tokens.admin

# Customer must NOT be able to call an admin-only route
$r = Invoke-ApiRequest GET '/api/admin/users' $hdrCust $null
Assert-Status    'GET /api/admin/users (customer → 403)' $r 403
Assert-JsonField 'body has FORBIDDEN code'              $r 'code' 'FORBIDDEN'

# Admin can
$r = Invoke-ApiRequest GET '/api/admin/users' $hdrAdm $null
Assert-Status    'GET /api/admin/users (admin → 200)' $r 200
Assert-JsonField 'returns data array'                  $r 'data' -NotNull
```

**Variants:**

| Need | Variation |
|------|-----------|
| Admin-only mutation | `Invoke-ApiRequest PATCH '/api/admin/users/3' $hdrCust @{ role = 'merchant' }` → expect 403 |
| Admin disables themselves | assert response is `200` and a follow-up login returns `401` |

---

## R-B: How to test rate-limited endpoints

**When:** verifying the bucket actually limits traffic (vs the bucket being a no-op).

**Pattern:** the auth bucket is `20 / 15 min`. Hit it 21 times and expect `429`.

```powershell
. "$PSScriptRoot\helpers\PS_TestHelpers.ps1"

# Always start clean
node tests/e2e/reset-rate-limit.cjs | Out-Null

# Burn through login attempts (all hit the auth bucket)
$hitLimitAt = -1
for ($i = 1; $i -le 25; $i++) {
    $r = Invoke-ApiRequest POST '/api/auth/login' @{} @{
        email    = 'no-such-user@example.com'
        password = 'wrong-password'
    }
    if ($r.status -eq 429) {
        $hitLimitAt = $i
        break
    }
}

if ($hitLimitAt -gt 0) {
    Assert-Status ("hit 429 after $hitLimitAt requests") $r 429
} else {
    Write-Host "  Rate limit did NOT trigger — adjust bucket size." -ForegroundColor Yellow
}
```

**Variants:**

| Need | Variation |
|------|-----------|
| Per-endpoint bucket | `/api/products` and `/api/cart/count` use different buckets — hit each independently |
| Window expiry | wait 15 min, or call `node tests/e2e/reset-rate-limit.cjs` |

---

## R-C: How to handle a stateful flow (create → act → verify)

**When:** the test must create something, then act on it, then verify side-effects
(orders, payments, refunds, cart → checkout, etc.).

**Pattern:** capture an id from the response, use it in the next call, verify the
side-effect.

```powershell
. "$PSScriptRoot\helpers\PS_TestHelpers.ps1"

$tokens  = Get-TestTokens
$hdrCust = Get-AuthHeader $tokens.customer

# Step 1: create the parent entity (an order)
$orderResp = Invoke-ApiRequest POST '/api/orders' $hdrCust @{
    items        = @(@{ productId = 11; quantity = 2; unitPrice = 18000 })
    total        = 36000
    paymentMethod = 'cod'
}
Assert-Status   'POST /api/orders' $orderResp 200
Assert-JsonField 'returns id'      $orderResp 'data.id' -NotNull
$orderId = $orderResp.json.data.id

# Step 2: act on it (initiate a payment)
$payResp = Invoke-ApiRequest POST '/api/payments' $hdrCust @{
    order_id = $orderId
    amount   = 36000
    currency = 'YER'
    method   = 'cod'
}
Assert-Status 'POST /api/payments' $payResp 200

# Step 3: verify side-effect (stock decremented)
$prodResp = Invoke-ApiRequest GET '/api/products/11' @{} $null
Assert-JsonField 'stock decremented' $prodResp 'data.stock' 38
```

**Variants:**

| Need | Variation |
|------|-----------|
| Order → refund | create order → pay → request refund → admin resolves refund |
| Cart → checkout | add to cart → checkout → verify cart empty + order created |
| Login → 2FA | POST `/api/auth/login` → if `requires_2fa`, POST `/api/auth/2fa/verify` |

---

## R-D: How to test a webhook

**When:** the API fires a webhook to an external URL (e.g. payment provider callback).

**Pattern:** stand up a local HTTP listener that captures the call, then trigger
the webhook, then assert what arrived.

```powershell
. "$PSScriptRoot\helpers\PS_TestHelpers.ps1"

# 1. Start a tiny HTTP listener on a free port
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:9876/')
$listener.Start()

# 2. Background job to grab the first request
$job = Start-Job {
    param($listener)
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $body = (New-Object System.IO.StreamReader($req.InputStream)).ReadToEnd()
    return @{ url = $req.Url.AbsolutePath; method = $req.HttpMethod; body = $body }
} -ArgumentList $listener

# 3. Trigger the webhook (e.g. confirm a payment as admin)
$tokens  = Get-TestTokens
$hdrAdm  = Get-AuthHeader $tokens.admin

# ... (create order + payment as in R-C, get $paymentId) ...

$r = Invoke-ApiRequest POST "/api/payments/$paymentId/confirm" $hdrAdm $null
Assert-Status 'confirm payment (triggers webhook)' $r 200

# 4. Wait for the webhook
$captured = Receive-Job $job -Wait -Timeout 15

# 5. Assert
if ($captured) {
    $payload = $captured.body | ConvertFrom-Json
    if ($payload.payment_id -ne $paymentId) {
        Fail 'webhook payment_id' $paymentId $payload.payment_id
    } else {
        Pass 'webhook arrived with correct payment_id'
    }
} else {
    Fail 'webhook arrived' '<within 15s>' '<timed out>'
}

$listener.Stop()
```

**Variants:**

| Need | Variation |
|------|-----------|
| Webhook with signature | expect header `X-Signature: <hmac>` and verify it against the shared secret |
| Idempotent webhook | POST same event twice → backend should de-dupe (no double-side-effect) |

---

## R-E: How to handle 4xx vs 5xx correctly

**When:** every assertion. The principle: **4xx is "the request was bad", 5xx is "the server crashed".**

| Status | Means | Test expectation |
|--------|-------|-------------------|
| 400 | Bad Request — body or params failed validation | assert specific code in body, e.g. `'MIXED_STORES'` |
| 401 | Unauthorized — no/invalid token | assert NO body data leaked |
| 403 | Forbidden — token OK but role/owner mismatch | assert body has `code: 'FORBIDDEN'` |
| 404 | Not Found — id doesn't exist | assert `code: 'NOT_FOUND'` if router returns one |
| 409 | Conflict — duplicate / state mismatch | assert `code: 'EMAIL_TAKEN'` etc. |
| 429 | Too Many Requests — rate limit hit | assert bucket cleared, then retry |
| **5xx** | **Server error — actual bug** | **fail loudly with the full body — never silently accept** |

```powershell
# BAD — silently accepts 500 as "expected"
Assert-Status 'POST /api/cart' $r 500

# GOOD — fail loudly on 5xx (server bugs are NEVER expected)
if ($r.status -ge 500 -and $r.status -lt 600) {
    Write-Host "  [FAIL] 5xx unexpected — server bug" -ForegroundColor Red
    Show-ApiResult 'POST /api/cart' $r
    $script:FailCount++
    continue
}
Assert-Status 'POST /api/cart (validation error)' $r 400
```

**Variants:**

| Need | Variation |
|------|-----------|
| Distinguish 400 vs 422 | some routers use 422 for "validation OK but business rule fails" — read the route |
| Catch 503 from upstream | rate limit on a downstream API → 503 + `Retry-After` header → mark test as `SKIP` not `FAIL` |

---

**See also:**
- Recipe 6 (ownership guard) — covers 403 from a user perspective
- Recipe 9 (state transition) — covers stateful flows end-to-end
- Recipe 8 (idempotency POST) — covers 200/200 same-id pattern
