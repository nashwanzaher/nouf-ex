---
name: scaffold
description: Create new project structure, components, or features from scratch
trigger:
  - "create new"
  - "scaffold"
  - "generate"
  - "bootstrap"
  - "create project"
phases:
  - define_requirements
  - choose_structure
  - generate_files
  - add_configuration
  - add_tests
  - add_documentation
  - verify
inputs:
  - project_type
  - requirements
  - tech_stack
outputs:
  - project_structure
  - configuration
  - tests
  - documentation
verification:
  - All files generated
  - Structure follows conventions
  - Tests passing
  - Documentation complete
---

## Mandatory Reference

> 🚨 **NON-NEGOTIABLE** — every action this agent/skill takes must align with the
> 9-domain End-to-End Developer Skills Mind Map:
> [docs/audits/2026-07-11-owasp-iso25010-nist-ssdf.md](../../../docs/audits/2026-07-11-owasp-iso25010-nist-ssdf.md) (v1.0)
>
> Adopted standards: ISO/IEC/IEEE 12207, ISO/IEC 25010, IEEE 829, ISO/IEC/IEEE 29119,
> OWASP API Top 10 (2023), WCAG 2.1 AA, Diátaxis, Keep a Changelog, Conventional
> Commits, SemVer. Violation = build-blocking.


# Scaffold Skill

## Purpose

Create **new projects, components, or features** from scratch following established patterns and best practices.

## When to Use

- Starting new project
- Creating new module/component
- Adding new feature
- Bootstrapping boilerplate
- Setting up new package

## Process

### Phase 1: Define Requirements

```yaml
Project Type:
  - Frontend (React, Vue, etc.)
  - Backend (Node.js, Python, etc.)
  - Full-stack
  - Library/Package
  - CLI tool
  - Mobile app

Requirements:
  Functional:
    - What does it do?
    - What are the features?
    - What are the inputs/outputs?

  Non-Functional:
    - Performance requirements
    - Security requirements
    - Scalability needs
    - Browser/platform support

  Constraints:
    - Tech stack
    - Timeline
    - Budget
    - Existing code
```

### Phase 2: Choose Structure

```yaml
Project Structure:

  Frontend (React):
    src/
      components/
        ui/         # Generic UI components
        feature/    # Feature components
      pages/         # Route pages
      hooks/         # Custom hooks
      lib/           # Utilities
      core/          # Business logic
      context/       # React contexts
      i18n/          # Internationalization
      widgets/       # Complex composites
      shared/        # Shared utilities
      types/         # Type definitions
      styles/        # Global styles
      assets/        # Images, fonts
      App.tsx
      main.tsx
      routes.tsx

  Backend (Express):
    src/
      routes/         # API endpoints
      controllers/    # Request handlers
      services/       # Business logic
      repositories/   # Data access
      middleware/     # Express middleware
      lib/            # Utilities
      db/             # Database utilities
      types/          # Type definitions
      config/         # Configuration
      utils/          # Helpers
      app.ts
      server.ts

  Full-Stack:
    client/          # Frontend
    server/          # Backend
    shared/          # Shared types
    docs/            # Documentation

  Library:
    src/
      index.ts       # Main entry
      types.ts       # Type definitions
      utils/         # Utilities
    tests/
    examples/
    docs/
```

### Phase 3: Generate Files

```yaml
Configuration Files:
  - package.json
  - tsconfig.json
  - .eslintrc.json
  - .prettierrc
  - .gitignore
  - .env.example
  - .editorconfig
  - vitest.config.ts
  - vite.config.ts

Source Files:
  - Main entry point
  - Core modules
  - Type definitions
  - Configuration

Test Files:
  - Test setup
  - Example tests
  - Test utilities

Documentation:
  - README.md
  - CHANGELOG.md
  - LICENSE
  - API.md
  - CONTRIBUTING.md

CI/CD:
  - .github/workflows/
  - Docker configuration
  - Deployment scripts
```

### Phase 4: Add Configuration

```yaml
TypeScript (tsconfig.json):
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}

ESLint (.eslintrc.json):
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "react/prop-types": "off",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}

Prettier (.prettierrc):
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "printWidth": 100,
  "arrowParens": "always"
}

Vitest (vitest.config.ts):
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
```

### Phase 5: Add Tests

```yaml
Test Setup (mocks/setup.ts):
import { beforeAll, afterAll } from 'vitest';

beforeAll(async () => {
  // Setup test environment
});

afterAll(async () => {
  // Cleanup
});

Example Test (tests/example.test.ts):
import { describe, it, expect } from 'vitest';

describe('Example', () => {
  it('should work', () => {
    expect(1 + 1).toBe(2);
  });
});
```

### Phase 6: Add Documentation

```yaml
README.md:
- Project name and description
- Features
- Installation
- Usage
- Configuration
- API reference
- Contributing
- License

CHANGELOG.md:
- Version history
- Keep a Changelog format

CONTRIBUTING.md:
- How to contribute
- Development setup
- Coding standards
- Pull request process

LICENSE:
- MIT or other open source license

docs/:
- Architecture overview
- API reference
- Deployment guide
- Troubleshooting
```

### Phase 7: Verify

```yaml
Verification:
  - [ ] All files generated
  - [ ] Dependencies installed
  - [ ] TypeScript compiles
  - [ ] Lint passes
  - [ ] Tests pass
  - [ ] Build succeeds
  - [ ] Documentation complete
  - [ ] Git initialized
  - [ ] CI/CD configured
```

## Scaffold Templates

### React Component Template

```typescript
// ComponentName.tsx
import { useState } from 'react';
import type { ComponentNameProps } from './ComponentName.types';
import styles from './ComponentName.module.css';

export const ComponentName: React.FC<ComponentNameProps> = ({
  prop1,
  prop2,
  onAction,
}) => {
  const [state, setState] = useState<string>('');

  const handleClick = () => {
    onAction?.(state);
  };

  return (
    <div className={styles.container}>
      <h2>{prop1}</h2>
      <p>{prop2}</p>
      <button onClick={handleClick}>Action</button>
    </div>
  );
};

ComponentName.displayName = 'ComponentName';

// ComponentName.types.ts
export interface ComponentNameProps {
  prop1: string;
  prop2: string;
  onAction?: (value: string) => void;
}

// ComponentName.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  it('renders correctly', () => {
    render(<ComponentName prop1="Test" prop2="Description" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('handles click', () => {
    const handleAction = vi.fn();
    render(
      <ComponentName
        prop1="Test"
        prop2="Description"
        onAction={handleAction}
      />
    );
    fireEvent.click(screen.getByText('Action'));
    expect(handleAction).toHaveBeenCalled();
  });
});

// index.ts
export { ComponentName } from './ComponentName';
export type { ComponentNameProps } from './ComponentName.types';
```

### Express Route Template

```typescript
// routes/resource.ts
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import * as controller from '../controllers/resource';
import { asyncHandler } from '../lib/async-handler';

const router = Router();

// Validation schemas
const createSchema = z.object({
  name: z.string().min(1).max(200),
  // ...
});

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Routes
router.get(
  '/',
  authenticate,
  validateQuery(listSchema),
  asyncHandler(controller.list)
);

router.post(
  '/',
  authenticate,
  validateBody(createSchema),
  asyncHandler(controller.create)
);

router.get(
  '/:id',
  authenticate,
  asyncHandler(controller.getById)
);

router.put(
  '/:id',
  authenticate,
  validateBody(createSchema),
  asyncHandler(controller.update)
);

router.delete(
  '/:id',
  authenticate,
  asyncHandler(controller.remove)
);

export default router;
```

### Database Migration Template

```sql
-- migrations/V001__create_users.sql
-- Description: Create users table
-- Author: Team
-- Date: 2026-07-02

BEGIN;

-- Create enum
CREATE TYPE user_role AS ENUM ('customer', 'seller', 'admin');

-- Create table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  role user_role NOT NULL DEFAULT 'customer',
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Insert migration record
INSERT INTO schema_migrations (version, description, installed_at)
VALUES ('V001', 'Create users table', NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT;
```

## Output Template

```markdown

## Scaffold Report

### Project Type

[Type]

### Structure Generated

[Directory tree]

### Files Created

- [List of files]

### Configuration

- TypeScript: ✅
- ESLint: ✅
- Prettier: ✅
- Vitest: ✅

### Tests

- Example tests: X
- All passing: ✅

### Documentation

- README: ✅
- CHANGELOG: ✅
- API docs: ✅

### Next Steps

1. Customize configuration
2. Add business logic
3. Add more tests
4. Setup CI/CD
5. Deploy
```

## Anti-Patterns to Avoid

```yaml
Don't:
  - Skip configuration files
  - Forget test setup
  - Skip documentation
  - Use generic names (Foo, Bar)
  - Mix multiple concerns
  - Skip CI/CD setup
  - Forget Git initialization
  - Skip linting/formatting
```
