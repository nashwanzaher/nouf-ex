# ADR-0002: Cache-aside with Redis + PG fallback (fail-OPEN)

## Status

Accepted

## Date

2026-07-05

## Context

Noufex serves a high read-to-write ratio catalog surface
(`GET /api/products*`, `GET /api/categories`, `GET /api/stats/home`).
Each request hits PostgreSQL by default; the data is small,
mostly-static, and changes only on seller-side PATCHes.

We needed a caching layer that:
1. Survives single-node outages (PM2 cluster, k8s replicas).
2. Doesn't depend on an always-on external service for the
   user-visible path.
3. Keeps the DB as the single source of truth.

Industry references: AWS ElastiCache docs ("cache-aside pattern"),
Facebook Memcache paper (the canonical "look-aside cache").

## Decision

Implement **cache-aside** with Redis as the L1 cache:

1. Read path: try Redis; on miss, query PG and populate Redis
   with the result.
2. Write path: on mutation, the API explicitly invalidates the
   affected keys via `cacheDel(...)`.
3. **Fail-OPEN contract**: every cache helper returns the
   safe no-op when Redis is unavailable. Callers MUST be able to
   handle a miss or write failure without breaking the request.

The implementation lives in `apps/api/src/lib/{redis,cache,cache-invalidate}.ts`.

## Consequences

### Positive

- Sub-millisecond reads for the 80 % of traffic that hits the
  cache.
- A Redis outage degrades performance, not correctness — DB
  load increases linearly with traffic but the system stays up.
- Per-cache-key invalidation is straightforward; the seller
  PATCH path busts only the affected keys.

### Negative

- Two sources of truth (Redis + PG) must stay consistent.
  Mitigation: writes always invalidate BEFORE returning 200,
  and the `setCacheKey(...)` helper uses `EX` (TTL) so an
  inconsistent state self-heals within minutes.
- Stale reads are possible if the invalidation message is
  dropped (RabbitMQ down + cache write fails). Mitigation: TTL
  caps the staleness at 5 minutes for products, 30 seconds for
  stats.

### Neutral

- The TTL choice (5 min for products, 1 h for categories, 30 s
  for stats) is empirical. We tune it as traffic patterns
  change.