# Agent Skills System

This document defines the **Skills System** for the Nouf-ex agent. Each skill is a structured workflow
that the agent follows when performing a specific type of task. Skills ensure **consistency**,
**precision**, and **professional quality** in every operation.

## Skill System Overview

```yaml
Philosophy:
  - Skills are reusable workflows (like N8N nodes)
  - Each skill has clear inputs, outputs, and verification steps
  - Skills reduce randomness and increase predictability
  - Skills work like a checklist + workflow automation

Structure:
  - Phase 1: Analyze (understand the request)
  - Phase 2: Plan (design the solution)
  - Phase 3: Execute (perform the work)
  - Phase 4: Verify (validate the result)
  - Phase 5: Document (record what was done)

Benefits:
  - Deterministic behavior
  - Reduced cognitive load
  - Consistent quality
  - Time efficiency
  - Easy auditing
```

## Available Skills

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `analyze` | Need to understand code/issue | Deep analysis with structured output |
| `plan` | Need to design solution | Architecture/approach planning |
| `implement` | Need to write code | Code implementation with tests |
| `refactor` | Need to improve code | Code restructuring without behavior change |
| `fix` | Need to fix bug | Bug fixing with regression tests |
| `test` | Need to verify code | Test creation and execution |
| `document` | Need to document | Documentation generation |
| `review` | Need to check quality | Code review with feedback |
| `verify` | Need to confirm working | Verification of changes |
| `organize` | Need to arrange/structure | File and code organization |
| `cleanup` | Need to remove issues | Remove duplicates, dead code |
| `optimize` | Need to improve performance | Performance optimization |
| `secure` | Need to check security | Security audit and fixes |
| `deploy` | Need to deploy/release | Deployment preparation |
| `migrate` | Need to change technology | Migration with zero downtime |

## Skill Format

Each skill is defined as a YAML file in `.github/skills/` with this structure:

```yaml
---
name: skill-name
description: What this skill does
trigger:
  - trigger keyword 1
  - trigger keyword 2
phases:
  - phase 1
  - phase 2
inputs:
  - input 1
  - input 2
outputs:
  - output 1
  - output 2
verification:
  - check 1
  - check 2
---
```

## Thinking Methodology

The agent follows a strict **5-Phase Thinking Framework** for every task:

### Phase 1: ANALYZE (Understand)

```yaml
Questions:
  - What is the user really asking?
  - What is the current state?
  - What constraints exist?
  - What are the success criteria?

Output:
  - Clear problem statement
  - List of requirements
  - List of constraints
  - Identified risks
```

### Phase 2: PLAN (Design)

```yaml
Questions:
  - What's the best approach?
  - What alternatives exist?
  - What are the trade-offs?
  - What's the sequence of steps?

Output:
  - Chosen approach with rationale
  - Step-by-step plan
  - Risk mitigation
  - Time/effort estimate
```

### Phase 3: EXECUTE (Implement)

```yaml
Questions:
  - Am I following the plan?
  - Are there deviations and why?
  - Is the code clean and tested?
  - Am I documenting as I go?

Output:
  - Working code
  - Tests added
  - Inline documentation
  - Progress notes
```

### Phase 4: VERIFY (Validate)

```yaml
Questions:
  - Does it work as expected?
  - Do all tests pass?
  - Are there any edge cases missed?
  - Is the code review-ready?

Output:
  - Test results
  - Lint/typecheck results
  - Manual verification
  - Sign-off checklist
```

### Phase 5: DOCUMENT (Record)

```yaml
Questions:
  - What was done?
  - Why was it done this way?
  - What changed?
  - What needs follow-up?

Output:
  - Summary of changes
  - Updated documentation
  - Commit message
  - Follow-up tasks
```

## Skill Usage Rules

```yaml
When to use a skill:
  - When the user request matches a skill trigger
  - When you need structured approach
  - When previous attempts were messy/random

When NOT to use a skill:
  - For simple conversational questions
  - For trivial edits (< 3 lines)
  - When user explicitly says "quick fix"

How to select:
  1. Identify the user's intent
  2. Match to closest skill trigger
  3. If multiple skills apply, use them in sequence
  4. Document skill usage in your response

Multiple skills:
  - Can chain skills: analyze → plan → implement → verify
  - Each skill produces output for the next
  - Document the chain in your response
```

## Quality Standards (Apply to ALL Skills)

```yaml
Code Quality:
  - TypeScript strict mode (no 'any')
  - ESLint passes with no warnings
  - Prettier formatted
  - All public APIs documented

Testing:
  - Unit tests for new code
  - Edge cases covered
  - Coverage meets threshold

Security:
  - Input validated
  - Auth/authz checked
  - No secrets in code
  - OWASP Top 10 reviewed

Performance:
  - No N+1 queries
  - Appropriate caching
  - Bundle size OK

Documentation:
  - JSDoc for public APIs
  - README updated if needed
  - CHANGELOG entry
```

## Anti-Patterns (AVOID)

```yaml
Random Behavior:
  ❌ Making changes without a plan
  ❌ Trying multiple approaches randomly
  ❌ Ignoring previous context
  ❌ Not verifying changes

Time Waste:
  ❌ Re-reading files unnecessarily
  ❌ Repeating failed attempts
  ❌ Asking clarifying questions for obvious things
  ❌ Generating excessive output

Poor Quality:
  ❌ Skipping tests
  ❌ Skipping documentation
  ❌ Skipping verification
  ❌ Ignoring lint errors
  ❌ Mixing multiple unrelated changes

Communication:
  ❌ Vague responses
  ❌ No progress updates
  ❌ Skipping the explanation
  ❌ Not asking for feedback
```

## Skill Invocation

To invoke a skill, the agent:

1. **Recognizes** the trigger in the user request
2. **Loads** the skill definition from `.github/skills/`
3. **Follows** the phases sequentially
4. **Documents** skill usage in the response
5. **Verifies** completion of all phases

Example response format:

```markdown
## 🎯 Skill: implement

### Phase 1: Analyze
[analysis content]

### Phase 2: Plan
[plan content]

### Phase 3: Execute
[execution content]

### Phase 4: Verify
[verification content]

### Phase 5: Document
[documentation content]
```

## Continuous Improvement

After each skill execution:

1. Note what worked well
2. Note what could be improved
3. Update skill definitions if needed
4. Add new patterns to memory

## References

- [N8N Workflow Automation](https://n8n.io/)
- [VS Code Agent Customization](https://code.visualstudio.com/docs/agents/overview)
- [Sequential Thinking MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking)

---

Last updated: 2026-07-02
Maintained by: Nouf-ex Agent System
