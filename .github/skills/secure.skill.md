---
name: secure
description: Security audit and remediation following OWASP Top 10
trigger:
  - "secure"
  - "security"
  - "vulnerability"
  - "audit"
  - "owasp"
phases:
  - identify_assets
  - threat_model
  - audit_code
  - find_vulnerabilities
  - remediate
  - verify
inputs:
  - target (code/system to audit)
  - compliance (OWASP, GDPR, etc.)
  - threat_model (assets, threats)
outputs:
  - security_audit_report
  - vulnerabilities_list
  - remediation_plan
verification:
  - All vulnerabilities addressed
  - Tests added
  - Compliance verified
---

## Mandatory Reference

> 🚨 **NON-NEGOTIABLE** — every action this agent/skill takes must align with the
> 9-domain End-to-End Developer Skills Mind Map:
> [docs/architecture/SKILLS_MINDMAP.md](../../../docs/architecture/SKILLS_MINDMAP.md) (v1.0.0)
>
> Adopted standards: ISO/IEC/IEEE 12207, ISO/IEC 25010, IEEE 829, ISO/IEC/IEEE 29119,
> OWASP API Top 10 (2023), WCAG 2.1 AA, Diátaxis, Keep a Changelog, Conventional
> Commits, SemVer. Violation = build-blocking.


# Secure Skill

## Purpose

Perform **comprehensive security audit** and remediation following OWASP Top 10 and industry best practices.

## When to Use

- Before deployment
- After major changes
- Regular security audit
- Compliance requirement
- Vulnerability reported

## Process

### Phase 1: Identify Assets

```yaml
Identify:
  - What needs protection?
  - What's the data classification?
  - Who has access?
  - What's the threat model?

Asset Types:
  - User data (PII, credentials)
  - Payment information
  - Business logic
  - API endpoints
  - Admin functions
  - Secrets and keys

Data Classification:
  Public: Marketing content, public docs
  Internal: Non-sensitive company data
  Confidential: User PII, business data
  Restricted: Credentials, payment data, secrets
```

### Phase 2: Threat Model (STRIDE)

```yaml
STRIDE Categories:

  Spoofing:
    - Can attacker impersonate users?
    - JWT/session security
    - Multi-factor auth

  Tampering:
    - Can data be modified in transit?
    - HTTPS enforced?
    - Signed tokens?
    - Database integrity?

  Repudiation:
    - Can users deny actions?
    - Audit logs?
    - Signed receipts?

  Information Disclosure:
    - Sensitive data exposed?
    - Encryption at rest/transit?
    - Error messages leak info?

  Denial of Service:
    - Rate limiting?
    - Resource limits?
    - DDoS protection?

  Elevation of Privilege:
    - Auth bypass possible?
    - Input validation?
    - Authorization checks?
```

### Phase 3: Audit Code

```yaml
Check OWASP Top 10 (2021):

  A01: Broken Access Control:
    - Authorization on every endpoint
    - Resource ownership verified
    - CORS configured properly
    - JWT validation

  A02: Cryptographic Failures:
    - HTTPS enforced
    - Strong encryption algorithms
    - Secure random for tokens
    - No hardcoded secrets

  A03: Injection:
    - Parameterized SQL queries
    - Input validation
    - Output encoding
    - NoSQL injection prevention

  A04: Insecure Design:
    - Threat modeling done
    - Defense in depth
    - Principle of least privilege

  A05: Security Misconfiguration:
    - Security headers (CSP, HSTS)
    - Default credentials changed
    - Error handling doesn't leak info
    - Unnecessary features disabled

  A06: Vulnerable Components:
    - Dependencies up to date
    - npm audit clean
    - No known vulnerabilities

  A07: Authentication Failures:
    - Strong password requirements
    - Account lockout
    - Secure session management
    - MFA available

  A08: Data Integrity Failures:
    - Input validation
    - CI/CD security
    - Signed URLs/tokens

  A09: Logging Failures:
    - Security events logged
    - Log injection prevention
    - Monitoring in place

  A10: SSRF:
    - URL validation
    - Network segmentation
    - Allowlist for external calls
```

### Phase 4: Find Vulnerabilities

```yaml
Common Vulnerabilities:

  SQL Injection:
    - String concatenation in queries
    - Untrusted input in queries
    - Missing parameterization

  XSS:
    - Unescaped user input
    - dangerous JSX attributes
    - URL parameters in DOM

  CSRF:
    - Missing CSRF tokens
    - Insecure CORS
    - State-changing GET requests

  Authentication:
    - Weak passwords allowed
    - No rate limiting
    - Session fixation
    - Missing MFA

  Authorization:
    - Missing ownership checks
    - Insecure direct object references
    - Privilege escalation

  Cryptography:
    - MD5/SHA1 used
    - Hardcoded secrets
    - Weak random
    - ECB mode

  Information Disclosure:
    - Verbose errors
    - Stack traces in production
    - Debug info leaked
```

### Phase 5: Remediate

```yaml
Remediation Strategy:

  Critical (Fix immediately):
    - Active exploits
    - Data breaches
    - Auth bypass

  High (Fix within days):
    - SQL injection
    - XSS
    - Auth bypass

  Medium (Fix within weeks):
    - Missing rate limiting
    - Weak crypto
    - Missing headers

  Low (Fix when possible):
    - Information disclosure
    - Missing monitoring
    - Outdated dependencies

Remediation Order:
  1. Fix critical vulnerabilities
  2. Add security tests
  3. Update documentation
  4. Notify stakeholders
```

### Phase 6: Verify

```yaml
Verification:
  - Vulnerability scanner clean
  - Penetration test passed
  - Security tests added
  - Compliance verified
  - Documentation updated
```

## Security Patterns

### SQL Injection Prevention

```typescript
// ❌ Vulnerable
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// ✅ Safe
const query = 'SELECT * FROM users WHERE id = $1';
const result = await db.query(query, [userId]);
```

### XSS Prevention

```tsx
// ❌ Vulnerable
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ Safe (React escapes by default)
<div>{userInput}</div>

// ✅ Safe (if HTML needed, sanitize)
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

### CSRF Protection

```typescript
// ❌ Vulnerable
app.post('/transfer', (req, res) => {
  transferMoney(req.body.to, req.body.amount);
});

// ✅ Safe (CSRF token)
app.post('/transfer', csrfProtection, (req, res) => {
  transferMoney(req.body.to, req.body.amount);
});
```

### Authentication

```typescript
// ❌ Weak
async function authenticate(email: string, password: string) {
  const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  if (user && user.password === password) return user;
}

// ✅ Secure
async function authenticate(email: string, password: string) {
  const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    await incrementFailedAttempts(user.id);
    return null;
  }

  await resetFailedAttempts(user.id);
  return user;
}
```

### Authorization

```typescript
// ❌ Vulnerable (no authz check)
app.delete('/api/posts/:id', authenticate, async (req, res) => {
  await db.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
});

// ✅ Secure (ownership check)
app.delete('/api/posts/:id', authenticate, async (req, res) => {
  const post = await db.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
  if (!post) return res.status(404).json({ error: 'Not found' });

  if (post.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await db.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
});
```

### Secrets Management

```typescript
// ❌ Bad (hardcoded)
const apiKey = 'sk-1234567890abcdef';

// ✅ Good (environment variable)
const apiKey = process.env.API_KEY;
if (!apiKey) throw new Error('API_KEY not set');

// ✅ Even better (secrets manager)
const apiKey = await secretsManager.getSecret('api-key');
```

### Security Headers

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

### Input Validation

```typescript
// ❌ No validation
app.post('/api/users', async (req, res) => {
  const user = await createUser(req.body);
  res.json(user);
});

// ✅ Validated
const userSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(12).max(128),
  name: z.string().min(1).max(100),
});

app.post('/api/users', validateBody(userSchema), async (req, res) => {
  const user = await createUser(req.body);
  res.status(201).json(user);
});
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 _ 60 _ 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests',
});

const authLimiter = rateLimit({
  windowMs: 15 _ 60 _ 1000,
  max: 5, // Stricter for auth
  skipSuccessfulRequests: true,
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);
```

## Security Checklist

```yaml
Authentication:
  - [ ] Strong passwords (12+ chars)
  - [ ] Bcrypt/argon2 (12+ rounds)
  - [ ] JWT with strong secret (64+ chars)
  - [ ] Short-lived access tokens (15min)
  - [ ] Refresh tokens in httpOnly cookies
  - [ ] Account lockout after failures
  - [ ] MFA available

Authorization:
  - [ ] Authz on every endpoint
  - [ ] Resource ownership verified
  - [ ] RBAC implemented
  - [ ] Least privilege

Input Validation:
  - [ ] Server-side validation
  - [ ] Zod schemas
  - [ ] SQL parameterized
  - [ ] File upload validated

Transport Security:
  - [ ] HTTPS enforced
  - [ ] HSTS enabled
  - [ ] TLS 1.2+
  - [ ] Secure cookies

Data Protection:
  - [ ] Encryption at rest
  - [ ] PII minimized
  - [ ] GDPR compliance
  - [ ] Backups encrypted

Configuration:
  - [ ] Security headers
  - [ ] CORS configured
  - [ ] Errors don't leak info
  - [ ] Debug disabled in prod

Monitoring:
  - [ ] Security events logged
  - [ ] Anomaly detection
  - [ ] Incident response plan
  - [ ] Dependency scanning

Dependencies:
  - [ ] npm audit clean
  - [ ] Up to date
  - [ ] No known vulnerabilities
```

## Output Template

```markdown

## Security Audit Report

### Target

[What was audited]

### Scope

- Files reviewed: X
- Endpoints reviewed: Y
- Components reviewed: Z

### Findings

#### 🔴 Critical (X)

1. **[Vulnerability]** - file:line
   - Risk: ...
   - Fix: ...

#### 🟠 High (Y)

[Vulnerabilities]

#### 🟡 Medium (Z)

[Vulnerabilities]

#### 🟢 Low (W)

[Vulnerabilities]

### Remediation Plan

1. [ ] Fix critical (immediate)
2. [ ] Fix high (this week)
3. [ ] Fix medium (this month)
4. [ ] Fix low (when possible)

### Security Tests Added

- [ ] SQL injection tests
- [ ] XSS tests
- [ ] Auth bypass tests
- [ ] CSRF tests
- [ ] Rate limiting tests

### Compliance

- [ ] OWASP Top 10 covered
- [ ] GDPR requirements met
- [ ] Industry standards followed

### Verification

- [ ] Vulnerability scanner clean
- [ ] Security tests pass
- [ ] Penetration test passed
```

## Verification Checklist

- [ ] Assets identified
- [ ] Threat model created
- [ ] All vulnerabilities found
- [ ] Remediated by severity
- [ ] Security tests added
- [ ] Documentation updated
- [ ] No new vulnerabilities
- [ ] Compliance verified

## Anti-Patterns to Avoid

```yaml
Don't:
  - Trust user input
  - Skip input validation
  - Use weak crypto
  - Hardcode secrets
  - Log sensitive data
  - Disable security features
  - Ignore security warnings
  - Delay security fixes
```
