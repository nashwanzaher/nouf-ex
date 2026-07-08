# Getting Started — Deploy Nouf-ex with Docker

> **Validated workflow** (last run: 2026-06-24). Follow these steps in
> order and the API will be reachable at `http://localhost:3000`.

This guide covers the fastest path to a running stack:
**PostgreSQL (external)** + **Nouf-ex API + SPA (Docker)**.

For a deeper description of every component, see
[Architecture](architecture.md). For database details, see
[Database](database.md). For tests, see [Testing](testing.md).

---

## 0. Prerequisites

| Tool       | Version | Why                                                              |
| ---------- | ------- | ---------------------------------------------------------------- |
| Node.js    | **20+** | Builds the SPA (`npm run build`) and runs scripts locally        |
| npm        | **10+** | Comes with Node                                                  |
| Docker     | **24+** | Runs the API container                                           |
| PostgreSQL | **17**  | The application DB (`noufex_db`). Must be reachable from the API |

> The project does **not** ship a Postgres container. Bring your own —
> local install, Docker host network, or managed service. The setup
> script connects as the `postgres` superuser **once** to create the
> `noufex_app` least-privilege role, then the API uses that role.

A `psql` client is useful for ad-hoc queries. Everything below assumes
the host has Node, Docker, and a reachable Postgres server.

---

## 1. Clone the repository

```sh
git clone <repo-url> noufex
cd noufex
```

---

## 2. Configure the environment

```sh
cp .env.example .env
```

`.env.example` already points at the production `noufex_app` role.
Edit only the values you need to change.

### 2.1 Generate `AUTH_SECRET`

The HMAC signing key for bearer tokens. Required in production
(`loadEnv` throws if it's missing or shorter than 32 chars).

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Paste the output into `.env`:

```env
AUTH_SECRET=hhCu-sRDKPmBhgE2NxJrSk24t2zM07HdY3itkhgxOBw
```

> If you ever rotate `AUTH_SECRET`, every existing bearer token becomes
> invalid — users must log in again. The rotation is intentional.

### 2.2 Database credentials

```env

# The host's Postgres

DB_HOST=localhost
DB_PORT=5432
DB_NAME=noufex_db

# `db:setup` uses these to connect as the superuser (ONE TIME)

DB_USER=postgres
DB_PASSWORD=<your postgres superuser password>

# The container connects as the least-privilege `noufex_app` role

# (created by db:setup). The compose file passes these to the container.

DATABASE_URL=postgresql://noufex_app:CHANGE_ME_APP@host.docker.internal:5432/noufex_db
```

> On **Docker Desktop for Windows / Mac** the host is reachable as
> `host.docker.internal`. On **Linux** add `host.docker.internal` to
> the container's `extra_hosts` (the compose file already does this)
> or run with `--network=host`.

---

## 3. Install dependencies (host)

Required to run `db:setup` and to build the SPA.

```sh
cd app
npm install
cd ..
```

---

## 4. Provision the database (one-time, host)

```sh
cd app
DATABASE_URL=postgresql://postgres:<your-superuser-password>@localhost:5432/noufex_db \
  npm run db:setup
```

> The `DATABASE_URL` must be the **superuser** connection for the
> first run — only the superuser can create roles (`noufex_app`,
> `noufex_owner`, `noufex_readonly`) and grant table-level
> permissions. After the script finishes, the application connects
> through `noufex_app` exclusively.

You should see output like:

```
[db:setup] target: postgresql://postgres:***@localhost:5432/noufex_db
[db:setup] applying 0001_baseline    (migrations/0001_baseline.sql, 840 bytes)…
[db:setup] applying schema           (schema.sql, 25315 bytes)…
[db:setup] applying schema-extra     (schema-extra.sql, 11404 bytes)…
[db:setup] applying views            (views.sql, 5380 bytes)…
[db:setup] applying functions        (functions.sql, 8075 bytes)…
[db:setup] applying triggers         (triggers.sql, 4701 bytes)…
[db:setup] applying roles            (roles.sql, 4505 bytes)…
[db:setup] applying seed             (seed.sql, 42443 bytes)…
[db:setup]   migration 0009_search_backend.sql — applied
[db:setup] done.
```

The script is **idempotent** — re-running it is safe and applies any
pending migrations (0001 → 0009 as of 2026-06-24).

See [Database](database.md) for the full list of tables (29),
triggers, and PL/pgSQL functions created.

---

## 5. Build the SPA (host)

The image serves the React SPA from the same Express process. The
Vite output (`app/dist/`) is baked into the image at build time, so
you need to build it before `docker compose build`.

```sh
cd app
npm run build
cd ..
```

This produces `app/dist/` (the PWA shell + the chunked JS bundles:
`index-*.js`, `react`, `recharts`, `animation`, `radix-ui`, `lucide`).
Re-run whenever the frontend changes.

---

## 6. Build and start the container

```sh
docker compose up -d --build
```

What this does:

1. **Builds the image** (`Dockerfile` is multi-stage):
   - Stage `deps`: `npm ci` for production dependencies.
   - Stage runtime: `node:20-alpine` + `tini` (PID 1) + the API code.
2. **Starts the container** `Nouf-ex` on port 3000.
3. **Runs the entrypoint** (`scripts/devops/docker-entrypoint.sh`):
   - Polls `${DB_HOST}:5432` for up to 60 s (Postgres may not be ready).
   - Logs `DB reachable after Ns` once the TCP connection succeeds.
   - Execs `node server/bootstrap.cjs` (see §6.1 below).

Expected log:

```
[entrypoint] Nouf-ex API container starting...
[entrypoint] Waiting for PostgreSQL at host.docker.internal:5432/noufex_db...
[entrypoint] DB reachable after 0s
[entrypoint] Starting Nouf-ex API server on port 3000...
{"t":"...","level":"info","msg":"server_started","port":3000,...}
```

### 6.1 Why `bootstrap.cjs` (not `npx tsx`)

The server entry is `server/index.ts`, which mixes ESM-style imports
with `.cts` (CommonJS TypeScript) files. Running it with `npx tsx` or
`node --import tsx` directly leaves the CJS-loader hooks unregistered
for the `require()` chain that runs inside `.cts` files, and the
container crashes with:

```
TypeError: Cannot read properties of undefined (reading 'exports')
    at <anonymous> (/app/server/lib/shared.cts:31:8)
```

`server/bootstrap.cjs` solves this in two steps:

1. Calls `require('tsx/cjs')` to patch `Module._extensions['.ts']` and
   `Module._extensions['.cts']` so every subsequent `require()` of a
   TypeScript file goes through esbuild.
2. Captures the `app` from `index.ts`'s default export and calls
   `app.listen(port)` explicitly (the built-in `__isMainModule` check
   in `index.ts` would otherwise skip listening because the
   `process.argv[1]` URL no longer points at `index.ts`).

---

## 7. Verify the deployment

Three curl checks should all return 200 (use `curl.exe` on Windows):

```sh

# 1. Liveness — process is alive

curl http://localhost:3000/api/health

# {"status":"ok","uptime_s":20,"ts":"2026-06-24T05:33:05.948Z"}

# 2. Readiness — DB reachable

curl http://localhost:3000/api/ready

# {"status":"ready","uptime_s":20,"checks":{"db":{"ok":true,"ms":76}}}

# 3. Public stats — homepage counters

curl http://localhost:3000/api/stats/home

# {"success":true,"data":{"counts":{"products":"24","stores":"7",...}}}

```

Then check the container is healthy:

```sh
docker ps --filter "name=Nouf-ex" --format "{{.Names}} | {{.Status}}"

# Nouf-ex | Up 20 seconds (healthy)

```

`docker compose logs -f Nouf-ex` shows the structured JSON access log
(per-request `request_id`, `path`, `status`, `duration_ms`).

---

## 8. Day-to-day operations

| Action                    | Command                                                             |
| ------------------------- | ------------------------------------------------------------------- |
| Tail logs                 | `docker logs -f Nouf-ex`                                            |
| Open a shell in the API   | `docker exec -it Nouf-ex sh`                                        |
| Restart the API           | `docker compose restart Nouf-ex`                                    |
| Rebuild after code change | `cd app && npm run build && docker compose up -d --build`           |
| Stop the stack            | `docker compose down`                                               |
| Re-apply DB migrations    | `cd app && DATABASE_URL=postgresql://postgres:... npm run db:setup` |
| Re-hash seed passwords    | `cd app && node scripts/db/gen-seed-hashes.cjs`                    |
| Run all tests             | `cd app && npm test`                                                |
| Type check                | `cd app && npx tsc --noEmit -p tsconfig.app.json`                   |
| Lint                      | `cd app && npx eslint .`                                            |

---

## 9. Troubleshooting

| Symptom                                                                             | Cause / Fix                                                                                                                                                                 |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[db:setup] FAILED: no pg_hba.conf entry for host "192.168.x.x", user "noufex_app"` | The container `DATABASE_URL` is reaching the host's Postgres from a network not in `pg_hba.conf`. Add the host's docker-bridge IP to `pg_hba.conf` or use `--network=host`. |
| `[db:setup] target: postgresql://noufex_app:***@host.docker.internal:5432/...`      | `.env` picked the placeholder `noufex_app` URL. Override with `DATABASE_URL=postgresql://postgres:...` on the command line for the one-time superuser run.                  |
| Container keeps restarting with `TypeError: Cannot read properties of undefined`    | The image is older than the `bootstrap.cjs` fix. Rebuild: `docker compose build --no-cache`.                                                                                |
| `curl http://localhost:3000/api/health` returns "connection refused"                | The container has not finished initialising yet. Wait 10–20 s (the healthcheck polls every 30 s).                                                                           |
| `AUTH_SECRET must be ≥ 32 chars`                                                    | Run the `node -e "..."` command in §2.1 and paste the 43-char output into `.env`.                                                                                           |
| `port 3000 already in use`                                                          | Either stop the conflicting process or change `API_PORT` in `.env` and the `ports:` block in `docker-compose.yml`.                                                          |

---

## 10. Architecture summary (one-line per layer)

```
Browser  ─HTTPS─▶  Docker image: Nouf-ex
                       ├─ Express 5  (server/index.ts + bootstrap.cjs) :3000
                       │     ├─ REST /api/*  (admin, catalog, auth, cart, orders, payments, …)
                       │     └─ Static SPA   (app/dist/)
                       └─ PgDb wrapper  ─pg pool─▶  PostgreSQL 17 (noufex_db, 29 tables, RLS via noufex_app role)
```

The browser loads the PWA shell from `dist/`, then issues JSON calls
to `/api/*`. Every authenticated request includes
`Authorization: Bearer <token>` where the token is an HMAC-SHA256
payload signed with `AUTH_SECRET`.

For end-to-end user-flow diagrams (login, cart, checkout, 2FA, …) see
[Architecture → User flows](architecture.md#user-flows) or the project
git history on GitHub for historical audits.
