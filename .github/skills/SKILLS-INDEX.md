# Nouf-ex Agent Skills Index

Comprehensive index of all skills available to the agent. Each skill provides structured workflows like N8N for specific task types.

## Complete Skills List (20 Skills)

### Analysis and Planning

| Skill | Purpose | File | Phases |
|-------|---------|------|--------|
| `analyze` | Deep analysis with structured output | `analyze.skill.md` | 4 |
| `plan` | Design solutions with trade-offs | `plan.skill.md` | 4 |
| `api-design` | Design RESTful APIs | `api-design.skill.md` | 7 |

### Implementation

| Skill | Purpose | File | Phases |
|-------|---------|------|--------|
| `implement` | Build features with tests | `implement.skill.md` | 5 |
| `refactor` | Improve code without behavior change | `refactor.skill.md` | 4 |
| `scaffold` | Create new projects or components | `scaffold.skill.md` | 7 |

### Quality and Fixes

| Skill | Purpose | File | Phases |
|-------|---------|------|--------|
| `fix` | Fix bugs with regression tests | `fix.skill.md` | 6 |
| `verify` | Comprehensive verification | `verify.skill.md` | 4 |
| `review` | Code review with structured feedback | `review.skill.md` | 5 |
| `debug` | Debug issues systematically | `debug.skill.md` | 7 |

### Testing and Documentation

| Skill | Purpose | File | Phases |
|-------|---------|------|--------|
| `test` | Create comprehensive tests | `test.skill.md` | 5 |
| `document` | Generate documentation | `document.skill.md` | 4 |

### Organization and Performance

| Skill | Purpose | File | Phases |
|-------|---------|------|--------|
| `organize` | File and code organization | `organize.skill.md` | 5 |
| `cleanup` | Remove duplicates and dead code | `cleanup.skill.md` | 5 |
| `optimize` | Performance optimization | `optimize.skill.md` | 5 |

### Security

| Skill | Purpose | File | Phases |
|-------|---------|------|--------|
| `secure` | Security audit and remediation | `secure.skill.md` | 6 |

### Operations and Integration

| Skill | Purpose | File | Phases |
|-------|---------|------|--------|
| `deploy` | Deploy application safely | `deploy.skill.md` | 6 |
| `migrate` | Migrate systems or databases | `migrate.skill.md` | 7 |
| `integrate` | Integrate external services | `integrate.skill.md` | 7 |
| `monitor` | Setup monitoring and observability | `monitor.skill.md` | 7 |

### Meta Skills

| Skill | Purpose | File | Phases |
|-------|---------|------|--------|
| `auto-switch-agent` | Auto-detect and switch to appropriate expert agent | `auto-switch-agent.skill.md` | 5 |

## Skill Selection Guide

```yaml
When user asks to:
  "Add a feature" → implement
  "Fix a bug" → fix
  "Improve code" → refactor
  "Make faster" → optimize
  "Add tests" → test
  "Document code" → document
  "Review code" → review
  "Verify changes" → verify
  "Clean up" → cleanup
  "Organize files" → organize
  "Check security" → secure
  "Investigate" → analyze
  "Plan changes" → plan
  "Debug issue" → debug
  "Design API" → api-design
  "Deploy" → deploy
  "Migrate" → migrate
  "Integrate service" → integrate
  "Setup monitoring" → monitor
  "Create new project" → scaffold
```

## Skill Structure

Each skill file follows this YAML structure:

```yaml
---
name: [skill-name]
description: [What this skill does]
trigger: [When to use this skill]
phases: [Ordered list of phases]
inputs: [Required inputs]
outputs: [Expected outputs]
verification: [How to verify completion]
---
```

## 5-Phase Thinking Framework

Every skill follows this framework:

1. ANALYZE - Understand the request and context
2. PLAN - Design the solution and identify trade-offs
3. EXECUTE - Implement the solution
4. VERIFY - Validate the result
5. DOCUMENT - Record what was done

## Skill Chaining

Skills can be chained for complex tasks:

```yaml
Feature Development:
  - analyze → plan → api-design → implement → test → verify → document

Bug Fixing:
  - analyze → debug → fix → test → verify

Code Review:
  - review → fix → verify

Performance:
  - analyze → optimize → verify

Security:
  - analyze → secure → fix → verify

Deployment:
  - verify → deploy → monitor

Migration:
  - plan → migrate → verify → monitor

New Project:
  - scaffold → implement → test → deploy → monitor
```

## Quality Standards

All skills adhere to these standards:

```yaml
Code Quality:
  - TypeScript strict mode
  - ESLint passes
  - Prettier formatted
  - JSDoc for public APIs

Testing:
  - Unit tests
  - Integration tests
  - Coverage > 80 percent

Security:
  - Input validated
  - OWASP Top 10
  - No secrets in code

Documentation:
  - Clear and accurate
  - Examples work
  - Links valid
```

## Usage Examples

### Example 1: Implement a feature

```yaml
User: "Add a new API endpoint to get user orders"

Skills Chain: api-design → implement → test → verify

Steps:
  1. api-design: Design the endpoint contract
  2. implement: Build the endpoint with tests
  3. test: Add comprehensive tests
  4. verify: Run all checks
```

### Example 2: Fix a bug

```yaml
User: "Login is failing for some users"

Skills Chain: debug → fix → test → verify

Steps:
  1. debug: Reproduce and diagnose
  2. fix: Write failing test, then fix
  3. test: Add regression tests
  4. verify: Test passes, no regressions
```

### Example 3: Deploy new feature

```yaml
User: "Deploy the new feature to production"

Skills Chain: verify → deploy → monitor

Steps:
  1. verify: All checks pass
  2. deploy: Deploy safely with rollback plan
  3. monitor: Watch metrics and logs
```

### Example 4: Security audit

```yaml
User: "Check the application for security issues"

Skills Chain: analyze → secure → fix → verify

Steps:
  1. analyze: Identify assets and threats
  2. secure: Audit OWASP Top 10
  3. fix: Remediate vulnerabilities
  4. verify: Confirm fixes
```

## Anti-Patterns

Avoid these patterns across ALL skills:

```yaml
  ❌ Making changes without understanding
  ❌ Skipping tests
  ❌ Multiple random approaches
  ❌ Mixing concerns
  ❌ Vague responses
  ❌ Skipping verification
  ❌ Not documenting work
  ❌ Skipping rollback plans
  ❌ Deploying without monitoring
```

## Skill Maintenance

When updating skills:

1. Keep triggers clear and specific
2. Define expected outputs
3. Include verification steps
4. Add examples
5. Update this index

## Statistics

```yaml
Total Skills: 20
Total Files: 22 (20 skills + 2 indexes)
Coverage Areas:
  - Analysis and Planning: 3
  - Implementation: 3
  - Quality and Fixes: 4
  - Testing and Documentation: 2
  - Organization and Performance: 3
  - Security: 1
  - Operations and Integration: 4

Total Phases Across All Skills: ~110
```

## References

- [N8N Workflow Automation](https://n8n.io/)
- [VS Code Agent Customization](https://code.visualstudio.com/docs/agents/overview)
- [Sequential Thinking MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking)

---

Last updated: 2026-07-02
Maintained by: Nouf-ex Agent System
