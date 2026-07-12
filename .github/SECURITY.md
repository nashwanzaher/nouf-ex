# Security Policy — Nouf-ex

> **Last updated:** 2026-07-11
> **Scope:** All code in this repository — server (`apps/api/src/`), frontend (`apps/web/src/`), database (`database/`), and infrastructure (`.github/workflows/`).
> **Active conformance baseline:** [docs/README.md §4.5](docs/README.md#45-standards--conformance) ·
> [2026-07-11 audit](docs/README.md#45-standards--conformance) ·
> [Q3 remediation roadmap](docs/README.md#52-roadmap).

## Supported Versions

| Version | Supported | Notes |
|---|---|---|
| `main` | ✅ Active support | All security fixes backported |
| `< 0.1` | ❌ End-of-life | Pre-release, no patches |

Until we tag `v1.0.0`, only `main` is supported.

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

We follow a **coordinated disclosure** model:

1. **GitHub Security Advisories (preferred):**
   <https://github.com/nashwanzaher/nouf-ex/security/advisories/new>
   - Private channel — only the maintainers see it.
   - Allows threaded discussion and a fix-PR linked to the advisory.
   - Closes the loop automatically when the fix lands (CVE / GHSA published).
2. **Email:** if you cannot use GitHub Advisories, request a contact address
   by opening a blank GitHub issue and a maintainer will reply with one.
3. **For highly sensitive issues:** request the maintainer's GPG key from a
   public channel first.

### What to include

- **Affected component** (`apps/api/src/routes/payments.cts` etc.)
- **Attack vector** (network, authenticated, requires-physical, etc.)
- **Steps to reproduce** — minimal `curl` snippet, screenshot, or test code
- **Impact** — what can an attacker do, on whose data, with what privilege
- **Suggested fix** (optional)
- **Disclosure timeline** — when you plan to go public

### SLA

| Stage | Commitment |
|---|---|
| **Acknowledgement** | ≤ 72 hours after submission |
| **Triage** | ≤ 7 days — severity (CVSS), affected versions, repro confirms |
| **Fix timeline** | Critical: ≤ 7 days · High: ≤ 30 days · Medium: ≤ 90 days · Low: best-effort |
| **Coordinated pub.** | We will credit you in the advisory (if you consent) |
| **Status updates** | Every 14 days until closure |

## Security Best Practices Already in Place

> Cross-referenced from [docs/README.md §3.3 — Security model](docs/README.md#33-security-model).

- **Authentication:** HttpOnly-cookie session (`Secure; HttpOnly; SameSite=Strict; Max-Age=7d` JWT, HMAC-SHA256 signed). Scrypt password hashing + optional 2FA/TOTP + scrypt-hashed backup codes.
- **Authorization:** role-based (`customer`/`merchant`/`admin`) + ownership guards on every user-scoped resource.
- **Secrets:** `.env` is gitignored; `.env.example` carries only placeholders. `AUTH_SECRET` and `DB_PASSWORD` are 32+ chars.
- **Transport:** Production expects TLS termination at the proxy. HSTS set.
- **CSP:** nonced + strict-dynamic, deny-by-default, no `unsafe-eval`.
- **Body limit:** `express.json({ limit: '1mb' })` to prevent OOM DoS.
- **Rate limiting:** per-IP for `/api/auth/*` (DB-backed atomic) + per-IP for `/health`/`/ready`.
- **Input validation:** every route uses Zod `.strict()` — unknown fields rejected with 400.
- **Database access:** every write goes through `db.tx(...)` for atomicity; no direct `pg.Pool.query()` outside the wrapper.

## Out of Scope

The following are not eligible for a security bounty:

- Denial-of-service against the single-process in-memory limiter (see [docs/README.md §5.1 — Risk register](docs/README.md#51-risk-register))
- `localhost`-bound data leaks (no multi-tenant model yet)
- Findings against the public demo seed users (intentionally weak, documented)
- Reports against unsupported versions

## Configuration Security Checklist

For self-hosted deployments, see [docs/README.md §2.4 — Deployment](docs/README.md#24-deployment) for the production checklist (AUTH_SECRET, DATABASE_URL, NODE_ENV, TLS termination, backups, DB_SSL).

## Acknowledgements

We thank the following reporters for responsibly disclosing security issues. _(none yet — be the first!)_

---

**See also:** [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [docs/README.md §3.3](docs/README.md#33-security-model)
