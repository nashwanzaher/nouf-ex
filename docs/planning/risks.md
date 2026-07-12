# Nouf-ex — Risk Register

> **Audience:** project managers, tech leads, security reviewers.
> **Last updated:** 2026-07-12
> **Standard:** NIST SP 800-30 (Risk Assessment), ISO 31000 (Risk Management).

This is a **living document**. Update it whenever a new risk is identified, mitigated, or escalated.

---

## Risk scoring matrix

| Likelihood ↓ / Impact → | **Low** (≤1h) | **Medium** (≤1d) | **High** (≤1w) | **Critical** (>1w) |
|---|---|---|---|---|
| **High** (likely this month) | 🟡 Medium | 🟠 High | 🔴 Severe | 🔴 Severe |
| **Medium** (likely this quarter) | 🟢 Low | 🟡 Medium | 🟠 High | 🔴 Severe |
| **Low** (unlikely this year) | 🟢 Low | 🟢 Low | 🟡 Medium | 🟠 High |

---

## Top 10 risks (current)

### 🔴 R-01 — Single PostgreSQL instance (no HA)

- **Description:** The database is a single PostgreSQL 17 instance (external). No replication, no failover.
- **Impact:** DB outage = full platform outage. RPO = last backup, RTO = hours.
- **Likelihood:** Medium (managed services have 99.9% SLA but single-region).
- **Mitigation (planned):** Managed service (RDS Multi-AZ, Aurora, or Cloud SQL HA), automated `pg_dump` to S3 every 6h.
- **Owner:** DevOps
- **Target:** Q3 2026

### 🔴 R-02 — No WAF or rate-limit at edge

- **Description:** The API is exposed directly to the internet. No CDN, no WAF, no per-IP rate limit at the edge.
- **Impact:** DDoS, brute-force, scraping possible.
- **Likelihood:** High (the internet will probe any public endpoint).
- **Mitigation (planned):** Cloudflare / AWS CloudFront in front; nginx with `limit_req_zone`; CSP report-uri for monitoring.
- **Owner:** DevOps
- **Target:** Q3 2026 (with prod deploy)

### 🟠 R-03 — No automated DB backups

- **Description:** `pg_dump` is not scheduled. DB loss = total data loss.
- **Impact:** Catastrophic — entire customer/order/audit history lost.
- **Likelihood:** Low (DB providers usually have snapshots) but impact is critical.
- **Mitigation (planned):** `scripts/backup.sh` running daily + weekly full backup + restore drill quarterly.
- **Owner:** DevOps
- **Status:** Backlog P2 #3 (pending)

### 🟠 R-04 — Auth cookie tied to single session

- **Description:** HttpOnly cookie with 7-day TTL. No refresh-token rotation, no device binding.
- **Impact:** Stolen cookie = 7 days of access. No detection.
- **Likelihood:** Medium (XSS or compromised endpoint).
- **Mitigation:** CSRF + SameSite=Strict already in place. Future: shorter TTL + refresh + device fingerprint.
- **Owner:** Backend
- **Status:** Open

### 🟠 R-05 — npm dependency vulnerabilities

- **Description:** 100+ direct deps. Vulnerabilities discovered weekly (OWASP dep-check, npm audit).
- **Impact:** RCE via vulnerable transitive dep (e.g. event-stream incident).
- **Likelihood:** Medium.
- **Mitigation (active):** Dependabot opens weekly PRs. `npm audit --production` in CI. Critical deps (express, pg, jsonwebtoken) excluded from auto-merge.
- **Owner:** Maintainers
- **Status:** Active

### 🟡 R-06 — i18n drift between ar/en/zh

- **Description:** Three locales maintained manually. Missing keys or untranslated strings common.
- **Impact:** Confusing UX for non-Arabic speakers, accessibility issue.
- **Likelihood:** High (any new feature adds 30+ new strings).
- **Mitigation (planned):** CI check that all 3 locale files have the same keys. Crowdin or similar for translations.
- **Owner:** Frontend
- **Status:** Open

### 🟡 R-07 — No CSP report-uri

- **Description:** CSP is set per-request with nonce, but no `report-uri` to collect violations.
- **Impact:** Cannot detect XSS attempts in the wild.
- **Likelihood:** Low (low usage so far).
- **Mitigation:** Add `report-uri /api/security/csp-report` and a collector.
- **Owner:** Backend
- **Status:** Backlog P3

### 🟡 R-08 — Audit log DLQ on disk

- **Description:** Failed audit writes go to `logs/audit-dlq-*.jsonl` indefinitely. No monitoring.
- **Impact:** Silent failure of audit chain.
- **Likelihood:** Low (only triggers on DB outage).
- **Mitigation:** `log.error` already emits `audit_log_dead_lettered`. Add metric + alert.
- **Owner:** DevOps
- **Status:** Open

### 🟢 R-09 — Seed passwords known

- **Description:** `seed.sql` ships with `admin123`, `customer123`, `merchant123`. Cannot run in production.
- **Impact:** If accidentally exposed, anyone can log in.
- **Likelihood:** Low (gated by `noufex.allow_seed='on'`).
- **Mitigation:** Gate already in place. CI verifies `NODE_ENV !== 'production'` before applying seed.
- **Owner:** Backend
- **Status:** Mitigated

### 🟢 R-10 — Single-tenant (no row-level isolation)

- **Description:** The DB is a single `noufex_db` for all customers (single-tenant). Tenant isolation is not a concern.
- **Impact:** None — by design (Yemen marketplace, one operator).
- **Likelihood:** N/A
- **Mitigation:** None needed.
- **Owner:** N/A
- **Status:** Accepted

---

## Operational risks

### Ops-R-01 — Docker image builds from scratch (no layer cache)

- **Description:** Dockerfile uses `--no-cache` patterns? Verify.
- **Impact:** Slow CI builds (8 min cold).
- **Mitigation:** Use BuildKit cache mounts. (Already implemented? Verify.)
- **Status:** Open

### Ops-R-02 — PostgreSQL on Windows

- **Description:** Dev DB runs on Windows via `postgresql-x64-17`. Service mode is broken.
- **Impact:** Slow dev loop.
- **Mitigation:** Use Docker for dev DB. (Backlog P2 #4)
- **Status:** Open

### Ops-R-03 — No staging environment data refresh

- **Description:** Staging may drift from prod schema/data over time.
- **Impact:** Staging tests pass but prod fails.
- **Mitigation:** Daily `pg_dump` from prod → staging with anonymization.
- **Status:** Open

---

## Security risks

### Sec-R-01 — TOTP secret stored encrypted (or not)?

- **Description:** `users.totp_secret TEXT` — need to verify encryption at rest.
- **Impact:** DB compromise = 2FA bypass.
- **Mitigation:** Apply `pgcrypto` encryption at column level. Document encryption.
- **Status:** Open — verify

### Sec-R-02 — CSP unsafe-inline fallback

- **Description:** Some legacy shadcn primitives may use inline styles.
- **Impact:** CSP relaxation could enable XSS.
- **Mitigation:** Audit all components for `style={{}}` usage; prefer CSS classes.
- **Status:** Open

### Sec-R-03 — No MFA enforcement for admin

- **Description:** Admins are not required to enable 2FA.
- **Impact:** Admin account compromise = full platform takeover.
- **Mitigation:** Force 2FA enrollment for `role='admin'` on first login.
- **Status:** Backlog P2

---

## Compliance risks

### Comp-R-01 — GDPR (if expanding to EU)

- **Description:** No data export, no account deletion, no consent flow.
- **Impact:** Cannot serve EU customers legally.
- **Mitigation:** Add `/api/me/export`, `/api/me/delete`, consent banner.
- **Status:** Open (not yet relevant)

### Comp-R-02 — PCI-DSS (if accepting cards directly)

- **Description:** Currently routes payments via Stripe/Paymob (PCI-compliant by delegation).
- **Impact:** If we ever store card numbers, we need PCI audit.
- **Mitigation:** Never store card numbers; rely on Stripe Checkout / Paymob iframe.
- **Status:** Compliant by design

---

## Risk tracking

- All risks reviewed monthly
- High/Critical risks surface in sprint planning
- Risks moved to BACKLOG when mitigation becomes a task

See [`BACKLOG.md`](../../docs/BACKLOG.md) for risk-derived work items.

---

## See also

- [Architecture overview](../architecture/overview.md)
- [Security model](../architecture/security.md)
- [BACKLOG](../../docs/BACKLOG.md)
- [CHANGELOG](../../CHANGELOG.md)
