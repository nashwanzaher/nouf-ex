---
name: integrate
description: Integrate with external services, APIs, or third-party systems
trigger:
  - "integrate"
  - "connect to"
  - "third party"
  - "api integration"
  - "webhook"
phases:
  - research_api
  - plan_integration
  - setup_authentication
  - implement_client
  - handle_errors
  - test_integration
  - monitor
inputs:
  - service_name
  - api_documentation
  - authentication_method
outputs:
  - integration_code
  - error_handling
  - tests
verification:
  - All endpoints working
  - Errors handled
  - Tests passing
  - Monitoring in place
---

## Mandatory Reference

> 🚨 **NON-NEGOTIABLE** — every action this agent/skill takes must align with the
> 9-domain End-to-End Developer Skills Mind Map:
> [docs/architecture/SKILLS_MINDMAP.md](../../../docs/architecture/SKILLS_MINDMAP.md) (v1.0.0)
>
> Adopted standards: ISO/IEC/IEEE 12207, ISO/IEC 25010, IEEE 829, ISO/IEC/IEEE 29119,
> OWASP API Top 10 (2023), WCAG 2.1 AA, Diátaxis, Keep a Changelog, Conventional
> Commits, SemVer. Violation = build-blocking.


# Integrate Skill

## Purpose

Integrate with external services, APIs, or third-party systems **safely** and **reliably**.

## When to Use

- Connecting to third-party API
- Setting up webhooks
- OAuth integration
- Payment processor
- Email service
- SMS provider
- Cloud storage

## Process

### Phase 1: Research API

```yaml
Documentation Review:
  - Authentication method
  - Base URL and endpoints
  - Request format
  - Response format
  - Rate limits
  - Error codes
  - Webhooks (if applicable)
  - Versioning strategy

API Constraints:
  - Rate limits (requests/minute, day)
  - Request size limits
  - Timeout limits
  - Concurrent connections
  - Quota limits

SDK Availability:
  - Official SDK?
  - Community SDKs?
  - Quality and maintenance
  - License compatibility

Alternatives:
  - Compare similar services
  - Cost comparison
  - Feature comparison
  - Migration ease
```

### Phase 2: Plan Integration

```yaml
Architecture:
  - Direct integration vs adapter pattern
  - Synchronous vs async
  - Caching strategy
  - Retry strategy
  - Circuit breaker

Security:
  - API key storage (secrets manager)
  - Webhook signature verification
  - HTTPS only
  - Input validation
  - Output sanitization

Error Handling:
  - Retry with backoff
  - Circuit breaker
  - Fallback behavior
  - User notification
  - Monitoring and alerting

Data Flow:
  - Request flow
  - Response handling
  - Webhook processing
  - State management
  - Idempotency
```

### Phase 3: Setup Authentication

```yaml
API Key Authentication:
  - Store in environment variables
  - Use secrets manager in production
  - Rotate regularly
  - Never commit to git

OAuth 2.0:
  - Authorization code flow
  - PKCE for public clients
  - Token storage (encrypted)
  - Refresh token handling
  - Token expiration handling

Webhook Verification:
  - Verify signature
  - Check timestamp
  - Idempotency (handle duplicates)
  - HTTPS only
  - IP allowlist (if available)
```

### Phase 4: Implement Client

```yaml
Client Design:
  - Type-safe client
  - Error handling
  - Retry logic
  - Rate limiting
  - Request/response logging

Example Structure:
  src/integrations/
    stripe/
      client.ts          # Main client
      types.ts           # Type definitions
      errors.ts          # Error classes
      webhooks.ts        # Webhook handlers
      README.md          # Documentation
      __tests__/
        client.test.ts
        webhooks.test.ts
```

### Phase 5: Handle Errors

```yaml
Error Categories:

  Transient (retry):
    - 429 Rate Limit
    - 500 Server Error
    - 502 Bad Gateway
    - 503 Service Unavailable
    - 504 Gateway Timeout
    - Network timeouts

  Permanent (don't retry):
    - 400 Bad Request
    - 401 Unauthorized
    - 403 Forbidden
    - 404 Not Found
    - 422 Validation Error

  Client Errors (fix code):
    - Malformed request
    - Missing required fields
    - Invalid authentication

Retry Strategy:
  - Exponential backoff
  - Max retry attempts
  - Jitter to avoid thundering herd
  - Don't retry on 4xx (except 429)

Circuit Breaker:
  - Open after N failures
  - Half-open after timeout
  - Close after success
  - Prevent cascade failures
```

### Phase 6: Test Integration

```yaml
Test Strategy:

  Unit Tests:
    - Mock external API
    - Test client methods
    - Test error handling
    - Test retry logic

  Integration Tests:
    - Use sandbox/test environment
    - Test full request/response
    - Test webhooks
    - Test authentication

  E2E Tests:
    - Test full user flow
    - Test with real service (test mode)
    - Verify webhook handling

Test Coverage:
  - Happy path
  - Error cases
  - Rate limiting
  - Timeouts
  - Network failures
  - Invalid responses
```

### Phase 7: Monitor

```yaml
Monitoring Metrics:
  - Request rate
  - Success rate
  - Error rate (by type)
  - Response time
  - Rate limit hits
  - Circuit breaker state
  - Retry attempts
  - Webhook delivery rate

Alerts:
  - Error rate > 5%
  - Response time > 2s
  - Rate limit hit
  - Circuit breaker open
  - Webhook failures

Logging:
  - Request ID
  - Endpoint
  - Status code
  - Response time
  - Error details (sanitized)
  - Retry attempts
```

## Integration Patterns

### HTTP Client with Retry

```typescript
interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryOptions: RetryOptions = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
  }
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retryOptions.maxAttempts; attempt++) {
    try {
      const response = await fetch(url, options);

      // Don't retry on client errors (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      // Success
      if (response.ok) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error as Error;
    }

    // Don't sleep after last attempt
    if (attempt < retryOptions.maxAttempts) {
      const delay = Math.min(
        retryOptions.baseDelayMs _ Math.pow(2, attempt - 1) + Math.random() _ 1000,
        retryOptions.maxDelayMs
      );
      logger.warn({ url, attempt, delay }, 'Retrying request');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

### Circuit Breaker

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure?: Date;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold: number = 5,
    private readonly timeoutMs: number = 60000,
    private readonly onStateChange?: (state: string) => void
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - (this.lastFailure?.getTime() || 0) > this.timeoutMs) {
        this.setState('half-open');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.setState('closed');
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = new Date();

    if (this.failures >= this.threshold) {
      this.setState('open');
    }
  }

  private setState(state: 'closed' | 'open' | 'half-open') {
    if (this.state !== state) {
      this.state = state;
      this.onStateChange?.(state);
      logger.info({ state }, 'Circuit breaker state changed');
    }
  }
}
```

### Webhook Handler

```typescript
import crypto from 'crypto';

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

export async function handleWebhook(
  payload: string,
  signature: string,
  secret: string
): Promise<void> {
  // 1. Verify signature
  if (!verifyWebhookSignature(payload, signature, secret)) {
    throw new Error('Invalid webhook signature');
  }

  // 2. Parse payload
  const event = JSON.parse(payload);

  // 3. Check idempotency
  const processed = await redis.get(`webhook:${event.id}`);
  if (processed) {
    logger.info({ eventId: event.id }, 'Webhook already processed');
    return;
  }

  // 4. Process event
  try {
    await processEvent(event);

    // 5. Mark as processed
    await redis.setex(`webhook:${event.id}`, 86400, '1'); // 24 hours
  } catch (error) {
    logger.error({ error, eventId: event.id }, 'Webhook processing failed');
    throw error;
  }
}
```

### Rate Limit Handling

```typescript
class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillRate: number  // tokens per second
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.refill();
    }

    this.tokens--;
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsed * this.refillRate
    );
    this.lastRefill = now;
  }
}
```

### OAuth 2.0 Client

```typescript
class OAuthClient {
  private accessToken?: string;
  private refreshToken?: string;
  private expiresAt?: Date;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string
  ) {}

  getAuthorizationUrl(state: string, scopes: string[]): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
    });
    return `https://provider.com/oauth/authorize?${params}`;
  }

  async exchangeCode(code: string): Promise<void> {
    const response = await fetch('https://provider.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error('Token exchange failed');
    }

    const data = await response.json();
    this.setTokens(data);
  }

  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token');
    }

    const response = await fetch('https://provider.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    this.setTokens(data);
  }

  private setTokens(data: any) {
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token || this.refreshToken;
    this.expiresAt = new Date(Date.now() + data.expires_in * 1000);
  }
}
```

## Integration Checklist

```yaml
Planning:
  - [ ] API researched
  - [ ] Authentication method chosen
  - [ ] Error handling strategy
  - [ ] Rate limiting plan
  - [ ] Cost estimate

Implementation:
  - [ ] Client implemented
  - [ ] Authentication handled
  - [ ] Error handling implemented
  - [ ] Retry logic added
  - [ ] Circuit breaker configured
  - [ ] Logging added

Testing:
  - [ ] Unit tests with mocks
  - [ ] Integration tests with sandbox
  - [ ] Webhook tests
  - [ ] Error case tests
  - [ ] Performance tests

Deployment:
  - [ ] Secrets in vault
  - [ ] Monitoring configured
  - [ ] Alerts set up
  - [ ] Documentation written
  - [ ] Runbook created
```

## Output Template

```markdown

## Integration Report

### Service

[Service name]

### Authentication

[Method used]

### Endpoints Integrated

- [List]

### Error Handling

- Retry: [strategy]
- Circuit breaker: [config]
- Fallback: [strategy]

### Testing

- Unit tests: X
- Integration tests: Y
- All passing: ✅

### Monitoring

- Metrics: [list]
- Alerts: [list]
- Logs: [configured]

### Documentation

- [Link to docs]
- [Link to runbook]
```

## Anti-Patterns to Avoid

```yaml
Don't:
  - Hardcode API keys
  - Skip retry logic
  - Ignore rate limits
  - Trust external data without validation
  - Skip error handling
  - Block on synchronous calls when async is possible
  - Skip testing in sandbox
  - Forget to handle webhook signatures
```
