# Nouf-ex — `app/`

The front-end (React + Vite) and the back-end (Express + `pg`) live in
this single npm package to keep deployment and dependency management
simple. The Docker image is built from this directory.

## Layout

```
app/
├── server/                    # Express 5 backend (extracted from app/)
│   ├── index.ts               # Express entrypoint
│   ├── db/pg-wrapper.cts      # async pg.Pool wrapper
│   └── tests/                 # api-server.test.ts, schema.test.ts
│
├── src/                       # React 19 + Vite 7 frontend
│   ├── App.tsx, App.css, main.tsx, index.css
│   ├── components/            # Shared (Navbar, Footer, …) + ui/ (shadcn)
│   ├── context/               # AppContext, CartContext
│   ├── data/                  # Build-time JS fallbacks
│   ├── hooks/                 # useApi, use-mobile
│   ├── i18n/                  # locales/ar|en|zh.json + i18next setup
│   ├── lib/                   # api.ts (client), jsonData.ts, utils.ts
│   └── pages/                 # All routed pages (Home, Search, admin/, …)
│
├── tests/                     # Frontend tests + MSW mocks
│
├── public/                    # Static assets, JSON fixtures
│
├── scripts/                   # (empty after extraction; see ../../scripts/)
│
├── vite.config.ts, vitest.config.ts
├── tailwind.config.js, postcss.config.js
├── eslint.config.js, components.json
├── tsconfig*.json
└── package.json
```

## Common commands

```sh
npm install              # install
npm run dev              # Vite dev server with HMR
npm run api              # Express API on :3000 (server/index.ts)
npm run build            # tsc + vite build → dist/
npm run db:setup         # apply database/*.sql to the external Postgres
npm test                 # Vitest (frontend + backend)
npm run lint             # ESLint
```

See [`../docs/development.md`](../docs/development.md) for the full list.

## Where things are documented

- Project README: [`../README.md`](../README.md)
- Docs index: [`../docs/README.md`](../docs/README.md)
- API: [`../docs/api.md`](../docs/api.md)
- Conventions: [`../docs/conventions.md`](../docs/conventions.md)
- Architecture: [`../docs/architecture.md`](../docs/architecture.md)
