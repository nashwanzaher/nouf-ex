---
name: monitor
description: Set up monitoring, logging, alerting, and observability
trigger:
  - "monitor"
  - "observability"
  - "metrics"
  - "alerting"
  - "logging"
phases:
  - identify_what_to_monitor
  - setup_metrics
  - setup_logging
  - setup_tracing
  - setup_alerts
  - create_dashboards
  - test_monitoring
inputs:
  - system_components
  - slos (service level objectives)
outputs:
  - monitoring_setup
  - dashboards
  - alerts
verification:
  - Metrics flowing
  - Alerts triggering
  - Dashboards working
  - Logs structured
---

# Monitor Skill

## Purpose

Set up **comprehensive monitoring** with metrics, logs, traces, and alerts for production systems.

## When to Use

- New application deployment
- Existing system needs observability
- Incident response
- Performance troubleshooting
- Capacity planning

## Process

### Phase 1: Identify What to Monitor

```yaml
Golden Signals (SRE):
  - Latency: How long requests take
  - Traffic: How much demand
  - Errors: Rate of failures
  - Saturation: How "full" the service is

USE Method (Resources):
  - Utilization: % time busy
  - Saturation: Queue length
  - Errors: Error count

RED Method (Services):
  - Rate: Requests per second
  - Errors: Failures per second
  - Duration: Response time

Four Golden Metrics:
  - Latency
  - Traffic
  - Errors
  - Saturation

Business Metrics:
  - Signups
  - Conversions
  - Revenue
  - User actions
```

### Phase 2: Setup Metrics

```yaml
Metric Types:

  Counter:
    - Only goes up
    - Reset on restart
    - Examples: requests_total, errors_total

  Gauge:
    - Can go up or down
    - Current value
    - Examples: memory_usage, active_users

  Histogram:
    - Distribution of values
    - Examples: request_duration_seconds

  Summary:
    - Similar to histogram
    - Client-side aggregation
    - Examples: response_size

Key Metrics:
  Application:
    - http_requests_total{method, route, status}
    - http_request_duration_seconds{method, route}
    - http_requests_in_flight
    - errors_total{type}
    - active_users

  System:
    - cpu_usage_percent
    - memory_usage_bytes
    - disk_usage_bytes
    - network_io_bytes

  Database:
    - db_query_duration_seconds
    - db_connections_active
    - db_connections_idle
    - db_slow_queries_total

  Business:
    - signups_total
    - orders_total
    - revenue_total
    - active_sessions
```

### Phase 3: Setup Logging

```yaml
Structured Logging Best Practices:

  Format:
    - JSON format for machine parsing
    - Include timestamp, level, message
    - Include context (request_id, user_id)

  Levels:
    - ERROR: Errors requiring attention
    - WARN: Warnings, recoverable issues
    - INFO: Normal operation events
    - DEBUG: Detailed debugging info

  Context:
    - Request ID for tracing
    - User ID (when applicable)
    - Action being performed
    - Duration of operation

  Sensitive Data:
    - NEVER log: passwords, tokens, credit cards, PII
    - Redact sensitive fields
    - Use log redaction libraries

Example:
```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'noufex-api',
    version: process.env.APP_VERSION,
    env: process.env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.creditCard',
      '*.password',
      '*.token',
      '*.secret',
    ],
    remove: true,
  },
});
```

### Phase 4: Setup Tracing

```yaml
Distributed Tracing:

  Purpose:
    - Track request across services
    - Identify bottlenecks
    - Find failures

  Components:
    - Trace: Complete request journey
    - Span: Single operation in trace
    - Context: Data passed between spans

  Implementation:
    - OpenTelemetry (standard)
    - Jaeger or Zipkin (visualization)
    - Auto-instrumentation libraries

  Key Spans:
    - HTTP requests
    - Database queries
    - External API calls
    - Cache operations
    - Background jobs

Example:
```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('noufex-api');

async function getUser(id: string) {
  return tracer.startActiveSpan('getUser', async (span) => {
    span.setAttribute('user.id', id);

    try {
      const user = await tracer.startActiveSpan('db.query', async (dbSpan) => {
        dbSpan.setAttribute('db.statement', 'SELECT * FROM users WHERE id = $1');
        return await db.query('SELECT * FROM users WHERE id = $1', [id]);
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return user;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

### Phase 5: Setup Alerts

```yaml
Alert Types:

  Critical (Page immediately):
    - Service down
    - Error rate > 10%
    - Database down
    - Payment processing failing

  Warning (Notify team):
    - Error rate > 5%
    - Response time p95 > 1s
    - Disk usage > 80%
    - Memory usage > 90%

  Info (Log only):
    - Deployment completed
    - High traffic detected
    - New error type

Alert Best Practices:
  - Actionable: Every alert should have a runbook
  - Specific: Clear what's wrong
  - Timely: Alert when issue occurs
  - Not noisy: Avoid alert fatigue
  - Escalating: Different levels for severity

Alert Format:
  Title: [Severity] [Component] [Issue]
  Description: What's wrong, impact, what to do
  Runbook: Link to investigation steps

Example:
```yaml
Critical Alert:
  Title: "[CRITICAL] API High Error Rate"
  Description: "API error rate is 15% (threshold: 5%)"
  Impact: "Users experiencing failures"
  Runbook: https://wiki/runbooks/api-high-errors
  Notify: On-call engineer
```

### Phase 6: Create Dashboards

```yaml
Dashboard Types:

  Overview Dashboard:
    - Service health
    - Request rate
    - Error rate
    - Response time
    - Active users

  Performance Dashboard:
    - Response time percentiles
    - Database performance
    - Cache hit rate
    - Slow queries

  Error Dashboard:
    - Error rate by type
    - Recent errors
    - Error trends
    - Affected users

  Business Dashboard:
    - Signups
    - Active users
    - Revenue
    - Key actions

Dashboard Best Practices:
  - One purpose per dashboard
  - Most important metrics at top
  - Color coding (green/yellow/red)
  - Time range selector
  - Drill-down capability
```

### Phase 7: Test Monitoring

```yaml
Testing:
  - Verify metrics are collected
  - Verify logs are structured
  - Verify traces are captured
  - Test alerts trigger correctly
  - Verify dashboards display data

Synthetic Tests:
  - Generate traffic
  - Verify metrics increase
  - Verify logs are generated
  - Verify traces are created

Alert Testing:
  - Trigger alert manually
  - Verify notification received
  - Verify runbook is accessible
  - Test escalation
```

## Monitoring Implementation

### Prometheus + Grafana

```typescript
import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

// HTTP metrics
export const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const httpTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

export const httpInFlight = new client.Gauge({
  name: 'http_requests_in_flight',
  help: 'In-flight HTTP requests',
  registers: [register],
});

// Middleware
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  httpInFlight.inc();
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const labels = {
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode.toString(),
    };

    httpDuration.observe(labels, duration);
    httpTotal.inc(labels);
    httpInFlight.dec();
  });

  next();
}

// Metrics endpoint
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### Health Checks

```typescript
app.get('/health', async (_req, res) => {
  const checks = await Promise.all([
    checkDatabase(),
    checkCache(),
    checkExternalServices(),
  ]);

  const allHealthy = checks.every(c => c.status === 'ok');
  const status = allHealthy ? 200 : 503;

  res.status(status).json({
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: Object.fromEntries(
      checks.map(c => [c.name, c])
    ),
  });
});

async function checkDatabase() {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    return {
      name: 'database',
      status: 'ok',
      latency_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'error',
      error: (error as Error).message,
    };
  }
}
```

### SLO Monitoring

```yaml
SLO Definition:
  Availability:
    Target: 99.9% uptime
    Measurement: (successful_requests / total_requests) * 100
    Window: 30 days

  Latency:
    Target: 95% of requests < 200ms
    Measurement: p95 response time
    Window: 30 days

Error Budget:
  Budget: 0.1% (43.2 minutes/month for 99.9%)
  Consumed: (1 - availability) * time_window
  Action: If budget exhausted, focus on reliability

SLO Tracking:
  - Calculate actual vs target
  - Alert if SLO at risk
  - Report on SLO compliance
  - Use error budget for feature releases
```

## Monitoring Checklist

```yaml
Metrics:
  - [ ] Application metrics (requests, errors, latency)
  - [ ] System metrics (CPU, memory, disk)
  - [ ] Database metrics (queries, connections)
  - [ ] Business metrics (signups, revenue)
  - [ ] Custom metrics for features

Logging:
  - [ ] Structured logging (JSON)
  - [ ] Log levels used appropriately
  - [ ] Sensitive data redacted
  - [ ] Request IDs for tracing
  - [ ] Centralized log aggregation

Tracing:
  - [ ] Distributed tracing setup
  - [ ] Key spans instrumented
  - [ ] Trace sampling configured
  - [ ] Trace UI accessible

Alerting:
  - [ ] Critical alerts defined
  - [ ] Warning alerts defined
  - [ ] Runbooks linked
  - [ ] Escalation policies set
  - [ ] On-call rotation established

Dashboards:
  - [ ] Overview dashboard
  - [ ] Performance dashboard
  - [ ] Error dashboard
  - [ ] Business dashboard

Testing:
  - [ ] Metrics flowing
  - [ ] Logs structured
  - [ ] Alerts triggering
  - [ ] Dashboards displaying data
```

## Output Template

```markdown

## Monitoring Setup Report

### Components

[List of monitored components]

### Metrics

- Application: [list]
- System: [list]
- Database: [list]
- Business: [list]

### Logging

- Format: JSON
- Levels: error, warn, info, debug
- Sensitive data: Redacted
- Retention: 30 days

### Tracing

- System: OpenTelemetry
- Sampling: 10%
- UI: Jaeger

### Alerts

- Critical: [list]
- Warning: [list]
- Info: [list]

### Dashboards

- Overview: [link]
- Performance: [link]
- Errors: [link]
- Business: [link]

### SLOs

- Availability: 99.9%
- Latency: p95 < 200ms
- Error rate: < 0.1%
```

## Anti-Patterns to Avoid

```yaml
Don't:
  - Monitor everything (alert fatigue)
  - Skip context in logs
  - Log sensitive data
  - Alert without runbook
  - Ignore false positives
  - Skip dashboards
  - Forget to test monitoring
  - Use wrong metric types
```
