---
name: plan
description: Plan implementation strategy with clear steps and trade-offs
trigger:
  - "plan"
  - "design"
  - "architect"
  - "approach"
  - "how to implement"
phases:
  - understand_requirements
  - research_options
  - design_solution
  - document_plan
inputs:
  - requirement (what needs to be done)
  - constraints (limitations)
  - context (current state)
outputs:
  - implementation_plan
  - design_decisions
  - trade_offs
verification:
  - Plan covers all requirements
  - Trade-offs documented
  - Steps are actionable
---

## Mandatory Reference

> 🚨 **NON-NEGOTIABLE** — every action this agent/skill takes must align with the
> 9-domain End-to-End Developer Skills Mind Map:
> [docs/architecture/SKILLS_MINDMAP.md](../../../docs/architecture/SKILLS_MINDMAP.md) (v1.0.0)
>
> Adopted standards: ISO/IEC/IEEE 12207, ISO/IEC 25010, IEEE 829, ISO/IEC/IEEE 29119,
> OWASP API Top 10 (2023), WCAG 2.1 AA, Diátaxis, Keep a Changelog, Conventional
> Commits, SemVer. Violation = build-blocking.


# Plan Skill

## Purpose

Design a **clear, actionable implementation plan** for any task with proper trade-off analysis.

## When to Use

- Starting a new feature
- Implementing complex changes
- Refactoring large codebases
- Multi-file changes
- Architectural decisions

## Process

### Phase 1: Understand Requirements

```yaml
Functional Requirements:
  - What must the code do?
  - What inputs does it handle?
  - What outputs does it produce?
  - What edge cases exist?

Non-Functional Requirements:
  - Performance (latency, throughput)
  - Security (auth, authz, validation)
  - Scalability (concurrent users, data volume)
  - Reliability (uptime, error rate)
  - Maintainability (code quality, tests)
  - Compatibility (browsers, platforms)

Constraints:
  - Time/deadline
  - Budget/resources
  - Existing code/architecture
  - Team skills
  - Dependencies
```

### Phase 2: Research Options

```yaml
Approaches:
  - List 2-3 possible approaches
  - For each approach:
    - Pros
    - Cons
    - Complexity
    - Risk
    - Time estimate

Technologies:
  - Libraries to use
  - Frameworks
  - Tools
  - Patterns

Standards:
  - Industry best practices
  - Project conventions
  - Official documentation
```

### Phase 3: Design Solution

```yaml
Architecture:
  - High-level structure
  - Components and responsibilities
  - Data flow
  - Interfaces

Implementation:
  - Step-by-step plan
  - Files to create/modify
  - Dependencies
  - Order of operations

Testing:
  - Unit tests
  - Integration tests
  - E2E tests
  - Manual verification

Risks:
  - Identified risks
  - Mitigation strategies
  - Rollback plan
```

### Phase 4: Document Plan

```yaml
Plan Structure:
  Overview:
    - Goal
    - Approach (chosen + why)
    - Estimated effort

  Steps:
    - Ordered list
    - Each step:
      - Action
      - Files affected
      - Verification

  Trade-offs:
    - What we gain
    - What we lose
    - Why this is acceptable

  Risks:
    - Identified risks
    - Mitigation

  Verification:
    - How we'll know it works
    - Tests to add
    - Metrics to track
```

## Output Template

```markdown
## Implementation Plan: [Feature/Task]

### Overview
- **Goal**: [What we're building]
- **Approach**: [Chosen approach]
- **Effort**: [Hours/Days]
- **Risk**: [Low/Medium/High]

### Requirements
#### Functional
- [Requirement 1]
- [Requirement 2]

#### Non-Functional
- Performance: [target]
- Security: [target]

### Approach Options Considered

#### Option A: [Name] ✅ Chosen
- **Pros**: ...
- **Cons**: ...
- **Why chosen**: ...

#### Option B: [Name]
- **Pros**: ...
- **Cons**: ...
- **Why not**: ...

### Implementation Steps

1. **[Step 1]**: [Action]
   - Files: `path/to/file.ts`
   - Verification: [How to verify]

2. **[Step 2]**: [Action]
   - Files: `path/to/file.ts`
   - Verification: [How to verify]

### Files to Create
- [ ] `path/to/new-file.ts`
- [ ] `path/to/test.ts`

### Files to Modify
- [ ] `path/to/existing.ts` - [what changes]

### Testing Plan
- Unit: [tests to add]
- Integration: [tests to add]
- Manual: [verification steps]

### Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ...  | Low         | High   | ...        |

### Verification Criteria
- [ ] All tests pass
- [ ] Lint passes
- [ ] Type check passes
- [ ] Manual verification done
```

## Verification Checklist

- [ ] All requirements addressed
- [ ] Multiple options considered
- [ ] Trade-offs explicit
- [ ] Steps are ordered and specific
- [ ] Files identified
- [ ] Tests planned
- [ ] Risks identified

## Example Usage

```yaml
User Request: "Plan how to add real-time notifications"

Agent Invocation:
  1. Understand: Need real-time notifications to users
  2. Research: WebSocket vs SSE vs Polling
  3. Design: Choose WebSocket with Socket.io
  4. Document: Step-by-step plan with files
```
