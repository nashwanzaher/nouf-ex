---
name: refactor
description: Refactor code without changing behavior, with tests as safety net
trigger:
  - "refactor"
  - "improve"
  - "clean up"
  - "restructure"
  - "reorganize"
phases:
  - identify_code_smells
  - ensure_test_coverage
  - apply_refactoring
  - verify_behavior_unchanged
inputs:
  - target (code to refactor)
  - goal (what to improve)
outputs:
  - refactored_code
  - same_behavior
  - improved_design
verification:
  - All tests still pass
  - Behavior unchanged
  - Code quality improved
---

# Refactor Skill

## Purpose

Improve code structure **without changing behavior** using systematic refactoring patterns.

## Core Rule

> **NEVER change behavior while refactoring.**

If you need to change behavior, that's a separate task.

## When to Use

- Code is hard to understand
- Duplication exists
- Long methods/classes
- Tight coupling
- Poor naming
- After adding features

## When NOT to Use

- Code has no tests (write tests first!)
- You're tempted to also fix bugs (separate task)
- Under time pressure with no tests

## Process

### Phase 1: Identify Code Smells

```yaml
Common Code Smells:

  Bloaters:
    - Long Method (> 20 lines)
    - Large Class (> 200 lines)
    - Long Parameter List (> 4 params)
    - Data Clumps

  OO Abusers:
    - Switch Statements
    - Refused Bequest
    - Alternative Classes with Different Interfaces

  Change Preventers:
    - Divergent Change
    - Shotgun Surgery
    - Parallel Inheritance

  Dispensables:
    - Duplicate Code
    - Dead Code
    - Lazy Class
    - Speculative Generality

  Couplers:
    - Feature Envy
    - Inappropriate Intimacy
    - Message Chains
    - Middle Man
```

### Phase 2: Ensure Test Coverage

```yaml
Before Refactoring:
  - Run existing tests, ensure they pass
  - Identify areas with low coverage
  - Add characterization tests if needed:
    - Tests that document current behavior
    - Tests for edge cases
    - Tests for error paths

Rule: If you can't test it, you can't safely refactor it.
```

### Phase 3: Apply Refactoring

```yaml
Common Refactorings:

  Extract Function:
    When: Function doing multiple things
    Action: Split into named functions
    Example: Long processOrder → validateOrder + calculateTotal + saveOrder

  Extract Class:
    When: Class with too many responsibilities
    Action: Split into cohesive classes
    Example: User with address → User + Address

  Move Method:
    When: Method uses other class more
    Action: Move to that class
    Example: Account.overdraftCharge → AccountType.overdraftCharge

  Replace Conditional with Polymorphism:
    When: Switch on type
    Action: Create class hierarchy
    Example: getSpeed switch → Vehicle subclasses

  Introduce Parameter Object:
    When: Long parameter lists
    Action: Group related params
    Example: (userId, items, address, payment) → CreateOrderRequest

  Replace Magic Numbers with Constants:
    When: Literal values in code
    Action: Named constants
    Example: 18 → LEGAL_AGE

  Rename:
    When: Poor naming
    Action: Clear, descriptive names
    Example: d → elapsedDays

  Decompose Conditional:
    When: Complex conditional
    Action: Extract to well-named methods
    Example: if (date.before(SUMMER_START) || date.after(SUMMER_END)) → !isSummer(date)

Refactoring Steps:
  1. Make one small change
  2. Run tests
  3. Commit if passing
  4. Repeat
```

### Phase 4: Verify Behavior Unchanged

```yaml
Verification:
  - All existing tests pass
  - New tests added if behavior needed documenting
  - Manual smoke test
  - No new bugs introduced
  - Performance not degraded

If behavior changed:
  - STOP
  - Revert changes
  - Identify what went wrong
  - Re-approach
```

## Refactoring Workflow

```markdown
## Refactoring Session

### Target
[File/Component]

### Smells Identified
- [ ] [Smell 1]
- [ ] [Smell 2]

### Pre-Refactor Checklist
- [ ] Tests exist and pass
- [ ] Current behavior documented
- [ ] Backup/commit before starting

### Refactoring Steps

#### Step 1: [Refactoring name]
**Before**:
```typescript
[Before code]
```

**After**:
```typescript
[After code]
```

**Tests**: ✅ All passing

### Step 2: [Refactoring name]

[Same format]

### Post-Refactor Verification

- [ ] All tests pass
- [ ] No behavior changes
- [ ] Code is cleaner
- [ ] No new bugs

### Commit Message

`refactor(scope): description`
```

## Common Refactoring Examples

### Extract Function

```typescript
// Before
function printOwing(invoice: Invoice) {
  console.log('***********************');
  console.log('** Customer Owes **');
  console.log('***********************');

  // calculate outstanding
  let outstanding = 0;
  for (const o of invoice.orders) {
    outstanding += o.amount;
  }

  // print details
  console.log(`name: ${invoice.customer}`);
  console.log(`amount: ${outstanding}`);
}

// After
function printOwing(invoice: Invoice) {
  printBanner();
  const outstanding = calculateOutstanding(invoice);
  printDetails(invoice, outstanding);
}

function printBanner() {
  console.log('***********************');
  console.log('** Customer Owes **');
  console.log('***********************');
}

function calculateOutstanding(invoice: Invoice): number {
  return invoice.orders.reduce((sum, o) => sum + o.amount, 0);
}

function printDetails(invoice: Invoice, outstanding: number) {
  console.log(`name: ${invoice.customer}`);
  console.log(`amount: ${outstanding}`);
}
```

### Replace Conditional with Polymorphism

```typescript
// Before
function getSpeed(vehicle: Vehicle): number {
  switch (vehicle.type) {
    case 'car': return vehicle.baseSpeed * 1.0;
    case 'bicycle': return vehicle.baseSpeed * 0.5;
    case 'airplane': return vehicle.baseSpeed * 10.0;
    default: throw new Error('Unknown vehicle');
  }
}

// After
abstract class Vehicle {
  abstract getSpeed(): number;
}

class Car extends Vehicle {
  getSpeed() { return this.baseSpeed * 1.0; }
}

class Bicycle extends Vehicle {
  getSpeed() { return this.baseSpeed * 0.5; }
}

class Airplane extends Vehicle {
  getSpeed() { return this.baseSpeed * 10.0; }
}

// Now: vehicle.getSpeed() - no switch needed
```

## Verification Checklist

- [ ] Tests exist before refactoring
- [ ] One refactoring at a time
- [ ] Tests pass after each step
- [ ] Commit after each successful step
- [ ] Behavior unchanged
- [ ] Code is cleaner

## Anti-Patterns to Avoid

```yaml
Don't:
  - Refactor and fix bugs at the same time
  - Refactor without tests
  - Make multiple refactorings at once
  - Change formatting and refactor at same time
  - Refactor code you don't understand
```
