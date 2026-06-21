# Getting Started

## Prerequisites

| Tool          | Version       | Notes                                                                                |
| ------------- | ------------- | ------------------------------------------------------------------------------------ |
| Node.js       | **20+** (24 OK) | Project compiles and runs on Node 20 (used in the Docker image).                  |
| npm           | **10+**       | `pnpm` and `bun` also work; the lockfile is npm.                                    |
| PostgreSQL    | **17**        | Must be reachable from where the API runs. The project does **not** start Postgres. |
| Docker (opt.) | 24+           | Optional. Use the container image if you want the API isolated from your machine.   |

A `psql` client is useful for ad-hoc queries but not required — the API
itself talks to Postgres via `pg`.

---

## 1. Get the code

```sh
git clone <repo-url> noufex
cd noufex
```

## 2. Configure the environment

```sh
cp .env.example .env
```

The defaults in `.env.example` already point at:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=noufex_db
DB_USER=postgres
DB_PASSWORD=CHANGE_ME
DATABASE_URL=postgresql://postgres:CHANGE_ME@localhost:5432/noufex_db
```

Adjust if your Postgres server is not on `localhost`.

## 3. Install dependencies

```sh
cd app
npm install
```

## 4. Provision the database

```sh
# Make sure noufex_db exists (one-time, on the host)
psql -h localhost -U postgres -c "CREATE DATABASE noufex_db;"

# Apply schema + seed (idempotent)
npm run db:setup
```

See **[Database](database.md)** for full details.

## 5. Run the stack

### Option A — direct (Node)

```sh
# Terminal 1: API server on :3000
cd app
npm run api

# Terminal 2: Vite dev server on :5173 (proxies /api to :3000)
cd app
npm run dev
```

Open `http://localhost:5173`.

### Option B — Docker

```sh
# From the repo root
docker compose up -d --build
```

Open `http://localhost:3000`. The container serves the SPA **and** the API
on the same origin. `host.docker.internal` is mapped automatically
(`extra_hosts` is set for Linux, the hostname is built-in on Win/Mac).

To rebuild the SPA into the image:

```sh
cd app && npm run build   # populates app/dist/
docker compose up -d --build
```

---

## 6. Verify

| Check              | Command                          | Expected                                     |
| ------------------ | -------------------------------- | -------------------------------------------- |
| API health         | `curl http://localhost:3000/api/stats/home` | JSON with `stores`, `products`, … |
| DB reachable       | `npm run db:setup` (re-run)      | `done.`                                      |
| TypeScript         | `cd app && npx tsc -b` | exits 0 (checks app + node + server)     |
| Lint               | `cd app && npx eslint .`         | 0 errors, 0 warnings                          |
| Tests              | `cd app && npm test`             | all green                                    |

See **[Testing](testing.md)** for the full test layout.
