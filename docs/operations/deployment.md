# Nouf-ex — Operations: Deployment Guide

> **Audience:** DevOps engineers, release managers.
> **Last updated:** 2026-07-12
> **Standards:** GitHub Actions Environments, 12-Factor App, OWASP API Security.

---

## 1. Environments

| Environment | URL pattern | Trigger | Approvals | Rollback |
|---|---|---|---|---|
| **Local dev** | `http://localhost:3000` (API) + `:8080` (SPA) | `npm run dev` | none | `Ctrl+C` |
| **CI** | ephemeral `postgres:17` service container | push/PR to `main`/`develop` | required checks via branch protection | re-run job |
| **Staging** | `https://staging.<your-domain>` | push to `main` (after CI passes) | none | re-deploy previous SHA |
| **Production** | `https://<your-domain>` | tag push `vX.Y.Z` OR manual dispatch | **required via `production` GitHub Environment** | automatic rollback in `deploy-prod.yml` |

---

## 2. First-time deployment

### 2.1 Provision the database

External PostgreSQL 17 instance (managed service like AWS RDS, Neon, Supabase, or self-hosted).

Create the database and roles:

```sh
# As postgres superuser
psql -h <host> -U postgres -c "CREATE DATABASE noufex_db;"
```

Then from the repo root:

```sh
# Copy .env.example to .env and fill in:
# DB_HOST=<host>
# DB_PORT=5432
# DB_NAME=noufex_db
# DB_USER=noufex_app
# DB_PASSWORD=<strong-password>
# DATABASE_URL=postgresql://noufex_app:<pw>@<host>:5432/noufex_db
# AUTH_SECRET=<32-byte base64url random>

npm install
npm run db:setup     # creates roles, applies schema + 30 migrations + seed
```

### 2.2 Build the image

```sh
docker build -t noufex:latest .
docker compose up -d
```

The image is **4-stage** (see `Dockerfile`):
1. `deps` — workspace-wide `npm ci`
2. `api-build` — `esbuild` → `apps/api/dist/index.js`
3. `web-build` — `vite build` → `apps/web/dist/`
4. `runtime` — `node:20.19-alpine` + `tini` (PID 1) + non-root user

### 2.3 Set up the GitHub Environment

1. Repo → **Settings** → **Environments** → **New environment** → `production`
2. Configure **Deployment protection rules** → require reviewers
3. Add secrets:
   - `PROD_HOST` — SSH hostname
   - `PROD_USER` — SSH user
   - `PROD_SSH_KEY` — SSH private key
   - `PROD_URL` — public URL (e.g. `https://noufex.example.com`)
   - `AUTH_SECRET_PROD` — ≥32 chars
   - `DB_PASSWORD_PROD` — postgres password
   - `DATABASE_URL_PROD` — full connection string

Rotation policy: see [`.github/SECRETS.md`](../../.github/SECRETS.md).

---

## 3. CI/CD pipeline (5 workflows)

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | push/PR to main/develop | 7 jobs: docs-presence → lint → typecheck → mcp-server → test → build → db-integration → server-boot |
| `deploy-staging.yml` | push to main | Auto-deploy staging from build artefacts |
| `deploy-prod.yml` | tag push `v*` OR manual | Production deploy with automatic rollback |
| `docs.yml` | push/PR touching `docs/**` | MkDocs build + GitHub Pages |
| `link-check.yml` | PR + nightly 06:00 UTC | markdown-link-check matrix |

See [`.github/workflows/`](../../.github/workflows/) for the full source.

---

## 4. Production deploy workflow

### 4.1 Trigger via semver tag

```sh
git tag v1.2.0
git push origin v1.2.0
```

The `deploy-prod.yml` will:
1. **Validate the tag** matches `vX.Y.Z`
2. **Check tag is ancestor of main** (prevent direct-to-prod commits)
3. **Download the build artefact** from the latest successful `ci.yml` run
4. **SSH to the production host** and upload the artefact
5. **Atomically swap** `apps/api/dist/` and `apps/api/src/`
6. **Backup the previous version** to `apps/api/src.bak.<timestamp>` and `apps/api/dist.bak.<timestamp>`
7. **Wait up to 60s** for the API to come back up
8. **Smoke check** `/api/health`, `/api/ready`, `/api/stats/home` — all must return 200
9. **Automatic rollback** if any check fails

### 4.2 Trigger via manual dispatch

1. Repo → **Actions** → **Deploy to Production** → **Run workflow**
2. Provide a **reason** (will be POSTED IN CHANGELOG)
3. Click **Run workflow**

### 4.3 Required checks before merge

Per [`.github/branch-protection.md`](../../.github/branch-protection.md), every PR to `main` requires:
- ✅ Lint
- ✅ Typecheck
- ✅ Test (Vitest)
- ✅ Build
- ✅ DB integration (when pushing to a branch matching `db`)
- ✅ Server-boot smoke (when pushing to a branch matching `server` or `ci`)

---

## 5. Local dev workflow

```sh
# 1. Install
npm install

# 2. Set up DB (one-time per DB)
npm run db:setup

# 3. Run both API and SPA (in two terminals)
npm run dev -w @noufex/api        # → http://localhost:3000
npm run dev -w @noufex/web        # → http://localhost:8080

# OR run the full Docker stack
docker compose up -d --build     # → http://localhost:3000
```

Vite dev server (`:8080`) proxies `/api/*` to the Express API (`:3000`). The browser sees a single origin.

---

## 6. Rollback procedure

### Automatic (in `deploy-prod.yml`)

When smoke checks fail after a deploy, the workflow:
1. Lists the latest `apps/api/src.bak.<ts>` and `apps/api/dist.bak.<ts>`
2. `rm -rf apps/api/src && mv <bak> apps/api/src`
3. `rm -rf apps/api/dist && mv <bak> apps/api/dist`
4. `docker compose restart noufex`
5. Exits with non-zero → GitHub shows red ✗

### Manual (for catastrophic failure)

If the automatic rollback fails:

```sh
ssh deploy@prod-host

cd /opt/noufex

# Option A: roll back to the immediately previous version
LATEST=$(ls -td apps/api/src.bak.* | head -1)
rm -rf apps/api/src && mv "$LATEST" apps/api/src
docker compose restart noufex

# Option B: re-deploy a specific previous tag
git checkout v1.1.0   # locally
docker compose up -d --build  # rebuilds the image
```

---

## 7. Monitoring & logs

- **Structured JSON logs** to stdout (`apps/api/src/middleware.ts:requestLogger`)
- **Health probe**: `GET /api/health` (in-memory rate-limited 30/s)
- **Readiness probe**: `GET /api/ready` (DB check, 2s timeout)
- **Dead-letter queue**: `logs/audit-dlq-YYYY-MM-DD.jsonl` for failed audit writes

Recommended observability stack:
- Ship logs to **CloudWatch / Loki / Datadog** via a sidecar
- Alert on `5xx` rate, `rate_limited` spike, `audit_dlq` non-empty
- Monitor DB `pg_stat_user_tables` for table bloat

See [monitoring.md](monitoring.md) for details (TODO).

---

## 8. Backup & restore

- **Database backups**: see [backup-restore.md](backup-restore.md) (TODO)
- **File backups**: not needed — `apps/api/dist/` and `apps/api/src/` are reproducible from git
- **Logs**: shipped to external storage; not stored locally long-term

---

## 9. Disaster recovery

| Failure | Recovery time | Procedure |
|---|---|---|
| API process crash | <30s | `docker compose restart noufex` |
| Single DB row corruption | minutes | restore from latest `pg_dump` |
| Full DB loss | hours | restore DB + re-run `npm run db:setup` |
| Build artefact loss | minutes | re-run `ci.yml` to rebuild |
| Region outage | hours | switch to backup region, restore DB |
| Compromised secret | minutes | rotate via `gh secret set`, redeploy |

---

## 10. Compliance

- **OWASP API Top 10 (2023)** — see [architecture/security.md](security.md)
- **WCAG 2.1 Level AA** — frontend a11y tests via `axe-core`
- **Keep a Changelog** — see [CHANGELOG.md](../../CHANGELOG.md)
- **Conventional Commits** — enforced by commitlint + release-please
- **SemVer 2.0** — release-please bumps automatically

---

## 11. Local-dev troubleshooting (added 2026-07-15)

### 11.1 PostgreSQL connection refused (`ECONNREFUSED 127.0.0.1:5432`)

If the API boots but every request returns:

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

the app is pointing at the **default** `5432` port while the dev
cluster runs on `5435` (per `.env`). The `.env` loader uses
`dotenv/config`, but **Vitest imports `lib/shared.ts` directly** (no
side-effect import of `dotenv/config`), so unit tests that need a DB
must run with the env pre-loaded:

```powershell
# PowerShell — one-shot env load
Get-Content .env | ForEach-Object {
  if ($_ -match '^([^#][^=]+)=(.*)$') {
    [System.Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
  }
}
npx vitest run apps/api/src/tests
```

Or export the var before invoking vitest:

```sh
# bash / zsh
set -a; source .env; set +a
npx vitest run apps/api/src/tests
```

### 11.2 PostgreSQL `pg_hba.conf` — scram-sha-256 vs trust

The bundled `start-postgres.bat` starts the cluster in **trust** mode
so the local dev flow never trips on a password mismatch. If you boot
a vanilla Postgres container instead (`docker run postgres:17`), the
default `pg_hba.conf` requires `scram-sha-256` and you'll see:

```
password authentication failed for user "noufex_app"
```

Two fixes — pick one:

1. **Local dev (recommended):** add the lines below to the running
   container's `pg_hba.conf` and reload:

   ```
   host    noufex_db      noufex_app     127.0.0.1/32    trust
   host    noufex_db      postgres       127.0.0.1/32    trust
   ```

   ```sh
   docker exec noufex-postgres bash -c 'echo "host noufex_db noufex_app 127.0.0.1/32 trust" >> /var/lib/postgresql/data/pg_hba.conf'
   docker exec noufex-postgres pg_ctl reload
   ```

2. **Production-style:** keep `scram-sha-256` and set a real
   `DB_PASSWORD` in `.env` that matches the role created by
   `roles.sql` (`noufex_owner` / `noufex_app`).

### 11.3 `tsc --noEmit` reports 0 errors but CI fails

CI uses `NODE_VERSION=20.19` while a stale local install can still be
on Node 20.18.0. Re-install after the engine bump:

```powershell
rm -r node_modules apps/*/node_modules packages/*/node_modules
npm ci
```

### 11.4 Vite 7 warnings on Node <20.19

```
Warning: Unsupported engine: wanted: {"node":"^20.19.0 || >=22.12.0"}
```

Install Node 20.19+ (`nvm install 20.19 && nvm use 20.19`) or Node 22.12+
before running `npm run dev` / `npm run build` in `apps/web`.

---

## See also

- [CI/CD workflows source](../../.github/workflows/)
- [Dockerfile](../../Dockerfile)
- [docker-compose.yml](../../docker-compose.yml)
- [SECRETS management](../../.github/SECRETS.md)
- [Architecture overview](overview.md)
