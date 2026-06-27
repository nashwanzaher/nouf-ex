# PS_TestHelpers.ps1 — Function Reference

> **Source of truth:** [`tests/e2e/helpers/PS_TestHelpers.ps1`](../../../tests/e2e/helpers/PS_TestHelpers.ps1)
> **Audience:** authors of `tests/e2e/phaseNN_*.ps1` scripts.
> **Companion:** [`PS_TEST_TEMPLATE.ps1`](PS_TEST_TEMPLATE.ps1) (A.2)
> **Last reviewed:** 2026-06-28

This document is the canonical reference for every public function exported
by `PS_TestHelpers.ps1`. It complements (not replaces) the inline
comment-block headers in the source file.

---

## 📦 Loading the helpers

```powershell
# From tests/e2e/phaseNN_*.ps1 (canonical location):
. "$PSScriptRoot\helpers\PS_TestHelpers.ps1"

# The template (PS_TEST_TEMPLATE.ps1) auto-discovers 3 layouts — see it
# for the resilient dot-source pattern.
```

After dot-sourcing:

- `$script:ApiBaseUrl` is set from `$env:NOUFEX_API_BASE` (falls back to
  `http://localhost:3000`).
- `$script:PassCount`, `$script:FailCount`, `$script:Failures` are
  zero-initialized.

---

## 🔧 Public API (8 functions)

| # | Function | Purpose |
|---|----------|---------|
| 1 | `Invoke-ApiRequest` | Single HTTP call with structured response |
| 2 | `Show-ApiResult` | One-line result printer |
| 3 | `Assert-Status` | Pass/Fail on HTTP status code |
| 4 | `Assert-JsonField` | Pass/Fail on a JSON field value |
| 5 | `Get-TestTokens` | Cached login for the 3 seeded roles |
| 6 | `Get-AuthHeader` | Bearer-header builder |
| 7 | `Print-Summary` | Final PASS/FAIL totals |
| 8 | `Reset-Counters` | Reset counters between sub-suites |

---

## 1. `Invoke-ApiRequest`

Performs a single HTTP call and returns a structured response envelope
that the assertion helpers consume.

### Signature

```powershell
function Invoke-ApiRequest {
    param(
        [Parameter(Mandatory)] [string] $Method,   # GET | POST | PUT | PATCH | DELETE
        [Parameter(Mandatory)] [string] $Path,     # e.g. '/api/auth/login' (no host)
        [hashtable] $Headers = @{},                # e.g. @{ Authorization = "Bearer $tok" }
        $Body = $null                              # Hashtable OR $null
    )
}
```

### Returns

A hashtable with four keys:

| Key | Type | Meaning |
|-----|------|---------|
| `ok` | `[bool]` | `true` if HTTP request succeeded (any 2xx-4xx) |
| `status` | `[int]` | HTTP status code (0 if network error) |
| `body` | `[string]` | Raw response body (possibly empty) |
| `json` | `[PSObject]` | Parsed JSON (or `$null` on parse error / empty body) |

### Example

```powershell
$r = Invoke-ApiRequest POST '/api/auth/login' @{} @{
    email    = 'ahmed@gmail.com'
    password = 'customer123'
}
if ($r.ok -and $r.json.data.token) {
    $token = $r.json.data.token
}
```

### Behavior notes

- **Timeout:** 15 seconds per call (`TimeoutSec = 15`).
- **HTTP errors** (4xx / 5xx) DO NOT throw — they populate `ok=$false`
  and `status=<code>`. The caller must branch on `ok`.
- **Network errors** (DNS, refused) set `status=0`.
- **Empty bodies** keep `json=$null` (no spurious `ConvertFrom-Json`
  error).

---

## 2. `Show-ApiResult`

Compact one-line result printer — useful when you want to *see* a
response without asserting on it.

### Signature

```powershell
function Show-ApiResult {
    param(
        [Parameter(Mandatory)] [string] $Label,
        [Parameter(Mandatory)] $Result     # Hashtable from Invoke-ApiRequest
    )
}
```

### Output

```
  <label-padded-to-60>  status=<code>  <body-preview>
```

The body is truncated to 120 characters.

### Example

```powershell
$r = Invoke-ApiRequest GET '/api/products?limit=5' @{} $null
Show-ApiResult 'list first 5 products' $r
# → list first 5 products                            status=200  {"success":true,"data":{"products":[...
```

---

## 3. `Assert-Status`

Pass/Fail assertion on the HTTP status code. Increments `$script:PassCount`
or `$script:FailCount` automatically.

### Signature

```powershell
function Assert-Status {
    param(
        [Parameter(Mandatory)] [string] $Label,
        [Parameter(Mandatory)] $Result,    # Hashtable from Invoke-ApiRequest
        [Parameter(Mandatory)] [int]    $Expected
    )
}
```

### Output

- **Pass** → `  [PASS] <label>                                        status=<code>` (green)
- **Fail** → `  [FAIL] <label>                                        expected=<exp> actual=<code>`
            plus a full `Show-ApiResult` line so the failure body is visible.

### Example

```powershell
$r = Invoke-ApiRequest GET '/api/health' @{} $null
Assert-Status 'GET /api/health (no auth)' $r 200

$r = Invoke-ApiRequest GET '/api/cart/7' @{} $null
Assert-Status 'GET /api/cart/7 (no auth → 401)' $r 401
```

### Failure-list output

Failures are appended to `$script:Failures` for `Print-Summary` to
display at the end:

```powershell
$script:Failures += @{
    Label    = $Label
    Expected = $Expected
    Actual   = $Result.status
    Body     = $Result.body
}
```

---

## 4. `Assert-JsonField`

Pass/Fail assertion on a JSON field value. Supports dot-path navigation
(`data.user.email`) and a `NotNull` switch.

### Signature

```powershell
function Assert-JsonField {
    param(
        [Parameter(Mandatory)] [string] $Label,
        [Parameter(Mandatory)] $Result,    # Hashtable from Invoke-ApiRequest
        [Parameter(Mandatory)] [string] $Path,    # dot-path, e.g. 'data.id'
        $Expected = $null,
        [switch] $NotNull
    )
}
```

### Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Equality** | `$Expected` is non-null | Pass if `$r.json.<path>` equals `$Expected` |
| **NotNull** | `-NotNull` switch | Pass if `$r.json.<path>` is non-null AND non-empty string |
| **Both** | Both supplied | Equality wins (NotNull is ignored) |
| **Neither** | Error | Function silently no-ops (caller bug) |

### Example

```powershell
$r = Invoke-ApiRequest POST '/api/cart' $hdrCust @{ productId = 1; quantity = 2 }

# Field is present and non-null:
Assert-JsonField 'POST returns data.id' $r 'data.id' -NotNull

# Field equals an expected value:
Assert-JsonField 'POST returns quantity=2' $r 'data.quantity' 2

# Drill into nested objects:
$r2 = Invoke-ApiRequest GET '/api/products/1' @{} $null
Assert-JsonField 'product name_en set' $r2 'data.name_en' -NotNull
Assert-JsonField 'product store id=2' $r2 'data.store_id' 2
```

### Caveats

- **Missing path** (e.g. `data.foo` when `data` is `$null`) fails
  gracefully — no exception is thrown.
- **Arrays** at the path terminate the drill (you can't index `data.0.name`
  — use `data[0].name` only via PowerShell array indexing outside this helper).
- **Numbers vs strings**: `42` (int) does not equal `"42"` (string). Pass
  the same type the API returns (use `Write-Host $r.json.data.id` first to
  confirm).

---

## 5. `Get-TestTokens`

Logs in the 3 seeded roles (`customer`, `merchant`, `admin`) and returns
a hashtable of bearer tokens. **Cached at script scope** — only the
first call hits the API.

### Signature

```powershell
function Get-TestTokens
# (no parameters)
```

### Returns

```powershell
@{
    customer = '<jwt>'
    merchant = '<jwt>'
    admin    = '<jwt>'
}
```

Roles where login fails are **omitted** from the hashtable. Always check
`.ContainsKey('customer')` before using a token.

### Credentials used (from seed.sql)

| Role | Email | Password |
|------|-------|----------|
| `customer` | `ahmed@gmail.com` | `customer123` |
| `merchant` | `fatima@spice-yemen.com` | `merchant123` |
| `admin` | `admin@noufex.com` | `admin123` |

### Example

```powershell
$tokens = Get-TestTokens
if (-not $tokens.ContainsKey('customer')) {
    throw 'Customer login failed — check that the DB is seeded.'
}
$hdrCust = Get-AuthHeader $tokens.customer
```

---

## 6. `Get-AuthHeader`

Convenience wrapper that returns the `Authorization` header hashtable
for a given token.

### Signature

```powershell
function Get-AuthHeader {
    param([Parameter(Mandatory)] [string] $Token)
}
```

### Example

```powershell
$hdr = Get-AuthHeader $tokens.customer
# → @{ Authorization = 'Bearer eyJ...' }

Invoke-ApiRequest GET '/api/cart/7' $hdr $null
```

---

## 7. `Print-Summary`

Prints the final PASS/FAIL totals and a list of failures (if any).
**Always call this at the end of a phase script.**

### Signature

```powershell
function Print-Summary {
    param([string] $PhaseName)
}
```

### Output

```
════════════════════════════════════════════════════════════════
  PHASE SUMMARY: <PhaseName>
  Total:  <N>
  Passed: <N>
  Failed: <N>

  Failures:
    - <label>: expected=<exp> actual=<code>
    - <label>: expected=<exp> actual=<code>
════════════════════════════════════════════════════════════════
```

### Example

```powershell
Print-Summary 'PHASE 4: Cart'
```

---

## 8. `Reset-Counters`

Re-initializes the counter globals. Use between sub-suites so that a
section's pass/fail total isn't mixed with the previous section.

### Signature

```powershell
function Reset-Counters
# (no parameters)
```

### Example

```powershell
Reset-Counters
$r = Invoke-ApiRequest GET '/api/health' @{} $null
Assert-Status 'GET /api/health' $r 200

Print-Summary 'PHASE 4a: Health check'
# Total is the count for THIS section only, not the whole script.

Reset-Counters
$r = Invoke-ApiRequest GET '/api/products' @{} $null
Assert-Status 'GET /api/products' $r 200

Print-Summary 'PHASE 4b: Catalog'
```

---

## ⚠️ Common pitfalls

| Pitfall | Fix |
|---------|-----|
| `$script:ApiBaseUrl` doesn't change after I set `$env:NOUFEX_API_BASE` | Set the env var BEFORE dot-sourcing the helper, not after |
| `Invoke-ApiRequest` returns `status=0` | API is unreachable — check `Test-NetConnection localhost -Port 3000` |
| `Assert-JsonField 'data.id' $r 5` fails silently | Pass `-NotNull` instead of an `$Expected` value |
| `Print-Summary` shows "Failed: 0" but `exit 1` | `$ErrorActionPreference='Stop'` aborted the script before any assertion ran |
| All my auth-gated calls return 401 | `AUTH_SECRET` in `.env` is too short (< 32 chars); check `app/.env` |

---

## 🔗 Related

- [`PS_TEST_TEMPLATE.ps1`](PS_TEST_TEMPLATE.ps1) — IEEE 829 §8 template (A.2)
- [`JS_INTEGRATION_TEST_TEMPLATE.ts`](JS_INTEGRATION_TEST_TEMPLATE.ts) — Vitest companion (A.3)
- [`docs/testing/standards/IEEE-829.md`](../standards/IEEE-829.md) — clause-by-clause mapping
- [`docs/testing/standards/ISTQB-CTFL.md`](../standards/ISTQB-CTFL.md) — test techniques used by these helpers
- [`tests/e2e/README.md`](../../../tests/e2e/README.md) — how to run a single phase