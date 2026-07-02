# Monitoring & Observability — Nouf-ex

> **Scope:** Production observability for the Nouf-ex REST API.
> **Audience:** SRE, ops, on-call engineers.
> **Last reviewed:** 2026-06-28
> **Standard:** [Google SRE Book — Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/) · [USE method](https://www.brendangregg.com/usemethod.html) · [RED method](https://www.weave.works/blog/the-red-method-key-metrics-for-microservices-architecture/)

---

## Table of Contents

1. [Three pillars of observability](#1-three-pillars-of-observability)
2. [Structured logging](#2-structured-logging)
3. [Metrics](#3-metrics)
4. [Request tracing](#4-request-tracing)
5. [Alerting](#5-alerting)
6. [Runbooks](#6-runbooks)
7. [On-call playbook](#7-on-call-playbook)
8. [Capacity planning](#8-capacity-planning)
9. [Tools (current + future)](#9-tools-current--future)
10. [References](#10-references)

---

## 1. Three pillars of observability

We implement all three:

| Pillar | Implementation | Example |
|--------|----------------|---------|
| **Logs** | Single-line JSON to stdout (`middleware.ts:107-117`) | `{"t":"2026-06-28T...","level":"info","msg":"request","request_id":"...","method":"GET","path":"/api/health","status":200,"duration_ms":1.2}` |
| **Metrics** | Aggregated from logs (today); Prometheus-format endpoint (roadmap) | Request rate per endpoint, error rate, p50/p95/p99 latency |
| **Traces** | `x-request-id` propagated through every log line + response header | `req.id` correlates all logs for one request |

The "USE method" (Utilization, Saturation, Errors) is applied per
resource (CPU, DB connections, rate-limit buckets).

---

## 2. Structured logging

### 2.1 Log format

Every log line is a **single-line JSON object** with at minimum:

```json
{
  "t": "2026-06-28T12:34:56.789Z",   // ISO timestamp
  "level": "info" | "warn" | "error", // log level
  "msg": "<event-type>",               // discriminator
  "request_id": "<uuid>",              // x-request-id (omitted for startup logs)
  ...                                  // event-specific fields
}
```

### 2.2 Event types

| Event type | Level | When | Example fields |
|------------|-------|------|----------------|
| `request` | info | Every HTTP request finishes | `method`, `path`, `status`, `duration_ms`, `user_id` |
| `http_error` | warn | Custom HttpError thrown | `status`, `code`, `path` |
| `pg_error` | warn | Postgres error returned to client | `pg_code`, `pg_constraint`, `path` |
| `validation_error` | warn | Zod validation failed | `path` |
| `unhandled_error` | error | Uncaught exception | `error_name`, `error_message`, `stack` |

### 2.3 Levels

| Level | When | Default in prod |
|-------|------|-----------------|
| `debug` | Verbose diagnostic | disabled |
| `info` | Normal lifecycle | **enabled** |
| `warn` | Recoverable issue | enabled |
| `error` | Unhandled exception | enabled |

Set via `LOG_LEVEL` env var.

### 2.4 Example log lines

Successful request:

```json
{"t":"2026-06-28T12:34:56.789Z","level":"info","msg":"request","request_id":"a1b2c3d4-...","method":"GET","path":"/api/products","status":200,"duration_ms":12.34,"user_id":2}
```

Auth failure:

```json
{"t":"2026-06-28T12:34:57.001Z","level":"warn","msg":"http_error","request_id":"b2c3d4e5-...","status":401,"code":"AUTH_INVALID","path":"/api/auth/me"}
```

DB constraint violation:

```json
{"t":"2026-06-28T12:34:57.500Z","level":"warn","msg":"pg_error","request_id":"c3d4e5f6-...","pg_code":"23505","pg_constraint":"users_email_unique","path":"/api/auth/register"}
```

Uncaught exception (with full stack):

```json
{"t":"2026-06-28T12:34:58.001Z","level":"error","msg":"unhandled_error","request_id":"d4e5f6a7-...","path":"/api/orders","method":"POST","error_name":"TypeError","error_message":"Cannot read property...","stack":"TypeError: ..."}
```

### 2.5 Log shipping

The Docker container emits logs to stdout. A log shipper (future:
Loki / Elasticsearch / Vector / Fluentbit) tails the container and
forwards to a central store.

```yaml

# docker-compose.yml (future)

services:
  vector:
    image: timberio/vector:latest-alpine
    volumes:
      - ./vector.toml:/etc/vector/vector.toml
    depends_on: [noufex]
```

Sample `vector.toml`:

```toml
[sources.noufex]
type = "docker_logs"
include_images = ["noufex:latest"]

[transforms.parse]
type = "remap"
source = "noufex"
mapping = '''
  . |= parse_json!(.message)
'''

[sinks.loki]
type = "loki"
inputs = ["parse"]
endpoint = "http://loki.internal:3100"
```

---

## 3. Metrics

### 3.1 RED method (per service)

| Metric | Source | Aggregation |
|--------|--------|-------------|
| **Rate** (req/s) | `request` log events | Count by `path` + window |
| **Errors** (5xx / 4xx rate) | `request` log events with `status >= 400` | Count by `status` + window |
| **Duration** (latency) | `duration_ms` field | p50 / p95 / p99 by `path` |

### 3.2 USE method (per resource)

| Resource | Metric | Threshold |
|----------|--------|-----------|
| API process | CPU% | alert > 80% for 5m |
| API process | Memory RSS | alert > 80% of limit |
| API process | Event loop lag | alert > 1s |
| Postgres | Active connections | alert > 80% of `max_connections` |
| Postgres | Replication lag | alert > 30s |
| Postgres | Disk usage | alert > 80% |
| Rate-limit buckets | Size | alert > 100K rows |

### 3.3 Endpoints to monitor

```yaml

# Synthetic monitoring (every 60s)

- name: API health
  url: https://noufex.example.com/api/health
  expect_status: 200
  timeout: 5s

- name: API readiness
  url: https://noufex.example.com/api/ready
  expect_status: 200
  expect_json_path: checks.db.ok
  expect_value: true
  timeout: 5s

- name: Public catalog
  url: https://noufex.example.com/api/products?limit=1
  expect_status: 200
  expect_json_path: data.total
  expect_value_gt: 0
  timeout: 10s

- name: SPA root
  url: https://noufex.example.com/
  expect_status: 200
  expect_body_contains: '<html'
  timeout: 10s
```

### 3.4 Future: Prometheus metrics endpoint

We do not yet expose a `/metrics` endpoint. When we do (roadmap), it
will return text/plain in the standard format:

```text

# HELP noufex_http_requests_total Total HTTP requests

# TYPE noufex_http_requests_total counter

noufex_http_requests_total{method="GET",path="/api/products",status="200"} 12345

# HELP noufex_http_request_duration_seconds Request latency

# TYPE noufex_http_request_duration_seconds histogram

noufex_http_request_duration_seconds_bucket{method="GET",path="/api/products",le="0.005"} 8000
...

# HELP noufex_rate_limit_buckets_size Current rate-limit bucket count

# TYPE noufex_rate_limit_buckets_size gauge

noufex_rate_limit_buckets_size 42
```

---

## 4. Request tracing

Every request has a **UUID v4** identifier, exposed as the
`x-request-id` header on both request and response. The same UUID
appears in **every log line** for that request.

### 4.1 Incoming request ID

If the client sends `x-request-id: <uuid>`, the server uses it (if
length ≤ 64 chars). Otherwise a fresh UUID is generated.

```ts
// middleware.ts:26
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.length <= 64 ? incoming : randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
};
```

### 4.2 Tracing a failed request

When a user reports a problem, ask for the `x-request-id` from their
browser dev tools. Then:

```sh

# Search logs for that request_id

docker logs Nouf-ex 2>&1 | grep "a1b2c3d4-...-..."

# Or in your log shipper:

loki-cli query '{job="noufex"} |= "a1b2c3d4-..."'
```

You'll get **every log line** that touched that request.

### 4.3 Tracing a request flow (planned)

When we add `traceparent` (W3C Trace Context) headers, we'll
propagate `trace_id` and `span_id` alongside `request_id`. For now,
`request_id` is sufficient for single-request debugging.

---

## 5. Alerting

### 5.1 Severity matrix

| Severity | Definition | Response time | Notify |
|----------|------------|---------------|--------|
| **SEV-1** | Service down or data integrity issue | Immediate (within 15 min) | Page on-call |
| **SEV-2** | Degraded service (e.g., one endpoint 5xx) | Same business day | Slack + email |
| **SEV-3** | Performance issue (p99 > 2s) | Within 1 business day | Slack |
| **SEV-4** | Hygiene (e.g., disk 70%) | Best-effort | Slack |

### 5.2 Alert rules (current)

We do not yet have a centralized alerting system. Below are the rules
we would configure in Grafana / Alertmanager / Sentry.

```yaml
- alert: NoufExAPIDown
  expr: probe_success{job="noufex-health"} == 0
  for: 2m
  severity: SEV-1
  notify: [pagerduty_oncall, slack_noufex_alerts]
  runbook: docs/operations/monitoring.md#api-down

- alert: NoufExHighErrorRate
  expr: |
    sum(rate(noufex_http_requests_total{status=~"5.."}[5m]))
    /
    sum(rate(noufex_http_requests_total[5m])) > 0.01
  for: 5m
  severity: SEV-2
  notify: [slack_noufex_alerts]
  runbook: docs/operations/monitoring.md#high-error-rate

- alert: NoufExHighP99Latency
  expr: |
    histogram_quantile(0.99, sum(rate(noufex_http_request_duration_seconds_bucket[5m])) by (le)) > 2
  for: 10m
  severity: SEV-3
  notify: [slack_noufex_alerts]

- alert: NoufExDBConnectionsHigh
  expr: noufex_db_active_connections / noufex_db_max_connections > 0.8
  for: 5m
  severity: SEV-2
  notify: [slack_noufex_alerts]
  runbook: docs/operations/monitoring.md#db-connection-pool

- alert: NoufExRateLimitBucketOverflow
  expr: noufex_rate_limit_buckets_size > 100000
  for: 10m
  severity: SEV-3
  notify: [slack_noufex_alerts]
```

### 5.3 Suppression rules

To prevent alert fatigue:

```yaml
- suppress: NoufExAPIDown during deploys
  matchers: [alertname=~"NoufEx.*"]
  starts_at: ${DEPLOY_START}
  ends_at: ${DEPLOY_END}
  comment: "Deploy in progress; alerts silenced for 5 min"
```

---

## 6. Runbooks

### 6.1 API down (`/api/health` returns 5xx or times out)

**Symptoms:** `/api/health` 5xx for 2+ minutes; nginx returns 502/504.

**Diagnosis:**

```sh

# 1. Check container status

docker ps | grep Nouf-ex

# 2. Check logs (last 200 lines)

docker logs --tail 200 Nouf-ex | jq

# 3. Check DB connection

docker exec Nouf-ex node -e "console.log(process.env.DATABASE_URL ? 'set' : 'MISSING')"

# 4. Check rate-limit bucket overflow

psql -h $DB_HOST -U noufex_owner -d noufex_db \
  -c "SELECT count(*) FROM rate_limit_buckets;"

# 5. Test from inside the container

docker exec Nouf-ex curl -sf http://localhost:3000/api/health
```

**Common root causes:**

| Symptom in logs | Root cause | Fix |
|------------------|-------------|-----|
| `unhandled_error: ECONNREFUSED` | DB unreachable | Check DB container; restart if needed |
| `unhandled_error: EADDRINUSE` | Port conflict | Stop duplicate process |
| `AUTH_SECRET env var is required` | Missing env var | Set in `.env` and restart |
| `verifyAuthToken: invalid` spike | Clock skew or token leak | Rotate `AUTH_SECRET` (revoke all sessions) |

### 6.2 High error rate (5xx > 1%)

**Symptoms:** `pg_error`, `unhandled_error`, or `http_error` events with
status >= 500 appearing > 1% of total.

**Diagnosis:**

```sh

# 1. Aggregate error types in last 5 minutes

docker logs --since 5m Nouf-ex | jq -r 'select(.level == "error" or .level == "warn") | .msg' | sort | uniq -c | sort -rn

# 2. Specific 5xx endpoints

docker logs --since 5m Nouf-ex | jq 'select(.status >= 500) | .path' | sort | uniq -c | sort -rn
```

**Common root causes:**

| Error type | Root cause | Fix |
|------------|-------------|-----|
| `pg_error: 23505` | Duplicate key — race condition | Investigate the unique constraint; possibly add advisory lock |
| `pg_error: 40001` | Serialization failure | Retry the transaction (already in handler) |
| `pg_error: 40P01` | DB unreachable | Check DB health |
| `unhandled_error: timeout` | Long-running query | Check indexes; look at pg_stat_activity |
| `validation_error` spike | Client sending malformed requests | Could be a bot; consider rate limiting |

### 6.3 High p99 latency (> 2s)

**Diagnosis:**

```sh

# 1. Slow endpoints

docker logs --since 10m Nouf-ex | jq 'select(.duration_ms > 1000) | {path, duration_ms}' | head -50

# 2. DB slow queries

psql -h $DB_HOST -U noufex_owner -d noufex_db \
  -c "SELECT pid, query, state, NOW() - query_start AS duration FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC LIMIT 10;"
```

**Common root causes:**

| Symptom | Root cause | Fix |
|---------|------------|-----|
| `/api/search` slow | FTS query without index | Verify GIN index exists: `SELECT * FROM pg_indexes WHERE tablename = 'products'` |
| `/api/products` slow | Missing LIMIT pushdown | Add index on `is_active` |
| `/api/admin/*` slow | Full table scan on `admin_audit_log` | Add pagination (already done) + index on `created_at` |

### 6.4 DB connection pool exhausted

**Symptoms:** `pg_error: too many connections` errors.

**Diagnosis:**

```sql
-- Current connections
SELECT count(*), state FROM pg_stat_activity GROUP BY state;

-- Long-running queries
SELECT pid, query, state, NOW() - query_start AS duration
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC
LIMIT 10;
```

**Common root causes:**

| Symptom | Root cause | Fix |
|---------|------------|-----|
| Many idle connections | Connection leak (forgot `client.release()`) | Review recent code; restart API |
| Many active queries | Long-running query blocking others | Kill long queries; add indexes |
| `max_connections` reached | Default 100 may be too low for high traffic | Increase `max_connections` in `postgresql.conf` |

### 6.5 Rate-limit bucket overflow

**Symptoms:** `pg_error: 23505` on `rate_limit_buckets`; users getting 429
even when not attacking.

**Diagnosis:**

```sql
SELECT count(*) FROM rate_limit_buckets;
SELECT ip, bucket, count(*) FROM rate_limit_buckets GROUP BY ip, bucket ORDER BY count DESC LIMIT 10;
```

**Fix:**

```sql
-- Manually clear a specific IP's buckets
DELETE FROM rate_limit_buckets WHERE ip = '1.2.3.4';

-- Or clear all buckets (DANGER: brief DOS vulnerability)
TRUNCATE rate_limit_buckets;
```

### 6.6 Disk usage > 80%

**Symptoms:** Postgres refuses to write; Docker fails to pull images.

**Diagnosis:**

```sh
df -h
du -sh /var/lib/postgresql/  /var/lib/docker/  /var/log/
```

**Fix:**

```sh

# Rotate old logs

journalctl --vacuum-size=100M

# Clean unused Docker artifacts

docker system prune -a --volumes

# Archive old admin_audit_log rows (future: automated)

psql -c "DELETE FROM admin_audit_log WHERE created_at < NOW() - INTERVAL '1 year'"
```

---

## 7. On-call playbook

### 7.1 Receiving an alert

1. **Acknowledge** in PagerDuty within 5 min (for SEV-1/2).
2. **Open** the runbook for the alert (linked in the alert rule).
3. **Investigate** using the runbook's diagnostic commands.
4. **Mitigate** — apply the documented fix OR escalate.
5. **Communicate** — post in `#noufex-incidents` with:
   - Alert name + severity.
   - Investigation status (every 30 min for SEV-1).
   - Estimated time to resolution.
6. **Post-mortem** — for SEV-1/2, write a dated entry in
   `docs/audit/postmortem-YYYY-MM-DD.md`.

### 7.2 Escalation path

| Level | Who | Contact |
|-------|-----|---------|
| L1 | On-call SRE | PagerDuty |
| L2 | Backend lead | Slack `#noufex-backend` |
| L3 | CTO | Phone |

### 7.3 Handoff

At the end of each on-call shift:

- [ ] All open incidents documented.
- [ ] Pending follow-ups recorded in `docs/audit/`.
- [ ] Next on-call briefed verbally + written.

---

## 8. Capacity planning

### 8.1 Current limits (single replica)

| Resource | Limit | Headroom |
|----------|-------|----------|
| API memory | ~200 MB RSS | Plenty (single replica) |
| API CPU | ~5% at 100 req/s | Plenty |
| DB connections | Default 100 | 90 free |
| Rate-limit (auth) | 20 req / 15 min / IP | Plenty |
| Rate-limit (health) | 30 req / 1s / IP | Plenty |
| Postgres storage | ~500 MB (24 products + 10 users + reviews) | Plenty for demo |

### 8.2 Scaling triggers

When any of the following are observed, scale out:

| Trigger | Action |
|---------|--------|
| CPU > 70% sustained for 5m | Add 1 replica, rebalance nginx |
| p99 latency > 1s | Profile queries; add indexes OR scale out |
| DB connections > 80 | Increase `max_connections` AND scale out |
| Disk usage > 70% | Add storage OR archive old data |
| Rate-limit bucket size > 100K | Investigate attack; possibly tighten limits |

### 8.3 Scaling out (single host)

```sh

# Start a second replica on a different port

docker compose -f docker-compose.green.yml up -d

# Update nginx upstream

upstream noufex_api {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    keepalive 32;
}

sudo nginx -s reload
```

---

## 9. Tools (current + future)

| Tool | Status | Purpose |
|------|--------|---------|
| **stdout JSON logs** | ✅ In use | Application logs |
| **x-request-id** | ✅ In use | Request tracing |
| **`docker logs`** | ✅ In use | Container log access |
| **Manual rate-limit reset** | ✅ In use | `psql DELETE FROM rate_limit_buckets` |
| **Synthetic probes** | ⚠️ Partial | `/api/health`, `/api/ready` exposed but no external monitor |
| **Grafana + Loki** | 🔜 Roadmap | Centralized log aggregation |
| **Prometheus + Alertmanager** | 🔜 Roadmap | Metrics + alerting |
| **Sentry** | 🔜 Roadmap | Error tracking (server + client) |
| **OpenTelemetry** | 🔜 Roadmap | Distributed tracing |

---

## 10. References

### 10.1 Internal documents

- [`security.md`](../architecture/security.md) — OWASP API Top 10
- [`deployment.md`](deployment.md) — production deploy guide
- [`architecture/overview.md`](../architecture/overview.md) — system overview
- [`../../app/server/middleware.ts`](../../../../app/server/middleware.ts) — `log`, `requestLogger`, `errorHandler`
- [`../../app/server/lib/shared.cts`](../../../../app/server/lib/shared.cts) — `consume_rate_limit()` SQL fn
- [`../testing/conventions.md`](../testing/conventions.md) — log structure in tests

### 10.2 External standards

- [Google SRE Book — Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)
- [USE method](https://www.brendangregg.com/usemethod.html)
- [RED method](https://www.weave.works/blog/the-red-method-key-metrics-for-microservices-architecture/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/) (planned)
- [Prometheus exposition format](https://prometheus.io/docs/instrumenting/exposition_formats/)
- [Loki log format](https://grafana.com/docs/loki/latest/clients/promtail/stages/)
- [PostgreSQL monitoring](https://www.postgresql.org/docs/17/monitoring.html)

---

## Maintenance Notes

1. **Update §5 (Alert rules)** when adding new metrics.
2. **Update §6 (Runbooks)** when adding new incident classes.
3. **Update §8 (Capacity triggers)** when scale changes.
4. **Bump version** in §1 when significant changes are made.
5. Commit spec + code **together**.

---

> **End of monitoring.md.** Next: B.2.4 — `er-diagram.md` (Mermaid ERD
> for the 29 tables).
