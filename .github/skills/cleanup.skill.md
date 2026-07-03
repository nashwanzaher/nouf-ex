---
name: cleanup
description: Remove duplicates, dead code, and improve code quality
trigger:
  - "cleanup"
  - "remove duplicates"
  - "remove dead code"
  - "deduplicate"
  - "remove unused"
phases:
  - identify_duplicates
  - identify_dead_code
  - identify_unused
  - remove_safely
  - verify
inputs:
  - scope (what to clean)
outputs:
  - cleaner_codebase
  - reduced_complexity
verification:
  - No functionality removed
  - All tests still pass
  - Bundle size reduced
---

## Mandatory Reference

> 🚨 **NON-NEGOTIABLE** — every action this agent/skill takes must align with the
> 9-domain End-to-End Developer Skills Mind Map:
> [docs/architecture/SKILLS_MINDMAP.md](../../../docs/architecture/SKILLS_MINDMAP.md) (v1.0.0)
>
> Adopted standards: ISO/IEC/IEEE 12207, ISO/IEC 25010, IEEE 829, ISO/IEC/IEEE 29119,
> OWASP API Top 10 (2023), WCAG 2.1 AA, Diátaxis, Keep a Changelog, Conventional
> Commits, SemVer. Violation = build-blocking.


# Cleanup Skill

## Purpose

Remove **duplicates**, **dead code**, and **unused imports** to keep the codebase clean and maintainable.

## When to Use

- Code review feedback
- Regular maintenance
- Pre-release cleanup
- After major refactoring
- When tests still pass but code is bloated

## Process

### Phase 1: Identify Duplicates

```yaml
Types of Duplicates:

  Exact Duplicates:
    - Identical files
    - Identical functions

  Near Duplicates:
    - Similar logic with slight variations
    - Copy-pasted code with minor changes

  Conceptual Duplicates:
    - Different implementations of same concept
    - Multiple ways to do same thing

Tools:
  - grep_search for similar code
  - Duplicate detection tools (jscpd)
  - Manual review
```

### Phase 2: Identify Dead Code

```yaml
Types of Dead Code:

  Unused Exports:
    - Functions never called
    - Components never rendered
    - Constants never used

  Unreachable Code:
    - After return statement
    - In always-false branches
    - In dead code paths

  Commented-Out Code:
    - Should be deleted (git has history)
    - Reduces readability

  Unused Files:
    - Files never imported
    - Test files for deleted code

Tools:
  - TypeScript compiler (noUnusedLocals)
  - ESLint (no-unused-vars)
  - Knip / ts-prune for unused exports
  - Manual review
```

### Phase 3: Identify Unused

```yaml
Categories:

  Unused Imports:
    - Imported but never used
    - Type imports no longer needed

  Unused Variables:
    - Declared but never read
    - Function parameters never used

  Unused Dependencies:
    - In package.json but never imported
    - Transitive but unnecessary

  Unused Styles:
    - CSS classes never applied
    - Unused Tailwind classes

Tools:
  - ESLint
  - depcheck
  - Knip
  - ts-prune
```

### Phase 4: Remove Safely

```yaml
Removal Strategy:

  Safe Removals (Always OK):
    - Unused imports
    - Unused variables
    - Commented-out code
    - Unused dependencies

  Careful Removals (Verify First):
    - Unused exports (might be public API)
    - Unused files (might be entry points)
    - Duplicate functions (might be public API)

Removal Process:
  1. Remove one category at a time
  2. Run tests after each removal
  3. Commit if passing
  4. Verify no functionality lost

Tools:
  - IDE organize imports
  - ESLint --fix
  - Knip --fix
  - Manual deletion
```

### Phase 5: Verify

```yaml
Verification:
  - All tests pass
  - Build succeeds
  - No new errors
  - Bundle size reduced (if possible)
  - No functionality lost
  - Documentation still accurate
```

## Common Cleanup Patterns

### 1. Remove Unused Imports

```typescript
// Before
import { useState, useEffect, useMemo, useCallback } from 'react';  // Only useState used
import { Button, Card, Modal, Dropdown } from '@/components/ui';  // Only Button used
import { formatDate, parseDate, calculateAge } from '@/lib/dates';  // Only formatDate used

// After
import { useState } from 'react';
import { Button } from '@/components/ui';
import { formatDate } from '@/lib/dates';
```

### 2. Extract Duplicate Logic

```typescript
// Before (duplicated in 3 places)
function validateUser1(user: User) {
  if (!user.email || !user.email.includes('@')) throw new Error('Invalid email');
  if (!user.name || user.name.length < 2) throw new Error('Invalid name');
}

function validateUser2(user: User) {
  if (!user.email || !user.email.includes('@')) throw new Error('Invalid email');
  if (!user.name || user.name.length < 2) throw new Error('Invalid name');
}

function validateUser3(user: User) {
  if (!user.email || !user.email.includes('@')) throw new Error('Invalid email');
  if (!user.name || user.name.length < 2) throw new Error('Invalid name');
}

// After (extracted)
function validateUser(user: User) {
  if (!user.email || !user.email.includes('@')) throw new Error('Invalid email');
  if (!user.name || user.name.length < 2) throw new Error('Invalid name');
}
```

### 3. Remove Dead Code

```typescript
// Before
function processOrder(order: Order) {
  if (order.status === 'pending') {
    // process
  } else if (order.status === 'paid') {
    // process
  } else {
    // dead code - this status never exists
    console.log('Unknown status');
  }
}

// After
function processOrder(order: Order) {
  if (order.status === 'pending') {
    // process
  } else if (order.status === 'paid') {
    // process
  }
  // Remove the else branch - unreachable code
}
```

### 4. Remove Unused Dependencies

```bash
# Check for unused dependencies
npx depcheck

# Remove unused dependency
npm uninstall unused-package
```

## Output Template

```markdown
## Cleanup Report

### Scope
[What was cleaned]

### Findings

#### Duplicates
- [Duplicate 1]: `file1.ts` and `file2.ts`
- [Duplicate 2]: [description]

#### Dead Code
- [Dead code 1]: `file.ts:line` - [description]
- [Dead code 2]: [description]

#### Unused
- [Unused 1]: [description]
- [Unused 2]: [description]

### Removals

#### Files Removed
- `path/to/unused.ts`

#### Code Removed
- Unused imports: 23
- Unused variables: 12
- Dead code: 5 functions
- Unused dependencies: 3

### Impact
- Lines removed: 1,234
- Bundle size: -45KB
- Complexity: Reduced

### Verification
- [ ] Tests pass: 45/45
- [ ] Build succeeds
- [ ] No functionality lost
```

## Verification Checklist

- [ ] All duplicates identified
- [ ] All dead code identified
- [ ] All unused code identified
- [ ] Removed safely (one at a time)
- [ ] Tests pass after each removal
- [ ] Build succeeds
- [ ] No functionality lost
- [ ] Bundle size reduced

## Anti-Patterns to Avoid

```yaml
Don't:
  - Remove code without verifying it's unused
  - Remove "unused" exports (might be public API)
  - Remove tests (even if "redundant")
  - Remove comments without understanding why
  - Mass delete without testing
  - Remove error handling that "seems unnecessary"
```
