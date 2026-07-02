---
name: implement
description: Implement code with tests and documentation following best practices
trigger:
  - "implement"
  - "build"
  - "create"
  - "add"
  - "develop"
phases:
  - setup
  - implement_code
  - add_tests
  - add_documentation
  - verify
inputs:
  - specification (what to build)
  - plan (how to build it)
  - context (existing code)
outputs:
  - working_code
  - tests
  - documentation
verification:
  - Code compiles
  - Tests pass
  - Lint passes
  - Type check passes
  - Documentation complete
---

# Implement Skill

## Purpose

Implement code **systematically** following best practices, with tests, documentation, and verification.

## When to Use

- Creating new features
- Implementing planned changes
- Adding new functionality
- Building components or modules

## Process

### Phase 1: Setup

```yaml
Pre-Implementation Checklist:
  - [ ] Plan exists or is created
  - [ ] Files identified
  - [ ] Dependencies identified
  - [ ] Test framework understood
  - [ ] Coding standards clear

Setup Actions:
  - Create directories if needed
  - Initialize test files
  - Set up types/interfaces
  - Configure imports
  - Update package.json if needed
```

### Phase 2: Implement Code

```yaml
Implementation Order:
  1. Types and interfaces (compile-time contracts)
  2. Pure functions (no side effects)
  3. Side-effect functions (with tests)
  4. Classes/services (orchestration)
  5. Routes/handlers (entry points)
  6. Middleware (cross-cutting)
  7. UI components (if applicable)

Code Standards:
  - TypeScript strict mode
  - No 'any' types
  - Explicit return types
  - JSDoc for public APIs
  - Error handling
  - Input validation
  - Security checks
  - Performance considerations
```

### Phase 3: Add Tests

```yaml
Test Types:
  Unit Tests:
    - Test each function in isolation
    - Cover happy path
    - Cover error cases
    - Cover edge cases

  Integration Tests:
    - Test component interactions
    - Test with real database
    - Test API endpoints

  E2E Tests:
    - Test user flows
    - Test critical paths

Test Structure (AAA):
  Arrange: Set up test data
  Act: Execute code under test
  Assert: Verify expected outcome

Coverage Goals:
  - Statements: 80%+
  - Branches: 80%+
  - Functions: 80%+
  - Lines: 80%+
```

### Phase 4: Add Documentation

```yaml
Code Documentation:
  - JSDoc for public APIs
  - Inline comments for complex logic
  - Type definitions
  - Usage examples

File Documentation:
  - Header comment explaining purpose
  - Module-level documentation
  - Links to related docs

API Documentation:
  - OpenAPI/Swagger spec
  - Endpoint descriptions
  - Request/response examples
  - Error codes
```

### Phase 5: Verify

```yaml
Verification Steps:
  1. Type Check:
     - Run: npm run typecheck
     - Result: 0 errors

  2. Lint:
     - Run: npm run lint
     - Result: 0 warnings

  3. Tests:
     - Run: npm test
     - Result: All pass

  4. Build:
     - Run: npm run build
     - Result: Success

  5. Manual:
     - Test in browser
     - Verify behavior
     - Check edge cases
```

## Implementation Order Template

```typescript
// 1. Define types (src/types/order.ts)
export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
}

// 2. Pure functions (src/lib/pricing.ts)
export function calculateTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// 3. Database/repository (src/db/order.repository.ts)
export class OrderRepository {
  async findById(id: string): Promise<Order | null> { }
  async save(order: Order): Promise<Order> { }
}

// 4. Service (src/services/order.service.ts)
export class OrderService {
  constructor(private repo: OrderRepository) {}

  async createOrder(data: CreateOrderInput): Promise<Order> {
    // Business logic
  }
}

// 5. API handler (src/routes/orders.ts)
router.post('/api/orders', validateBody(createOrderSchema), async (req, res) => {
  const order = await orderService.createOrder(req.body);
  res.status(201).json({ success: true, data: order });
});

// 6. Tests (src/services/order.service.test.ts)
describe('OrderService', () => {
  it('creates order with valid input', async () => { });
  it('throws on invalid input', async () => { });
});
```

## Output Template

```markdown
## Implementation Report: [Feature]

### Files Created
- `src/types/order.ts` - Type definitions
- `src/services/order.service.ts` - Business logic
- `src/routes/orders.ts` - API endpoints
- `tests/order.test.ts` - Tests

### Files Modified
- `src/db/index.ts` - Added order repository
- `package.json` - Added dependencies

### Tests Added
- Unit tests: 12
- Integration tests: 3
- All passing ✅

### Documentation
- JSDoc added: 8 functions
- API docs updated: ✅
- README updated: ✅

### Verification Results
- Type check: ✅ 0 errors
- Lint: ✅ 0 warnings
- Tests: ✅ 12/12 passing
- Build: ✅ Success

### Notes
[Any important notes]
```

## Verification Checklist

- [ ] Code follows standards
- [ ] All types defined
- [ ] Tests added and passing
- [ ] Documentation complete
- [ ] Lint passes
- [ ] Type check passes
- [ ] Build succeeds
- [ ] Manual verification done

## Anti-Patterns to Avoid

```yaml
Don't:
  - Write code without tests
  - Skip TypeScript types
  - Ignore lint errors
  - Leave dead code
  - Hardcode values
  - Skip error handling
  - Mix concerns
  - Create god functions
```
