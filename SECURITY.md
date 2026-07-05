# Security Policy — Nouf-ex

> **Last updated:** 2026-07-02
> **Scope:** All code in this repository — server (`app/server/`), frontend
> (`app/src/`), database schema (`database/`), and infrastructure (`.github/workflows/`).

## Supported Versions

| Version | Supported          | Notes                                  |
| ------- | ------------------ | -------------------------------------- |
| `main`  | ✅ Active support  | All security fixes backported          |
| `< 0.1` | ❌ End-of-life     | Pre-release, no patches                |

Until we tag `v1.0.0`, only `main` is supported. Older releases (e.g. `0.1.0`)
are end-of-life and will not receive security updates — please upgrade.

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

A high-quality report speeds up triage. Please include as much of the following
as you can:

- **Affected component** (`server/routes/payments.cts` etc.)
- **Attack vector** (network, authenticated, requires-physical, etc.)
- **Steps to reproduce** — minimal `curl` snippet, screenshot, or test code
- **Impact** — what can an attacker do, on whose data, with what privilege
- **Suggested fix** (optional — maintainers are grateful for patches)
- **Disclosure timeline** — when you plan to go public, if at all

### What you can expect

| Stage                | Our commitment                                                |
| -------------------- | ------------------------------------------------------------- |
| **Acknowledgement**  | ≤ 72 hours after submission                                   |
| **Triage**           | ≤ 7 days — severity (CVSS), affected versions, repro confirms |
| **Fix timeline**     | Critical: ≤ 7 days · High: ≤ 30 days · Medium: ≤ 90 days · Low: best-effort |
| **Coordinated pub.** | We will credit you in the advisory (if you consent).          |
| **Status updates**   | Every 14 days until closure, even if no progress             |

If we believe a report is out of scope, low-quality, or a duplicate, we will
say so and explain why.

## Out of Scope

The following are **not** eligible for a security bounty and should be
reported through normal GitHub Issues instead:

- Denial-of-service against the in-memory rate limiter (single-process; see
  [`docs/planning/risks.md`](docs/planning/risks.md) §1 for the scaling plan
  and risk acceptance)
- Rate-limit cascade between PHASE test scripts (test-infra bug, documented)
- `localhost`-bound data leaks (no multi-tenant model yet)
- Findings from the public demo dataset (the seed users in
  `database/seed.sql` are intentionally weak — documented)
- Reports against unsupported versions

## Security Best Practices Already in Place

> Cross-referenced from [`docs/architecture/security.md`](docs/architecture/security.md)
> (the canonical security reference). This is a _summary_, not the source of
> truth.

- **Authentication**: HMAC-signed JWT (HS256) + scrypt password hashing +
  optional 2FA/TOTP + backup codes. No session cookies (CSRF-proof by
  design).
- **Authorization**: role-based access (`customer`/`merchant`/`admin`) +
  ownership guards on every user-scoped resource (`app/server/middleware.ts`).
- **Secrets**: `.env` is gitignored; `.env.example` carries only placeholders.
  AUTH_SECRET and DB_PASSWORD are 32+ chars.
- **Transport**: Production expects TLS termination at the proxy. HSTS set.
- **CSP**: `securityHeaders` middleware sets a deny-by-default CSP with no
  `unsafe-eval`.
- **Body limit**: `express.json({ limit: '1mb' })` to prevent OOM DoS (see
  `app/server/index.ts` SECURITY comment — was tightened from 10MB after the
  M-1 audit finding).
- **Rate limiting**: per-user (100/60 s) for `/api/*` + per-IP (30/s) for
  `/health`/`/ready`.
- **Input validation**: every route uses Zod `.strict()` — unknown fields
  rejected with 400.
- **Database access**: every write goes through `db.tx(...)` for atomicity;
  no direct `pg.Pool.query()` outside the wrapper.

## Configuration Security Checklist

For self-hosted deployments:

- [ ] `AUTH_SECRET` is ≥ 32 chars random — generate with
      `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
- [ ] `DB_PASSWORD` is unique to this deployment — never reuse a personal
      password.
- [ ] `NODE_ENV=production` is set before `npm run api:build`.
- [ ] `DATABASE_URL` matches the credentials in `database/roles.sql`
      (`noufex_app` role, _never_ `postgres` superuser for the app).
- [ ] Behind a TLS-terminating proxy (nginx, Caddy, ALB). See
      [`docs/operations/deployment.md`](docs/operations/deployment.md).
- [ ] Database backups run nightly and are encrypted at rest
      ([`docs/operations/backup-restore.md`](docs/operations/backup-restore.md)).
- [ ] `DB_SSL=true` when the DB is in another network/VPC.

## Acknowledgements

We thank the following reporters for responsibly disclosing security issues
(see [`docs/architecture/security.md`](docs/architecture/security.md) §15 for
the full list):

_(none yet — be the first!)_

---

**See also:** [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) ·
[`CONTRIBUTING.md`](CONTRIBUTING.md) ·
[`docs/architecture/security.md`](docs/architecture/security.md)
