---
name: api-design
description: Design RESTful APIs with proper contracts, validation, and documentation
trigger:
  - "design api"
  - "create endpoint"
  - "api contract"
  - "rest api"
  - "openapi"
phases:
  - identify_resources
  - design_endpoints
  - define_schemas
  - design_validation
  - design_errors
  - document_api
  - test_api
inputs:
  - domain (business domain)
  - requirements
  - consumers (who uses the API)
outputs:
  - api_specification
  - validation_schemas
  - error_handlers
  - tests
verification:
  - All endpoints documented
  - Validation works
  - Errors handled
  - Tests passing
---

# API Design Skill

## Purpose

Design **RESTful APIs** with proper contracts, validation, error handling, and documentation.

## When to Use

- Creating new API
- Adding endpoints to existing API
- Refactoring API
- Creating API documentation
- Designing API contracts

## Process

### Phase 1: Identify Resources

```yaml
Resource Identification:

  Nouns (Resources):
    - User
    - Product
    - Order
    - Category
    - Store
    - Review

  Verbs (Actions):
    - List resources
    - Get single resource
    - Create resource
    - Update resource
    - Delete resource
    - Custom actions (publish, archive)

Resource Relationships:
  - User has many Orders
  - Order has many Items
  - Product belongs to Category
  - Product belongs to Store
  - User writes many Reviews

Resource Modeling:
  - Identify attributes
  - Identify relationships
  - Identify constraints
  - Identify state transitions
```

### Phase 2: Design Endpoints

```yaml
REST Conventions:

  URL Structure:
    - /api/resources - Collection
    - /api/resources/:id - Single resource
    - /api/resources/:id/sub-resources - Sub-collection
    - /api/resources/:id/actions - Custom action

  HTTP Methods:
    - GET /api/products - List products
    - GET /api/products/:id - Get one product
    - POST /api/products - Create product
    - PUT /api/products/:id - Replace product
    - PATCH /api/products/:id - Update product
    - DELETE /api/products/:id - Delete product
    - POST /api/products/:id/publish - Custom action

  Query Parameters:
    - ?page=1&limit=20 - Pagination
    - ?sort=name:asc - Sorting
    - ?search=keyword - Search
    - ?filter[status]=active - Filtering
    - ?fields=id,name - Field selection

  Versioning:
    - URL path: /api/v1/products
    - Header: Accept: application/vnd.api+json;version=1
    - Query: ?version=1

Naming Conventions:
  - Use plural nouns: /products, /users
  - Use kebab-case: /product-categories
  - Avoid verbs in URLs: ❌ /getProducts
  - Use HTTP methods for actions
```

### Phase 3: Define Schemas

```yaml
Request Schemas:

  Create Product:
    name: string (required, 1-200 chars)
    price: number (required, positive)
    sku: string (required, unique)
    category_id: UUID (required)
    store_id: UUID (required)
    description: string (optional, max 2000)
    images: string[] (optional, max 10 URLs)

  Update Product:
    name: string (optional, 1-200 chars)
    price: number (optional, positive)
    description: string (optional, max 2000)

  List Products:
    page: integer (optional, default 1, min 1)
    limit: integer (optional, default 20, min 1, max 100)
    sort: string (optional, default 'created_at')
    order: enum ['asc', 'desc'] (optional, default 'desc')
    search: string (optional, max 100)
    category_id: UUID (optional)
    store_id: UUID (optional)
    min_price: number (optional)
    max_price: number (optional)

Response Schemas:

  Product:
    id: UUID
    name: string
    price: number
    sku: string
    category_id: UUID
    store_id: UUID
    description: string | null
    images: string[]
    status: enum ['active', 'inactive', 'archived']
    created_at: ISO 8601 datetime
    updated_at: ISO 8601 datetime

  Product List:
    data: Product[]
    pagination:
      page: integer
      limit: integer
      total: integer
      total_pages: integer
    links:
      self: URL
      first: URL
      prev: URL | null
      next: URL | null
      last: URL

  Error:
    success: false
    error:
      code: string
      message: string
      details: object (optional)
```

### Phase 4: Design Validation

```yaml
Validation Strategy:

  Server-Side (Required):
    - All input validated
    - Type checking
    - Length limits
    - Format validation
    - Business rules

  Client-Side (UX):
    - Immediate feedback
    - Format hints
    - Required field indicators

Validation Rules:

  Required Fields:
    - Must be present
    - Must not be empty
    - Must not be whitespace only

  String Validation:
    - Min/max length
    - Pattern (regex)
    - Trim whitespace
    - Lowercase emails

  Number Validation:
    - Must be number
    - Min/max value
    - Integer vs float
    - Positive/negative

  Format Validation:
    - Email format
    - URL format
    - UUID format
    - Date format (ISO 8601)
    - Phone number

  Business Rules:
    - Unique constraints
    - Referential integrity
    - State transitions
    - Authorization checks

Implementation (Zod):
```typescript
const createProductSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name must be at most 200 characters')
    .trim(),

  price: z.number()
    .positive('Price must be positive')
    .max(1_000_000, 'Price is too high'),

  sku: z.string()
    .min(1)
    .max(50)
    .regex(/^[A-Z0-9-]+$/, 'SKU must be uppercase alphanumeric'),

  category_id: z.string().uuid('Invalid category ID'),
  store_id: z.string().uuid('Invalid store ID'),

  description: z.string()
    .max(2000)
    .optional(),

  images: z.array(z.string().url())
    .max(10, 'Maximum 10 images')
    .optional(),

  status: z.enum(['active', 'inactive', 'archived'])
    .default('active'),
});
```
```

### Phase 5: Design Errors

```yaml
Error Categories:

  4xx Client Errors:
    400 Bad Request: Invalid input
    401 Unauthorized: Missing/invalid auth
    403 Forbidden: Insufficient permissions
    404 Not Found: Resource doesn't exist
    409 Conflict: Duplicate or state conflict
    422 Unprocessable Entity: Semantic error
    429 Too Many Requests: Rate limit

  5xx Server Errors:
    500 Internal Server Error: Unexpected error
    502 Bad Gateway: Upstream error
    503 Service Unavailable: Service down
    504 Gateway Timeout: Upstream timeout

Error Response Format:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  }
}
```

Error Codes:
  VALIDATION_ERROR: Input validation failed
  UNAUTHORIZED: Authentication required
  FORBIDDEN: Insufficient permissions
  NOT_FOUND: Resource not found
  CONFLICT: Resource conflict
  RATE_LIMITED: Too many requests
  INTERNAL_ERROR: Server error

Error Handling:
```typescript
class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

class ValidationError extends AppError {
  constructor(details: unknown) {
    super(400, 'Validation failed', 'VALIDATION_ERROR', details);
  }
}

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn({ err, path: req.path }, 'Application error');
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
});
```
```

### Phase 6: Document API

```yaml
OpenAPI Specification:

openapi: 3.0.3
info:
  title: Nouf-ex API
  version: 1.0.0
  description: REST API for Nouf-ex platform

servers:
  - url: https://api.noufex.com/v1
  - url: http://localhost:3000/api

paths:
  /products:
    get:
      summary: List products
      tags: [Products]
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            minimum: 1
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
        - name: search
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProductList'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'

    post:
      summary: Create product
      tags: [Products]
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateProductRequest'
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Product'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '409':
          $ref: '#/components/responses/Conflict'

components:
  schemas:
    Product:
      type: object
      required: [id, name, price, sku]
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
          minLength: 1
          maxLength: 200
        price:
          type: number
          minimum: 0
        sku:
          type: string
          pattern: '^[A-Z0-9-]+$'

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

### Phase 7: Test API

```yaml
Test Strategy:

  Contract Tests:
    - Request format
    - Response format
    - Status codes
    - Headers

  Integration Tests:
    - Happy path
    - Error cases
    - Edge cases
    - Authentication
    - Authorization

  E2E Tests:
    - User flows
    - API interactions

Example:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';

describe('Products API', () => {
  beforeAll(async () => {
    await pool.query('TRUNCATE products CASCADE');
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('POST /api/products', () => {
    it('creates a product', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Test Product',
          price: 99.99,
          sku: 'TEST-001',
          category_id: '...',
          store_id: '...',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: 'Test Product',
        price: 99.99,
      });
    });

    it('returns 400 on validation error', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ name: '' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 without auth', async () => {
      await request(app)
        .post('/api/products')
        .send({ name: 'Test' })
        .expect(401);
    });
  });
});
```
```

## API Design Principles

```yaml
REST Best Practices:
  - Stateless: Each request is independent
  - Cacheable: Responses can be cached
  - Uniform interface: Consistent patterns
  - Layered system: Use intermediaries (CDN, cache)
  - Code on demand: Optional (client-side scripts)

REST Constraints:
  - Client-server separation
  - Stateless
  - Cacheable
  - Layered system
  - Uniform interface
  - (Code on demand - optional)

Good API Design:
  - Use nouns, not verbs
  - Use plural for collections
  - Use HTTP methods correctly
  - Use proper status codes
  - Return consistent format
  - Validate input
  - Handle errors gracefully
  - Document thoroughly
  - Version your API
  - Paginate large responses
  - Support filtering, sorting, searching
  - Use HATEOAS for navigation (optional)
```

## Output Template

```markdown

## API Design Report

### Resources

- [List of resources]

### Endpoints

- [List of endpoints with methods]

### Schemas

- Request: [list]
- Response: [list]

### Validation

- Required fields: [list]
- Format validation: [list]
- Business rules: [list]

### Error Handling

- Status codes: [list]
- Error codes: [list]
- Error format: [standard]

### Documentation

- OpenAPI: [link]
- API docs: [link]
- Examples: [link]

### Testing

- Contract tests: X
- Integration tests: Y
- All passing: ✅
```

## Anti-Patterns to Avoid

```yaml
Don't:
  - Use verbs in URLs
  - Return inconsistent formats
  - Use wrong status codes
  - Leak sensitive info in errors
  - Skip validation
  - Forget pagination
  - Ignore authentication
  - Skip authorization checks
  - Hard-code values
  - Skip documentation
```
