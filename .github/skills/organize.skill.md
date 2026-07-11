---
name: organize
description: Organize files, directories, and code structure systematically
trigger:
  - "organize"
  - "arrange"
  - "structure"
  - "sort"
  - "tidy"
phases:
  - analyze_current_structure
  - plan_target_structure
  - move_files
  - update_references
  - verify
inputs:
  - scope (what to organize)
  - rules (organization principles)
outputs:
  - organized_structure
  - updated_references
verification:
  - Files in correct locations
  - All references updated
  - Tests still pass
  - No broken imports
---

## Mandatory Reference

> 🚨 **NON-NEGOTIABLE** — every action this agent/skill takes must align with the
> 9-domain End-to-End Developer Skills Mind Map:
> [docs/audits/2026-07-11-owasp-iso25010-nist-ssdf.md](../../../docs/audits/2026-07-11-owasp-iso25010-nist-ssdf.md) (v1.0)
>
> Adopted standards: ISO/IEC/IEEE 12207, ISO/IEC 25010, IEEE 829, ISO/IEC/IEEE 29119,
> OWASP API Top 10 (2023), WCAG 2.1 AA, Diátaxis, Keep a Changelog, Conventional
> Commits, SemVer. Violation = build-blocking.


# Organize Skill

## Purpose

Systematically **organize** files, directories, and code following project conventions.

## When to Use

- Project structure cleanup
- File reorganization
- Directory restructuring
- Naming convention enforcement
- Import organization

## Process

### Phase 1: Analyze Current Structure

```yaml
Inventory:
  - List all files in scope
  - Categorize by type
  - Identify misplaced files
  - Find naming violations
  - Detect duplicates

Analysis Output:
  - Current state
  - Issues found
  - Proposed changes
```

### Phase 2: Plan Target Structure

```yaml
Organization Rules:
  - By feature: Group related functionality
  - By type: Group by file type (components, hooks, etc.)
  - By layer: Group by architectural layer
  - Hybrid: Most common in real projects

Project Structure Standard:
  src/
    components/
      ui/          # Generic UI (shadcn)
      feature/     # Feature-specific
    pages/         # Route pages
    hooks/         # Custom hooks
    lib/           # Utilities
    core/          # Business logic
    context/       # React contexts
    i18n/          # Internationalization
    widgets/       # Complex composites
    shared/        # Cross-cutting
```

### Phase 3: Move Files

```yaml
Move Order:
  1. Create new directories first
  2. Move files (git mv to preserve history)
  3. Verify each move
  4. Update imports
  5. Run tests

Safety:
  - Use git mv (preserves history)
  - Move in small batches
  - Test after each batch
  - Commit after each successful batch
```

### Phase 4: Update References

```yaml
Update:
  - Import paths
  - Type imports
  - Re-exports
  - Documentation links
  - Test imports
  - Build configuration
  - CI/CD references

Tools:
  - Find and replace (with verification)
  - IDE refactoring
  - grep_search for old paths
```

### Phase 5: Verify

```yaml
Verification:
  - All imports resolve
  - All tests pass
  - Build succeeds
  - No broken links
  - Lint passes
  - Type check passes
```

## File Organization Rules

```yaml
Naming Conventions:
  Components: PascalCase.tsx (UserCard.tsx)
  Hooks: camelCase with 'use' prefix (useAuth.ts)
  Utilities: camelCase (formatDate.ts)
  Constants: UPPER_SNAKE_CASE (API_ENDPOINTS.ts)
  Types: PascalCase (User.ts)
  Tests: source.test.ts (UserCard.test.tsx)

Directory Rules:
  - Group by feature when files are related
  - Group by type when files are independent
  - Max 10-15 files per directory
  - Use index.ts for barrel exports (sparingly)

File Size:
  - Max 300 lines per file
  - Max 20 lines per function
  - Max 4 parameters per function
```

## Common Organization Tasks

### 1. Sort Imports

```typescript
// Before
import { useState } from 'react';
import { Button } from './Button';
import { formatDate } from '@/lib/utils';
import express from 'express';

// After (sorted by: external, internal, relative, types)
import express from 'express';
import { useState } from 'react';

import { Button } from './Button';
import { formatDate } from '@/lib/utils';
```

### 2. Group Constants

```typescript
// Before
const MAX_RETRIES = 3;
const userName = 'John';
const API_URL = 'https://api.example.com';
const TIMEOUT = 5000;

// After
const MAX_RETRIES = 3;
const TIMEOUT = 5000;
const API_URL = 'https://api.example.com';

const userName = 'John';
```

### 3. Group Related Files

```
// Before
src/
  Button.tsx
  Card.tsx
  useAuth.ts
  useProducts.ts
  auth.ts
  products.ts
  api.ts
  utils.ts

// After
src/
  components/
    ui/
      Button.tsx
      Card.tsx
  hooks/
    useAuth.ts
    useProducts.ts
  services/
    auth.ts
    products.ts
  api/
    api.ts
  utils/
    utils.ts
```

## Output Template

```markdown
## Organization Report

### Scope
[What was organized]

### Changes Made
- Moved: X files
- Renamed: X files
- Updated: X imports
- Created: X directories

### Before
[Old structure]

### After
[New structure]

### Verification
- [ ] All imports resolve
- [ ] All tests pass
- [ ] Build succeeds
- [ ] No broken references

### Files Moved
- `src/OldPath.tsx` → `src/components/NewPath.tsx`
- `src/utils.ts` → `src/lib/utils/index.ts`

### Imports Updated
- Updated X imports across Y files
```

## Verification Checklist

- [ ] All files in correct location
- [ ] All imports updated
- [ ] All tests pass
- [ ] Lint passes
- [ ] Type check passes
- [ ] Build succeeds
- [ ] Git history preserved
- [ ] No broken references

## Anti-Patterns to Avoid

```yaml
Don't:
  - Reorganize without tests
  - Move too many files at once
  - Forget to update imports
  - Break git history (don't delete/recreate)
  - Reorganize while adding features
  - Move without considering dependencies
```
