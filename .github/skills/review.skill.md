---
name: review
description: Code review with structured feedback
trigger:
  - "review code"
  - "code review"
  - "check quality"
  - "review pr"
phases:
  - read_code
  - analyze_quality
  - identify_issues
  - provide_feedback
  - suggest_improvements
inputs:
  - code_to_review
  - context (purpose)
  - standards (coding standards)
outputs:
  - review_report
  - issues_list
  - suggestions
verification:
  - All critical issues identified
  - Feedback is constructive
  - Suggestions are actionable
---

## Mandatory Reference

> 🚨 **NON-NEGOTIABLE** — every action this agent/skill takes must align with the
> 9-domain End-to-End Developer Skills Mind Map:
> [docs/audits/2026-07-11-owasp-iso25010-nist-ssdf.md](../../../docs/audits/2026-07-11-owasp-iso25010-nist-ssdf.md) (v1.0)
>
> Adopted standards: ISO/IEC/IEEE 12207, ISO/IEC 25010, IEEE 829, ISO/IEC/IEEE 29119,
> OWASP API Top 10 (2023), WCAG 2.1 AA, Diátaxis, Keep a Changelog, Conventional
> Commits, SemVer. Violation = build-blocking.


# Review Skill

## Purpose

Provide **constructive, structured code review** that helps improve code quality and team knowledge.

## When to Use

- Before merging PR
- Self-review before committing
- Code audit
- Mentoring team members
- Quality gate

## Process

### Phase 1: Read Code

```yaml
Read:
  - Understand the purpose
  - Read related context (tests, docs)
  - Check git history for context
  - Note design decisions
  - Identify scope of change

Understand:
  - What problem does this solve?
  - What's the approach?
  - What are the trade-offs?
```

### Phase 2: Analyze Quality

```yaml
Quality Dimensions:

  Correctness:
    - Does it work?
    - Edge cases handled?
    - Error cases handled?
    - Race conditions?

  Security:
    - Input validated?
    - Auth/authz enforced?
    - Secrets handled?
    - SQL injection safe?

  Performance:
    - Efficient algorithm?
    - No N+1 queries?
    - Appropriate caching?
    - No memory leaks?

  Maintainability:
    - Readable code?
    - Good names?
    - Single responsibility?
    - No duplication?

  Testability:
    - Tests present?
    - Edge cases covered?
    - Coverage adequate?

  Style:
    - Follows conventions?
    - Properly formatted?
    - Lint passes?
    - TypeScript strict?
```

### Phase 3: Identify Issues

```yaml
Severity Levels:

  Critical (Must Fix):
    - Security vulnerabilities
    - Data loss risks
    - Production-breaking bugs
    - Major performance issues

  Major (Should Fix):
    - Logic errors
    - Missing validation
    - Insufficient tests
    - Code smells

  Minor (Nice to Fix):
    - Style violations
    - Naming improvements
    - Documentation gaps
    - Refactoring opportunities

  Nitpick (Optional):
    - Formatting preferences
    - Subjective style choices
    - Comment wording
```

### Phase 4: Provide Feedback

```yaml
Feedback Principles:
  - Be kind but honest
  - Critique code, not people
  - Explain why
  - Suggest alternatives
  - Acknowledge good code

Feedback Format:
  - Location (file:line)
  - Issue description
  - Why it's a problem
  - How to fix (with example)
  - Alternative approaches
```

### Phase 5: Suggest Improvements

```yaml
Improvement Types:

  Quick Wins:
    - Easy fixes with high impact
    - Can be done in minutes

  Refactoring:
    - Improve structure
    - Better patterns
    - Cleaner code

  Learning Opportunities:
    - Concepts to explore
    - Resources to read
    - Patterns to learn

  Architecture:
    - Bigger picture
    - Long-term implications
    - System design
```

## Review Template

```markdown

## Code Review: [Feature/PR]

### Summary

[1-2 sentences]

### Overall Assessment

- ✅ Approve / 💬 Comment / ⚠️ Request Changes / ❌ Reject

### Strengths

- [Good thing 1]
- [Good thing 2]

### Required Changes 🚨

#### Security

- [ ] [Issue] - file:line - [Fix]

#### Critical

- [ ] [Issue] - file:line - [Fix]

### Suggestions 💡

#### Code Quality

- [ ] [Issue] - file:line - [Improvement]

#### Performance

- [ ] [Issue] - file:line - [Improvement]

### Questions ❓

- [Clarification needed]

### Testing

- [ ] Unit tests added
- [ ] Edge cases covered
- [ ] Coverage maintained

### Files Reviewed

- [List of files]
```

## Common Issues & Fixes

### Security Issues

```typescript
// Issue: SQL injection
// File: src/products.ts:15
const query = `SELECT * FROM products WHERE id = '${id}'`;

// Fix: Parameterized query
const query = 'SELECT * FROM products WHERE id = $1';
const result = await db.query(query, [id]);
```

```typescript
// Issue: No input validation
// File: src/api/users.ts:25
router.post('/users', async (req, res) => {
  const user = await createUser(req.body);
});

// Fix: Validate input
router.post('/users', validateBody(createUserSchema), async (req, res) => {
  const user = await createUser(req.body);
});
```

### Performance Issues

```typescript
// Issue: N+1 query
// File: src/orders.ts:30
const orders = await getOrders();
for (const order of orders) {
  order.items = await getOrderItems(order.id);
}

// Fix: Single JOIN query
const orders = await db.query(`
  SELECT orders._, json_agg(items._) as items
  FROM orders
  LEFT JOIN items ON items.order_id = orders.id
  GROUP BY orders.id
`);
```

### Code Quality Issues

```typescript
// Issue: Using 'any'
// File: src/utils.ts:10
function process(data: any): any { }

// Fix: Proper types
interface Input {
  value: string;
  options?: ProcessOptions;
}
function process(data: Input): ProcessResult { }
```

```typescript
// Issue: Long function
// File: src/checkout.ts:50-120
async function checkout(cart: Cart) {
  // 70 lines of logic
}

// Fix: Extract functions
async function checkout(cart: Cart) {
  validateCart(cart);
  const order = createOrder(cart);
  await processPayment(order);
  await sendConfirmation(order);
  return order;
}
```

### Testing Issues

```typescript
// Issue: No error case tests
// File: src/auth.test.ts
describe('login', () => {
  it('logs in with valid credentials', () => { });
});

// Fix: Add error cases
describe('login', () => {
  it('logs in with valid credentials', () => { });
  it('throws on invalid password', () => { });
  it('throws on non-existent user', () => { });
  it('throws on account locked', () => { });
});
```

## Review Etiquette

```markdown
✅ Good:
"This could be more efficient using a Map instead of nested loops.
Here's the refactored version:
```ts
const map = new Map(items.map(i => [i.id, i]));
```

❌ Bad:
"This is slow. Fix it."

✅ Good:
"Consider adding input validation here to prevent invalid data
from reaching the database. We use Zod for this:
```ts
const schema = z.object({ name: z.string().min(1) });
```"

❌ Bad:
"This is wrong."
```

## Output Template

```markdown

## Code Review Report

### Reviewed

[What was reviewed]

### Verdict

[Approve/Comment/Request Changes/Reject]

### Files Reviewed

- [List]

### Issues Found

#### Critical (X)

1. **[Issue]** - file:line
   - Problem: ...
   - Fix: ...

#### Major (Y)

[Issues]

#### Minor (Z)

[Issues]

### Strengths

- [Positive aspects]

### Suggestions

- [Improvements]

### Next Steps

- [Required actions]
```

## Verification Checklist

- [ ] Code read thoroughly
- [ ] Quality analyzed
- [ ] Issues identified by severity
- [ ] Feedback is constructive
- [ ] Suggestions actionable
- [ ] Code examples work
- [ ] Tone is professional
- [ ] No personal attacks

## Anti-Patterns to Avoid

```yaml
Don't:
  - Criticize the author personally
  - Be vague ("this could be better")
  - Focus only on style
  - Skip security review
  - Approve without verification
  - Add unnecessary comments
  - Make it about winning arguments
```
