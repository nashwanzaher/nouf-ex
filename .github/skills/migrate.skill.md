---
name: migrate
description: Migrate systems, databases, or code to new technology/architecture
trigger:
  - "migrate"
  - "upgrade"
  - "move to"
  - "convert"
  - "transition"
phases:
  - plan_migration
  - create_rollback_plan
  - setup_parallel_systems
  - migrate_increments
  - verify
  - cutover
  - decommission
inputs:
  - from_system
  - to_system
  - data_to_migrate
outputs:
  - migrated_system
  - migrated_data
  - verified_workflow
verification:
  - All data migrated correctly
  - All features work
  - Performance acceptable
  - Old system can be decommissioned
---

# Migrate Skill

## Purpose

Migrate systems, databases, or code **safely** with minimal downtime and risk.

## When to Use

- Database migration
- Framework upgrade
- Cloud migration
- Language version upgrade
- Architecture change

## Process

### Phase 1: Plan Migration

```yaml
Assessment:
  Current State:
    - What exists today?
    - How is it used?
    - What's the data volume?
    - What's the complexity?

  Target State:
    - What should it become?
    - What's the benefit?
    - What's the cost?

  Migration Strategy:
    Big Bang:
      - Pros: Quick
      - Cons: High risk, downtime
      - Use: Small systems, low risk

    Incremental:
      - Pros: Low risk, gradual
      - Cons: Slower, dual systems
      - Use: Large systems, critical

    Parallel Run:
      - Pros: Can validate
      - Cons: Expensive
      - Use: Critical systems

  Timeline:
    - Total duration
    - Milestones
    - Dependencies
    - Buffer for issues
```

### Phase 2: Create Rollback Plan

```yaml
Rollback Strategy:

  Database:
    - Backup before migration
    - Test rollback procedure
    - Document rollback steps
    - Verify data integrity post-rollback

  Application:
    - Keep old version deployable
    - Feature flags for new code
    - Ability to switch back instantly
    - DNS switching for instant rollback

  Data:
    - Reverse sync if needed
    - Keep old data until verified
    - Validation checks

Rollback Testing:
  - Test rollback in staging
  - Measure rollback time
  - Document steps
  - Train team on rollback
```

### Phase 3: Setup Parallel Systems

```yaml
Infrastructure:
  - Provision new environment
  - Configure networking
  - Setup monitoring for both
  - Configure logging

Data Sync:
  - Initial data load
  - Set up CDC (Change Data Capture)
  - Verify sync working
  - Test bidirectional sync

Application:
  - Deploy new version
  - Configure feature flags
  - Test in new environment
  - Verify functionality
```

### Phase 4: Migrate in Increments

```yaml
Incremental Approach:

  By User:
    - Migrate 1% of users
    - Monitor metrics
    - Gradually increase
    - Rollback if issues

  By Feature:
    - Migrate non-critical features first
    - Test thoroughly
    - Migrate critical features
    - Monitor at each step

  By Region:
    - Migrate one region at a time
    - Test in low-traffic region first
    - Migrate high-traffic regions last

  By Data:
    - Migrate in batches
    - Verify each batch
    - Handle errors gracefully
    - Track progress

Each Increment:
  - Deploy
  - Verify
  - Monitor for [time period]
  - Confirm success
  - Move to next increment
```

### Phase 5: Verify

```yaml
Verification Checklist:

  Data Integrity:
    - [ ] All records migrated
    - [ ] No data loss
    - [ ] No duplicates
    - [ ] Relationships preserved
    - [ ] Constraints satisfied

  Functionality:
    - [ ] All features work
    - [ ] Edge cases handled
    - [ ] Error cases handled
    - [ ] Performance acceptable

  Integration:
    - [ ] APIs working
    - [ ] External services connecting
    - [ ] Authentication working
    - [ ] Authorization working

  Monitoring:
    - [ ] Metrics normal
    - [ ] Error rate normal
    - [ ] Logs clean
    - [ ] Alerts working
```

### Phase 6: Cutover

```yaml
Cutover Steps:
  1. Notify team and stakeholders
  2. Enable maintenance mode (if needed)
  3. Stop writes to old system
  4. Final data sync
  5. Verify data consistency
  6. Switch traffic to new system
  7. Verify new system working
  8. Disable maintenance mode
  9. Monitor closely

Communication:
  - Status page updated
  - Team notified
  - Users notified (if impact)
  - Stakeholders informed

Timing:
  - Low-traffic window
  - Off-peak hours
  - When team is available
  - Buffer time for issues
```

### Phase 7: Decommission

```yaml
Decommission Steps:
  1. Monitor new system for [period] (e.g., 2 weeks)
  2. Verify no issues
  3. Create final backup of old system
  4. Document everything
  5. Remove old infrastructure
  6. Clean up DNS, load balancers
  7. Archive code and configs
  8. Update documentation
  9. Notify team of completion

Keep:
  - Final backup for [period] (e.g., 90 days)
  - Documentation
  - Migration scripts
  - Rollback procedure
```

## Migration Patterns

### Database Migration (PostgreSQL)

```sql
-- Step 1: Create new schema
CREATE SCHEMA new_schema;

-- Step 2: Create new tables (with improvements)
CREATE TABLE new_schema.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  -- ... new schema
);

-- Step 3: Copy data
INSERT INTO new_schema.products (id, name, ...)
SELECT id, name, ... FROM public.products;

-- Step 4: Verify
SELECT COUNT(*) FROM new_schema.products;
SELECT COUNT(*) FROM public.products;

-- Step 5: Create views for transition
CREATE VIEW public.products_v2 AS SELECT * FROM new_schema.products;

-- Step 6: Switch application to new schema
-- Update DATABASE_URL or schema search_path

-- Step 7: Drop old schema (after verification period)
-- DROP SCHEMA public CASCADE;  -- CAREFUL!
```

### Framework Migration (Express 4 → 5)

```typescript
// Step 1: Install new framework
npm install express@5

// Step 2: Update code incrementally
// Old: app.use((req, res, next) => { ... })
// New: Same syntax, but error handling changed

// Step 3: Test each route
// Express 5: Async errors automatically caught
app.get('/api/users', async (req, res) => {
  const users = await db.users.findAll();
  res.json(users);  // No try/catch needed
});

// Step 4: Update middleware
// Express 5: Some middleware needs updates
// e.g., body-parser is built-in now

// Step 5: Test thoroughly
// Step 6: Deploy with feature flag
// Step 7: Enable for production
// Step 8: Remove old version
```

### Node.js Version Upgrade

```bash

# Step 1: Update package.json

{
  "engines": {
    "node": ">=20.19.0"
  }
}

# Step 2: Test in CI with new version

# Step 3: Update Dockerfile

FROM node:20.19-alpine

# Step 4: Run full test suite

npm test

# Step 5: Check for breaking changes

# Review release notes

# Update deprecated APIs

# Step 6: Deploy to staging

# Step 7: Monitor for issues

# Step 8: Deploy to production

```

## Zero-Downtime Migration

```yaml
Strategy:
  1. Deploy new version alongside old
  2. Configure load balancer for both
  3. Route small % of traffic to new
  4. Gradually increase
  5. Monitor metrics
  6. Full rollout when confident
  7. Decommission old

Database Considerations:
  - Use CDC (Change Data Capture)
  - Dual writes during transition
  - Verify data consistency
  - Switch reads when confident
  - Stop writes to old last

Application Considerations:
  - Feature flags for new behavior
  - Backward compatibility
  - Gradual rollout
  - Easy rollback
```

## Migration Checklist

```yaml
Planning:
  - [ ] Migration strategy chosen
  - [ ] Timeline established
  - [ ] Resources allocated
  - [ ] Stakeholders informed

Preparation:
  - [ ] Rollback plan documented
  - [ ] Rollback tested
  - [ ] Backup created
  - [ ] Monitoring configured
  - [ ] Team trained

Execution:
  - [ ] Pre-migration verification
  - [ ] Migration executed
  - [ ] Data verified
  - [ ] Functionality tested
  - [ ] Performance verified

Post-Migration:
  - [ ] Monitoring normal
  - [ ] No error spikes
  - [ ] Old system stable
  - [ ] Team available
  - [ ] Documentation updated

Decommissioning:
  - [ ] Monitoring period complete
  - [ ] Final backup created
  - [ ] Old system removed
  - [ ] Documentation archived
  - [ ] Team notified
```

## Output Template

```markdown

## Migration Report

### Type

[Database / Framework / Cloud / Version]

### Strategy

[Big Bang / Incremental / Parallel]

### Timeline

- Start: [Date]
- End: [Date]
- Duration: [Days]

### Steps Completed

- [x] Planning
- [x] Preparation
- [x] Execution
- [x] Verification
- [x] Cutover

### Verification Results

- Data integrity: ✅
- Functionality: ✅
- Performance: ✅
- No regressions: ✅

### Issues Encountered

[List]

### Rollback Status

[Not needed / Tested and ready]

### Decommissioning

- Old system: [Status]
- Backups: [Location]
- Documentation: [Location]
```

## Anti-Patterns to Avoid

```yaml
Don't:
  - Migrate without testing
  - Skip rollback plan
  - Migrate during peak hours
  - Make changes during migration
  - Skip data verification
  - Rush the process
  - Skip communication
  - Decommission too early
```
