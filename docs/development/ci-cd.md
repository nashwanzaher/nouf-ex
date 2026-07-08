# CI/CD — Nouf-ex

> **Scope:** GitHub Actions pipeline + secrets + branch protection + future deployment.
> **Audience:** DevOps, release engineers, contributors.
> **Last reviewed:** 2026-06-28
> **Standard:** [GitHub Actions best practices](https://docs.github.com/en/actions/learn-github-actions/best-practices-for-github-actions) · [Conventional Commits](https://www.conventionalcommits.org/)

---

## Table of Contents

1. [Pipeline overview](#1-pipeline-overview)
2. [Stages (cheap → expensive)](#2-stages-cheap--expensive)
3. [Secrets management](#3-secrets-management)
4. [Branch protection](#4-branch-protection)
5. [Required status checks](#5-required-status-checks)
6. [Deployment strategy (future)](#6-deployment-strategy-future)
7. [Local CI simulation](#7-local-ci-simulation)
8. [Performance & cost](#8-performance--cost)
9. [Adding a new stage](#9-adding-a-new-stage)
10. [Troubleshooting CI](#10-troubleshooting-ci)
11. [References](#11-references)

---

## 1. Pipeline overview

The CI/CD pipeline is in `.github/workflows/ci.yml`. It runs on every
push to `main` / `develop` and every PR targeting those branches.

### 1.1 High-level flow

```
push / PR
  │
  ├─→ lint          (parallel, ~10s)
  ├─→ typecheck     (parallel, ~30s)
  │     └─→ mcp-server typecheck (parallel, ~10s)
  │
  ├─→ test         (after lint + typecheck, ~1m, no DB)
  │
  ├─→ db-integration (push-only, ~30s, with Postgres service)
  ├─→ server-boot   (push-only, ~30s, with Postgres service)
  │
  └─→ build        (after test + db-integration, ~30s)
       └─→ upload artifact
```

### 1.2 Concurrency

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

When a new commit lands on the same branch, the previous in-progress run
is **cancelled**. This saves CI minutes.

### 1.3 Permissions

```yaml
permissions:
  contents: read
```

The workflow runs with the **least privilege** — read access to repo
content. No `write` permissions on issues, PRs, packages, etc. If a
future stage needs more, grant narrowly at the job level.

---

## 2. Stages (cheap → expensive)

The pipeline order is **deliberate**: cheap stages fail fast, expensive
stages only run if the cheap ones pass.

### 2.1 Stage 1 — Lint (`~10s`)

**What:** ESLint on the entire `app/` workspace.

**Trigger:** always (parallel with typecheck).

**Failures to fix:**
- `npm run lint` errors (style + correctness).
- `npm run lint` warnings are upgraded to errors (`--max-warnings=0`).

**Cost:** ~10s × N runs/month = small.

### 2.2 Stage 2 — TypeScript (`~30s`)

**What:**
- `npx tsc --noEmit -p tsconfig.app.json` (app/)
- `npm run typecheck` (mcp-server/)

**Trigger:** always (parallel with lint).

**Failures to fix:**
- Type errors in routes, middleware, hooks, components.
- A new dependency that doesn't have types.

### 2.3 Stage 3 — Unit tests (`~1m`)

**What:** `npm test` in `app/`. All 299+ tests in 53 files.

**Trigger:** after lint + typecheck pass.

**Why no DB?** `pg` is mocked globally in `app/mocks/setup.ts`, so the
suite runs **offline**. The DB-backed integration suite is in §2.4.

**Coverage:** uploaded as artifact on `main` only (saves storage).

**Failures to fix:**
- Test regressions in route handlers.
- New test missing for new endpoint.
- Snapshot mismatch (e.g., API contract change).

### 2.4 Stage 4 — DB integration (`~30s`, push-only)

**What:**
1. Spins up a `postgres:17` service container.
2. Runs `scripts/db/db-setup.cjs` to apply schema + seed.
3. Counts users via the MCP server (smoke check).

**Trigger:** push to main/develop, OR PRs with "db" in branch name.

**Why service container?** The schema must be applied against a real
PostgreSQL 17 (not SQLite / mocked). The container runs only for this
job.

**Why push-only?** Pull requests get the unit tests in §2.3 (faster
feedback). The DB integration is a stricter check that's worth the
extra CI time only when merging.

**Failures to fix:**
- Migration doesn't apply cleanly.
- Permissions mismatch (e.g., `noufex_app` can't `INSERT` into a new table).
- Schema drift (a `db:setup` after a previous successful run fails).

### 2.5 Stage 5 — Server boot smoke (`~30s`, push-only)

**What:**
1. Spins up Postgres.
2. Boots the actual API via `npx tsx server/index.ts`.
3. Waits up to 30s for `/api/health` to return 200.
4. Hits `/api/health`, `/api/ready`, `/api/stats/home` — all must be 200.
5. Verifies response body shape (`status:ok`, `uptime_s` field).
6. Kills the server (trap on EXIT).

**Trigger:** push OR branch name contains "db", "server", or "ci".

**Why this stage?** Catches the class of bugs that unit tests miss:
- Bad env wiring.
- Route-mount typos (`/api/orders` vs `/api/oredrs`).
- Runtime config issues.
- The DB ↔ API handshake.
- 503 vs 200 distinction in `/api/ready`.

**Failures to fix:**
- Server doesn't start within 30s (timeout).
- `/api/health` returns 500 (zod schema bug, env var missing).
- `/api/ready` returns 503 (DB connection failed).

### 2.6 Stage 6 — Build (`~30s`)

**What:**
- `vite build` — produces `app/dist/` (SPA bundle).
- esbuild via the `api:build` script — produces `app/server/index.js`.
- `mcp-server` build — produces `mcp-server/dist/`.

**Trigger:** after test + db-integration pass.

**Artifact:** uploaded with 7-day retention.

**Why build last?** Building is expensive (~30s of CPU). If lint
fails, no point building.

### 2.7 Stage matrix

| Stage | Always? | Time | DB? | What it catches |
|-------|---------|------|-----|-----------------|
| lint | ✅ | 10s | no | Style, unused imports, common bugs |
| typecheck | ✅ | 30s | no | Type errors, missing types |
| test | ✅ | 1m | no | Route logic, RBAC, validation |
| db-integration | push only | 30s | yes | Schema, permissions |
| server-boot | push only | 30s | yes | Runtime wiring, route mounts |
| build | ✅ | 30s | no | Bundle creation, asset hashing |

---

## 3. Secrets management

### 3.1 What is a secret (in this pipeline)

| Secret | Where | Lifetime |
|--------|-------|----------|
| `AUTH_SECRET` | workflow `env` block (test-only) | ephemeral per run |
| `DB_PASSWORD` | service container env (test-only) | ephemeral per run |
| `NPM_TOKEN` (future) | GitHub Actions secrets | permanent |
| `DEPLOY_SSH_KEY` (future) | GitHub Actions secrets | permanent |

The current pipeline **does not need any production secrets** — it's
purely build + test. Production secrets are managed in deployment
(see `deployment.md` §3).

### 3.2 GitHub Actions secrets (when needed)

When a future stage needs a production secret (e.g., `deploy-staging.yml`):

1. **Never** commit secrets to `.github/workflows/ci.yml`.
2. **Store** in **Settings → Secrets and variables → Actions**.
3. **Reference** with `${{ secrets.SECRET_NAME }}`.
4. **Rotate** regularly (90-day cadence, documented in `monitoring.md`
   §13.3).

```yaml

# Example: future deploy-staging.yml

env:
  DEPLOY_SSH_KEY: ${{ secrets.STAGING_SSH_KEY }}
  PROD_DB_PASSWORD: ${{ secrets.PROD_DB_PASSWORD }}
```

### 3.3 Test-only secrets in the env block

The current pipeline sets test secrets in the `env:` block at the
workflow level. These are **safe** because:

- They only work against the ephemeral Postgres service container.
- The `AUTH_SECRET` value is a fixed test string, not a real key.
- The pipeline never connects to production DBs.

```yaml
env:
  DB_USER: postgres
  DB_PASSWORD: postgres        # ephemeral, service container only
  AUTH_SECRET: test-secret-must-be-at-least-32-chars-long-xxx
```

### 3.4 Pre-commit hook (recommended)

To prevent accidental secret leaks:

```sh

# Install git-secrets

brew install git-secrets
git secrets --install
git secrets --register-aws
git secrets --add 'sk_live_[a-zA-Z0-9]+'        # Stripe
git secrets --add 'AUTH_SECRET=.{32,}'       # our pattern
```

---

## 4. Branch protection

Configure these on `main` (GitHub → Settings → Branches → main → Edit):

### 4.1 Required settings

- [x] **Require a pull request before merging** — direct pushes to main are blocked.
- [x] **Require approvals: 1** — at least 1 reviewer.
- [x] **Dismiss stale pull request approvals** — new pushes invalidate old approvals.
- [x] **Require status checks to pass before merging** — see §5.
- [x] **Require branches to be up to date** — block merge if base is behind main.
- [x] **Do not allow force pushes** — protects commit history.
- [x] **Do not allow deletions** — protects main from accidental deletion.

### 4.2 Optional (recommended)

- [ ] **Require linear history** — no merge commits.
- [ ] **Include administrators** — even admins must follow the rules.
- [ ] **Allowed merge methods: squash only** — one commit per PR.

---

## 5. Required status checks

Configure these on `main` (GitHub → Settings → Branches → main → Require
status checks → Search for status check):

| Status check | Job | Why required |
|--------------|-----|--------------|
| `Lint` | lint | Catches ESLint errors |
| `TypeScript` | typecheck | Catches type errors |
| `Tests` | test | All 299+ unit tests pass |
| `DB Integration` (push only) | db-integration | Schema applies cleanly |
| `Server Boot Smoke` (push only) | server-boot | Real API boots end-to-end |
| `Build` | build | Bundle produces |

### 5.1 Configuration via `gh` CLI

```sh

# Set branch protection on main

gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks[strict]=true \
  --field required_status_checks[contexts][]=Lint \
  --field required_status_checks[contexts][]=TypeScript \
  --field required_status_checks[contexts][]=Tests \
  --field required_status_checks[contexts][]=Build \
  --field required_pull_request_reviews[required_approving_review_count]=1 \
  --field enforce_admins=true
```

---

## 6. Deployment strategy (future)

Today: **CI only** — no automatic deploys. Deploys are manual via
`deployment.md` §6.

### 6.1 Future: auto-deploy to staging on main

```yaml

# .github/workflows/deploy-staging.yml

name: Deploy to Staging

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.noufex.example.com
    steps:
      - uses: actions/checkout@v4

      - name: Download build artifact
        uses: actions/download-artifact@v4
        with:
          name: noufex-build
          path: build/

      - name: Copy to staging server
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          source: "build/*"
          target: /opt/noufex/build/

      - name: Restart staging container
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /opt/noufex
            mv build/* app/dist/ app/server/
            docker compose restart noufex
            curl -sf https://staging.noufex.example.com/api/health
```

### 6.2 Future: manual approval for production

```yaml

# .github/workflows/deploy-prod.yml

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version tag (e.g. v0.2.0)'
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://noufex.example.com
    steps:
      - uses: actions/checkout@v4
      - run: |
          git tag ${{ inputs.version }}
          git push origin ${{ inputs.version }}
      - run: ./scripts/deploy-prod.sh ${{ inputs.version }}
```

GitHub Environments → `production` → **Required reviewers: 2**.

### 6.3 Future: rollback

```yaml

# .github/workflows/rollback.yml

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to roll back TO'
        required: true
jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: { name: production }
    steps:
      - run: ./scripts/rollback.sh ${{ inputs.version }}
```

---

## 7. Local CI simulation

Test the pipeline locally before pushing:

### 7.1 The single command

```sh

# Run all stages sequentially

./scripts/run-ci-locally.sh
```

### 7.2 The script (future)

```bash
#!/bin/bash

# scripts/run-ci-locally.sh

set -e
echo "=== 1/6: Lint ==="
cd app && npx eslint . --max-warnings=0
echo "=== 2/6: TypeScript ==="
cd app && npx tsc --noEmit -p tsconfig.app.json
cd ../mcp-server && npm run typecheck
cd ../app
echo "=== 3/6: Tests ==="
cd app && npm test
echo "=== 4/6: DB integration (Docker) ==="
docker compose up -d postgres
sleep 5
cd app && npm run db:setup
cd app && node -e "const{Client}=require('pg');(async()=>{const c=new Client({connectionString:'postgresql://postgres:postgres@localhost:5432/noufex_db'});await c.connect();const r=await c.query('SELECT COUNT(*)::int AS n FROM users');console.log('users:',r.rows[0].n);await c.end();})()"
cd app
echo "=== 5/6: Server boot smoke ==="
(cd app && npx tsx server/index.ts > /tmp/noufex-api.log 2>&1) &
API_PID=$!
trap "kill $API_PID 2>/dev/null || true" EXIT
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3000/api/health > /dev/null 2>&1; then break; fi
  sleep 1
done
curl -sf http://127.0.0.1:3000/api/health | jq
echo "=== 6/6: Build ==="
cd app && npm run build
cd ../mcp-server && npm run build
cd ..
echo "✅ All stages passed locally"
```

### 7.3 Manual equivalent (no script)

```sh

# 1. Lint

cd app && npx eslint . --max-warnings=0

# 2. Typecheck

cd app && npx tsc --noEmit -p tsconfig.app.json
cd ../mcp-server && npm run typecheck

# 3. Tests

cd ../app && npm test

# 4. DB integration (Docker)

docker compose up -d postgres
sleep 5
cd app && npm run db:setup

# 5. Server boot smoke

(cd app && npx tsx server/index.ts > /tmp/noufex-api.log 2>&1) &
API_PID=$!
trap "kill $API_PID 2>/dev/null || true" EXIT
sleep 5
curl -sf http://127.0.0.1:3000/api/health

# 6. Build

cd app && npm run build
```

---

## 8. Performance & cost

### 8.1 Stage timing (current)

| Stage | Avg time | Cost (Linux, 2 vCPU) |
|-------|----------|----------------------|
| lint | 10s | $0.004 |
| typecheck | 30s | $0.012 |
| test | 60s | $0.024 |
| db-integration | 30s | $0.012 |
| server-boot | 30s | $0.012 |
| build | 30s | $0.012 |
| **Total per run** | **~3 min** | **~$0.08** |

### 8.2 Monthly estimate

Assuming **200 PR runs + 100 push runs** per month:

```
200 PR runs × $0.05  = $10   (no DB stages)
100 push runs × $0.08 = $8    (with DB stages)
                       ----
                       $18 / month
```

### 8.3 Optimization opportunities

| Stage | Optimization | Estimated saving |
|-------|---------------|-------------------|
| lint + typecheck | Combine into one job | -10s per run |
| test | Cache `app/coverage/` between runs | -30s per run |
| build | Use `actions/cache@v4` for `app/node_modules` | -20s per run |
| server-boot | Run in parallel with `build` | -30s per run (already parallel) |

---

## 9. Adding a new stage

### 9.1 Checklist

When you add a new stage to the pipeline:

- [ ] Stage runs in the **correct position** in the matrix (cheap → expensive).
- [ ] Stage has the **correct dependencies** (`needs:`).
- [ ] Stage has the **correct trigger** (always, or push-only).
- [ ] If the stage uses a service container, **wait for healthcheck**.
- [ ] If the stage uses secrets, **reference via `secrets.*`** (not hardcoded).
- [ ] If the stage can fail in multiple ways, **add a useful error message**.
- [ ] Add the stage name to the **required status checks** list (§5).
- [ ] **Update this document** (§2 stage matrix + new section).

### 9.2 Template

```yaml
new-stage:
  name: My New Stage
  runs-on: ubuntu-latest
  needs: [test]  # depends on test passing
  if: github.event_name == 'push' || contains(github.head_ref, 'feature')
  services:
    postgres:
      image: postgres:17
      env:
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
        POSTGRES_DB: noufex_db
      ports: ['5432:5432']
      options: >-
        --health-cmd "pg_isready -U postgres"
        --health-interval 5s
        --health-timeout 5s
        --health-retries 10
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/noufex_db
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
        cache-dependency-path: app/package-lock.json
    - run: cd app && npm ci --no-audit --no-fund
    - run: ./my-new-stage.sh
```

### 9.3 Example: adding a security scan stage

```yaml
security-scan:
  name: Security Scan
  runs-on: ubuntu-latest
  needs: [lint, typecheck]
  steps:
    - uses: actions/checkout@v4
    - run: cd app && npm ci --no-audit --no-fund
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        severity: 'CRITICAL,HIGH'
        exit-code: '1'
        ignore-unfixed: true
    - name: Run npm audit
      run: cd app && npm audit --audit-level=high
```

---

## 10. Troubleshooting CI

### 10.1 "Tests pass locally but fail in CI"

**Common causes:**

1. **Different Node version** — CI uses Node 20. Check `engines` in
   `package.json` matches.
2. **Timezone** — tests that depend on `Date.now()` may fail. Mock it.
3. **Port conflicts** — CI runs in a fresh container, no leftover processes.
4. **Hidden env vars** — set in `.env` but not in CI workflow.
5. **Flaky tests** — fix the flakiness, don't retry the CI.

### 10.2 "DB integration fails on first run after migration"

**Common causes:**

1. **Migration not idempotent** — use `IF NOT EXISTS` and `OR REPLACE`.
2. **Permission grant missing** — `noufex_app` lacks `INSERT/UPDATE/SELECT`
   on the new table.
3. **Seed data missing** — the new table has no default row.

### 10.3 "Server boot smoke times out"

**Common causes:**

1. **Postgres not ready** — service container healthcheck didn't pass.
2. **AUTH_SECRET missing** — server crashes at module load.
3. **Bind address in use** — another process is on port 3000 (rare in CI).

### 10.4 "Build artifact upload fails"

**Common causes:**

1. **Artifact too large** — limit is 10 GB.
2. **Path doesn't exist** — verify the build output dir.
3. **Permissions** — `contents: write` needed for `upload-artifact`.

### 10.5 Debug a failed CI run

1. **Download logs** — Actions → run → Summary → Artifacts.
2. **Re-run with debug logging** — Actions → run → Re-run jobs → Enable
   debug logging.
3. **Tmate SSH session** — for hard-to-reproduce failures:
   ```yaml
   - name: Setup tmate session
     if: failure()
     uses: mxschmitt/action-tmate@v3
   ```
4. **Local simulation** — `./scripts/run-ci-locally.sh` (§7).

---

## 11. References

### 11.1 Internal documents

- [`deployment.md`](../operations/deployment.md) — production ops
- [`monitoring.md`](../operations/monitoring.md) — observability + runbooks
- [`security.md`](../architecture/security.md) — OWASP + RBAC
- [`debugging.md`](../development/debugging.md) — local debugging
- [`er-diagram.md`](../architecture/er-diagram.md) — schema
- [`../../.github/workflows/ci.yml`](../../../../.github/workflows/ci.yml) — the pipeline source

### 11.2 External standards

- [GitHub Actions — Best practices](https://docs.github.com/en/actions/learn-github-actions/best-practices-for-github-actions)
- [GitHub Actions — Security hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [Conventional Commits 1.0](https://www.conventionalcommits.org/en/v1.0.0/)
- [Semantic Versioning 2.0](https://semver.org/)
- [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/)
- [PostgreSQL in GitHub Actions](https://docs.github.com/en/actions/using-containerized-services/using-postgresql-with-github-actions)
- [Trivy — vulnerability scanner](https://github.com/aquasecurity/trivy)

---

## Maintenance Notes

1. **Update §2** when adding/removing stages.
2. **Update §3** when adding production secrets.
3. **Update §4** when branch protection rules change.
4. **Update §6** when deployment strategy changes.
5. **Add to §10** any new CI failure mode.
6. Bump version in §1 when significant changes are made.
7. Commit spec + workflow **together**.

---

> **End of ci-cd.md.** Next: B.3.1 closes Phase B.3 (CI/CD docs).
> After that: C.1 → C.4 (functional P1: real notifications, i18n,
> merchant endpoints, merchant UI).
