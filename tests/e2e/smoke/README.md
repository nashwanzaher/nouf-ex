# `tests/e2e/smoke/` — Quick Smoke Scripts

> **Purpose:** one-shot manual smoke tests that exercise a single endpoint
> or flow against the **live** API. Distinct from `tests/e2e/phase*.ps1`
> which are the structured regression suite.
> **Standard:** [IEEE 829-2008 §8](https://standards.ieee.org/ieee/829/4987/) (Test Script) ·
> [ISTQB CTFL](https://www.istqb.org/) Smoke Test technique.
> **Last reviewed:** 2026-06-28

---

## 🎯 What is a "smoke" test here?

Smoke tests are **fast, throwaway** PowerShell scripts that exercise one
feature end-to-end so a developer can eyeball whether it works. They
are:

- ✅ Run against the **live** API (`http://localhost:3000`).
- ✅ Output human-readable text (`OK …`, `FAIL …`).
- ✅ Self-contained — no shared helpers, no state setup beyond login.
- ❌ Not part of CI / regression (use `phase*.ps1` for that).
- ❌ Not expected to be exhaustive — they verify the happy path.

| | Smoke (`smoke/`) | Phase (`phase*.ps1`) |
|---|---|---|
| **Runs in CI?** | No (manual only) | Yes (planned) |
| **Speed** | < 5 seconds | 10–60 seconds |
| **Coverage depth** | Happy path | Happy + negative + boundary |
| **Helpers used** | None (inline `Invoke-WebRequest`) | `PS_TestHelpers.ps1` |
| **Assertion style** | `Write-Host "OK ..."` | `Assert-Status` + counter |
| **Exit code** | Always 0 | 0 (pass) / 1 (fail) |

---

## 📂 Inventory (17 scripts)

Sorted by feature area. Each entry shows the script and what it covers.

### Auth & 2FA
| Script | Covers |
|--------|--------|
| `smoke-auth.ps1` | Full login → `/auth/me` → 6 customer endpoints in one shot |
| `smoke-auth-extended.ps1` | Registration, password reset, validation, duplicate-email guard |
| `smoke-2fa.ps1` | 2FA setup, verify, enable/disable |

### Cart & wishlist
| Script | Covers |
|--------|--------|
| `smoke-cart.ps1` | Add → list → patch → remove (full cart flow with correct schema) |
| `smoke-cart-patch.ps1` | PATCH `/api/cart/:id` quantity updates (focus on the patch path) |
| `smoke-crud.ps1` | Cart + wishlist + addresses + notifications CRUD |

### Catalog & orders
| Script | Covers |
|--------|--------|
| `smoke-public.ps1` | Public endpoints (products list, categories, stores) without auth |
| `smoke-merchant-buyer.ps1` | End-to-end merchant↔buyer interaction (store + order) |
| `smoke-mutations.ps1` | Notifications mark-as-read + cart mutations + order state transitions |
| `smoke-remaining.ps1` | Catch-all for flows not covered elsewhere |

### Coupons, reviews, RBAC
| Script | Covers |
|--------|--------|
| `smoke-coupon.ps1` | Coupon create / validate / redeem |
| `smoke-review.ps1` | Add a product review |
| `smoke-review2.ps1` | Review variant (alternate payload) |
| `smoke-rbac.ps1` | Role-based access control: merchant vs buyer denial paths |
| `smoke-roles.ps1` | Cross-role token inspection |

### Other
| Script | Covers |
|--------|--------|
| `smoke-address-put.ps1` | PUT `/api/addresses/:id` (PUT specifically; PATCH is elsewhere) |
| `smoke-spa.ps1` | SPA routes return correct CSP nonce + no stale service-worker cache |

---

## ▶️ Running a single smoke

```powershell
# Make sure the API is up:
cd D:/source/Nouf-ex/app
npm run api      # or: docker compose up -d

# Run one smoke:
powershell -ExecutionPolicy Bypass -File tests/e2e/smoke/smoke-auth.ps1
```

Most scripts print `OK …` for success and `FAIL …` (or throw) on
failure. They do **not** return a non-zero exit code, so they cannot be
used in a CI gate as-is.

---

## ▶️ Running all smoke tests

```powershell
# Loop over every .ps1 in the folder and print a pass/fail summary:
$results = foreach ($s in Get-ChildItem tests/e2e/smoke/*.ps1 | Sort-Object Name) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $out = powershell -ExecutionPolicy Bypass -File $s.FullName 2>&1 | Out-String
    $sw.Stop()
    $hasFail = $out -match 'FAIL|Exception|Error'
    [PSCustomObject]@{
        Script = $s.Name
        Status = if ($hasFail) { '❌ FAIL' } else { '✅ OK' }
        Elapsed = "$($sw.ElapsedMilliseconds) ms"
    }
}
$results | Format-Table -AutoSize
```

The script `scripts/run-all-smoke.ps1` (if it exists) wraps this loop
and writes the report to `tests/reports/smoke_<date>.log`.

---

## ✍️ Authoring a new smoke script

1. **Pick a single feature** to exercise. If you find yourself covering
   3+ endpoints, prefer a `phase*.ps1` instead.
2. **Use inline `Invoke-WebRequest`** — do NOT import `PS_TestHelpers.ps1`.
   Smoke scripts are designed to be self-contained and copy-pasteable.
3. **Prefix with `smoke-`** so the file appears in alphabetical inventories.
4. **First line = one-line comment** describing what the smoke tests
   (this is how the inventory above was generated).
5. **Print `OK …` for success**, `FAIL …` (or throw) on failure.
6. **No counters, no summary block.** Smoke scripts are for humans, not
   machines.

### Minimal template

```powershell
# Test <feature>: <what it verifies>
$base = 'http://localhost:3000'

# 1. Login
$login = Invoke-WebRequest -Uri "$base/api/auth/login" -Method POST `
    -ContentType 'application/json' `
    -Body (@{ email = 'ahmed@gmail.com'; password = 'customer123' } | ConvertTo-Json) `
    -UseBasicParsing
$token = ($login.Content | ConvertFrom-Json).data.token
Write-Host "OK login"

# 2. Exercise the feature
$hdr = @{ Authorization = "Bearer $token" }
$r = Invoke-WebRequest -Uri "$base/api/<endpoint>" -Method GET -Headers $hdr -UseBasicParsing
if ($r.StatusCode -eq 200) {
    Write-Host "OK GET /api/<endpoint>"
} else {
    Write-Host "FAIL GET /api/<endpoint> status=$($r.StatusCode)"
}

# 3. (optional) cleanup
```

### When to graduate a smoke to a phase

If the smoke script grows to:
- 30+ lines,
- covering 3+ endpoints,
- needing ownership / RBAC checks, or
- being run by teammates before every release,

then promote it to `tests/e2e/phaseNN_<topic>.ps1` using
[`docs/testing/templates/PS_TEST_TEMPLATE.ps1`](../../docs/testing/templates/PS_TEST_TEMPLATE.ps1).

---

## 🚫 Anti-patterns

| Anti-pattern | Why bad | Use instead |
|--------------|---------|-------------|
| Adding counters / `Print-Summary` to a smoke | Duplicates phase-script machinery for no value | Promote to a phase |
| Calling a smoke from CI | No exit code → false green | Promote to a phase, then wire into CI |
| Sharing variables between smoke scripts | Breaks the self-contained principle | Each smoke logs in its own copy |
| Asserting on `Write-Host "OK"` with `Select-String` | Brittle | Smoke = visual; phase = automated |

---

## 📚 Related

- [`../README.md`](../README.md) — full E2E suite (phases)
- [`../COOKBOOK.md`](../COOKBOOK.md) — recipes for phase scripts (A.5)
- [`../../docs/testing/templates/PS_TEST_TEMPLATE.ps1`](../../docs/testing/templates/PS_TEST_TEMPLATE.ps1) — phase template (A.2)
- [`../../docs/testing/standards/IEEE-829.md`](../../docs/testing/standards/IEEE-829.md) — IEEE 829 §8 mapping