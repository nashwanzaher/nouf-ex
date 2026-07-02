# Deployment — Nouf-ex

> **Scope:** Production deployment of the Nouf-ex REST API + SPA.
> **Audience:** DevOps, SRE, release engineers.
> **Last reviewed:** 2026-06-28
> **Standard:** [12-Factor App](https://12factor.net/) · [Docker](https://docs.docker.com/) · [nginx](https://nginx.org/en/docs/) · [Let's Encrypt](https://letsencrypt.org/)

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [Pre-deployment checklist](#2-pre-deployment-checklist)
3. [Environment variables](#3-environment-variables)
4. [nginx reverse proxy](#4-nginx-reverse-proxy)
5. [SSL termination](#5-ssl-termination)
6. [Docker deployment](#6-docker-deployment)
7. [Database deployment](#7-database-deployment)
8. [Blue-green / rolling deployment](#8-blue-green--rolling-deployment)
9. [Health checks](#9-health-checks)
10. [Smoke test after deploy](#10-smoke-test-after-deploy)
11. [Post-deployment verification](#11-post-deployment-verification)
12. [Rollback procedure](#12-rollback-procedure)
13. [Operational runbook](#13-operational-runbook)
14. [References](#14-references)

---

## 1. Architecture overview

```
                ┌─────────────────────────────┐
                │      Internet users          │
                └──────────┬──────────────────┘
                           │ HTTPS (443)
                           ▼
                ┌─────────────────────────────┐
                │  nginx (reverse proxy)        │
                │  - TLS termination            │
                │  - CSP / headers              │
                │  - rate limit (optional)      │
                │  - gzip                       │
                └──────────┬──────────────────┘
                           │ HTTP (3000, internal only)
                           ▼
                ┌─────────────────────────────┐
                │  Docker: Nouf-ex API          │
                │  - Express 5 + tsx            │
                │  - 3000/tcp                   │
                │  - 1 replica (small scale)    │
                └──────────┬──────────────────┘
                           │ TCP/SSL (5432)
                           ▼
                ┌─────────────────────────────┐
                │  PostgreSQL 17 (external)     │
                │  - role: noufex_app           │
                │  - DB: noufex_db              │
                │  - 29 tables + triggers        │
                └─────────────────────────────┘
```

The PostgreSQL server is **external** (not containerized by us). It can be
on the same host, a managed RDS instance, or a separate VM.

---

## 2. Pre-deployment checklist

Run through every item before pushing to production.

### 2.1 Secrets

- [ ] `AUTH_SECRET` is **≥ 32 random chars**. Generate with:
  ```sh
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  ```
- [ ] `AUTH_SECRET` is **different** from staging / dev secrets.
- [ ] `DB_PASSWORD` for `noufex_app` is **rotated in the last 90 days**.
- [ ] `CHANGE_ME_APP` placeholder is **replaced** in `.env`.
- [ ] `.env` is in `.gitignore` (verify: `git check-ignore .env`).
- [ ] No secrets in `docker-compose.yml` env section (use `env_file: .env`).
- [ ] No secrets in CI logs (`grep -ri 'CHANGE_ME\|password' .github/` returns nothing).

### 2.2 Configuration

- [ ] `NODE_ENV=production` (hides error messages in 500 responses).
- [ ] `ALLOWED_ORIGINS` is the production domain only (no localhost).
- [ ] `TRUST_PROXY` is set (`true` / `1` / `loopback` / CIDR list) — required
  for correct `req.ip` behind nginx / k8s.
- [ ] `DB_SSL=true` (secure-by-default; uses TLS to Postgres).
- [ ] `LOG_LEVEL=info` (or `warn` for high-traffic).

### 2.3 Build

- [ ] `npm ci` ran cleanly (no `npm` warnings).
- [ ] `npm run build` succeeded (`dist/` contains hashed assets).
- [ ] Docker image built successfully:
  ```sh
  docker compose build --no-cache
  ```
- [ ] Image scanned with `docker scout` or `trivy` (no HIGH/CRITICAL CVEs).

### 2.4 Database

- [ ] PostgreSQL 17 is running and reachable.
- [ ] `noufex_db` database exists.
- [ ] `noufex_owner`, `noufex_app`, `noufex_readonly` roles exist.
- [ ] `npm run db:setup` ran cleanly on the host (creates schema + seed).
- [ ] `noufex_app` has correct GRANTs (verified via `psql -c '\du noufex_app'`).

### 2.5 Networking

- [ ] Port 443 (HTTPS) is open on the load balancer / nginx.
- [ ] Port 3000 (API) is **internal only** (firewall / SG blocks public access).
- [ ] Port 5432 (Postgres) is **internal only**.
- [ ] DNS A/AAAA records point to the LB / nginx.

---

## 3. Environment variables

### 3.1 Required

| Variable | Example | Purpose |
|----------|---------|---------|
| `AUTH_SECRET` | `<43-char base64url>` | HMAC-SHA256 signing key for bearer tokens. **Must be ≥ 32 chars.** |
| `DATABASE_URL` | `postgresql://noufex_app:CHANGE_ME@db.internal:5432/noufex_db?sslmode=require` | Full Postgres connection string. |
| `NODE_ENV` | `production` | Hides error messages in 500 responses. |
| `ALLOWED_ORIGINS` | `https://noufex.example.com` | Comma-separated CORS allowlist. |

### 3.2 Recommended

| Variable | Example | Purpose |
|----------|---------|---------|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | (from `.env`) | Discrete DB vars (alternative to `DATABASE_URL`). |
| `DB_SSL` | `true` | Use TLS to Postgres. |
| `API_PORT` | `3000` | Inside-container port. nginx maps to this. |
| `TRUST_PROXY` | `true` / `1` / CIDR list | Required for correct `req.ip` behind proxy. |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error`. |
| `SERVE_STATIC` | `true` | Serve SPA `dist/` from the API. Set `false` if SPA is hosted separately (CDN). |

### 3.3 Optional / future

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Real Stripe integration (not yet used) |
| `PAYMOB_*` | Real Paymob integration (not yet used) |
| `SENTRY_DSN` | Error tracking (not yet integrated) |

### 3.4 Generate the secret

```sh

# 32 random bytes → 43-char base64url

node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# Example output:

# kZ8dQfR3vN1xY7pE2jW5mT4sL0aH6bC9dF8gJ3kM5nQ

```

---

## 4. nginx reverse proxy

The API listens on `:3000`. nginx terminates TLS, adds a few extra
defense headers, and forwards to the API.

### 4.1 Minimum nginx config (`/etc/nginx/sites-available/noufex.conf`)

```nginx
upstream noufex_api {
    server 127.0.0.1:3000;

    # Add more `server` lines for multiple replicas.

    keepalive 32;
}

server {
    listen 80;
    server_name noufex.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name noufex.example.com;

    # SSL — managed by Let's Encrypt (see §5).

    ssl_certificate     /etc/letsencrypt/live/noufex.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/noufex.example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers — most are set by the API (Helmet-equivalent in

    # middleware.ts); we add the ones nginx handles better.

    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # gzip — JSON responses compress ~10x.

    gzip on;
    gzip_types application/json application/javascript text/css;
    gzip_min_length 1024;

    # Rate limit (extra layer beyond the API's auth rate limit).

    limit_req_zone $binary_remote_addr zone=noufex:10m rate=10r/s;
    limit_req zone=noufex burst=20 nodelay;

    # Proxy to API.

    location / {
        proxy_pass http://noufex_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Allow large request bodies (image upload, future).

        client_max_body_size 25m;

        # SSE-friendly timeouts.

        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    # Health endpoints — used by load balancer; bypass rate limit.

    location ~ ^/api/(health|ready)$ {
        proxy_pass http://noufex_api;
        access_log off;
    }

    # Static SPA assets — long-lived cache.

    location /assets/ {
        proxy_pass http://noufex_api;
        proxy_cache_valid 200 365d;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4.2 Test the config

```sh
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. SSL termination

We use **Let's Encrypt** with **certbot**. Free, automated, 90-day
renewal.

### 5.1 Install certbot

```sh
sudo apt install certbot python3-certbot-nginx
```

### 5.2 Obtain a certificate

```sh
sudo certbot --nginx -d noufex.example.com --agree-tos --redirect --no-eff-email
```

This:
- Obtains a certificate from Let's Encrypt.
- Modifies nginx config to enable HTTPS.
- Sets up HTTP → HTTPS redirect.
- Installs a systemd timer for auto-renewal.

### 5.3 Test renewal

```sh
sudo certbot renew --dry-run
```

### 5.4 Verify HSTS

After the cert is installed, the API also adds `Strict-Transport-Security`
when `NODE_ENV=production` (see `middleware.ts:67-69`).

```sh
curl -I https://noufex.example.com/api/health | grep -i strict-transport

# Strict-Transport-Security: max-age=15552000; includeSubDomains

```

---

## 6. Docker deployment

### 6.1 Build

```sh

# Build the SPA on the host (Vite build needs a working node_modules)

cd /opt/noufex
npm ci --prefix app
npm run build --prefix app

# Build the API image (Docker uses the freshly-built dist/)

docker compose build --no-cache
```

### 6.2 Start

```sh
docker compose up -d
```

### 6.3 Verify

```sh

# Container is up

docker compose ps

# NAME                STATUS              PORTS

# Nouf-ex             Up (healthy)        0.0.0.0:3000->3000/tcp

# Logs (single-line JSON, log-shipper friendly)

docker logs --tail 50 Nouf-ex

# Health check from outside the container

curl -s http://localhost:3000/api/health | jq

# {

#   "status": "ok",

#   "uptime_s": 1234,

#   "ts": "2026-06-28T12:34:56.000Z"

# }

```

### 6.4 Stop

```sh
docker compose stop            # SIGTERM, then SIGKILL after 10s
docker compose down -v         # also remove volumes (DANGER: drops data)
```

### 6.5 Update

```sh
git pull
npm ci --prefix app
npm run build --prefix app
docker compose build --no-cache
docker compose up -d
```

---

## 7. Database deployment

The Postgres server is **external** — managed by your cloud / your
team. We never touch it inside the API container.

### 7.1 One-time setup (run on the host, NOT in the container)

```sh
cd /opt/noufex
npm run db:setup
```

This applies:
- `migrations/0001_baseline.sql` — creates `schema_migrations` table.
- `schema.sql`, `schema-extra.sql`, `views.sql`, `functions.sql`,
  `triggers.sql`, `roles.sql` — full schema.
- `seed.sql` — 10 users + 24 products + 18 reviews + etc.
- Any pending `migrations/NNNN_*.sql`.

### 7.2 Role privileges

Verify with:

```sql
psql -h $DB_HOST -U noufex_owner -d noufex_db -c "\du noufex_app"
```

Expected: `noufex_app` has CRUD on user-data tables but **no** write
permission on `admin_audit_log` and `inventory_log` (those are
definer-trigger-managed).

### 7.3 Backups

```sh

# Daily logical backup (cron job)

pg_dump --no-owner --no-privileges \
  -h $DB_HOST -U noufex_owner -d noufex_db \
  -Fc -f /var/backups/noufex/noufex_$(date +%F).dump

# Restore (DANGER: overwrites current DB)

pg_restore -h $DB_HOST -U noufex_owner -d noufex_db \
  --clean --if-exists /var/backups/noufex/noufex_2026-06-28.dump
```

---

## 8. Blue-green / rolling deployment

### 8.1 Current state (v1)

We ship **single-replica** — downtime during deploy is ~10-30s (container
restart + DB connection + health check).

### 8.2 Future: blue-green (when scale demands)

Two replicas behind a load balancer:

```sh

# 1. Start green (new version) on a different port

docker compose -f docker-compose.green.yml up -d

# env: API_PORT=3001, container_name=Nouf-ex-green

# 2. Wait for green to be healthy

curl -sf http://localhost:3001/api/health

# 3. Switch nginx upstream

sed -i 's/127.0.0.1:3000/127.0.0.1:3001/' /etc/nginx/sites-available/noufex.conf
sudo nginx -s reload

# 4. Wait 5 min (let cache settle)

# 5. Stop blue (old version)

docker compose -f docker-compose.yml down
```

### 8.3 Future: rolling (when using k8s)

k8s handles rolling deploys natively. We do **not** deploy directly to
k8s today; this is a roadmap item.

---

## 9. Health checks

### 9.1 API endpoints

- **`GET /api/health`** — liveness probe. Returns 200 always (no DB check).
- **`GET /api/ready`** — readiness probe. Pings DB via `SELECT 1`. Returns
  200 + `checks.db.ok=true` if DB is up; 503 if not.

### 9.2 Docker healthcheck

Configured in `Dockerfile` and `docker-compose.yml`:

```yaml
healthcheck:
  test: ['CMD-SHELL', 'node -e "require(''http'').get(''http://localhost:3000/api/health'', (r) => { if (r.statusCode !== 200) process.exit(1) })"']
  interval: 30s
  timeout: 10s
  start_period: 20s
  retries: 3
```

### 9.3 nginx health check (used by load balancer)

```nginx
location ~ ^/api/(health|ready)$ {
    proxy_pass http://noufex_api;
    access_log off;        # Don't spam the access log with probes
}
```

### 9.4 k8s probes (future)

```yaml
livenessProbe:
  httpGet: { path: /api/health, port: 3000 }
  periodSeconds: 30
  timeoutSeconds: 5
  failureThreshold: 3
readinessProbe:
  httpGet: { path: /api/ready, port: 3000 }
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

---

## 10. Smoke test after deploy

After every deploy, run a 5-minute smoke test:

```sh

# 1. Health endpoints

curl -sf https://noufex.example.com/api/health | jq
curl -sf https://noufex.example.com/api/ready | jq

# 2. Public endpoints

curl -sf https://noufex.example.com/api/products?limit=1 | jq '.data.total'
curl -sf https://noufex.example.com/api/categories | jq '.data | length'

# 3. Login as a seeded user

TOKEN=$(curl -s -X POST https://noufex.example.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ahmed@gmail.com","password":"customer123"}' | jq -r '.data.token')

# 4. Authenticated endpoint

curl -sf https://noufex.example.com/api/auth/me -H "Authorization: Bearer $TOKEN" | jq

# 5. SPA — verify the SPA loads

curl -sf https://noufex.example.com/ | grep -q '<html' && echo "SPA OK"
```

Or run the PHASE 0 spec (fastest of the regression suite):

```sh
cd /opt/noufex
powershell -ExecutionPolicy Bypass -File tests/e2e/phase00_health_auth.ps1

# Expected: 22 PASS / 0 FAIL

```

---

## 11. Post-deployment verification

Within 30 minutes of deploy:

- [ ] `curl /api/health` returns 200 (liveness).
- [ ] `curl /api/ready` returns 200 with `checks.db.ok=true` (readiness).
- [ ] Login as ahmed / fatima / admin succeeds.
- [ ] PHASE 0 spec passes (22 assertions).
- [ ] PHASE 16 spec passes (21 assertions, SPA + headers).
- [ ] nginx logs show no 5xx errors.
- [ ] API logs (stdout) show no `unhandled_error` events.
- [ ] Postgres connection pool is healthy (no connection leaks).
- [ ] Docker container is `Up (healthy)`.

---

## 12. Rollback procedure

If the deploy fails post-deploy verification:

### 12.1 Quick rollback (Docker)

```sh

# 1. Stop the new version

docker compose down

# 2. Restore the previous image

git checkout HEAD~1  # or `git checkout v0.1.0` for a tag
npm ci --prefix app
npm run build --prefix app
docker compose build --no-cache
docker compose up -d

# 3. Verify

curl -sf https://noufex.example.com/api/health
```

### 12.2 Database rollback

Database changes are **forward-only** (no down-migrations). If a
migration caused an outage:

```sh

# 1. Find the migration record

psql -h $DB_HOST -U noufex_owner -d noufex_db \
  -c "SELECT version, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 5;"

# 2. Inspect the schema for the breaking change

# (You should be doing this BEFORE running the migration in prod.)

# 3. If needed, write a forward-only FIX migration

# (database/migrations/NNNN_fix_<issue>.sql) and run npm run db:setup

```

### 12.3 Post-rollback

- [ ] All smoke tests pass.
- [ ] PHASE 0 spec passes.
- [ ] Write a dated entry in `docs/audit/` (e.g.
  `docs/audit/rollback-2026-06-28.md`) describing root cause + remediation.

---

## 13. Operational runbook

### 13.1 Daily

- [ ] Check Docker container health: `docker ps`.
- [ ] Tail API logs for errors: `docker logs --tail 200 Nouf-ex | jq`.
- [ ] Verify backup completed: `ls -la /var/backups/noufex/`.

### 13.2 Weekly

- [ ] Review API metrics (request rate, p50/p95/p99 latency).
- [ ] Check rate-limit bucket size: `psql -c 'SELECT count(*) FROM rate_limit_buckets'`.
- [ ] Check Postgres connection count: `psql -c 'SELECT count(*) FROM pg_stat_activity'`.

### 13.3 Monthly

- [ ] Rotate `AUTH_SECRET` (TODO: write rotation script).
- [ ] Rotate `DB_PASSWORD` for `noufex_app`.
- [ ] Run `npm audit` and review findings.
- [ ] Review and rotate API keys (if Stripe/Paymob are live).

### 13.4 Quarterly

- [ ] Disaster-recovery drill: restore from a backup into a fresh DB.
- [ ] Penetration test (external).
- [ ] Update this document + `security.md`.

---

## 14. References

### 14.1 Internal documents

- [`security.md`](security.md) — OWASP API Top 10 + RBAC
- [`overview.md`](overview.md) — architecture overview
- [`database.md`](database.md) — schema and roles
- [`../../Dockerfile`](../../../../Dockerfile) — API image build
- [`../../docker-compose.yml`](../../../../docker-compose.yml) — local stack
- [`../../docker/entrypoint.sh`](../../../../docker/entrypoint.sh) — container entrypoint
- [`../testing/conventions.md`](../testing/conventions.md) — test taxonomy
- [`../development/getting-started.md`](../development/getting-started.md) — local dev setup

### 14.2 External standards

- [12-Factor App](https://12factor.net/) — config, deps, processes
- [Docker best practices](https://docs.docker.com/develop/dev-best-practices/)
- [nginx documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/getting-started/)
- [certbot](https://certbot.eff.org/)
- [PostgreSQL backup](https://www.postgresql.org/docs/17/backup.html)
- [Kubernetes probes](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-probes) (future)

---

## Maintenance Notes

1. **Update §2 (Pre-deployment checklist)** when new env vars are added.
2. **Update §3 (Environment variables)** when the schema changes.
3. **Update §4 (nginx config)** when reverse-proxy logic changes.
4. **Add to §13 (Runbook)** any new operational task.
5. **Update §8 (Blue-green)** when actual multi-replica deployment happens.
6. Bump version in §1 when significant changes are made.
7. Commit spec + code **together**.

---

> **End of deployment.md.** Next: B.2.3 — `monitoring.md`
> (structured JSON logs + metrics + alerts).
