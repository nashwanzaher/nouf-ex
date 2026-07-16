# ADR-0008: OpenTelemetry (W3C Trace Context) for distributed tracing

## Status

Accepted

## Date

2026-07-14

## Context

The Noufex API serves requests across multiple bounded contexts:
HTTP (Express) → DB (PostgreSQL) → cache (Redis) → queue
(RabbitMQ) → workers → search (Elasticsearch). When a user
reports a slow checkout, the SRE on-call needs to follow the
request across all five hops.

We previously relied on X-Request-Id, a single correlation token.
It works for the API, but it gives us no parent/child
relationships, no standardised semantics, and no way to
sample intelligently.

## Decision

Adopt **OpenTelemetry** as the observability framework. Concretely:

1. `@opentelemetry/sdk-node` with **auto-instrumentations** for
   HTTP, Express, pg, ioredis, amqplib, @elastic/elasticsearch.
2. **W3C Trace Context** (`traceparent` + `tracestate`) propagator
   — the IETF standard for cross-service correlation.
3. Export to an **OTLP/HTTP** collector (the OpenTelemetry
   native protocol). The collector URL is read from
   `OTEL_EXPORTER_OTLP_ENDPOINT`, defaulting to none — so
   local dev runs zero-overhead.
4. The custom `httpTracingMiddleware` wraps every request in a
   server span, extracting the upstream `traceparent` and
   attaching `http.route`, `noufex.request_id`, and the
   response status.
5. Manual spans live in `tracing-spans.ts` for the cache, queue,
   and ES surfaces — auto-instrumentation handles the rest.

The implementation: `apps/api/src/lib/{telemetry,tracing-middleware,tracing-spans}.ts`.

## Consequences

### Positive

- Industry-standard tracing. Compatible with every APM on the
  market (Jaeger, Tempo, Honeycomb, Datadog, Dynatrace).
- W3C-compliant — incoming requests from upstream services
  (CDN edge, mobile clients) can carry `traceparent` and we
  pick it up automatically.
- Single global TracerProvider (via `@opentelemetry/api`) —
  no library-specific boileplate at call sites.

### Negative

- One more dependency. Mitigated: OpenTelemetry is CNCF
  graduated and the dependencies are well-maintained.
- Each request creates multiple spans. At 10 % sampling this
  adds ~1 µs per request, negligible.

### Neutral

- The OTLP exporter speaks HTTP/protobuf, which is verbose.
  We don't switch to gRPC to keep the deploy simple.