# Architecture — Nouf-ex

## One-line summary

A single Node/Express API talks to one external PostgreSQL database, and a
React/Vite SPA talks to that API. The whole thing runs as one Docker image
when deployed.

```
                ┌──────────────────────────────┐
                │  PostgreSQL 17 (external)    │
                │  database: noufex_db         │
                └──────────────┬───────────────┘
                               │ pg (TCP)
                               │
       ┌───────────────────────┴────────────────────────┐
       │                                                │
       │   Docker image: Nouf-ex                        │
       │   ┌────────────────────────────────────────┐   │
       │   │  Express 5 (server/index.ts, port 3000) │   │
       │   │  ├── REST endpoints (/api/*)          │   │
       │   │  ├── Static SPA fallback (dist/)      │   │
       │   │  └── PgDb wrapper (db/pg-wrapper.cjs)  │   │
       │   └───────────────┬────────────────────────┘   │
       │                   │                            │
       │   ┌───────────────┴────────────────────────┐   │
       │   │  Vite-built SPA (dist/)                │   │
       │   │  React 19 + Router 7                   │   │
       │   └────────────────────────────────────────┘   │
       └────────────────────────────────────────────────┘
                       ▲
                       │ HTTPS
                       │
                  ┌────┴────┐
                  │ Browser │
                  └─────────┘
```

## Component map

| Layer                | Tech                                                                                  | Files                                                                |
| -------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Database**         | PostgreSQL 17 — 27 tables across schema/schema-extra/views/functions/triggers/roles; migrations folder; `noufex_app` least-privilege role | `database/schema.sql`, `database/schema-extra.sql`, `database/views.sql`, `database/functions.sql`, `database/triggers.sql`, `database/roles.sql`, `database/seed.sql`, `database/migrations/` |
| **API**              | Node 20 + Express 5 + `pg`                                                            | `app/server/index.ts`                                                  |
| **DB access wrapper**| `PgDb` — async, mimics `better-sqlite3` API used by the route handlers                | `app/server/db/pg-wrapper.cjs`                                              |
| **Frontend tooling** | Vite 7 + TypeScript 5.9 + Tailwind 3.4 + shadcn/ui (new-york, slate)                   | `app/vite.config.ts`, `app/tailwind.config.js`, `app/components.json` |
| **Frontend app**     | React 19 + React Router 7 + 23 routes                                                 | `app/src/App.tsx`, `app/src/main.tsx`                                |
| **State**            | React Context (AppContext for i18n+auth, CartContext for cart) + `useApi` hooks        | `app/src/context/`, `app/src/hooks/useApi.ts`                        |
| **Forms**            | react-hook-form + zod resolver                                                        | various `pages/**`                                                   |
| **i18n**             | i18next + react-i18next + 3 locales (AR default, EN, ZH)                              | `app/src/i18n/`                                                      |
| **Charts / animation**| Recharts, Framer Motion, GSAP, Embla Carousel                                        | various                                                              |
| **Tests**            | Vitest 2 + supertest; `pg` mocked globally so tests run offline                       | `app/tests/`, `app/vitest.config.ts`                                 |
| **Lint / format**    | ESLint 9 (typescript-eslint, react-hooks, react-refresh) + Prettier                   | `app/eslint.config.js`                                               |
| **Container**        | `node:20-alpine` base, tini PID 1, entrypoint runs the API                            | `Dockerfile`, `docker/entrypoint.sh`                                 |
| **One-time DB setup**| `db-setup.cjs` reads `.env`, connects as `postgres` superuser, applies the 8-file pipeline (baseline + schema + extra + views + functions + triggers + roles + seed) plus any pending migrations. After this, the app uses the least-privilege `noufex_app` role. | `scripts/db-setup.cjs`                                           |

## Request lifecycle (typical)

```
Browser
  └─ GET /api/products
       └─ Express route handler (app/server/index.ts)
            └─ db.prepare('SELECT ...').all()         ← async via PgDb
                 └─ pg.Pool.query(sql, params)        ← placeholder rewrite
                      └─ PostgreSQL 17 (noufex_db)
       └─ JSON response → React component
            └─ useApi() hook (caches result)
                 └─ <ProductCard /> rendered
```

A transactional flow (e.g. `POST /api/orders`) wraps the writes in
`db.tx(async (txDb) => { ... })` so they commit together or roll back
together.

## Cross-cutting concerns

- **Authentication** — passwords hashed with `scrypt` + 16-byte random salt
  + `timingSafeEqual`. No JWT yet — endpoints rely on the `x-user-id` header
  (server stub for now; real session middleware is a P0 item).
- **Validation** — every writable endpoint accepts its payload through a
  `zod` schema before it touches the DB.
- **CORS** — restricted to `ALLOWED_ORIGINS` (default:
  `http://localhost:3000,http://localhost:5173`).
- **Rate limiting** — in-memory token bucket on `/api/auth/*` and
  `/api/payments`. Resets per process; document before scaling out.
- **i18n** — Arabic is the default and the source of truth for many
  strings. EN/ZH are kept in lock-step via the keys in `src/i18n/locales/`.
- **RTL** — set on `<html dir>` whenever the active locale is `ar`.

## Boundaries and what is **not** in scope

- **No containerised Postgres.** The DB is a shared, external resource.
- **No ORM.** SQL is hand-written. Use `db.prepare(...).all/get/run/tx`.
- **No message queue / background workers.** The API is synchronous.
- **No CDN / static hosting layer.** The API serves `dist/` directly when
  present.
