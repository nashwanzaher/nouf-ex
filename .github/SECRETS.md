# Secrets Management

> **Scope:** All environments (local dev, CI, staging, production).
> **Last reviewed:** 2026-06-28
> **Standard:** [OWASP API Security §API2 — Broken Authentication](https://owasp.org/API-security/editions/2023/en/0x11-t10/) · [12-Factor App §Config](https://12factor.net/config) · [GitHub Actions — Encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

---

## 1. What is a secret

| Secret | Where used | Storage | Rotation cadence |
|--------|-----------|----------|-------------------|
| `AUTH_SECRET` (HMAC key, ≥32 chars) | API token signing | `.env` / Docker env / k8s Secret | Every 90 days |
| `DB_PASSWORD` (postgres role password) | DB connection | `.env` / Docker env / k8s Secret | Every 90 days |
| `SMTP_PASSWORD` (when SMTP is configured) | Outbound email | `.env` / k8s Secret | Per provider docs |
| `STRIPE_SECRET_KEY` (future) | Stripe payments | `.env` / k8s Secret | Per Stripe docs |
| `PAYMOB_API_KEY` (future) | Paymob payments | `.env` / k8s Secret | Per Paymob docs |
| `STAGING_SSH_KEY` (future) | Auto-deploy to staging | GitHub Actions secret | Annually |

## 2. Local dev (`.env` file)

```sh
# .env (gitignored) — local development only
AUTH_SECRET=           # generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
DB_PASSWORD=           # match the password you set when running scripts/db-setup.cjs
DATABASE_URL=          # full postgres:// connection string
```

**Verification:**

```sh
# Confirm .env is gitignored
git check-ignore .env && echo "OK" || echo "FIXME: add .env to .gitignore"

# Generate a strong AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

**What goes in `.env` vs `.env.example`:**

| File | Purpose | Committed? |
|------|---------|-----------|
| `.env` | Live values for local dev | ❌ gitignored |
| `.env.example` | Template with placeholder values (e.g. `CHANGE_ME_APP`) | ✅ committed |

## 3. CI (GitHub Actions)

For D.1, the CI workflow uses **ephemeral test credentials** that are
hard-coded into the workflow YAML:

```yaml
env:
  DB_PASSWORD: noufex_app_test_password_only
  AUTH_SECRET: test-secret-must-be-at-least-32-chars-long-xyz
```

This is safe because:

1. The credentials only work against the ephemeral `postgres:17`
   service container that is started and torn down per-job.
2. `AUTH_SECRET` in CI is a test-only key (a real production secret
   would never validate tokens signed by this key).
3. The CI workflow has `permissions: contents: read` and never has
   access to production secrets.

**If you need to add a real secret to CI later** (e.g. for a deploy
job), use the GitHub UI:

```sh
# Via the GitHub UI
Settings → Secrets and variables → Actions → New repository secret

# Via the GitHub CLI
gh secret set AUTH_SECRET_PROD --body "$(node -e 'console.log(require(\"crypto\").randomBytes(32).toString(\"base64url\"))')"
```

Then reference in the workflow:

```yaml
env:
  AUTH_SECRET: ${{ secrets.AUTH_SECRET_PROD }}
```

**Never** print a secret value in the workflow YAML, even commented.

## 4. Staging / Production

- **Docker Compose (local)**: secrets come from the host `.env`
  file (see `docker-compose.yml`'s `env_file: - .env` line).
- **Docker Swarm / Kubernetes**: use `secrets:` (Swarm) or `Secret:`
  resources (k8s). Mount as env vars into the pod. Do NOT bake secrets
  into the image.
- **AWS ECS / Fargate**: use Parameter Store (SSM) or Secrets Manager.
- **Bare-metal staging**: store in `/etc/noufex/secrets.env` (mode 0600,
  owned by root) and source it via `EnvironmentFile=` in the systemd
  unit.

### 4.1 Rotation

| Secret | Steps |
|--------|-------|
| `AUTH_SECRET` | 1. Generate a new key.<br>2. Update `.env` (or k8s Secret) on staging.<br>3. Restart API on staging — all existing bearer tokens are now invalid (clients must re-login).<br>4. Wait 24h, observe error rate.<br>5. Update prod, restart API. |
| `DB_PASSWORD` | 1. `ALTER USER noufex_app WITH PASSWORD '...';`<br>2. Update `.env` or k8s Secret on each env.<br>3. Restart API.<br>4. No client impact (DB connections are re-established). |
| `SMTP_PASSWORD` | 1. Rotate at provider.<br>2. Update env.<br>3. Restart API. |

## 5. Never commit

- ❌ Real `AUTH_SECRET` values.
- ❌ Real `DB_PASSWORD` values.
- ❌ API keys (Stripe, Paymob, Twilio).
- ❌ TLS certificates / private keys.
- ❌ Customer or test data with PII.

## 6. Verification

```sh
# Find accidentally-committed secrets (use trufflehog or git-secrets
# in CI to enforce this on every push).
pip install trufflehog
trufflehog filesystem ./

# Or use git's built-in check
git log -p --all -S 'AUTH_SECRET=' | head -20   # shows the history
```

If a secret was ever committed, **rotate it immediately** — the old
value must be considered compromised even after the commit is deleted
(git history is persistent).

## 7. Dependabot (D.2)

The `.github/dependabot.yml` (added in D.2) opens weekly PRs for
dependency updates:

- npm updates in `app/` and `mcp-server/`
- GitHub Actions updates
- Groups minor+patch to limit PR noise
- Ignores critical packages (express, pg, jsonwebtoken) — these need
  manual review before update
- Labels every PR with `dependencies`

A PR that Dependabot opens will trigger the normal CI pipeline.
The PR can only be merged after `Lint`, `Typecheck`, `Test`, and
`Build` all pass (see `.github/branch-protection.md`).

---

## References

- [GitHub Actions: Encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [OWASP API Security Top 10 — API2:2023 Broken Authentication](https://owasp.org/API-security/editions/2023/en/0x11-t10/)
- [12-Factor App: Config](https://12factor.net/config)
- [security.md](../architecture/security.md) — full security reference
- [deployment.md](../operations/deployment.md) — production deploy guide
