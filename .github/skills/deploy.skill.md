---
name: deploy
description: Deploy application safely with verification and rollback plan
trigger:
  - "deploy"
  - "release"
  - "publish"
  - "go live"
  - "ship to production"
phases:
  - pre_deployment_checks
  - build_artifacts
  - prepare_environment
  - deploy
  - verify_deployment
  - monitor
inputs:
  - target (environment)
  - version (release version)
  - rollback_plan
outputs:
  - deployed_application
  - deployment_report
  - verification_results
verification:
  - All health checks pass
  - Smoke tests pass
  - Monitoring normal
  - No error spikes
---

# Deploy Skill

## Purpose

Deploy application **safely** with proper checks, verification, and rollback capability.

## When to Use

- Releasing new version
- Hotfix to production
- Rolling update
- Blue-green deployment
- Canary release

## Process

### Phase 1: Pre-Deployment Checks

```yaml
Code Quality:
  - [ ] All tests pass
  - [ ] No lint errors
  - [ ] Type check passes
  - [ ] Code review approved
  - [ ] No security vulnerabilities

Documentation:
  - [ ] CHANGELOG updated
  - [ ] README updated
  - [ ] API docs updated
  - [ ] Migration guide (if needed)

Build:
  - [ ] Build succeeds
  - [ ] Bundle size OK
  - [ ] Dependencies up to date

Database:
  - [ ] Migrations tested
  - [ ] Backward compatible
  - [ ] Rollback plan ready
  - [ ] Backup created

Environment:
  - [ ] Environment variables set
  - [ ] Secrets in vault
  - [ ] SSL certificates valid
  - [ ] DNS configured
```

### Phase 2: Build Artifacts

```yaml
Build Steps:
  - Install dependencies (production only)
  - Run build command
  - Generate assets
  - Optimize bundle
  - Generate source maps

Build Commands:
  Frontend:
    - npm ci --production
    - npm run build

  Backend:
    - npm ci --production
    - npm run build
    - npm prune --production

Artifacts:
  - Docker image
  - Compiled assets
  - Migration scripts
  - Configuration files
```

### Phase 3: Prepare Environment

```yaml
Pre-Deployment:
  - Notify team (#deploys channel)
  - Set maintenance window (if needed)
  - Verify staging deployment works
  - Check current production health

Database:
  - Run migrations (if any)
  - Verify schema is correct
  - Test data integrity
  - Backup before migration

Infrastructure:
  - Scale up (if needed)
  - Verify health checks pass
  - Check monitoring is working
  - Verify alerting is configured
```

### Phase 4: Deploy

```yaml
Deployment Strategy:

  Rolling Update:
    - Deploy to subset of instances
    - Verify health
    - Gradually replace all instances
    - Zero downtime

  Blue-Green:
    - Deploy to green environment
    - Test green environment
    - Switch traffic to green
    - Keep blue for rollback

  Canary:
    - Deploy to small subset (5-10%)
    - Monitor metrics
    - Gradually increase
    - Full rollout if metrics good

  Feature Flags:
    - Deploy code (disabled)
    - Enable for internal users
    - Gradual rollout
    - Disable if issues

Deployment Steps:
  1. Tag release in git
  2. Build Docker image
  3. Push to registry
  4. Update deployment config
  5. Apply to staging first
  6. Run smoke tests
  7. Apply to production
  8. Monitor metrics
```

### Phase 5: Verify Deployment

```yaml
Health Checks:
  - HTTP 200 responses
  - Database connections working
  - Cache connections working
  - External APIs reachable

Smoke Tests:
  - User can log in
  - User can perform key actions
  - Critical paths work
  - No error pages

Metrics:
  - Response time normal
  - Error rate < 1%
  - CPU usage normal
  - Memory usage normal

Logs:
  - No error spikes
  - No unexpected warnings
  - Application starting correctly
  - Workers running
```

### Phase 6: Monitor

```yaml
Monitoring Period:
  - Watch for 30 minutes minimum
  - Check key metrics
  - Monitor error rates
  - Verify business metrics

What to Watch:
  - Error rate
  - Response time
  - User signups / key actions
  - Database performance
  - Memory leaks
  - CPU usage

If Issues:
  - Rollback immediately if critical
  - Investigate if minor
  - Document incident
  - Post-mortem
```

## Deployment Patterns

### Docker Deployment

```yaml

# docker-compose.yml

version: '3.8'

services:
  api:
    image: ghcr.io/noufex/api:${VERSION}
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
      rollback_config:
        parallelism: 1
        delay: 0s
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: ghcr.io/noufex/api:${VERSION}
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: production
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: database-url
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Database Migration

```bash
#!/bin/bash

# deploy.sh - Safe database migration

set -euo pipefail

echo "Starting database migration..."

# 1. Backup

echo "Creating backup..."
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Run migration

echo "Running migration..."
npm run db:migrate

# 3. Verify

echo "Verifying schema..."
psql $DATABASE_URL -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;"

echo "Migration complete!"
```

### Blue-Green Deployment Script

```bash
#!/bin/bash

# blue-green-deploy.sh

set -euo pipefail

NEW_ENV=$1  # 'blue' or 'green'
CURRENT_ENV=$(cat current-env.txt)

if [ "$NEW_ENV" == "$CURRENT_ENV" ]; then
  echo "Already deployed to $NEW_ENV"
  exit 1
fi

echo "Deploying to $NEW_ENV..."

# 1. Deploy to new environment

docker compose -f docker-compose.$NEW_ENV.yml up -d

# 2. Wait for health check

echo "Waiting for health check..."
sleep 30
for i in {1..10}; do
  if curl -f http://$NEW_ENV.internal:3000/health; then
    echo "Health check passed"
    break
  fi
  sleep 10
done

# 3. Run smoke tests

echo "Running smoke tests..."
./scripts/smoke-test.sh http://$NEW_ENV.internal:3000

# 4. Switch traffic (update load balancer)

echo "Switching traffic to $NEW_ENV..."
./scripts/switch-traffic.sh $NEW_ENV

# 5. Update current environment

echo $NEW_ENV > current-env.txt

echo "Deployment complete!"
```

## Rollback Strategy

```yaml
Rollback Triggers:
  - Error rate > 5%
  - Response time > 2x normal
  - Health checks failing
  - Critical functionality broken

Rollback Steps:
  1. Identify issue (immediate)
  2. Decide: Fix forward or rollback?
  3. If rollback:
     - Switch traffic to previous version
     - Revert database migration (if safe)
     - Verify system healthy
     - Notify team

Database Rollback:
  - Forward migration preferred
  - If must rollback:
    - Create rollback migration
    - Test in staging first
    - Backup before rollback
    - Run rollback migration
    - Verify data integrity
```

## Deployment Checklist

```yaml
Pre-Deployment:
  - [ ] Code merged to main
  - [ ] CI pipeline passed
  - [ ] Code review approved
  - [ ] Staging deployment tested
  - [ ] Database migrations ready
  - [ ] Environment variables set
  - [ ] Monitoring configured
  - [ ] Rollback plan documented
  - [ ] Team notified

Deployment:
  - [ ] Tag created in git
  - [ ] Docker image built and pushed
  - [ ] Deployment executed
  - [ ] Health checks passing
  - [ ] Smoke tests passing
  - [ ] No error spikes

Post-Deployment:
  - [ ] Monitoring normal
  - [ ] Performance metrics OK
  - [ ] Error rate < 1%
  - [ ] User-facing features work
  - [ ] Documentation updated
  - [ ] Team notified of completion
```

## Output Template

```markdown

## Deployment Report

### Version

[Release version]

### Environment

[Production / Staging / etc.]

### Deployment Time

[Start - End]

### Steps Completed

- [x] Pre-deployment checks
- [x] Build artifacts
- [x] Deploy
- [x] Verify

### Verification Results

- Health checks: ✅
- Smoke tests: ✅
- Error rate: 0.X%
- Response time: XXms

### Monitoring

- CPU: X%
- Memory: X%
- Errors: X/hour
- Uptime: 100%

### Issues

[None / List]

### Rollback Status

[Not needed / Completed]
```

## Anti-Patterns to Avoid

```yaml
Don't:
  - Deploy on Friday afternoon
  - Skip staging
  - Deploy without rollback plan
  - Make changes during deployment
  - Deploy without testing
  - Ignore monitoring
  - Deploy too many changes at once
  - Skip communication
```
