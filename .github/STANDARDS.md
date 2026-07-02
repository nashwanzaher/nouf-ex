# Nouf-ex Engineering Standards

This document defines the engineering standards and best practices for the **Nouf-ex** project. These standards are derived from industry best practices, official documentation, and academic sources.

## Table of Contents

- [Code Organization](#code-organization)
- [Naming Conventions](#naming-conventions)
- [TypeScript Standards](#typescript-standards)
- [React Standards](#react-standards)
- [API Standards](#api-standards)
- [Database Standards](#database-standards)
- [Testing Standards](#testing-standards)
- [Git Workflow](#git-workflow)
- [Documentation Standards](#documentation-standards)
- [Security Standards](#security-standards)
- [Performance Standards](#performance-standards)

## Code Organization

### Project Structure

```
nouf-ex/
├── app/                         # Main application
│   ├── src/                     # React frontend
│   │   ├── app/                 # Application bootstrap
│   │   ├── components/          # Reusable components
│   │   │   ├── ui/              # Generic UI components (shadcn)
│   │   │   └── feature/         # Feature-specific components
│   │   ├── pages/               # Route pages
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/                 # Utility libraries
│   │   ├── core/                # Business logic
│   │   ├── context/             # React contexts
│   │   ├── i18n/                # Internationalization
│   │   ├── widgets/             # Complex composite components
│   │   └── shared/              # Cross-cutting components
│   ├── server/                  # Express API
│   │   ├── routes/              # API endpoints
│   │   ├── middleware/          # Express middleware
│   │   ├── lib/                 # Server libraries
│   │   └── db/                  # Database utilities
│   ├── tests/                   # Test setup and mocks
│   └── public/                  # Static assets
├── database/                    # PostgreSQL
│   ├── schema.sql               # Main schema
│   ├── migrations/              # Versioned migrations
│   ├── functions.sql            # Stored functions
│   ├── views.sql                # Views
│   ├── triggers.sql             # Triggers
│   └── seed.sql                 # Seed data
├── docs/                        # Documentation
│   ├── architecture/            # System design docs
│   ├── development/             # Dev guides
│   ├── operations/              # Ops guides
│   └── api/                     # API reference
├── scripts/                     # Build/utility scripts
├── docker/                      # Docker files
├── mcp-server/                  # MCP server
├── .github/                     # GitHub configuration
│   ├── agents/                  # Custom agents
│   ├── workflows/               # GitHub Actions
│   └── copilot-instructions.md  # Agent instructions
└── .vscode/                     # VS Code config
    ├── settings.json
    ├── tasks.json
    ├── launch.json
    └── mcp.json
```

### File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| React Component | PascalCase | `ProductCard.tsx` |
| React Component (multiple) | PascalCase | `ProductCards.tsx` |
| Hook | camelCase with `use` prefix | `useProducts.ts` |
| Utility | camelCase | `formatDate.ts` |
| Constants | UPPER_SNAKE_CASE | `API_ENDPOINTS.ts` |
| Type definition | PascalCase | `User.ts` |
| Test file | Match source + `.test` | `ProductCard.test.tsx` |
| E2E test | `.spec.ts` | `checkout.spec.ts` |
| Markdown | kebab-case | `user-guide.md` |

### Import Order

```typescript
// 1. Node.js built-ins
import { readFile } from 'fs/promises';

// 2. External packages
import express from 'express';
import { z } from 'zod';

// 3. Internal aliases (@/*)
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';

// 4. Relative imports (parent, then sibling)
import { ParentComponent } from '../ParentComponent';
import { ChildComponent } from './ChildComponent';

// 5. Type imports (separate group)
import type { User, Product } from '@/types';
```

## Naming Conventions

### Variables

```typescript
// ✅ camelCase for variables
const userName = 'John';
const isActive = true;
const userCount = 0;

// ✅ UPPER_SNAKE_CASE for constants
const MAX_RETRY_ATTEMPTS = 3;
const API_BASE_URL = 'https://api.example.com';
const DEFAULT_TIMEOUT_MS = 5000;

// ✅ Boolean prefix
const isVisible = true;
const hasPermission = false;
const canEdit = true;
const shouldRender = false;
```

### Functions

```typescript
// ✅ camelCase for functions
function getUserById(id: string) { }
function calculateTotal(items: Item[]) { }

// ✅ Verb-first naming
function fetchProducts() { }     // Network
function createOrder() { }        // Action
function isValidEmail() { }       // Predicate
function formatDate() { }         // Transform
```

### Classes & Types

```typescript
// ✅ PascalCase for classes, types, interfaces
class UserService { }
interface UserProfile { }
type OrderStatus = 'pending' | 'paid';
enum UserRole { Admin, Customer }

// ✅ Don't prefix interfaces with 'I'
interface User { }  // ✅ Good
interface IUser { } // ❌ Bad

// ✅ Suffix types meaningfully
type UserCreate = Omit<User, 'id'>;
type UserUpdate = Partial<UserCreate>;
type UserResponse = User & { createdAt: Date };
```

### React Components

```typescript
// ✅ PascalCase, descriptive
export const ProductCard = () => { };
export const UserProfileDropdown = () => { };

// ✅ Component variants
export const Button = ({ variant = 'primary' }: Props) => { };
export const ButtonPrimary = () => <Button variant="primary" />;

// ✅ Hooks always start with 'use'
export const useAuth = () => { };
export const useProducts = (filters: Filters) => { };
```

## TypeScript Standards

### Strict Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### Type Definitions

```typescript
// ✅ Use interfaces for object shapes
interface User {
  id: string;
  name: string;
  email: string;
}

// ✅ Use type for unions/intersections
type Status = 'active' | 'inactive';
type UserWithOrders = User & { orders: Order[] };

// ✅ Use enums for finite sets of named constants
enum UserRole {
  Customer = 'customer',
  Seller = 'seller',
  Admin = 'admin'
}

// ✅ Generic types
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<T>;
}

// ✅ Avoid 'any' - use 'unknown' if type is truly unknown
function process(data: unknown) {
  if (isValidData(data)) {
    // Now data is typed
  }
}

// ✅ Type guards
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value
  );
}
```

### Branded Types

```typescript
// ✅ Branded types for domain modeling
type UserId = string & { __brand: 'UserId' };
type Email = string & { __brand: 'Email' };

function createUserId(id: string): UserId {
  if (!isUUID(id)) throw new Error('Invalid user ID');
  return id as UserId;
}

function sendEmail(to: Email, subject: string) {
  // Type-safe: can't pass UserId as Email
}
```

## React Standards

### Component Structure

```typescript
// ✅ Standard component structure
// 1. Imports
import { useState, useEffect } from 'react';
import type { Product } from '@/types';

// 2. Types
interface ProductCardProps {
  product: Product;
  onAddToCart?: (id: string) => void;
  variant?: 'default' | 'compact';
}

// 3. Component
export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  variant = 'default',
}) => {
  // 3a. Hooks
  const [isLoading, setIsLoading] = useState(false);

  // 3b. Event handlers
  const handleClick = useCallback(() => {
    setIsLoading(true);
    onAddToCart?.(product.id);
    setIsLoading(false);
  }, [onAddToCart, product.id]);

  // 3c. Effects
  useEffect(() => {
    // ...
  }, []);

  // 3d. Render
  return (
    <article>
      {/_ ... _/}
    </article>
  );
};

// 4. Display name for debugging
ProductCard.displayName = 'ProductCard';

// 5. Default export (optional)
export default ProductCard;
```

### Hooks Rules

```typescript
// ✅ Always call hooks at the top level
function Component() {
  const [count, setCount] = useState(0);  // ✅ Top level
  useEffect(() => {}, []);                 // ✅ Top level

  if (count > 0) {
    // ❌ Never call hooks conditionally
    const [data, setData] = useState(null);
  }
}

// ✅ Custom hooks for reusable logic
function useProducts(filters: Filters) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const data = await fetchProducts(filters);
        if (!cancelled) setProducts(data);
      } catch (err) {
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [filters]);

  return { products, isLoading, error };
}
```

### Performance Best Practices

```typescript
// ✅ Memoize expensive components
const MemoizedProductCard = React.memo(ProductCard);

// ✅ useMemo for expensive computations
const filteredProducts = useMemo(
  () => products.filter(p => p.price < maxPrice),
  [products, maxPrice]
);

// ✅ useCallback for stable references
const handleAddToCart = useCallback(
  (id: string) => addToCart(id),
  []
);

// ✅ Lazy load heavy components
const HeavyChart = lazy(() => import('./HeavyChart'));
```

## API Standards

### REST Conventions

```yaml
URL Structure:
  - Resources: plural nouns (/products, /orders)
  - Sub-resources: nested (/orders/:id/items)
  - Actions: POST /products/:id/publish

HTTP Methods:
  - GET: Retrieve resource(s)
  - POST: Create resource or action
  - PUT: Replace resource entirely
  - PATCH: Partial update
  - DELETE: Remove resource

Status Codes:
  - 200: OK (successful GET, PUT, PATCH)
  - 201: Created (successful POST)
  - 204: No Content (successful DELETE)
  - 400: Bad Request (validation error)
  - 401: Unauthorized (missing/invalid auth)
  - 403: Forbidden (insufficient permissions)
  - 404: Not Found
  - 409: Conflict (duplicate, optimistic lock)
  - 422: Unprocessable Entity
  - 429: Too Many Requests (rate limit)
  - 500: Internal Server Error
```

### Response Format

```typescript
// ✅ Success response
{
  "success": true,
  "data": T | T[],
  "pagination"?: {
    "page": number,
    "limit": number,
    "total": number
  }
}

// ✅ Error response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details"?: unknown
  }
}
```

### Validation

```typescript
// ✅ Always validate input with Zod
const createProductSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  price: z.number().positive().max(1_000_000),
  store_id: z.string().uuid(),
  description: z.string().max(2000).optional(),
  category_id: z.string().uuid(),
});

router.post(
  '/api/products',
  authenticate,
  validateBody(createProductSchema),
  async (req, res) => {
    // req.body is now typed and validated
  }
);
```

## Database Standards

### Schema Design

```sql
-- ✅ Always use UUID for primary keys
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ✅ Always use TIMESTAMPTZ
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- ✅ Use proper constraints
  name VARCHAR(200) NOT NULL CHECK (length(name) > 0),
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- ✅ Use enums for fixed sets
  status product_status NOT NULL DEFAULT 'active'
);

-- ✅ Indexes for common queries
CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_status_created_at ON products(status, created_at DESC)
  WHERE deleted_at IS NULL;

-- ✅ Audit trigger
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### Query Standards

```typescript
// ✅ Always parameterized
const result = await pool.query(
  'SELECT * FROM products WHERE id = $1',
  [productId]
);

// ❌ Never string concatenation
const result = await pool.query(
  `SELECT * FROM products WHERE id = '${productId}'`
);

// ✅ Use transactions for multi-step
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(/_ ... _/);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

## Testing Standards

### Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ProductService } from './product.service';

describe('ProductService', () => {
  let service: ProductService;

  beforeEach(() => {
    service = new ProductService(mockDb);
  });

  describe('createProduct', () => {
    it('should create a product with valid input', async () => {
      const product = await service.create({
        name: 'Test Product',
        price: 99.99,
      });

      expect(product).toMatchObject({
        name: 'Test Product',
        price: 99.99,
      });
      expect(product.id).toBeDefined();
    });

    it('should throw on invalid input', async () => {
      await expect(service.create({ name: '', price: -1 }))
        .rejects.toThrow('Invalid product data');
    });
  });
});
```

### Coverage Requirements

```yaml
Coverage Targets:
  Statements: 80%+
  Branches: 80%+
  Functions: 80%+
  Lines: 80%+

Critical Paths (100% coverage):
  - Authentication
  - Payment processing
  - Authorization checks
  - Data validation
  - Error handling
```

## Git Workflow

### Branch Naming

```yaml
Pattern: <type>/<description>

Types:
  - feature/   New feature
  - fix/       Bug fix
  - refactor/  Code refactoring
  - docs/      Documentation only
  - test/      Test additions
  - chore/     Maintenance
  - perf/      Performance improvement

Examples:
  - feature/user-authentication
  - fix/login-validation-bug
  - refactor/database-queries
  - docs/api-documentation
```

### Commit Messages

```yaml
Format: <type>(<scope>): <subject>

Types:
  - feat:     New feature
  - fix:      Bug fix
  - docs:     Documentation
  - style:    Formatting
  - refactor: Code refactoring
  - test:     Tests
  - chore:    Maintenance
  - perf:     Performance

Subject: Imperative, present tense, no period, max 72 chars
Body: Explain what and why, not how
Footer: Reference issues

Examples:
  feat(auth): add JWT authentication
  fix(api): handle null response in user endpoint
  perf(db): add index on products.created_at
  docs(readme): update installation steps
```

## Documentation Standards

### JSDoc

```typescript
/**
 - Creates a new product in the catalog.
 *
 - @param data - Product creation data
 - @param data.name - Product name (1-200 chars)
 - @param data.price - Price in dollars (positive)
 - @param data.store_id - UUID of the store
 - @returns The created product with generated ID
 - @throws {ValidationError} If data is invalid
 - @throws {NotFoundError} If store doesn't exist
 *
 - @example
 - ```ts
 - const product = await createProduct({
 -   name: 'New Product',
 -   price: 99.99,
 -   store_id: '123e4567-e89b-12d3-a456-426614174000',
 - });
 - ```
 */
async function createProduct(data: CreateProductInput): Promise<Product> {
  // Implementation
}
```

### README Structure

Every project should have a README with:

1. **Title and Description**
2. **Features** (bullet list)
3. **Installation**
4. **Usage** (with examples)
5. **Configuration**
6. **API Reference** (or link)
7. **Testing**
8. **Contributing**
9. **License**

## Security Standards

### Authentication

- ✅ JWT with strong secrets (64+ chars)
- ✅ Short-lived access tokens (15min)
- ✅ Refresh tokens in httpOnly cookies
- ✅ bcrypt for password hashing (12+ rounds)
- ✅ Account lockout after 5 failed attempts

### Authorization

- ✅ RBAC for role-based access
- ✅ Resource ownership verification
- ✅ Principle of least privilege

### Input Validation

- ✅ Whitelist validation
- ✅ Type checking
- ✅ Length limits
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention (escape output)

### Secrets

- ✅ Environment variables (never in code)
- ✅ Strong secret values (32+ chars)
- ✅ Rotate regularly
- ✅ Use secrets manager in production

## Performance Standards

### Frontend

```yaml
Core Web Vitals:
  LCP: < 2.5s
  FID: < 100ms
  CLS: < 0.1
  TTFB: < 600ms

Bundle:
  Initial: < 200KB gzipped
  Total: < 1MB gzipped
```

### Backend

```yaml
Response Time:
  p50: < 100ms
  p95: < 200ms
  p99: < 500ms

Throughput:
  Sustained: 1000+ RPS
  Peak: 5000+ RPS
```

### Database

```yaml
Query Time:
  Simple: < 10ms
  Complex: < 100ms
  Reports: < 1000ms

Indexing:
  All WHERE/ORDER BY columns
  No unused indexes
  Strategic partial indexes
```

## References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [React Documentation](https://react.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Google Style Guides](https://google.github.io/styleguide/)
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- [Clean Code (Robert C. Martin)](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882)
- [Refactoring (Martin Fowler)](https://refactoring.com/)
- [Web Vitals](https://web.dev/vitals/)

---

Last updated: 2026-07-02
Maintained by: Nouf-ex Engineering Team
