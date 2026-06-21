# Nouf-ex

> B2B/B2C e-commerce platform targeting Yemen and the Middle East, modelled on
> Alibaba/Taobao. React + Vite front-end, Express + PostgreSQL back-end.

**Live docs:** [`docs/`](docs/) · [Getting started](docs/getting-started.md) ·
[Architecture](docs/architecture.md) · [Roadmap](docs/roadmap.md)

---

## What's in this repo

```
.
├── app/                          # Single npm package: frontend + backend
│   ├── src/                      # React 19 + Vite 7 frontend
│   │   ├── components/           # Layout, Navbar, Footer, … + ui/ (shadcn)
│   │   ├── context/              # AppContext (i18n + auth), CartContext
│   │   ├── data/                 # build-time JS fallbacks
│   │   ├── hooks/                # useApi, use-mobile
│   │   ├── i18n/                 # locales/ar|en|zh.json + i18next setup
│   │   ├── lib/                  # api.ts (client), jsonData.ts, utils.ts
│   │   └── pages/                # Home, Search, ProductDetail, StorePage, …
│   │       ├── admin/  auth/  customer/  seller/  Home/
│   ├── server/                   # Express 5 API (extracted from app/)
│   │   ├── index.ts              # Express entrypoint
│   │   ├── db/pg-wrapper.cjs     # async pg.Pool wrapper
│   │   └── tests/                # api-server.test.ts, schema.test.ts
│   ├── tests/                    # Frontend setup + MSW mocks
│   ├── public/                   # Static assets + JSON snapshots
│   └── package.json, vite/vitest configs, eslint, tsconfig, …
│
├── database/                     # PostgreSQL 17 schema + seed (host-side)
│   ├── README.md
│   ├── schema.sql                # 16 base tables
│   ├── schema-extra.sql          # 9 extra tables (payments, coupons, refunds, …)
│   ├── views.sql                 # 4 read-only views (security_invoker)
│   ├── functions.sql             # 7 PL/pgSQL trigger functions
│   ├── triggers.sql              # 9 trigger definitions
│   ├── roles.sql                 # noufex_app + noufex_owner + noufex_readonly
│   ├── seed.sql                  # Idempotent demo data (real scrypt hashes)
│   └── migrations/               # incremental schema changes (NNNN_*.sql)
│
├── scripts/                      # Project-level helpers
│   ├── README.md
│   ├── db-setup.cjs              # Applies the 8-file pipeline + migrations
│   ├── gen-seed-hashes.cjs       # Generates scrypt hashes for seed users
│   └── test-summary.cjs          # Clean vitest summary
│
├── docker/
│   └── entrypoint.sh             # Runs the API inside the container
│
├── docs/                         # All documentation (start with docs/README.md)
│
├── Dockerfile                    # API image (Postgres is external)
├── docker-compose.yml            # Single service: Nouf-ex
├── .env.example                  # DATABASE_URL template (uses CHANGE_ME placeholders)
└── .vscode/                      # Editor config (extensions, settings, tasks, launch)
```

## Stack

| Layer        | Tech                                                                                |
| ------------ | ----------------------------------------------------------------------------------- |
| Database     | PostgreSQL 17 (external, database `noufex_db`)                                      |
| API          | Node 20 + Express 5 + `pg`, scrypt hashing, zod validation, in-memory rate limiting  |
| Frontend     | React 19 + React Router 7 + Vite 7 + Tailwind 3 + shadcn/ui                         |
| i18n         | i18next — Arabic (default) / English / Chinese                                       |
| Tests        | Vitest 2 + supertest; `pg` is mocked globally                                       |
| Container    | `node:20-alpine` + tini PID 1                                                       |

## Quick start (4 commands)

```sh
cp .env.example .env             # then fill in your DB password
cd app && npm install
npm run db:setup                 # applies database/*.sql to the external Postgres
docker compose up -d --build     # API image; connects via host.docker.internal
```

→ open `http://localhost:3000`.

Without Docker:

```sh
cp .env.example .env
cd app && npm install && npm run db:setup
# Terminal 1
npm run api                      # Express on :3000
# Terminal 2
npm run dev                      # Vite on :5173
```

Full instructions in [docs/getting-started.md](docs/getting-started.md).

## Documentation map

| I want to …                              | Read                                                  |
| ---------------------------------------- | ----------------------------------------------------- |
| Get the project running                  | [docs/getting-started.md](docs/getting-started.md)    |
| Understand the architecture              | [docs/architecture.md](docs/architecture.md)          |
| Set up or update the database            | [docs/database.md](docs/database.md)                  |
| Work with Docker                         | [docs/docker.md](docs/docker.md)                      |
| Write or run tests                       | [docs/testing.md](docs/testing.md)                    |
| Day-to-day dev workflow                  | [docs/development.md](docs/development.md)            |
| Code style / i18n / git workflow         | [docs/conventions.md](docs/conventions.md)            |
| Look up an endpoint                      | [docs/api.md](docs/api.md)                            |
| See what's planned                       | [docs/roadmap.md](docs/roadmap.md)                    |
| Read the original Alibaba/Taobao research | [docs/research/](docs/research/)                      |
| Read past code/UX reviews                | [docs/audit/](docs/audit/)                            |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). TL;DR: one concern per PR,
imperative commit subjects, link to a roadmap item, run `npm run lint` and
`npm test` before pushing.

## License

Not yet licensed. Add a `LICENSE` file before any public release.
