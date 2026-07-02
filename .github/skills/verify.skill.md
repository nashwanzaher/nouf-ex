---
name: verify
description: Verify code works correctly with comprehensive checks
trigger:
  - "verify"
  - "check"
  - "test"
  - "validate"
  - "does it work"
phases:
  - identify_what_to_verify
  - run_automated_checks
  - perform_manual_checks
  - document_results
inputs:
  - target (what to verify)
  - criteria (what success looks like)
outputs:
  - verification_report
  - pass_fail_status
  - issues_found
verification:
  - All checks completed
  - Results documented
  - Issues addressed
---

# Verify Skill

## Purpose

Systematically **verify** that code works correctly and meets requirements.

## When to Use

- After implementing changes
- Before merging PRs
- Before deployment
- After refactoring
- After fixing bugs

## Process

### Phase 1: Identify What to Verify

```yaml
Verification Categories:
  Functional:
    - Requirements met
    - Edge cases handled
    - Error cases handled

  Non-Functional:
    - Performance acceptable
    - Security validated
    - Accessibility met
    - Browser compatibility

  Quality:
    - Tests passing
    - Lint passing
    - Type check passing
    - Code review approved

  Operational:
    - Builds successfully
    - Deploys correctly
    - Monitors properly
    - Logs working
```

### Phase 2: Run Automated Checks

```yaml
Automated Checks:

  Type Check:
    Command: npm run typecheck
    Expected: 0 errors
    Tool: TypeScript

  Lint:
    Command: npm run lint
    Expected: 0 warnings
    Tool: ESLint

  Tests:
    Command: npm test
    Expected: All pass
    Tool: Vitest

  Coverage:
    Command: npm run test:coverage
    Expected: 80%+ all metrics
    Tool: Vitest + c8

  Build:
    Command: npm run build
    Expected: Success
    Tool: Vite

  Security:
    Command: npm audit
    Expected: No high/critical
    Tool: npm

  Markdown Lint:
    Command: markdownlint-cli2 "**/*.md"
    Expected: 0 errors
    Tool: markdownlint-cli2

  Format:
    Command: npm run format:check
    Expected: All formatted
    Tool: Prettier
```

### Phase 3: Perform Manual Checks

```yaml
Manual Verification:

  Functionality:
    - [ ] Feature works as expected
    - [ ] Edge cases handled
    - [ ] Error messages clear

  UX:
    - [ ] UI responsive
    - [ ] Loading states shown
    - [ ] Error states handled
    - [ ] Accessibility (keyboard nav, screen reader)

  Performance:
    - [ ] Response time acceptable
    - [ ] No memory leaks
    - [ ] Bundle size OK

  Security:
    - [ ] Auth enforced
    - [ ] Authz enforced
    - [ ] Input validated
    - [ ] No secrets exposed

  Browser Compatibility:
    - [ ] Chrome
    - [ ] Firefox
    - [ ] Safari
    - [ ] Edge (if applicable)
    - [ ] Mobile browsers
```

### Phase 4: Document Results

```yaml
Verification Report:
  - What was verified
  - Results (pass/fail)
  - Issues found
  - Actions taken
  - Sign-off
```

## Output Template

```markdown
## Verification Report: [Target]

### Summary
- **Status**: ✅ Pass / ❌ Fail / ⚠️ Pass with issues
- **Date**: YYYY-MM-DD
- **Verifier**: Agent

### Automated Checks

| Check | Result | Details |
|-------|--------|---------|
| Type check | ✅ | 0 errors |
| Lint | ✅ | 0 warnings |
| Tests | ✅ | 45/45 pass |
| Coverage | ✅ | 87% lines, 82% branches |
| Build | ✅ | Built in 12s |
| Security | ⚠️ | 2 moderate vulnerabilities |
| Markdown lint | ✅ | 0 errors |

### Manual Checks

#### Functionality
- [x] Feature works
- [x] Edge cases handled
- [x] Errors handled

#### Performance
- [x] Response time < 200ms
- [x] No memory leaks
- [x] Bundle size OK

#### Security
- [x] Auth enforced
- [x] Input validated

### Issues Found
1. **Moderate**: [Description]
   - Location: ...
   - Impact: ...
   - Action: ...

### Sign-off
- [x] All automated checks pass
- [x] All manual checks complete
- [x] Issues documented
- [x] Ready for [next step]
```

## Verification Checklist

### Before Merge

- [ ] Type check passes
- [ ] Lint passes
- [ ] All tests pass
- [ ] Coverage meets threshold
- [ ] Build succeeds
- [ ] No security vulnerabilities
- [ ] Documentation updated
- [ ] CHANGELOG updated

### Before Deploy

- [ ] All pre-merge checks
- [ ] Manual smoke test
- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] Monitoring configured
- [ ] Rollback plan ready

### After Deploy

- [ ] Health check passes
- [ ] Logs show expected behavior
- [ ] No error spikes
- [ ] Performance metrics normal
- [ ] User feedback collected

## Example Usage

```yaml
User Request: "Verify the authentication feature"

Agent Invocation:
  1. Identify: Authentication feature
  2. Run automated checks:
     - Type check
     - Lint
     - Tests
     - Coverage
     - Build
  3. Manual checks:
     - Login flow
     - Logout flow
     - Token refresh
     - Error cases
  4. Document results
  5. Report status
```
