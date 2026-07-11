---
name: debug
description: Debug issues systematically using logs, stack traces, and profiling
trigger:
  - "debug"
  - "investigate error"
  - "why is this failing"
  - "stack trace"
  - "error analysis"
phases:
  - reproduce
  - gather_evidence
  - form_hypothesis
  - test_hypothesis
  - identify_root_cause
  - apply_fix
  - verify_fix
inputs:
  - error_description
  - reproduction_steps
  - logs_stack_traces
outputs:
  - root_cause_analysis
  - fix_applied
  - regression_test
verification:
  - Bug no longer reproduces
  - Regression test added
  - No new issues introduced
---

## Mandatory Reference

> 🚨 **NON-NEGOTIABLE** — every action this agent/skill takes must align with the
> 9-domain End-to-End Developer Skills Mind Map:
> [docs/audits/2026-07-11-owasp-iso25010-nist-ssdf.md](../../../docs/audits/2026-07-11-owasp-iso25010-nist-ssdf.md) (v1.0)
>
> Adopted standards: ISO/IEC/IEEE 12207, ISO/IEC 25010, IEEE 829, ISO/IEC/IEEE 29119,
> OWASP API Top 10 (2023), WCAG 2.1 AA, Diátaxis, Keep a Changelog, Conventional
> Commits, SemVer. Violation = build-blocking.


# Debug Skill

## Purpose

Systematically **debug** issues by reproducing, gathering evidence, forming hypotheses, and identifying root causes.

## When to Use

- Error in logs
- Test failing
- User-reported bug
- Performance regression
- Unexpected behavior
- Crash report

## Process

### Phase 1: Reproduce

```yaml
Goal: Consistently reproduce the bug

Steps:
  1. Document exact reproduction steps
  2. Identify minimal repro
  3. Capture environment details
  4. Record frequency (always/sometimes/once)
  5. Note affected users/data

Reproduction Template:
  Steps:
    1. [Step 1]
    2. [Step 2]
    3. [Step 3]

  Expected: [What should happen]
  Actual: [What actually happens]

  Environment:
    - OS: Windows 11
    - Browser: Chrome 120
    - Node.js: 20.18.1
    - Database: PostgreSQL 17

  Frequency: Always / Sometimes / Once
```

### Phase 2: Gather Evidence

```yaml
Collect:
  - Error messages (exact text)
  - Stack traces (full, not truncated)
  - Log entries around the error
  - Recent code changes (git log)
  - System metrics (CPU, memory, disk)
  - Network requests (DevTools)
  - Database queries (EXPLAIN)
  - Environment variables

Tools:
  - Browser DevTools
  - VS Code debugger
  - Node.js --inspect
  - Chrome DevTools Profiler
  - pg_stat_statements
  - Application logs
  - Error tracking (Sentry)
```

### Phase 3: Form Hypothesis

```yaml
Based on evidence, hypothesize root cause:

Common Bug Categories:
  - Null/undefined reference
  - Race condition
  - Off-by-one error
  - Logic error
  - Type coercion issue
  - Missing validation
  - Wrong API call
  - Database query issue
  - Configuration error
  - Dependency version mismatch

Hypothesis Format:
  - Statement: [What I think is wrong]
  - Location: [Where I think it's happening]
  - Evidence: [Why I think so]
  - Test: [How to verify]
```

### Phase 4: Test Hypothesis

```yaml
Methods:
  - Add logging at suspected location
  - Run with debugger attached
  - Write failing test
  - Inspect variable values
  - Trace execution flow

Validation:
  - Hypothesis confirmed: Move to Phase 5
  - Hypothesis rejected: Form new hypothesis
  - Need more info: Go back to Phase 2
```

### Phase 5: Identify Root Cause

```yaml
Root Cause Analysis:
  - Symptom vs Root Cause (fix cause, not symptom)
  - Why did this happen? (5 Whys)
  - Why wasn't it caught? (missing test?)
  - Why now? (recent change? data change?)

Document:
  - Root cause description
  - Why it happened
  - Why it wasn't caught
  - Impact assessment
```

### Phase 6: Apply Fix

```yaml
Fix Strategy:
  - Minimal change to fix root cause
  - Don't introduce new bugs
  - Consider side effects
  - Update related code if needed

Process:
  1. Write failing test that reproduces bug
  2. Implement fix
  3. Verify test now passes
  4. Check related tests still pass
  5. Manual verification
```

### Phase 7: Verify Fix

```yaml
Verification:
  - Bug no longer reproduces
  - All tests pass
  - No regressions
  - Performance not degraded
  - Edge cases handled
  - Documentation updated
```

## Debugging Techniques

### 1. Binary Search

```typescript
// Bug somewhere in this function
function processData(data: Data) {
  step1(data);
  step2(data);
  step3(data);
  step4(data);
  step5(data);
}

// Add logging at midpoint
function processData(data: Data) {
  console.log('Before step1');
  step1(data);
  console.log('After step1');
  // ...
  console.log('Before step3');
  step3(data);
  console.log('After step3');
}
```

### 2. Rubber Duck Debugging

```yaml
Explain to rubber duck (or colleague):
  - What is the code supposed to do?
  - What does it actually do?
  - What's different?
  - Why might that be?

Often, explaining the problem reveals the solution.
```

### 3. Divide and Conquer

```yaml
If bug in large function:
  1. Comment out half the code
  2. Does bug still occur?
  3. If yes: bug in remaining half
  4. If no: bug in commented half
  5. Repeat until bug is isolated
```

### 4. Print Debugging

```typescript
// Quick and dirty - remove after fix
function complexFunction(input: Input): Output {
  console.log('Input:', JSON.stringify(input));

  const intermediate = step1(input);
  console.log('After step1:', intermediate);

  const result = step2(intermediate);
  console.log('Final result:', result);

  return result;
}
```

### 5. Conditional Breakpoints

```typescript
// In debugger, set breakpoint with condition
// Example: Break only when userId === '123'
function processUser(user: User) {
  // Breakpoint: user.id === '123'
  return doSomething(user);
}
```

## Common Bug Patterns & Fixes

### 1. Null Reference

```typescript
// Bug: Cannot read property 'name' of undefined
const name = user.profile.name;

// Fix: Optional chaining
const name = user?.profile?.name ?? 'Unknown';

// Fix: Explicit check
if (!user?.profile) {
  throw new Error('Profile missing');
}
const name = user.profile.name;
```

### 2. Race Condition

```typescript
// Bug: Lost update
async function increment(id: string) {
  const value = await getValue(id);
  await setValue(id, value + 1);  // Another request might increment too
}

// Fix: Atomic operation
async function increment(id: string) {
  await db.query('UPDATE counters SET value = value + 1 WHERE id = $1', [id]);
}
```

### 3. Off-by-One

```typescript
// Bug: Iterates one too many
for (let i = 0; i <= arr.length; i++) {
  console.log(arr[i]);  // Last iteration: undefined
}

// Fix: Use <
for (let i = 0; i < arr.length; i++) {
  console.log(arr[i]);
}
```

### 4. Async Error Not Caught

```typescript
// Bug: Unhandled promise rejection
async function fetchData() {
  const res = await fetch('/api/data');  // Could throw
  return res.json();
}

// Fix: Try/catch
async function fetchData() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    logger.error({ error }, 'Fetch failed');
    throw new AppError(500, 'Fetch failed');
  }
}
```

### 5. Incorrect Comparison

```typescript
// Bug: == vs ===
if (count == '5') { }  // True (type coercion)

// Fix: Strict equality
if (count === 5) { }
```

### 6. Memory Leak

```typescript
// Bug: Event listener not removed
useEffect(() => {
  window.addEventListener('resize', handler);
}, []);

// Fix: Cleanup
useEffect(() => {
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);
```

### 7. SQL Injection

```typescript
// Bug: String concatenation
const query = `SELECT * FROM users WHERE id = '${id}'`;

// Fix: Parameterized query
const query = 'SELECT * FROM users WHERE id = $1';
const result = await db.query(query, [id]);
```

### 8. Wrong API Endpoint

```typescript
// Bug: Wrong URL
fetch('/api/v1/users')  // Old API

// Fix: Correct URL
fetch('/api/v2/users')  // Current API
```

## Debugging Tools

```yaml
Frontend:
  - Chrome DevTools: Network, Console, Sources, Performance
  - React DevTools: Component tree, props, state
  - Redux DevTools: Actions, state changes
  - Lighthouse: Performance, accessibility, SEO

Backend:
  - Node.js --inspect: Debugger
  - Node.js --prof: CPU profiler
  - clinic.js: Performance analysis
  - console.log: Quick debugging (remove after)

Database:
  - EXPLAIN ANALYZE: Query plan
  - pg_stat_statements: Query statistics
  - Slow query log: Identify slow queries

General:
  - VS Code debugger: Breakpoints, watch, call stack
  - Git bisect: Find which commit introduced bug
  - Application logs: Structured logging
  - Error tracking: Sentry, Rollbar, Bugsnag
```

## Debugging Checklist

```yaml
Before Debugging:
  - [ ] Bug reproduced consistently
  - [ ] Evidence gathered
  - [ ] Logs collected
  - [ ] Recent changes identified

During Debugging:
  - [ ] Hypothesis formed
  - [ ] Hypothesis tested
  - [ ] Root cause identified
  - [ ] Fix applied
  - [ ] Tests pass

After Debugging:
  - [ ] Bug no longer reproduces
  - [ ] Regression test added
  - [ ] No new bugs introduced
  - [ ] Documentation updated
  - [ ] Post-mortem written (if critical)
```

## Output Template

```markdown

## Debug Report

### Bug

[Description]

### Reproduction

[Steps]

### Expected vs Actual

[Comparison]

### Root Cause

[Analysis - what was actually wrong]

### Evidence

- [Log entries]
- [Stack traces]
- [Test failures]

### Hypothesis Tested

1. [Hypothesis 1] - Confirmed/Rejected
2. [Hypothesis 2] - Confirmed/Rejected

### Fix Applied

[Code changes]

### Verification

- [ ] Bug no longer reproduces
- [ ] Regression test added
- [ ] All tests pass
- [ ] No regressions

### Prevention

[How to prevent this in the future]
```

## Anti-Patterns to Avoid

```yaml
Don't:
  - Guess without evidence
  - Add try-catch to hide errors
  - Disable failing tests
  - Skip writing a regression test
  - Fix symptoms instead of root cause
  - Make random changes hoping it works
  - Ignore logs and stack traces
  - Debug without reproducing
```
