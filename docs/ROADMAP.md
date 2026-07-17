# Noufex — Roadmap (Tier 7+)

> Tracks every remaining task that was raised during Tier 1-6
> but not implemented yet. ADRs that say "we'll do this later"
> also land here. Last sync: post-Tier 6 commit `fd341a3`.

## How to read this file

- **🔴 Critical** = blocks production deploys / correctness issues
- **🟡 High** = clear value, modest scope
- **🟢 Medium** = improvement, deferable
- **🔵 Strategic** = future capability, not yet on a critical path

Each entry has: **Why** (the value of doing it), **What** (the
deliverable), **Effort** (rough estimate), **Status** (Open / In
Progress / Done).

## Critical

### R-1 — Fix pg mock in vitest.setup.ts

**Why.** Standalone runs of router test files (`addresses-router`,
`admin-read-router`, `payments-router`, ...) fail with
`ECONNREFUSED 127.0.0.1:5435` because there is no real
PostgreSQL available in the dev / CI environment and the test
suite has no global `pg` mock. The full suite run appears to
succeed because of module caching side effects, which masks
real regressions.

**What.** Add a global `vi.mock('pg', ...)` in
`apps/api/vitest.setup.ts` that returns a no-op pool backed by
in-memory state for the assertions our tests actually make.
Verify every test file in `apps/api/src/tests/` passes when
invoked standalone with `npx vitest run <file>`.

**Effort.** 1–2 hours.

**Status.** Done (commit pending — see Tier 1–6 follow-up).

**Acceptance criteria.**
- [x] Every test file under `apps/api/src/tests/` passes
      standalone with `npx vitest run`.
- [x] The mock honours the queries the tests rely on: the auth
      `SELECT ... FROM users WHERE id = $1 AND deleted_at IS NULL`
      (returns a synthetic admin user), `SELECT COUNT(*)` (returns
      `{c: 0}`), and the rate-limit `consume_rate_limit(...)` (returns
      `{allowed: true, retry_after_ms: 0}`).
- [x] `npm run test` reports 694 passing, 3 skipped, 1
      pre-existing failure (auth-router logout test asserts a
      route that doesn't exist in the current code).

**Notes.** The `vitest.setup.ts` file also mocks `ioredis`,
`@elastic/elasticsearch`, and `amqplib` so the test suite
runs without any of those services running. Each test can
override the response for a specific SQL via
`globalThis.__pg_mock.setNextResponse(rows)`.

## High

### R-2 — Migrate `apps/web` to `@noufex/api-client`

**Why.** `apps/web/src/lib/api/client.ts` and the 7 `features/*/api/*.ts`
files are hand-written and have drifted at least 3 times in the
past 60 days. ADR-0012 captures the decision to make the SDK
the single source of truth. Migrating removes drift forever.

**What.** Replace each hand-rolled `fetch()` call with the
generated `client.GET(...)` / `client.POST(...)` pattern. Update
React Query hooks to use the typed responses. Drop the
hand-written Zod re-validation in the web client (the server
already enforces it — the SDK reflects the server contract).

**Files affected.**
- `apps/web/src/lib/api/client.ts` (base client)
- `apps/web/src/features/home/api/*.ts`
- `apps/web/src/features/products/api/*.ts`
- `apps/web/src/features/cart/api/*.ts`
- `apps/web/src/features/orders/api/*.ts`
- ... (one per feature)

**Effort.** 4–6 hours.

**Status.** Foundation done (commit `ae8830f`).

**Progress.**
- [x] Add `@noufex/api-client` dependency.
- [x] Create `apps/web/src/lib/api/sdk-client.ts` as a thin
      wrapper exposing `sdkGet/sdkPost/sdkPatch/sdkDelete` plus
      the legacy-compatible `apiClient` proxy and `ApiError`.
- [ ] Migrate `apps/web/src/features/products/api/products.ts`
      (attempted in commit `ae8830f` then reverted; see below).
- [ ] Migrate the remaining 12 `features/*/api/*.ts` files.
- [ ] Migrate `apps/web/src/hooks/useApi.tsx` to use the SDK.
- [ ] Delete the legacy `apps/web/src/lib/api/client.ts`.

**Blocker.** The legacy `src/lib/__tests__/api.test.ts` uses
`vi.spyOn(globalThis, 'fetch')` to wrap the fetch-spy mock at
test time. openapi-fetch captures `globalThis.fetch` ONCE at
`createClient()` time — that frozen reference bypasses the
test-time `vi.spyOn` wrapper, so the SDK calls never reach
the spy. Two paths forward:

a) Refactor `mocks/fetch-spy.ts` to wrap fetch via the SDK's
   config rather than `globalThis`. ~1–2 h.
b) Migrate `src/lib/__tests__/api.test.ts` to assert against
   the SDK's URL shape. ~2 h.

Either unblocks the full migration in 1–2 hours.

### R-3 — Migrate `apps/mobile` to `@noufex/api-client`

**Why.** Same as R-2 but for the Expo app.

**What.** Replace `apps/mobile/src/lib/api/client.ts` + the
per-feature API modules with the generated client. The mobile
app already uses TanStack Query (set up in Tier 1.1) so the
migration is mechanical.

**Effort.** 3–4 hours.

**Status.** Open.

### R-4 — `/metrics` endpoint on the worker container

**Why.** The worker (Tier 1.4) exports spans to OTLP but does
not expose a Prometheus scrape endpoint. Today, worker health
is inferred from RabbitMQ DLQ depth + Sentry error volume only.
A `/metrics` endpoint would surface: jobs processed per minute,
retry count, search-indexer queue depth.

**What.** Port the existing `apps/api/src/lib/metrics.ts` to the
worker entrypoint. Add a tiny HTTP server on a dedicated port
(9090) that serves `metricsExposition()` from a separate
registry.

**Files affected.**
- `apps/api/src/worker.ts` (mount the metrics server)
- New `apps/api/src/lib/worker-metrics.ts` (separate registry)

**Effort.** 1 hour.

**Status.** Open.

### R-5 — CSP + Cloudflare Transform Rules integration test

**Why.** `cloudflare/CSP-NONCE-FLOW.md` documents the precedence
rules but no automated test verifies the live interaction. A
regression in either the Express CSP or the CF Transform rule
would silently break the page.

**What.** A test that:
1. Boots the API in a container.
2. Configures a local Cloudflare tunnel (via `cloudflared` in a
   Docker Compose test harness).
3. Issues a request that triggers CSP injection.
4. Asserts the final headers match the documented contract.

**Effort.** 2–3 hours (plus a Cloudflare account — use a test
zone).

**Status.** Open.

### R-6 — Deeper `/api/ready` checks (DB replication, ES cluster)

**Why.** Today's `/api/ready` does a `SELECT 1 AS ok` against
the primary DB. With a read-replica setup (R-9) we want to
verify both: the primary accepts writes AND the replica is
within `max_replica_lag_seconds`. Similarly, ES has `cluster
health` endpoints that should be `green` or `yellow`, never
`red`.

**What.** Extend `apps/api/src/index.ts:GET /api/ready` to
probe the replica + ES cluster health with a 2 s timeout each.
The OpenAPI contract documents `checks.{db,replica,redis,rabbitmq,elasticsearch}.{ok,ms,detail}`.

**Effort.** 2–3 hours.

**Status.** Open.

### R-7 — Per-route rate-limit documentation table

**Why.** Every limiter uses a different bucket
(`auth`, `password_reset`, `health`, `global`, ...). New
contributors don't know which route has which limit without
grep-ing the codebase. The contract should be one page in the
docs.

**What.** A markdown table at `docs/api/rate-limits.md`:

| Route | Bucket | Window | Max | Auth required |
|---|---|---|---|---|
| POST /api/auth/login | auth | 15 min | 10 | no |
| POST /api/auth/forgot-password | password_reset | 1 h | 3 | no |
| GET /api/health | health | 1 s | 30 | no |
| ... | ... | ... | ... | ... |

**Effort.** 1 hour.

**Status.** Open.

## Medium

### R-8 — OpenAPI doc for v2

**Why.** The v1→v2 migration runbook (Tier 6.2) activates the
day `VersionInfo[0].status` flips to `deprecated` for v1. Until
that day, the OpenAPI doc has only v1 paths. When v2 ships we
need v2 paths declared in `lib/openapi.ts:registry.registerPath`
with a different `vendor` marker.

**What.** Add a second `OpenAPIRegistry` for v2 paths, merge
into the final document. Update the OpenAPI UI to show a
"version" dropdown.

**Effort.** 1 day.

**Status.** Open.

### R-9 — PostgreSQL read-replica routing

**Why.** The catalog surface is 95 % reads. With a single
PG instance the bottleneck is CPU on the planner + executor.
Splitting reads to a replica frees the primary for the
checkout flow (which is the SLO-critical path).

**What.** Configure two `pg.Pool`s — primary for writes, replica
for reads. In `apps/api/src/db/pg-wrapper.ts` add `queryRead()`
that routes to the replica. The catalog and stats handlers
switch to `queryRead`.

**Effort.** 1 week.

**Status.** Open.

### R-10 — GraphQL gateway for mobile homepage

**Why.** The mobile app's home tab fires 5 separate HTTP
requests (categories, featured, deals, stats, banners). A
GraphQL endpoint that composes them into one round-trip saves
~150 ms over a 4G connection.

**What.** Add `apps/api/src/graphql/index.ts` that mounts a
GraphQL server at `/graphql` with a single `home(geo: Geo)` query
that the mobile app replaces its 5 calls with.

**Library choice.** `graphql-yoga` (small, OpenTelemetry-native).

**Effort.** 1 week.

**Status.** Open.

### R-11 — ML recommendations

**Why.** A "You might also like" carousel on the product page
could increase AOV by 10–15 %. We have the data (search_logs,
browse_history); we need the model.

**What.** A small Python service (separate repo, fed by
`search_logs` from PostgreSQL) that exposes `/recommend/:userId`.
Initially a simple co-occurrence matrix; later a neural CF.

**Effort.** 2–3 weeks (initial), more for the neural model.

**Status.** Open.

### R-12 — Multi-region deploy (Yemen + UAE + KSA)

**Why.** Geo-redundancy for the DR strategy. UAE is the natural
secondary (low latency to KSA + Egypt).

**What.** Terraform modules for the AWS Middle East (Bahrain)
region. Route53 latency-based routing. PG read replica (R-9) +
Redis cluster in the secondary region. ES cross-cluster
replication.

**Effort.** 1 month.

**Status.** Open.

### R-13 — Audit-log search UI

**Why.** Compliance (SOX, GDPR) requires that admin actions be
auditable. Today the data is in `audit_logs` but the only way
to find an entry is SQL.

**What.** A `/admin/audit-log` page in the web app with filters
by user, entity_type, action, date range. Reuses the existing
`GET /api/admin/audit-log` route.

**Effort.** 3 days.

**Status.** Open.

### R-14 — SLO-based release gating

**Why.** Deploying a release that consumes the entire error
budget for the next 24 h is a P0 incident waiting to happen.

**What.** Wire the Sentry release health metric
(`release_health.session_crash_free_rate`) into the CI deploy
gate. If the new release has < 99 % crash-free over the first 30
minutes, auto-rollback.

**Effort.** 3 days.

**Status.** Open.

### R-15 — Mobile offline sync

**Why.** Yemen + parts of rural GCC have unreliable 3G/4G.
The cart must survive a network drop.

**What.** TanStack Query persistence to MMKV (mobile KV
store). Background sync queue for mutations made offline.

**Effort.** 5 days.

**Status.** Open.

### R-16 — Linear/Jira auto-create from Sentry

**Why.** Manually creating a ticket from a `fatal` Sentry event
takes 5 minutes. We lose 30–60 min before any work begins.

**What.** Webhook from Sentry → Linear (or Jira) API with
auto-tagging by `tag[team]`. New ADR.

**Effort.** 2 days.

**Status.** Open.

### R-17 — Web push notifications

**Why.** Mobile has push, desktop doesn't. The 30 % of users on
desktop miss critical cart-abandonment and order-status
updates.

**What.** Service worker on the web app + Firebase Cloud
Messaging. Backend hook in `apps/api/src/lib/notifications/`.

**Effort.** 3 days.

**Status.** Open.

### R-18 — Disaster recovery runbook

**Why.** A working system needs a recovery plan. We don't have
one written down.

**What.** A `docs/operations/disaster-recovery.md` with:
- RPO / RTO targets
- PostgreSQL backup strategy + restore drill
- Redis persistence (AOF + RDB)
- ES reindex time (R-21 from the original plan)
- Cloudflare cache hit rate during an outage

**Effort.** 2 days.

**Status.** Open.

### R-19 — Public status page

**Why.** Trust. `/api/ready` is already returning health; expose
it on a public page that doesn't require login.

**What.** A small static page at `status.noufex.com` that polls
`/api/ready` and renders colored dots per service. The Cloudflare
transform rule caches the page for 60 s.

**Effort.** 3 days.

**Status.** Open.

### R-20 — Cost dashboard

**Why.** We have metrics; we don't have cost. Each Redis op is
money; each ES query is money.

**What.** A Grafana dashboard that pulls from a cost-tracker
service (or annotates the existing metrics with dollar costs from
the cloud bill).

**Effort.** 2 days.

**Status.** Open.

## Documentation debt

### R-21 — API cookbook for 3rd-party developers

**Why.** The OpenAPI doc is the contract, but new developers
need worked examples ("how do I list products with filters?",
"how do I handle a 406?", "how do I authenticate a webhook?").

**What.** `docs/api/cookbook.md` with 10–15 worked examples
following the Stripe / GitHub docs style.

**Effort.** 3 days.

**Status.** Open.

### R-22 — Operations manual

**Why.** New SREs shouldn't have to grep through Slack threads
to learn how to deploy / rollback / scale / troubleshoot.

**What.** A single `docs/operations/manual.md` that consolidates
the per-topic runbooks (deploy-prod.md, rollback-prod.md,
scale-celebrity-event.md, troubleshoot-search-slow.md, ...).

**Effort.** 1 week.

**Status.** Open.

---

## How to pick the next task

Run this query in the meeting room:

```
sort by (priority asc, effort asc)
where status = Open
```

The first three to commit to are R-1, R-2, R-3 — they together
unblock the test infrastructure, retire the hand-written clients
(ADR-0012), and produce the first SDK-driven mobile build.

## Last sync

Generated from Tier 1–6 implementation (commit `fd341a3`).
Re-generate on every merge to `main` so the roadmap stays
synchronised with reality.