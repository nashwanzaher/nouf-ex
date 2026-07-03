---
name: fix
description: Fix bugs systematically with regression tests
trigger:
  - "fix"
  - "bug"
  - "error"
  - "broken"
  - "not working"
  - "issue"
phases:
  - reproduce
  - diagnose
  - write_failing_test
  - implement_fix
  - verify_fix
  - prevent_regression
inputs:
  - bug_description
  - reproduction_steps
  - expected_vs_actual
outputs:
  - working_fix
  - regression_test
  - root_cause_analysis
verification:
  - Bug no longer reproduces
  - Test added to prevent regression
  - No new bugs introduced
---

## Mandatory Reference

> 🚨 **NON-NEGOTIABLE** — every action this agent/skill takes must align with the
> 9-domain End-to-End Developer Skills Mind Map:
> [docs/architecture/SKILLS_MINDMAP.md](../../../docs/architecture/SKILLS_MINDMAP.md) (v1.0.0)
>
> Adopted standards: ISO/IEC/IEEE 12207, ISO/IEC 25010, IEEE 829, ISO/IEC/IEEE 29119,
> OWASP API Top 10 (2023), WCAG 2.1 AA, Diátaxis, Keep a Changelog, Conventional
> Commits, SemVer. Violation = build-blocking.


# Fix Skill

## Purpose

Fix bugs **systematically** by reproducing first, understanding root cause, then implementing and verifying the fix.

## Core Principle

> **No fix without understanding the root cause.**

## When to Use

- Production bug
- Test failing
- Error in logs
- User-reported issue
- Performance regression

## Process

### Phase 1: Reproduce

```yaml
Goal: Consistently reproduce the bug

Steps:
  1. Document exact steps to reproduce
  2. Identify environment (OS, browser, version)
  3. Capture error messages and stack traces
  4. Note frequency (always/sometimes/once)
  5. Identify affected users/data

Reproduction Template:
  - Steps: [Exact steps]
  - Expected: [What should happen]
  - Actual: [What happens]
  - Environment: [OS, versions]
  - Frequency: [Always/sometimes]
  - Logs: [Stack trace, errors]
```

### Phase 2: Diagnose

```yaml
Goal: Find root cause (not just symptom)

Investigation:
  1. Read stack trace carefully
  2. Identify the failing component
  3. Trace data flow
  4. Check recent changes (git log)
  5. Review related issues
  6. Form hypothesis
  7. Test hypothesis

Common Root Causes:
  - Logic error in calculation
  - Missing null check
  - Off-by-one error
  - Race condition
  - Incorrect API call
  - Database query issue
  - Configuration error
  - Dependency version mismatch

Hypothesis Format:
  - Hypothesis: [What I think is wrong]
  - Evidence: [Why I think so]
  - Test: [How to verify]
```

### Phase 3: Write Failing Test

```yaml
Goal: Create a test that reproduces the bug

Why: Ensures:
  - Bug is reproducible in code
  - Fix can be verified
  - Regression prevented

Test Pattern:
  ```typescript
  describe('Bug: [description]', () => {
    it('reproduces the bug', () => {
      // Setup that triggers the bug
      const input = ...;

      // Action
      const result = functionUnderTest(input);

      // Assert expected behavior (currently failing)
      expect(result).toBe(expectedValue);
    });
  });
  ```

Verify test fails before fix.
```

### Phase 4: Implement Fix

```yaml
Goal: Fix the root cause

Fix Approaches:
  - Add missing validation
  - Fix logic error
  - Add null check
  - Fix race condition
  - Update incorrect query
  - Fix configuration
  - Update dependency

Fix Rules:
  - Fix root cause, not symptom
  - Minimal change
  - Don't introduce new issues
  - Consider side effects
  - Update related code if needed
```

### Phase 5: Verify Fix

```yaml
Verification:
  - Test now passes ✅
  - All other tests still pass ✅
  - Manual reproduction no longer triggers bug ✅
  - No new bugs introduced ✅
  - Performance not degraded ✅
  - Edge cases handled ✅

Smoke Tests:
  - Reproduce original bug scenario
  - Test related functionality
  - Test on different data
  - Test on different environments
```

### Phase 6: Prevent Regression

```yaml
Actions:
  - Keep the regression test
  - Add related edge case tests
  - Document the bug and fix in CHANGELOG
  - Update related documentation
  - Add code comment explaining the issue (if subtle)

Commit Message Format:
  fix(scope): description of bug

  - The bug: [description]
  - Root cause: [cause]
  - Fix: [what changed]

  Closes #[issue-number]
```

## Bug Investigation Template

```markdown
## Bug Report

### Description
[What's wrong]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happens]

### Environment
- OS: [OS]
- Browser: [Browser]
- Version: [Version]
- Database: [Version]

### Logs/Stack Trace
```
[paste error]
```

### Investigation Notes

#### Hypothesis 1
- **Theory**: ...
- **Evidence**: ...
- **Status**: Confirmed/Rejected

#### Hypothesis 2
- **Theory**: ...
- **Evidence**: ...
- **Status**: Confirmed/Rejected

### Root Cause
[What's actually wrong]

### Fix
[What was changed]

### Verification
- [ ] Regression test added
- [ ] Test passes
- [ ] All other tests pass
- [ ] Manual verification done
```

## Common Bug Patterns

### 1. Null Reference

```typescript
// Bug
const name = user.profile.name;  // user.profile might be null

// Fix
const name = user?.profile?.name ?? 'Unknown';
```

### 2. Off-by-One

```typescript
// Bug
for (let i = 0; i <= arr.length; i++) { }  // Should be <

// Fix
for (let i = 0; i < arr.length; i++) { }
```

### 3. Race Condition

```typescript
// Bug: Lost update
async function increment(id: string) {
  const value = await getValue(id);
  await setValue(id, value + 1);
}

// Fix: Atomic operation
async function increment(id: string) {
  await db.query('UPDATE counters SET value = value + 1 WHERE id = $1', [id]);
}
```

### 4. SQL Injection

```typescript
// Bug
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// Fix
const query = 'SELECT * FROM users WHERE id = $1';
```

### 5. Async Error

```typescript
// Bug: Unhandled promise rejection
async function fetchData() {
  const res = await fetch(url);
  return res.json();
}

// Fix: Proper error handling
async function fetchData() {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    logger.error({ error, url }, 'Fetch failed');
    throw new AppError(500, 'Failed to fetch data');
  }
}
```

## Verification Checklist

- [ ] Bug reproduced consistently
- [ ] Root cause identified
- [ ] Regression test written (failing)
- [ ] Fix implemented
- [ ] Test now passes
- [ ] All other tests still pass
- [ ] Manual verification done
- [ ] CHANGELOG updated
- [ ] Commit message descriptive

## Anti-Patterns to Avoid

```yaml
Don't:
  - Fix symptoms instead of root cause
  - Add try-catch to hide errors
  - Disable failing tests
  - Add comments instead of fixing
  - Make changes without tests
  - Fix and refactor at the same time
  - Skip verification
```
