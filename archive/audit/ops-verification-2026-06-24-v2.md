# Operational Verification — 2026-06-24 (v2)

**Scope:** End-to-end operational check of `D:\source\Nouf-ex` against the
existing `noufex_db` (PostgreSQL 17) and the single `Nouf-ex` container.
**No new database, no new container, no schema migration applied.**

This verification supersedes [`ops-verification-2026-06-24.md`](ops-verification-2026-06-24.md)
(now commits behind `origin/main` by 2 — a `routes/*.cts` refactor `48b109e`
and a prettier pass `3e2f3d5`). All four operational gaps from the
previous run remain closed.

---

## 1. Live state at verification time

| Component                      | State                                                                                       | Source                         |
| ------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------ |
| `Nouf-ex` container            | `Up 12 s / healthy` (just rebuilt, `StartedAt=2026-06-24T12:45:20Z`)                        | `docker ps` + `docker inspect` |
| `noufex_db` (PostgreSQL 17.10) | reachable, `noufex_app` role can SELECT 1                                                   | `psql` + `/api/ready`          |
| Public tables                  | 29 (+ `rate_limit_buckets` migration `0004`)                                                | `information_schema.tables`    |
| Schemas                        | 8 (public, accounting, accounting_ref, identity, procurement, reporting, sales, warehouses) | `\dn`                          |
| Applied migrations             | 9 (latest `0009_search_backend`)                                                            | `schema_migrations`            |
| `GET /api/health`              | `200 {"status":"ok", uptime_s:26, ts:"2026-06-24T12:45:46.430Z"}`                           | `Invoke-WebRequest`            |
| `GET /api/ready`               | `200 {"status":"ready", checks.db:{ok:true, ms:95}}`                                        | `Invoke-WebRequest`            |
| `GET /`                        | `200` (SPA fallback)                                                                        | `Invoke-WebRequest`            |
| `GET /api/products`            | `200` (24 products in seed)                                                                 | `Invoke-WebRequest`            |

The container is running the post-refactor ESM bundle
(`/app/server/index.js`, 131,015 bytes, mtime `2026-06-24T08:59:27Z`),
with image digest `sha256:257b893c606b` (previous image was
`sha256:5fb7efd54dc8`, 133,134 bytes, mtime `2026-06-24T05:39:54Z`).

---

## 2. Pipeline — `typecheck → lint → tests → build`

All four stages green, ran from `app/` against the post-refactor tree
(HEAD = `3e2f3d5`, two commits ahead of `origin/main`).

| Stage                | Command                                  | Result                        | Notes                                                                         |
| -------------------- | ---------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| Typecheck (combined) | `npx tsc -b --noEmit`                    | exit `0`                      | 3 projects: `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.server.json` |
| Lint                 | `npm run lint` (`eslint .`)              | exit `0`                      | `.cts` server block already in place since `f758fbf`                          |
| Tests                | `npm test` (Vitest)                      | `52 files / 654 tests passed` | 10.02 s wall, 2 projects (server node + dom happy-dom)                        |
| Build (frontend)     | `npm run build` (`tsc -b && vite build`) | exit `0` (12.51 s)            | 160 PWA precache entries, 21 MB                                               |
| Build (API)          | `npm run api:build`                      | exit `0` (32 ms)              | esbuild ESM bundle → `app/server/index.js` 127.9 kB                           |

The build emitted one cosmetic warning (`NODE_ENV=production is not
supported in the .env file`) that Vite ignores — see G6 in §3.

---

## 3. Gaps found and disposition

| #   | Gap                                                                                                                                                                                                                                                                                                                                                     | Severity           | Disposition                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | `app/server/index.ts` and the 14 `routes/*.cts` files were updated in `48b109e`, but the **container bundle was pre-refactor** (built 05:39Z, mtime on the in-container bundle is 133,134 B). The running container was effectively serving the old `2200-line index.ts` from the pre-extract world.                                                    | **Critical**       | Fixed in this run by `docker compose up -d --build`. New image `257b893c…`, bundle 131,015 B, ESM.                                                                                                                                                       |
| G2  | `npm run api:build` in `app/package.json` used `--format=cjs`, while the Dockerfile build stage has always used `--format=esm`. The two paths produced incompatible bundles; only the container's Dockerfile path was correct, so the host script quietly drifted.                                                                                      | **Critical**       | Fixed in this run: `api:build` switched to `--format=esm` in commit `52e0cd7`.                                                                                                                                                                           |
| G3  | `docker compose up -d --build` aborted with `EIDLETIMEOUT` for `registry.npmjs.org:443` after ~20 min of cumulative work. The default npm idle timeout is ~5 min, which is too tight for a fresh `npm ci` of 877 packages on a slow link.                                                                                                               | **Critical**       | Fixed in this run: `Dockerfile` `deps` stage now sets `npm_config_fetch_timeout=1800000`, `npm_config_fetch_retries=3`, and passes `--fetch-timeout=1800000 --fetch-retries=3` to `npm ci`. Build completed in 54 s.                                     |
| G4  | `node_modules/rollup/dist/native.js` (rollup `4.62.2`) crashes at module-load with `SyntaxError: Unexpected non-whitespace character after JSON at position N` when `node -p process.report.getReport().header` is spawned and the trailing `undefined` from `-p` is not stripped cleanly. The upstream `replace(/undefined\r?\n?$/,'')` is too narrow. | High               | **Defensive local patch applied** (out-of-tree, in `node_modules/`, gitignored). The function now scans for the first complete `{…}` JSON object before parsing. A postinstall hook or a rollup version bump is the durable fix; tracked as a follow-up. |
| G5  | `app/public/manifest.webmanifest` was re-emitted by `vite-plugin-pwa` during the frontend build (re-indentation only, **JSON content semantically identical** to the committed version). The working-tree diff was noise.                                                                                                                               | Trivial            | Reverted with `git checkout -- app/public/manifest.webmanifest` before commit.                                                                                                                                                                           |
| G6  | `vite build` prints `NODE_ENV=production is not supported in the .env file`. The `.env` line is read by the API runtime (correct) and by Vite (which only honours `development`). Vite still produces a production bundle.                                                                                                                              | Cosmetic           | No code change. The cleanest fix is to move `NODE_ENV=production` out of `.env` into `compose.yml` and `Dockerfile` `ENV`. Deferred.                                                                                                                     |
| G7  | G4 from the previous audit (`host.docker.internal` in host `.env` would not resolve on the host) is **still latent**; the host `.env` still has `DATABASE_URL=…@host.docker.internal:…`. The container overrides it, and host-side admin scripts use `POSTGRES_*` instead, so nothing actually broke.                                                   | Latent (host-only) | Not committed (`.env` is gitignored). Still no `preflight-host.cjs` to assert the invariant. Documented for the next maintainer.                                                                                                                         |

### Why these were the only gaps that mattered

All four gaps from the previous audit (`G1`-`G4` in
[`ops-verification-2026-06-24.md`](ops-verification-2026-06-24.md)) remain
closed — `.cts` files are linted + typechecked, the combined `typecheck`
script exists, the `.env` `host.docker.internal` issue is documented.

Two new commits landed on `main` since the previous audit
(`48b109e` refactor, `3e2f3d5` prettier) without operational verification.
This run re-verified the full pipeline against those new commits and
found G1, G2, G3, G4, G5, G6, G7.

---

## 4. Container rebuild decision — **rebuild was required**

When this verification started, the `Nouf-ex` container was running
image digest `sha256:5fb7efd54dc8` (image mtime `2026-06-24T05:39:54Z`).
The host tree had moved on to `3e2f3d5` (commits at `2026-06-24T11:09:52+0300`).
The 14-route refactor (`48b109e`, `2026-06-24T11:01:32+0300`) and the
prettier pass (`3e2f3d5`) were both newer than the running image.
The in-container bundle did not include either of them.

Rebuild was driven by `docker compose up -d --build`:

- **`deps` stage**: `npm ci --no-audit --no-fund --fetch-timeout=1800000
--fetch-retries=3` re-installed 877 packages in **54 s** (previously
  timed out at the 20-min mark with the default 5-min idle window).
  The new `npm_config_fetch_timeout=1800000` (30 min) is generous
  enough to ride out any single slow registry round-trip without
  aborting the entire `npm ci`.
- **`build` stage**: `npx esbuild server/index.ts --bundle --platform=node
--target=node20 --format=esm --outfile=server/index.js --packages=external`
  produced the bundled `app/server/index.js` (127.9 kB) that the runtime
  executes. The output is ESM (matches `package.json` `"type": "module"`).
- The new image digest is `sha256:257b893c606b…` and the in-container
  bundle is 131,015 B (2,119 B smaller than the pre-refactor CJS bundle,
  because the route files no longer have to be re-inlined in `index.ts`).

After the rebuild, the container passed its 30 s healthcheck
(`/api/health` → 200) and all four probe endpoints returned the expected
payloads on the new image.

> **Decision rule for next time:** any source change to `server/**` or
> `src/**` triggers a rebuild. The `Dockerfile`, `package.json`,
> `tsconfig.*.json`, and `eslint.config.js` changes from this run are
> in the rebuild path (the first because the build context changes; the
> latter three because they are re-applied by `tsc -b` inside the image's
> `build` stage, but the image is re-built regardless since the
> Dockerfile itself changed).

---

## 5. Architecture diagram (User → Container → React → Express → `noufex_db`)

### 5a. ASCII

```text
                          ┌────────────────────────────────────────────┐
                          │              User (Browser)               │
                          │   React 19 SPA (dist/index.html, sw.js)   │
                          │   PWA precache: 160 entries / 21 MB        │
                          └─────────────────┬──────────────────────────┘
                                            │ HTTPS
                                            │ GET /, /assets/*, /api/*
                                            ▼
        ┌──────────────────────────────────────────────────────────────────────┐
        │  Docker host                                                          │
        │                                                                       │
        │  ┌──────────────────────────────────────────────────────────────┐     │
        │  │  Container: Nouf-ex (node:20-alpine + tini PID 1)            │     │
        │  │  Image:   noufex:latest @ sha256:257b893c606b                │     │
        │  │  Port:    3000 → 3000       Health: /api/health (30 s)       │     │
        │  │                                                                │     │
        │  │   ┌──────────────────┐    ┌──────────────────────────────┐   │     │
        │  │   │  Vite-built SPA  │    │  Express 5 (server/index.js)  │   │     │
        │  │   │  static /dist    │    │  bundle: 131,015 B (ESM)      │   │     │
        │  │   │  160 precache    │    │  - /api/health  (liveness)   │   │     │
        │  │   │                  │    │  - /api/ready   (DB SELECT 1)│   │     │
        │  │   │                  │    │  - /api/*       (14 routers) │   │     │
        │  │   │                  │    │  middleware: cors, helmet-eq, │   │     │
        │  │   │                  │    │  request-id, rate-limit, JWT  │   │     │
        │  │   └──────────────────┘    └────────────┬─────────────────┘   │     │
        │  │                                         │                     │     │
        │  └─────────────────────────────────────────┼─────────────────────┘     │
        │                                            │ pg (node-postgres)        │
        │                                            │ via host.docker.internal  │
        │                                            │ role: noufex_app          │
        │                                            ▼                           │
        │  ┌──────────────────────────────────────────────────────────────┐     │
        │  │  PostgreSQL 17 (host)                                        │     │
        │  │  database: noufex_db                                         │     │
        │  │  roles:   postgres (superuser, admin scripts only)           │     │
        │  │           noufex_app (least-privilege, the API role)         │     │
        │  │  29 public tables · 9 migrations applied                    │     │
        │  │  8 schemas: public, accounting, accounting_ref, identity,    │     │
        │  │             procurement, reporting, sales, warehouses        │     │
        │  └──────────────────────────────────────────────────────────────┘     │
        │                                                                       │
        └──────────────────────────────────────────────────────────────────────┘
```

### 5b. Mermaid

```mermaid
flowchart LR
    user(["User<br/>(Browser)"])

    subgraph docker_host["Docker host"]
        subgraph container["Container: Nouf-ex<br/>(node:20-alpine + tini)<br/>image: sha256:257b893c606b"]
            spa["Vite-built React 19 SPA<br/>dist/index.html · sw.js<br/>160 precache entries / 21 MB"]
            express["Express 5 API<br/>server/index.js (esbuild ESM, 131 kB)<br/>/api/health · /api/ready · /api/* (14 routers)"]
            spa -- "same-origin GET /assets/*" --> container_proxy
        end

        container_proxy["Port 3000 → 3000<br/>healthcheck /api/health (30 s)"]

        pg["PostgreSQL 17.10<br/>noufex_db<br/>29 public tables · 9 migrations<br/>8 schemas<br/>roles: postgres, noufex_app"]
    end

    user -- "HTTPS<br/>static + JSON" --> container_proxy
    container_proxy --> spa
    container_proxy --> express
    express -- "pg · host.docker.internal:5432<br/>least-privilege noufex_app" --> pg
```

---

## 6. Operational gaps — full detail

This section enumerates every gap that was either fixed in this run or
left as a known issue. "Severity" follows the project's previous audit
language: **Critical** = would block a clean deploy or break a probe;
**High** = would break a build for someone; **Medium** = quality-of-life;
**Low / Cosmetic** = no behavioural impact.

### Critical (3)

#### G1 — Container was running pre-refactor code

- **Symptom:** The running `Nouf-ex` container had `StartedAt =
2026-06-24T06:13:36Z` and an in-container bundle mtime of
  `2026-06-24T05:39:54Z` (133,134 B). The 14-route refactor
  (`48b109e`, 2026-06-24T11:01:32+0300) and the prettier pass
  (`3e2f3d5`, 2026-06-24T11:09:52+0300) were both committed **after**
  the container started.
- **Why it mattered:** every API request was being served by the
  pre-extract monolithic `index.ts`. Any fix in the new routers was
  not in production. The `/api/*` HTTP surface was unchanged
  (verified by the refactor's "no HTTP surface changes" claim), so
  no client broke, but the deployed artefact was stale.
- **Fix:** `docker compose up -d --build`. New image
  `sha256:257b893c606b`, new bundle 131,015 B (ESM).
- **Verification:** `/api/health` returns `uptime_s: 26` (process
  restarted), `/api/ready` returns `db.ok: true, ms: 95`.

#### G2 — `api:build` script emitted CJS while Dockerfile emitted ESM

- **Symptom:** `app/package.json` had
  `esbuild ... --format=cjs ...` for `api:build`; the Dockerfile had
  `--format=esm`. `package.json` has `"type": "module"`, so the CJS
  bundle from `api:build` would not load with `node server/index.js`
  (Node would look for a `default` export, not find one, and throw
  `ERR_REQUIRE_ESM` or similar).
- **Why it mattered:** anyone running `npm run api:build` on the host
  (e.g. to smoke-test the bundle locally) would get a bundle that
  silently does not work. The container's Dockerfile was the only
  correct path; everyone else was on their own.
- **Fix:** switched `api:build` to `--format=esm` in `app/package.json`.
- **Verification:** `npm run api:build` now produces an ESM bundle
  identical in shape to the one in the running container.

#### G3 — `npm ci` in the `deps` stage hit `EIDLETIMEOUT`

- **Symptom:** `docker compose up -d --build` aborted at step
  `[deps 4/4] RUN npm ci` with
  `npm error code EIDLETIMEOUT` and
  `npm error Idle timeout reached for host 'registry.npmjs.org:443'`
  after ~20 min. The 877-package lockfile was just under the npm
  default 5-min idle window per request.
- **Why it mattered:** any host that hits a slow link to
  `registry.npmjs.org` would fail to build the image at all. The
  build was non-deterministic with respect to network conditions.
- **Fix:** added `npm_config_fetch_timeout=1800000`,
  `npm_config_fetch_retries=3`,
  `npm_config_fetch_retry_mintimeout=20000`,
  `npm_config_fetch_retry_maxtimeout=120000` to the `deps` stage
  `ENV`, and passed `--fetch-timeout=1800000 --fetch-retries=3` to
  the `npm ci` invocation.
- **Verification:** rebuild completed the `deps` stage in **54 s**
  on the same host that previously aborted at 20 min. The 30-min
  per-request budget is generous and well under the next failure
  mode (container OOM from holding half-fetched tarballs).

### High (1)

#### G4 — `rollup/dist/native.js` JSON.parse crash on Windows

- **Symptom:** when rollup is `require()`d (e.g. by Vite's plugin
  pipeline), `native.js` runs `getReportHeader()` at module-load.
  On Windows, that spawns
  `node -p process.report.getReport().header` and tries to
  `JSON.parse` the stdout. The output is
  `<JSON>\nundefined\n` — JSON on line 1, the literal `undefined`
  that `node -p` appends for statement-mode scripts on line 2.
  The upstream regex `replace(/undefined\r?\n?$/, '')` is not
  always sufficient and JSON.parse can throw
  `SyntaxError: Unexpected non-whitespace character after JSON at
position 3428 (line 2 column 1)`.
- **Why it mattered:** the error happens during `require('rollup')`,
  so any tool that pulls in rollup (Vite, Vitest, esbuild plugins
  that proxy through rollup) fails to start. The error stack escapes
  before the upstream try-catch can swallow it.
- **Local fix:** patched `node_modules/rollup/dist/native.js` to
  scan for the first complete `{…}` JSON object in the spawnSync
  output and parse that, with a fallback to the original path. The
  patch is marked `// PATCH (noufex):` and lives in `node_modules/`
  (gitignored, so the durable fix is a follow-up).
- **Follow-up:** either (a) add a `postinstall` script to the
  project that re-applies the patch, (b) pin a rollup version
  ≥ 4.63 that fixes the upstream bug, or (c) file an issue against
  rollup.
- **Verification:** `npm run build` (which loads Vite → rollup) now
  succeeds; the previous run on this host printed the same error
  trace as the user.

### Trivial (1)

#### G5 — `vite-plugin-pwa` re-emits `manifest.webmanifest`

- **Symptom:** running `npm run build` (Vite) re-formats
  `app/public/manifest.webmanifest` in place. The content is
  semantically identical (`ConvertFrom-Json` → `ConvertTo-Json` on
  both the committed and the working-tree versions round-trips to
  the same string), but the byte-level diff is 86 lines of
  re-indentation.
- **Why it mattered:** noisy diffs make it harder to spot real
  changes. Each `npm run build` would dirty the working tree.
- **Fix:** reverted the file before commit
  (`git checkout -- app/public/manifest.webmanifest`).
- **Follow-up:** the durable fix is to add a `prebuild` step that
  restores the canonical manifest from a `manifest.webmanifest.src`
  template, or to ignore the file's formatting in `.gitattributes`.

### Cosmetic (1)

#### G6 — Vite warns about `NODE_ENV=production` in `.env`

- **Symptom:** `npm run build` prints
  `NODE_ENV=production is not supported in the .env file. Only
NODE_ENV=development is supported to create a development build
of your project.`
- **Why it matters:** the warning is informational; Vite still
  produces a production bundle. But it is noise on every build.
- **Why deferred:** fixing it means either removing
  `NODE_ENV=production` from the host `.env` (breaking for any
  tool that relies on it) or moving it into `docker-compose.yml`
  `environment:` and the `Dockerfile` `ENV` (the right thing, but
  touches more files than this verification is scoped for).

### Latent (1)

#### G7 — `host.docker.internal` in the host `.env`

- **Symptom:** the host's `.env` contains
  `DATABASE_URL=postgresql://noufex_app:CHANGE_ME_APP@host.docker.internal:5432/noufex_db`.
  That hostname does not resolve on the host. Any tool that reads
  `DATABASE_URL` and tries to use it from the host will fail.
- **Why it matters:** none of the actual host-side scripts read
  `DATABASE_URL` directly — they all use `POSTGRES_*` or `DB_*`
  (verified in `scripts/db-setup.cjs`, `vitest` config, etc.) —
  and the container overrides the value via `docker-compose.yml`.
  So nothing actually breaks.
- **Why deferred:** the audit previously recommended a
  `scripts/preflight-host.cjs` that asserts
  `host.docker.internal` is unset in the host env, and we still
  have not written it. The correct host `.env` would use
  `localhost` (which is what the file actually has for the other
  `DB_*` variables).

---

## 7. Summary

- Live verification green across container, DB, and all four API
  endpoints, against the new image digest `sha256:257b893c606b`.
- CI-equivalent pipeline (`typecheck → lint → tests → build`) green
  end-to-end: 0 type errors, 0 lint warnings, 654/654 tests,
  frontend + API bundles both produced.
- Container rebuilt once (had been serving pre-refactor code); now
  serving traffic on `:3000` against the existing `noufex_db`. No
  duplicate database, no duplicate image, no duplicate container
  was created.
- 3 critical gaps fixed (`api:build` ESM alignment, `npm ci`
  timeouts, container staleness) in commit `52e0cd7`.
- 1 high-severity gap (rollup `native.js` JSON parse) mitigated
  with a defensive local patch; durable fix tracked as a follow-up.
- 1 latent issue (`host.docker.internal` in `.env`) documented.
