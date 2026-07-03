---
name: optimize
description: Optimize code for performance, scalability, and resource usage
trigger:
  - "optimize"
  - "performance"
  - "slow"
  - "speed up"
  - "make faster"
phases:
  - profile
  - identify_bottlenecks
  - plan_optimizations
  - implement_optimizations
  - measure_improvement
inputs:
  - target (code to optimize)
  - metrics (what to measure)
  - goals (target performance)
outputs:
  - optimized_code
  - performance_report
verification:
  - Performance improved
  - No functionality lost
  - Metrics improved
---

## Mandatory Reference

> 🚨 **NON-NEGOTIABLE** — every action this agent/skill takes must align with the
> 9-domain End-to-End Developer Skills Mind Map:
> [docs/architecture/SKILLS_MINDMAP.md](../../../docs/architecture/SKILLS_MINDMAP.md) (v1.0.0)
>
> Adopted standards: ISO/IEC/IEEE 12207, ISO/IEC 25010, IEEE 829, ISO/IEC/IEEE 29119,
> OWASP API Top 10 (2023), WCAG 2.1 AA, Diátaxis, Keep a Changelog, Conventional
> Commits, SemVer. Violation = build-blocking.


# Optimize Skill

## Purpose

**Optimize** code for performance, scalability, and resource usage while maintaining correctness.

## When to Use

- Slow response times
- High resource usage
- User complaints about speed
- Before scaling up
- Core Web Vitals issues

## Process

### Phase 1: Profile

```yaml
Measure First:
  - "Don't guess, measure"

Profile Tools:
  - Chrome DevTools (frontend)
  - Node.js --inspect (backend)
  - EXPLAIN ANALYZE (database)
  - Lighthouse (web vitals)
  - clinic.js (Node.js)

Capture Metrics:
  - Response time (p50, p95, p99)
  - Memory usage
  - CPU usage
  - Database queries
  - Network requests
  - Bundle size
  - LCP, FID, CLS

Baseline:
  - Record current metrics
  - Set target improvements
  - Identify biggest wins
```

### Phase 2: Identify Bottlenecks

```yaml
Common Bottlenecks:

  Frontend:
    - Large bundle size
    - Unnecessary re-renders
    - Large images
    - Blocking scripts
    - Inefficient CSS

  Backend:
    - Slow database queries
    - N+1 queries
    - Synchronous I/O
    - Memory leaks
    - CPU-intensive operations

  Database:
    - Missing indexes
    - Full table scans
    - Lock contention
    - Large result sets
    - Inefficient queries

  Network:
    - Too many requests
    - Large payloads
    - No compression
    - No caching
    - High latency
```

### Phase 3: Plan Optimizations

```yaml
Optimization Strategies:

  Caching:
    - In-memory cache
    - Redis cache
    - HTTP cache headers
    - CDN

  Database:
    - Add indexes
    - Optimize queries
    - Use connection pooling
    - Materialized views
    - Read replicas

  Code:
    - Memoization
    - Lazy loading
    - Code splitting
    - Tree shaking
    - Algorithm improvements

  Frontend:
    - Bundle optimization
    - Image optimization
    - Critical CSS
    - Service workers
    - Virtual scrolling

  Backend:
    - Async processing
    - Streaming
    - Compression
    - Load balancing
    - Worker pools
```

### Phase 4: Implement Optimizations

```yaml
Implementation Order:
  1. Quick wins (small changes, big impact)
  2. Caching (often huge gains)
  3. Database optimization
  4. Code optimization
  5. Architecture changes

Important:
  - Measure after each change
  - Don't break functionality
  - Keep tests passing
  - Document changes
```

### Phase 5: Measure Improvement

```yaml
Before/After Comparison:

  Metrics:
    - Response time: X → Y (X% improvement)
    - Memory: X → Y (X% reduction)
    - Bundle: X → Y (X% reduction)
    - Queries: X → Y (X% reduction)

  User Impact:
    - Page load: Xs → Ys
    - Time to interactive: Xs → Ys
    - Lighthouse score: X → Y
```

## Optimization Patterns

### 1. Database Indexing

```sql
-- Before: Seq scan (slow)
SELECT * FROM products WHERE status = 'active';

-- After: Index scan (fast)
CREATE INDEX idx_products_status ON products(status);
SELECT * FROM products WHERE status = 'active';
```

### 2. Caching

```typescript
// Before: Always queries DB
async function getUser(id: string) {
  return await db.query('SELECT * FROM users WHERE id = $1', [id]);
}

// After: Cached
async function getUser(id: string) {
  const cached = cache.get(id);
  if (cached) return cached;

  const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  cache.set(id, user, { ttl: 300 }); // 5 minutes
  return user;
}
```

### 3. Memoization

```typescript
// Before: Recomputes every render
function ProductList({ products, sortKey }: Props) {
  const sorted = products.sort((a, b) => a[sortKey] - b[sortKey]);
}

// After: Memoized
function ProductList({ products, sortKey }: Props) {
  const sorted = useMemo(
    () => [...products].sort((a, b) => a[sortKey] - b[sortKey]),
    [products, sortKey]
  );
}
```

### 4. Virtual Scrolling

```typescript
// Before: Renders all 10,000 items
function LongList({ items }: Props) {
  return items.map(item => <Item key={item.id} {...item} />);
}

// After: Only renders visible items
function LongList({ items }: Props) {
  return (
    <FixedSizeList height={600} itemCount={items.length} itemSize={50} width="100%">
      {({ index, style }) => <Item style={style} {...items[index]} />}
    </FixedSizeList>
  );
}
```

### 5. Code Splitting

```typescript
// Before: Single bundle
import HeavyChart from './HeavyChart';

function Dashboard() {
  return <HeavyChart />;
}

// After: Lazy loaded
const HeavyChart = lazy(() => import('./HeavyChart'));

function Dashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <HeavyChart />
    </Suspense>
  );
}
```

### 6. Connection Pooling

```typescript
// Before: New connection per query
async function getUser(id: string) {
  const client = new pg.Client(config);
  await client.connect();
  const result = await client.query('SELECT...');
  await client.end();
  return result;
}

// After: Pooled
const pool = new Pool(config);

async function getUser(id: string) {
  return pool.query('SELECT * FROM users WHERE id = $1', [id]);
}
```

### 7. Query Optimization

```sql
-- Before: N+1 queries
SELECT * FROM orders WHERE user_id = 123;
SELECT * FROM order_items WHERE order_id = 1;
SELECT * FROM order_items WHERE order_id = 2;
...

-- After: Single JOIN
SELECT orders._, items._
FROM orders
LEFT JOIN order_items ON order_items.order_id = orders.id
WHERE orders.user_id = 123;
```

### 8. Compression

```typescript
// Before: No compression
app.use(express.json());

// After: Compressed
app.use(compression());
app.use(express.json());
```

### 9. Image Optimization

```html
<!-- Before: Large PNG -->
<img src="/product.png" />

<!-- After: WebP with fallback -->
<picture>
  <source srcset="/product.webp" type="image/webp" />
  <img src="/product.jpg" alt="Product"
       loading="lazy"
       width="400"
       height="300" />
</picture>
```

### 10. Debouncing

```typescript
// Before: Fires every keystroke
function handleSearch(query: string) {
  api.search(query);
}

// After: Debounced
const debouncedSearch = debounce(api.search, 300);

function handleSearch(query: string) {
  debouncedSearch(query);
}
```

## Core Web Vitals Targets

```yaml
LCP (Largest Contentful Paint):
  Good: < 2.5s
  Needs improvement: 2.5s - 4.0s
  Poor: > 4.0s

FID (First Input Delay):
  Good: < 100ms
  Needs improvement: 100ms - 300ms
  Poor: > 300ms

CLS (Cumulative Layout Shift):
  Good: < 0.1
  Needs improvement: 0.1 - 0.25
  Poor: > 0.25

TTFB (Time to First Byte):
  Good: < 600ms
  Needs improvement: 600ms - 1.5s
  Poor: > 1.5s
```

## Performance Metrics

```yaml
Frontend:
  Bundle size: < 200KB gzipped
  Time to interactive: < 3.5s
  First contentful paint: < 1.8s
  Speed index: < 3.4s

Backend:
  Response time p50: < 100ms
  Response time p95: < 200ms
  Response time p99: < 500ms
  Throughput: 1000+ RPS

Database:
  Simple queries: < 10ms
  Complex queries: < 100ms
  Reports: < 1000ms
```

## Output Template

```markdown

## Optimization Report

### Target

[What was optimized]

### Baseline Metrics

- Response time: Xms
- Memory: XMB
- Bundle: XKB

### Optimizations Applied

#### Database

- Added 3 indexes
- Optimized 5 queries

#### Caching

- Added Redis cache for products
- 5 minute TTL

#### Frontend

- Code split heavy components
- Lazy loaded charts

### Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Response time | 500ms | 150ms | 70% |
| Memory | 200MB | 120MB | 40% |
| Bundle | 300KB | 180KB | 40% |

### Verification

- [ ] All tests pass
- [ ] No functionality lost
- [ ] Metrics improved
- [ ] No new bugs
```

## Verification Checklist

- [ ] Profiled current state
- [ ] Bottlenecks identified
- [ ] Optimizations planned
- [ ] Implemented carefully
- [ ] Measured improvement
- [ ] Tests still pass
- [ ] No new bugs
- [ ] Documented changes

## Anti-Patterns to Avoid

```yaml
Don't:
  - Optimize without measuring
  - Premature optimization
  - Sacrifice readability for performance
  - Optimize rarely-used code
  - Skip testing after optimization
  - Introduce complexity for small gains
```
