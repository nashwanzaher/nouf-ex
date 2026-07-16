# ADR-0011: Workers in a separate container (Tier 1.4)

## Status

Accepted

## Date

2026-07-16

## Context

Originally, the RabbitMQ consumers (notification, email,
search-indexer, analytics) ran **in-process** alongside the API
in a single Node.js runtime. `startWorkers()` was called from
`index.ts`'s `__isMainModule` block.

This caused two operational problems:

1. **Coupled deploys.** Every API restart (deploy, crash
   recovery, scaling event) killed in-flight jobs. A
   `docker compose restart noufex` would drop every
   notification that was halfway through delivery.
2. **Resource contention.** The email worker holds SMTP
   connections open; the search-indexer holds long-running ES
   bulk requests. Both contend with the HTTP event loop for
   memory and CPU.

Industry references: AWS guidance on separating web and worker
roles; Shopify's split between web and job-orchestrator pods.

## Decision

Move workers to a separate container (`noufex-worker`) that:

1. Shares the same code as the API (same monorepo, same build)
   but has a different entrypoint (`apps/api/src/worker.ts`).
2. Connects to the same RabbitMQ cluster and reads the same
   queues as the API would have.
3. Scales independently: 1 worker for 1 k req/day, 10 workers
   for 50 k req/day.
4. Is restarted safely: `startPostAppEffects` in `worker.ts`
   registers signal handlers that flush in-flight jobs before
   exit (with a tight 2 s timeout — we'd rather drop events than
   block shutdown).

The API container's `startWorkers()` is now a no-op unless
`DISABLE_WORKERS=1` (legacy single-process mode for local dev
where the worker container is not running).

The infrastructure: `Dockerfile.worker` (3-stage multi-stage
build, Distroless runtime, healthcheck via `kill -0 1`).

## Consequences

### Positive

- API redeploys never drop in-flight notifications.
- Email / search-indexer workloads can't slow down HTTP
  responses.
- Horizontal scaling is per-tier: scale the worker container
  to 10 replicas without touching the API.

### Negative

- One more service to operate. Mitigated: the worker image
  is half the size of the API image (no Express, no static
  assets, no OpenAPI doc).
- In a multi-worker deployment, two workers can race on the
  same message. RabbitMQ handles this — `consume` is
  exclusive to a single consumer at a time, so the duplicate
  is rare (only on `cancel`/`reconnect`).

### Neutral

- Workers now need their own metrics endpoint (`/metrics`
  added in a future tier; for now we use the same OTLP export).