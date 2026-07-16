# Noufex — Grafana dashboard (Tier 2.1).

Drop `noufex-api-dashboard.json` into Grafana → Dashboards → Import.

## Prerequisites

1. Prometheus scraping `/api/metrics` on every API + worker instance.
2. The dashboard's `datasource` field defaults to `Prometheus`; rename
   if you use a different UID.

## What it shows

| Panel | What to watch |
|---|---|
| HTTP request rate | 4xx/5xx spikes after a deploy → bad release |
| HTTP latency p50/p95/p99 | p99 > 1s sustained → DB contention or third-party slowness |
| Cache hit ratio | < 70% sustained → Redis config issue or hot-key skew |
| DB pool waiting | > 0 for >5min → pool too small or long-running query |
| Queue throughput | DLQ growth (nack > 0) → alert immediately |
| Worker handler p95 | > 30s → ES outage or SMTP slowdown |
| Search source split | 100% postgresql → ES is down, investigate |
| RSS / CPU | per-container memory leak detection |

## Alerts to set on top

```yaml
- alert: HighErrorRate
  expr: sum(rate(noufex_http_requests_total{status=~"5.."}[5m])) > 1
  for: 5m

- alert: SlowP99
  expr: histogram_quantile(0.99, sum by (le) (rate(noufex_http_request_duration_seconds_bucket[5m]))) > 2
  for: 10m

- alert: DLQBacklog
  expr: sum(rate(noufex_queue_messages_total{op="nack"}[5m])) > 0.1
  for: 5m

- alert: ESDown
  expr: sum(rate(noufex_search_source_total{source="postgresql"}[5m])) > sum(rate(noufex_search_source_total{source="elasticsearch"}[5m]))
  for: 5m
```