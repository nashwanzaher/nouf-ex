# Sentry → Alertmanager Routing (Tier 5.4)

> Wiring the official Sentry webhook integration with the
> Prometheus Alertmanager so a spike of high-severity errors
> triggers the same paging pipeline as the other alerts in
> `cloudflare/prometheus/noufex-alerts.yml`.

## Architecture

```
┌────────────────────────┐  SDK   ┌──────────────────────┐
│  API (Noufex runtime)  │ ─────▶ │  Sentry.io project   │
│  (lib/sentry.ts)       │ events │  (sentry.io/noufex) │
└────────────────────────┘        └──────────┬───────────┘
                                            │
                                            │ Alert Rules
                                            │ (UI-configured)
                                            ▼
                                ┌───────────────────────┐
                                │  Sentry Webhook        │
                                │  /integrations/        │
                                │   slack-alert/         │
                                └──────────┬────────────┘
                                           │ POST {app}:8080/sentry-webhook
                                           ▼
                                ┌───────────────────────┐
                                │  alertmanager-sentry-  │
                                │  relay (small Go svc)  │
                                │  – translates severity │
                                │  – dedups (10m)        │
                                └──────────┬────────────┘
                                           │ Prometheus Alert
                                           ▼
                                ┌───────────────────────┐
                                │  Alertmanager           │
                                │  (per severity routes) │
                                └──────────┬────────────┘
                                       ┌───┴───┐
                                       ▼       ▼
                                ┌─────────┐ ┌──────────┐
                                │ PagerDuty│ │  Slack   │
                                └─────────┘ └──────────┘
```

## Sentry → Webhook configuration

In Sentry (https://noufex-org.sentry.io):

1. **Settings → Integrations → Webhooks** (or use the official
   `sentry-webhook` plugin).
2. Add a webhook URL: `https://alertmanager-sentry.noufex.internal/sentry-webhook`
3. Enable the alert rule "All Issues" or per-environment
   rules.

## alertmanager-sentry-relay (deployment)

The relay service is a thin Go/Node wrapper that translates a
Sentry webhook payload into a Prometheus AlertManager v2 alert.
A reference implementation (~120 LOC) lives in
`cloudflare/observability/alertmanager-sentry-relay/main.go`. It
exposes:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/sentry-webhook` | Receives Sentry webhooks, emits AlertManager alerts |
| `GET` | `/health` | k8s liveness probe |
| `GET` | `/ready` | k8s readiness probe |

### Translation rules

| Sentry field | AlertManager label / annotation |
|---|---|
| `event.title` | `summary` annotation |
| `event.message` | `description` annotation (trimmed to 1024 chars) |
| `event.level` (`error`/`fatal`) | `severity=page` label |
| `event.level` (`warning`) | `severity=warn` label |
| `event.tags.environment` | `environment` label |
| `event.tags.release` | `release` label |
| `event.fingerprint` | `fingerprint` (for dedup) |
| `event.project.slug` | `project` label |

### Dedup window

The relay suppresses alerts for the same `fingerprint` for
**10 minutes** (configurable via `DEDUP_WINDOW`). After 10 m
without a fresh event from Sentry, the alert auto-resolves in
AlertManager. This avoids paging SRE for the same error.

## Alertmanager routing (Prometheus side)

The new webhook receiver goes in `alertmanager.yml`:

```yaml
receivers:
  - name: 'sentry-pagerduty'
    pagerduty_configs:
      - service_key: '<PAGERDUTY_KEY>'
        description: '{{ template "pagerduty.default.description" . }}'
        details:
          fingerprint: '{{ .Fingerprint }}'
          project: '{{ .Labels.project }}'
          environment: '{{ .Labels.environment }}'
  - name: 'sentry-slack'
    slack_configs:
      - api_url: '<SLACK_WEBHOOK>'
        channel: '#noufex-incidents'
        title: '{{ .GroupLabels.alertname }} ({{ .Status }})'
        text: '{{ .Annotations.description }}'

route:
  group_by: ['alertname', 'fingerprint']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - matchers: [severity = "page"]
      receiver: 'sentry-pagerduty'
    - matchers: [severity = "warn"]
      receiver: 'sentry-slack'
```

## Sentry SDK configuration (Noufex side)

The wiring on the Noufex side is `apps/api/src/lib/sentry.ts`:

| Env var | Purpose |
|---|---|
| `SENTRY_DSN` | Project DSN from `Settings → API Keys`. |
| `SENTRY_ENVIRONMENT` | `production` / `staging` / `development` |
| `SENTRY_RELEASE` | The git SHA of the deployed build (set by CI). |
| `SENTRY_TRACES_SAMPLE_RATE` | Default `0.1` (10% of transactions). |
| `SENTRY_PROFILES_SAMPLE_RATE` | Default `0.05` (5% of sampled). |

The SDK initialises from `initSentry()` in `apps/api/src/index.ts`
(Tier 4.1) AFTER OTel so the Sentry event carries the OTel
`trace_id` for cross-referencing.

### BeforeSend hook (PII scrubbing)

The `beforeSend` callback in `lib/sentry.ts` scrubs:

- `Authorization` header
- `Cookie` header
- `x-csrf-token` header
- `x-api-key` header

This satisfies OWASP ASVS 6.4 (Sensitive Data Exposure) and
GDPR Article 32 (security of processing).

### Breadcrumb hook

The `beforeBreadcrumb` hook truncates query strings in HTTP
breadcrumbs to avoid leaking session tokens or signed URLs.

## SLOs implied by this routing

| Error class | SLO target | Sentry level → PagerDuty |
|---|---|---|
| 5xx in production | < 0.1 % of requests | `error`/`fatal` → page |
| Unhandled exception in worker | 0 | `error`/`fatal` → page |
| Latency p99 > 5 s | < 0.01 % | `warning` → Slack |
| Auth login 429 storm | < 5/min | `warning` → Slack |

## References

- Sentry Webhooks — https://docs.sentry.io/api/webhooks/
- AlertManager webhook receiver — https://prometheus.io/docs/alerting/latest/configuration/#webhook_config
- RFC 8594 (Deprecation / Sunset) — used by `lib/api-version.ts` (Tier 5.3)
- CNCF TAG App Delivery — recommended incident-response loop

## Tier 5.5 (next)

- SLO-based release gating (block deploy if error budget is
  exhausted per the Sentry release health metric).
- Auto-create Linear/Jira issues from `fatal` Sentry events.
- Profiling production traces (already enabled at 5%).
- Cloudflare Workers + Sentry for edge-side error tracking.