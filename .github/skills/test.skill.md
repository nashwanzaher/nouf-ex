---
name: test
description: Create comprehensive tests with coverage analysis
trigger:
  - "test"
  - "add tests"
  - "write tests"
  - "create tests"
  - "test coverage"
phases:
  - analyze_code
  - plan_test_cases
  - write_tests
  - run_coverage
  - verify
inputs:
  - target (code to test)
  - coverage_goal (target percentage)
outputs:
  - test_files
  - coverage_report
  - passing_tests
verification:
  - Coverage meets goal
  - All tests pass
  - Edge cases covered
---

## Mandatory Reference

> 🚨 **NON-NEGOTIABLE** — every action this agent/skill takes must align with the
> 9-domain End-to-End Developer Skills Mind Map:
> [docs/audits/2026-07-11-owasp-iso25010-nist-ssdf.md](../../../docs/audits/2026-07-11-owasp-iso25010-nist-ssdf.md) (v1.0)
>
> Adopted standards: ISO/IEC/IEEE 12207, ISO/IEC 25010, IEEE 829, ISO/IEC/IEEE 29119,
> OWASP API Top 10 (2023), WCAG 2.1 AA, Diátaxis, Keep a Changelog, Conventional
> Commits, SemVer. Violation = build-blocking.


# Test Skill

## Purpose

Create **comprehensive tests** that ensure code correctness, prevent regressions, and document expected behavior.

## When to Use

- Adding new features
- Fixing bugs
- Refactoring code
- Coverage gaps exist
- Before deployment

## Process

### Phase 1: Analyze Code

```yaml
Understand:
  - What is being tested?
  - What is the public API?
  - What are the inputs/outputs?
  - What are the dependencies?
  - What can go wrong?

Identify:
  - Public functions/methods
  - Edge cases
  - Error conditions
  - Async behavior
  - Side effects
```

### Phase 2: Plan Test Cases

```yaml
Test Case Categories:

  Happy Path:
    - Valid input → expected output
    - Multiple valid scenarios
    - Common use cases

  Edge Cases:
    - Empty inputs
    - Boundary values (min, max)
    - Null/undefined
    - Empty arrays/objects
    - Large inputs

  Error Cases:
    - Invalid input
    - Missing dependencies
    - Network failures
    - Database errors
    - Permission denied

  State Cases:
    - Initial state
    - After operations
    - Concurrent operations
    - Cleanup

Test Structure (AAA):
  Arrange: Set up test data and mocks
  Act: Execute code under test
  Assert: Verify expected outcome
```

### Phase 3: Write Tests

```yaml
Test File Structure:
  - imports
  - describe blocks
  - beforeEach/afterEach setup
  - it blocks with clear names
  - expect assertions

Naming Convention:
  - describe: Component/Function name
  - it: should [expected behavior] when [condition]
  - Example: "should return 0 when list is empty"

Test Types:
  Unit Tests:
    - Test single function in isolation
    - Mock dependencies
    - Fast (< 100ms)

  Integration Tests:
    - Test with real database
    - Test API endpoints
    - Test component interactions

  E2E Tests:
    - Test user flows
    - Test critical paths
    - Test in real browser
```

### Phase 4: Run Coverage

```yaml
Coverage Goals:
  Statements: 80%+
  Branches: 80%+
  Functions: 80%+
  Lines: 80%+

Critical Paths (100%):
  - Authentication
  - Payment
  - Authorization
  - Data validation
  - Error handling

Commands:
  - npm test (run tests)
  - npm run test:coverage (with coverage)
  - npm run test:watch (watch mode)
  - npm run test:ui (UI mode)
```

### Phase 5: Verify

```yaml
Verify:
  - All tests pass
  - Coverage meets goal
  - No flaky tests
  - Tests are fast
  - Tests are independent
  - Names are descriptive
  - No test smells
```

## Test Patterns

### Unit Test Pattern

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { calculateDiscount } from './pricing';

describe('calculateDiscount', () => {
  describe('with valid inputs', () => {
    it('should apply percentage discount', () => {
      // Arrange
      const price = 100;
      const discount = 10;

      // Act
      const result = calculateDiscount(price, discount);

      // Assert
      expect(result).toBe(90);
    });
  });

  describe('with edge cases', () => {
    it('should return original price when discount is 0', () => {
      expect(calculateDiscount(100, 0)).toBe(100);
    });

    it('should return 0 when discount is 100%', () => {
      expect(calculateDiscount(100, 100)).toBe(0);
    });
  });

  describe('with invalid inputs', () => {
    it('should throw on negative price', () => {
      expect(() => calculateDiscount(-10, 5)).toThrow('Price must be positive');
    });

    it('should throw on discount over 100%', () => {
      expect(() => calculateDiscount(100, 150)).toThrow('Invalid discount');
    });
  });
});
```

### Async Test Pattern

```typescript
describe('fetchUser', () => {
  it('should return user data on success', async () => {
    const user = await fetchUser('123');
    expect(user).toEqual({
      id: '123',
      name: 'John Doe',
      email: 'john@example.com',
    });
  });

  it('should throw on 404', async () => {
    await expect(fetchUser('nonexistent')).rejects.toThrow('User not found');
  });

  it('should throw on network error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
    await expect(fetchUser('123')).rejects.toThrow('Network error');
  });
});
```

### Mock Pattern

```typescript
import { vi } from 'vitest';

vi.mock('./database', () => ({
  query: vi.fn(),
}));

import { query } from './database';

describe('getProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return products from database', async () => {
    vi.mocked(query).mockResolvedValue({
      rows: [{ id: '1', name: 'Product' }],
      rowCount: 1,
    });

    const products = await getProducts();

    expect(products).toHaveLength(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
  });
});
```

### E2E Test Pattern

```typescript
import { test, expect } from '@playwright/test';

test.describe('User Registration', () => {
  test('should register new user', async ({ page }) => {
    // Navigate
    await page.goto('/register');

    // Fill form
    await page.fill('[name="email"]', 'user@example.com');
    await page.fill('[name="password"]', 'SecurePass123!');

    // Submit
    await page.click('button[type="submit"]');

    // Verify
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Welcome');
  });

  test('should show error for existing email', async ({ page }) => {
    await page.goto('/register');
    await page.fill('[name="email"]', 'existing@example.com');
    await page.fill('[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="error"]')).toContainText('Email already exists');
  });
});
```

## Coverage Analysis

```yaml
Coverage Targets:
  Statements: 80%+
  Branches: 80%+
  Functions: 80%+
  Lines: 80%+

What to Exclude:
  - Type definitions (*.d.ts)
  - Test files
  - Config files
  - Mock files
  - Generated code

Increase Coverage By:
  1. Add tests for uncovered lines
  2. Cover error paths
  3. Test edge cases
  4. Test branches
```

## Output Template

```markdown

## Test Report

### Target

[What was tested]

### Tests Added

- Unit tests: X
- Integration tests: Y
- E2E tests: Z

### Coverage

- Statements: X% (target Y%)
- Branches: X% (target Y%)
- Functions: X% (target Y%)
- Lines: X% (target Y%)

### Test Results

- Total: X
- Passing: X ✅
- Failing: 0 ❌

### Verification

- [ ] All tests pass
- [ ] Coverage meets goals
- [ ] No flaky tests
- [ ] Fast execution
```

## Verification Checklist

- [ ] Code analyzed
- [ ] Test cases planned
- [ ] Tests written
- [ ] All tests pass
- [ ] Coverage meets target
- [ ] Edge cases covered
- [ ] Error cases covered
- [ ] No flaky tests
- [ ] Fast execution
- [ ] Independent tests

## Anti-Patterns to Avoid

```yaml
Don't:
  - Test implementation details
  - Use brittle selectors
  - Create inter-test dependencies
  - Skip error cases
  - Ignore coverage gaps
  - Write slow tests
  - Mock everything (test real when possible)
```
