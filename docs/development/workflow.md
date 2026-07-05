# Development Workflow

Daily commands. All of them assume your shell is in `app/` unless noted.

## Scripts (npm)

| Script                | What it does                                                          |
| --------------------- | --------------------------------------------------------------------- |
| `npm run dev`         | Vite dev server with HMR.                                             |
| `npm run build`       | `tsc -b && vite build` → `dist/`.                                     |
| `npm run preview`     | Serve the built `dist/` for a final smoke test.                       |
| `npm run api`         | Run the Express API via `tsx` on `API_PORT` (default 3000).           |
| `npm run api:prod`    | Same as `api` but with `NODE_ENV=production`.                         |
| `npm run api:build`   | esbuild → single-file `server/index.js` for non-Node-TS deployments.  |
| `npm run db:setup`    | Apply the canonical SQL pipeline (schema + extra + views + functions + triggers + roles + seed) plus any pending migrations to the external Postgres. |
| `npm test`            | Vitest run once.                                                      |
| `npm run test:watch`  | Vitest watch mode.                                                    |
| `npm run test:coverage` | Vitest with V8 coverage → `coverage/`.                              |
| `npm run test:ui`     | Vitest's interactive UI.                                              |
| `npm run lint`        | ESLint over `app/src/`, `app/server/`, `app/tests/`, `scripts/`. (`scripts/` is now organized into `db/`, `devops/`, `quality/`, `maintenance/` sub-folders — see [`scripts/README.md`](../../scripts/README.md).) |

## Lint

- Config: `app/eslint.config.js` (flat config).
- Run: `npm run lint` or `npx eslint .` from `app/`.
- **No `// eslint-disable` comments.** All rules are enforced. The only
  folder-scoped exemption is `react-refresh/only-export-components` for
  `src/components/ui/**` and `src/context/**` (shadcn convention).

## Format

- Prettier is the default formatter (`.vscode/settings.json`).
- 2-space indent, LF endings, single quotes, no semi (see Prettier
  defaults).
- Save-on-format is on for `.ts`, `.tsx`, `.json`, `.jsonc`, `.css`,
  `.html`. The Docker extension formats `.dockerfile` files.

## Type-check

- Config: `app/tsconfig.json` references three sub-projects:
  - `tsconfig.app.json` — browser/DOM (frontend)
  - `tsconfig.node.json` — Node tooling (`vite.config.ts`, `vitest.config.ts`)
  - `tsconfig.server.json` — backend (`app/server/**`, including `pg-wrapper.cts`)
- Run: `npx tsc -b` (checks everything) or
  `npx tsc --noEmit -p tsconfig.app.json` (frontend only).
- All aliases are routed through `@/_` → `app/src/_`.

## Test

- Config: `app/vitest.config.ts`.
- Two environments: `node` for `tests/` and `src/lib/`, `happy-dom` for
  `src/**/__tests__/`.
- `pg` is mocked globally — see [`testing.md`](testing.md).

## VS Code tasks

The workspace ships with `.vscode/tasks.json` so you can run common
commands from the command palette:

- 🚀 Start Full Stack (Docker)
- 📜 Show Nouf-ex Container Logs
- 🛑 Stop Nouf-ex Container
- 🐚 Exec Into Nouf-ex Container
- 🧹 Wipe Postgres Data Volume
- 📦 Install Dependencies (app/)
- 📝 TypeScript Type Check
- 🔨 Build API Server (esbuild)
- 🎨 Build Frontend (Vite)
- 🧪 Run Vitest Tests
- 👀 Vitest Watch Mode
- 📊 Vitest Coverage
- 🧹 Lint (ESLint)

… and `.vscode/launch.json` provides F5 debug configs:

- 🟢 Run Vite Dev Server
- 🚀 Run API Server (tsx)
- 🔌 Attach to API (3000)
- 🧪 Run Vitest (current file)
- ▶️ Full Stack (API + Vite) — compound config

## Recommended extensions

See `.vscode/extensions.json` (13 recommendations, 19 unwanted). For the
full audit, see [`audit/extensions.md`](audit/extensions.md).

## Adding a new dependency

```sh

# From app/

npm install <pkg>
npm install -D <pkg>
```

The lockfile is `package-lock.json`. Do not switch lockfiles without a
team-wide decision.
