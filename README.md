# Nouf-ex

> B2B/B2C e-commerce platform targeting Yemen and the Middle East, modelled on
> Alibaba/Taobao. React + Vite front-end, Express + PostgreSQL back-end.

[![Docs status](https://img.shields.io/badge/docs-passing-teal)](docs/BUILD.md)
[![CHANGELOG](https://img.shields.io/badge/keep--a--changelog-1.1.0-blue)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Diátaxis](https://img.shields.io/badge/Diátaxis-compliant-purple)](https://diataxis.fr/)
[![Last commit](https://img.shields.io/github/last-commit/nashwanzaher/nouf-ex/main)](../../commits/main)

**Live docs:** <https://nashwanzaher.github.io/nouf-ex/> (built from `docs/` by MkDocs, see [`docs/BUILD.md`](docs/BUILD.md))
· [Local index](docs/README.md) · [Getting started](docs/development/getting-started.md) ·
[Architecture](docs/architecture/overview.md) · [Roadmap](docs/planning/roadmap.md)

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
│   │   ├── db/pg-wrapper.cts     # async pg.Pool wrapper
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

> **The full rendered site lives at
> <https://nashwanzaher.github.io/nouf-ex/>.**
> Source files live in `docs/` and are organised by [Diátaxis](https://diataxis.fr/).
> The site is rebuilt on every push to `main` (see
> [`.github/workflows/docs.yml`](.github/workflows/docs.yml)).

| I want to …                              | Read                                                            |
| ---------------------------------------- | --------------------------------------------------------------- |
| Get the project running                  | [docs/development/getting-started.md](docs/development/getting-started.md) |
| Run an order end-to-end (tutorial)       | [docs/tutorials/run-an-order-end-to-end.md](docs/tutorials/run-an-order-end-to-end.md) |
| Understand the architecture              | [docs/architecture/overview.md](docs/architecture/overview.md) |
| Look up an endpoint                      | [docs/architecture/api.md](docs/architecture/api.md)            |
| Set up or update the database            | [docs/architecture/database.md](docs/architecture/database.md)  |
| Read the threat model / OWASP coverage   | [docs/architecture/security.md](docs/architecture/security.md)  |
| Work with Docker                         | [docs/operations/docker.md](docs/operations/docker.md)          |
| Deploy / monitor / back up               | [docs/operations/](docs/operations/)                            |
| Write or run tests                       | [docs/testing/README.md](docs/testing/README.md)                |
| Day-to-day dev workflow                  | [docs/development/workflow.md](docs/development/workflow.md)    |
| Code style / i18n / git workflow         | [docs/development/conventions.md](docs/development/conventions.md) |
| Build the docs site                      | [docs/BUILD.md](docs/BUILD.md)                                   |
| See what's planned                       | [docs/planning/roadmap.md](docs/planning/roadmap.md)            |
| Read the risk register / ADRs            | [docs/planning/risks.md](docs/planning/risks.md) · [docs/planning/adr/](docs/planning/adr/) |
| Read the original Alibaba/Taobao research | [archive/research/](archive/research/)                          |
| Read past code/UX reviews                | [archive/audit/](archive/audit/)                                |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). TL;DR: one concern per PR,
Conventional Commits, link to a MASTER_PLAN ID, run `npm run lint` and
`npm test` from `app/` before pushing.

## Standards

This project aligns with:

- **[IEEE 829-2008](https://standards.ieee.org/ieee/829/4987/)** — test
  documentation structure
- **[ISO/IEC/IEEE 29119](https://www.iso.org/standard/81291.html)** —
  software testing standards
- **[ISTQB CTFL v4.0](https://www.istqb.org/)** — test techniques
- **[Diátaxis](https://diataxis.fr/)** — documentation framework
- **[Keep a Changelog](https://keepachangelog.com/)** — CHANGELOG format
- **[Semantic Versioning](https://semver.org/)** — version numbers
- **[Conventional Commits](https://www.conventionalcommits.org/)** —
  commit messages
- **[Microsoft Docs](https://learn.microsoft.com/en-us/azure/devops/pipelines/)** —
  pipeline + architecture guidance

See [ADR-0001](docs/planning/adr/0001-mkdocs-and-release-please.md) for
the rationale behind the MkDocs + release-please stack.

## License

[MIT](LICENSE) — see [`LICENSE`](LICENSE) for the full text and the
academic-citation block. Third-party notices are listed inline in the
license file (React, Vite, Express, PostgreSQL, Vitest, Material for
MkDocs, Tailwind).

## Contributing & community

- [Contributing guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md) — Keep-a-Changelog v1.1.0, automated by
  [`release-please`](release-please-config.json)
- [Master execution plan](docs/MASTER_PLAN.md)
- [Architecture decision records](docs/planning/adr/README.md) — every
  significant decision traced back to its context, options, and consequences
