# Noufex — Prometheus alerting (Tier 3.2).

Standard Prometheus rule file at `noufex-alerts.yml`. Deploy via
`promtool check rules noufex-alerts.yml` then ship to your
collector of choice.

## How it works

The rules file groups metrics by domain:

| Group | Purpose | Page severity |
|---|---|---|
| `noufex_api_availability` | 5xx ratio + p99 latency | 1 m, 5 m |
| `noufex_companion_services` | Redis / RabbitMQ / DLQ | warn / page |
| `noufex_cache` | Redis hit ratio | warn |
| `noufex_database` | PG pool exhaustion | page |
| `noufex_search` | ES down / fallback | warn |
| `noufex_cdn` | Cloudflare purges | warn |
| `noufex_record_only` | traffic anomaly | warn |

Every alert follows Google SRE's multi-window/multi-burn-rate
pattern: short-window detection + sustained duration to avoid
alerting on transients.

## Wiring

```yaml
# prometheus.yml
rule_files:
  - /etc/prometheus/rules/noufex-alerts.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

## Severity routing

In Alertmanager:

```yaml
route:
  group_by: ['alertname', 'severity']
  routes:
    - matchers: [severity = "page"]
      receiver: 'pagerduty-critical'
    - matchers: [severity = "warn"]
      receiver: 'slack-noufex-ops'

receivers:
  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: '<PAGERDUTY_KEY>'
        description: '{{ template "pagerduty.default.description" . }}'
  - name: 'slack-noufex-ops'
    slack_configs:
      - api_url: '<SLACK_WEBHOOK>'
        channel: '#noufex-ops'
        title: '{{ .GroupLabels.alertname }} ({{ .Status }})'
```

## Adding a new alert

1. Add a `record` rule that emits the metric (Prometheus best
   practice — alerts *reference* a recording rule, never a raw
   expression, so the same computation can be re-used by
   dashboards).
2. Reference the recording rule by name in the alert `expr`.
3. Add `annotations.runbook` to a Markdown runbook URL.
4. Test with `promtool test rules noufex-alerts.test.yml`.

## References

- Google SRE Workbook — Ch. 5 "Practical Alerting from
  Time-Series Data"
- Prometheus — official alerting guide
- W3C Trace Context (RFC editor draft)
- OpenTelemetry semantic conventions
  https://opentelemetry.io/docs/specs/semconv/