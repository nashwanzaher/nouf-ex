# Nouf-ex — Docker Setup (API container only)

The PostgreSQL server is **not** part of this stack. It must already exist on
the host (or on a reachable network) and contain the `noufex_db` database.

## What runs inside the container

| Component        | Path inside container                  |
| ---------------- | -------------------------------------- |
| Express API      | `/app/server/index.ts` (run via `tsx`)   |
| Entrypoint       | `/usr/local/bin/noufex-entrypoint.sh`  |

The built SPA (if you ran `npm run build` first) is served from `/app/dist`
by the same API process.

## Reaching Postgres from inside the container

`docker-compose.yml` is pre-configured with `host.docker.internal` as
`DB_HOST`. That works out of the box on Docker Desktop for Windows and macOS.
On Linux, the `extra_hosts` directive maps `host.docker.internal` to the host
gateway so the same value works everywhere.

## One-time database setup

Before the first `docker compose up`, provision the schema and seed data on
the **host** Postgres (the API container does not auto-apply SQL files any
more):

```sh
# From the project root, against your local noufex_db
cd app
npm run db:setup
```

`db-setup.cjs` connects via `pg` and runs the canonical 8-file pipeline
(`migrations/0001_baseline.sql` + `schema.sql` + `schema-extra.sql` +
`views.sql` + `functions.sql` + `triggers.sql` + `roles.sql` + `seed.sql`) plus any
pending `migrations/NNNN_*.sql`.
All DDL uses `IF NOT EXISTS`, so the script is safe to re-run.

## Quick reference

```sh
# One-time DB setup (host-side, requires DATABASE_URL or .env)
cd app && npm run db:setup

# Build & start the API container
docker compose up -d --build

# Tail logs
docker logs -f Nouf-ex

# Open a shell inside the API container
docker exec -it Nouf-ex sh

# Stop
docker compose down
```

## Healthcheck

`HEALTHCHECK` hits `GET /api/stats/home` every 30 seconds. The container is
considered healthy only after the API responds with HTTP 200, which in turn
requires the database to be reachable and seeded.
