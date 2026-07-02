---
name: auto-switch-agent
description: Guide users to the right expert agent via the 3 default chat modes (Agent/Ask/Plan)
trigger:
  - "auto"
  - "switch"
  - "dispatch"
  - "expert"
  - "which agent"
  - "who should handle"
phases:
  - detect_task_type
  - recommend_mode
  - select_agent
  - execute_task
inputs:
  - user_request
  - file_context
  - conversation_history
outputs:
  - recommended_mode
  - selected_agent
  - task_execution
verification:
  - Correct mode selected
  - Correct agent active
  - Task completed successfully
---

# Expert Agent Routing Skill

## Purpose

**Route user requests to the appropriate expert agent** through the **3 default chat modes**
(Agent / Ask / Plan) available in VS Code Copilot Chat. The 12 expert agents are linked to
all 3 modes in `.vscode/settings.json` via `chat.agent.mode.agents.*`,
`chat.askMode.agents.*`, and `chat.planMode.agents.*`.

## How It Works

The agent provides **smart routing recommendations** based on the task type:

1. **Detect Task Type** - Analyze the user's request
2. **Recommend Mode** - Suggest Agent / Ask / Plan
3. **Select Expert Agent** - Choose from 12 available experts
4. **Execute Task** - Help the user invoke the right expert

## Available Modes (3 Default Buttons)

| Button | Mode | Use Case | Hotkey |
|--------|------|----------|--------|
| **Agent** | Code-editing | Make changes, run commands, edit files | Ctrl+Shift+I |
| **Ask** | Read-only Q&A | Ask questions, get information | (Chat menu) |
| **Plan** | Planning | Create implementation plans | (Chat menu) |

## 12 Available Expert Agents

All 12 agents are available in all 3 modes through `.vscode/settings.json`:

| Agent | Description | Best For |
|-------|-------------|----------|
| `architect` | Senior Software Architect | System design, architecture decisions |
| `backend` | Senior Backend Engineer | Node.js, Express, PostgreSQL APIs |
| `frontend` | Senior Frontend Engineer | React, TypeScript, Tailwind |
| `database` | Database Expert | PostgreSQL, queries, indexes |
| `security` | Security Expert | OWASP, JWT, OAuth, vulnerabilities |
| `tester` | QA Engineer | Vitest, Playwright, test coverage |
| `reviewer` | Code Review Expert | Code quality, best practices |
| `devops` | DevOps Expert | Docker, CI/CD, deployment |
| `performance` | Performance Engineer | Core Web Vitals, optimization |
| `refactor` | Refactoring Expert | Code restructuring, design patterns |
| `doc` | Documentation Expert | JSDoc, OpenAPI, technical writing |
| `debug` | Debugging Expert | Error analysis, stack traces |

## Quick Routing Guide

| User Says | Recommended Mode | Expert Agent |
|-----------|------------------|---------------|
| "Fix this bug" / "Error" | **Agent** | `debug` |
| "Create new feature" | **Agent** | `backend` or `frontend` |
| "Explain this code" | **Ask** | any relevant expert |
| "Design a system" | **Plan** | `architect` |
| "Find security issue" | **Agent** | `security` |
| "Optimize performance" | **Agent** | `performance` |
| "Write tests" | **Agent** | `tester` |
| "Review my code" | **Plan** | `reviewer` |
| "Deploy to production" | **Agent** | `devops` |
| "Document this" | **Agent** | `doc` |
| "Refactor legacy code" | **Agent** | `refactor` |
| "Optimize database query" | **Agent** | `database` |

## Detection Pipeline

The agent uses **multi-layered detection** to determine which expert should handle each task:

1. **Keyword Analysis** (Priority-based)
2. **File Pattern Detection** (Path-based)
3. **Context Awareness** (Conversation-based)
4. **Multi-Agent Patterns** (Complex tasks)

## Detection Tiers

### Tier 1: Critical Tasks (Always First)

```yaml
security:
  keywords: [security, vulnerability, exploit, xss, csrf, injection,
            auth, password, token, oauth, jwt, permission, owasp]
  priority: 1
  file_patterns: ["**/auth/**", "**/security/**", "**/middleware/auth*"]

debug:
  keywords: [error, bug, crash, broken, not working, failing,
            stack trace, exception, undefined, null, what's wrong, fix this]
  priority: 1
  file_patterns: ["**/*.test.ts", "**/*.spec.ts", "**/logs/**"]
```

### Tier 2: Architecture & Design

```yaml
architect:
  keywords: [architecture, design, pattern, structure, microservice,
            monolith, scalability, diagram, c4, uml, system design]
  priority: 2
  file_patterns: ["docs/architecture/**", "**/diagrams/**", "**/*.uml"]
```

### Tier 3: Database

```yaml
database:
  keywords: [sql, query, database, table, schema, migration, index,
            postgresql, postgres, join, select, where, transaction]
  priority: 3
  file_patterns: ["**/*.sql", "database/**", "**/migrations/**",
                  "**/schema/**", "**/seeds/**"]
```

### Tier 4: Frontend

```yaml
frontend:
  keywords: [react, component, jsx, tsx, ui, ux, css, tailwind,
            shadcn, html, dom, page, view, form, button, modal]
  priority: 4
  file_patterns: ["**/*.tsx", "**/*.jsx", "**/*.css", "**/*.scss",
                  "**/components/**", "**/pages/**", "**/hooks/**"]
```

### Tier 5: Backend

```yaml
backend:
  keywords: [api, endpoint, route, express, node, server, controller,
            middleware, rest, request, response, handler, service]
  priority: 5
  file_patterns: ["**/server/**", "**/routes/**", "**/controllers/**",
                  "**/services/**", "**/api/**", "**/middleware/**"]
```

### Tier 6: Testing

```yaml
tester:
  keywords: [test, spec, coverage, vitest, playwright, mock, stub,
            assertion, tdd, bdd, unit test, integration test, e2e]
  priority: 6
  file_patterns: ["**/*.test.ts", "**/*.spec.tsx", "**/tests/**",
                  "**/__tests__/**", "**/test/**"]
```

### Tier 7: Performance

```yaml
performance:
  keywords: [slow, performance, optimize, speed, fast, memory, cpu,
            cache, bundle, lighthouse, core web vitals, lcp, fid, cls]
  priority: 7
  file_patterns: ["**/perf/**", "**/performance/**", "**/benchmarks/**"]
```

### Tier 8: DevOps

```yaml
devops:
  keywords: [docker, kubernetes, k8s, deploy, ci/cd, github actions,
            pipeline, build, release, monitoring, logging, prometheus]
  priority: 8
  file_patterns: ["Dockerfile", "docker-compose.yml",
                  ".github/workflows/**", "**/deploy/**", "**/k8s/**"]
```

### Tier 9: Documentation

```yaml
doc:
  keywords: [document, docs, readme, jsdoc, tsdoc, comment, explain,
            documentation, guide, tutorial, reference, api doc]
  priority: 9
  file_patterns: ["**/*.md", "docs/**", "README.md", "CHANGELOG.md"]
```

### Tier 10: Refactoring

```yaml
refactor:
  keywords: [refactor, clean up, reorganize, restructure, improve code,
            clean code, design pattern, extract method, rename, move]
  priority: 10
```

### Tier 11: Code Review

```yaml
reviewer:
  keywords: [review, check, audit, lint, quality, best practices,
            solid, dry, kiss, yagni, code smell, anti-pattern]
  priority: 11
```

## Multi-Agent Tasks

For complex tasks, multiple agents are invoked:

```yaml
patterns:
  "add new feature with tests":
    primary: @frontend or @backend
    secondary: @tester
    review: @reviewer

  "deploy to production":
    primary: @devops
    security: @security
    verify: @tester

  "optimize database performance":
    primary: @database
    secondary: @performance
    design: @architect

  "fix security vulnerability":
    primary: @security
    secondary: @debug
    test: @tester
    document: @doc

  "refactor legacy code":
    primary: @refactor
    test: @tester
    review: @reviewer
    document: @doc

  "create new API endpoint":
    primary: @backend
    design: @architect
    test: @tester
    document: @doc
    security: @security
```

## Usage Examples

### Example 1: User Request About Security

```yaml
User: "I think there's a SQL injection vulnerability in the auth/login endpoint"

Auto-detection:
  - keywords: ["SQL injection", "vulnerability", "auth", "login"]
  - file: "src/auth/login.ts"
  - tier: 1 (security)

Output:
  🔄 Auto-switching to @security
  📋 Reason: "SQL injection", "vulnerability", "auth"
  🎯 Expertise: OWASP Top 10, JWT, encryption, secure code
  📁 Files in scope: src/auth/

Security agent executes:
  1. Review src/auth/login.ts
  2. Check for parameterized queries
  3. Apply security best practices
  4. Add input validation
  5. Document findings
```

### Example 2: User Request About Performance

```yaml
User: "The dashboard is loading slowly, can you optimize it?"

Auto-detection:
  - keywords: ["slow", "loading", "optimize"]
  - file: "src/pages/Dashboard.tsx"
  - tier: 7 (performance)

Output:
  🔄 Auto-switching to @performance
  📋 Reason: "slow", "loading", "optimize"
  🎯 Expertise: Core Web Vitals, profiling, optimization
  📁 Files in scope: src/pages/

Performance agent executes:
  1. Profile dashboard load time
  2. Identify bottlenecks
  3. Apply optimizations (memo, lazy load, code split)
  4. Measure improvements
```

### Example 3: Multi-Agent Complex Task

```yaml
User: "Add a new product review feature with tests and deploy to staging"

Auto-detection:
  - keywords: ["add", "feature", "review", "tests", "deploy"]
  - tier: multi-agent

Output:
  🔄 Multi-agent task detected
  📋 Task: Product review feature with tests + staging deploy

  Sequential agents:
  1. @architect (design schema + API contract)
  2. @backend (create review API endpoints)
  3. @frontend (create review UI components)
  4. @tester (write unit + integration tests)
  5. @security (security review of new endpoints)
  6. @devops (deploy to staging environment)
  7. @doc (update API documentation)
```

## Process

### Phase 1: Analyze Request

```yaml
actions:
  - Parse user input for keywords
  - Check current file context (if editing a file)
  - Review conversation history
  - Identify task type (single vs multi)
```

### Phase 2: Detect Keywords

```yaml
actions:
  - Match against all tier dictionaries
  - Calculate confidence score per agent
  - Sort by score (descending)
  - Check for explicit @agent overrides
```

### Phase 3: Match Agent

```yaml
actions:
  - If top score > 80% → auto-switch to that agent
  - If multiple scores > 60% → consider multi-agent
  - If no scores > 30% → use fallback (architect or reviewer)
  - If user explicitly mentioned @agent → use that (override)
```

### Phase 4: Notify Switch

```yaml
actions:
  - Show agent switch notification
  - List detected keywords
  - List relevant files
  - Confirm expertise area
```

### Phase 5: Execute Task

```yaml
actions:
  - Load agent's .agent.md file
  - Apply agent's patterns and principles
  - Use agent's specific tools and workflows
  - Preserve context across switches
```

## Configuration

### Enable/Disable Auto-Switching

```json
{
  "chat.agent.autoSwitch.enabled": true,
  "chat.agent.autoSwitch.confidenceThreshold": 0.6,
  "chat.agent.autoSwitch.showNotification": true,
  "chat.agent.autoSwitch.preserveContext": true,
  "chat.agent.autoSwitch.allowOverride": true
}
```

### Customize Detection

```json
{
  "chat.agent.autoSwitch.customKeywords": {
    "@frontend": ["component", "page", "ui"],
    "@backend": ["api", "route", "middleware"]
  },
  "chat.agent.autoSwitch.excludedAgents": [],
  "chat.agent.autoSwitch.preferredAgent": "auto"
}
```

## Verification Checklist

- [ ] Correct agent selected based on keywords
- [ ] File context considered
- [ ] Confidence threshold met
- [ ] User override respected (if explicit @agent)
- [ ] Context preserved across switches
- [ ] Notification shown to user
- [ ] Multi-agent pattern used (if needed)
- [ ] Fallback agent used (if no match)

## Anti-Patterns to Avoid

```yaml
Don't:
  - Switch agents on every message (causes churn)
  - Ignore file context (loses precision)
  - Skip user override (frustrating)
  - Lose context between switches (breaking flow)
  - Use random agent when no match (use fallback)
  - Switch to agent for single keyword (too aggressive)
```

## Example Notification Formats

### Simple Switch

```
🔄 Auto-switching to @security
📋 Reason: "vulnerability", "auth", "permission"
🎯 Expertise: OWASP Top 10, JWT, encryption
```

### Multi-Agent

```
🔄 Multi-agent task detected
📋 Task: Add product review feature with tests

Sequential:
  1. @architect (design)
  2. @backend (API)
  3. @frontend (UI)
  4. @tester (tests)
  5. @security (review)
  6. @devops (deploy)
```

### Fallback

```
🤔 No clear agent match for this task
🔄 Using fallback: @architect (general-purpose)
💡 Tip: Be more specific (e.g., "add a React component")
```

## Output Template

```markdown
## 🤖 Agent Auto-Switch

**Selected Agent**: @{agent_name}
**Confidence**: {score}%
**Reason**: {detected_keywords}
**Files in Scope**: {related_files}

### Agent Profile
- **Expertise**: {expertise}
- **Tools**: {tools}
- **Approach**: {approach}

### Task Execution
{how the agent will handle the task}
```

## Statistics Tracking

```yaml
metrics_to_track:
  - agent_switches_per_session
  - most_used_agents
  - switch_accuracy
  - user_override_frequency
  - multi_agent_pattern_usage
  - average_tasks_per_agent
```

## Integration with Skills System

The auto-switch system integrates with the existing Skills System:

```yaml
flow:
  1. User input → Auto-switch detects agent
  2. Agent loads → Loads relevant skills
  3. Skills execute → Apply 5-Phase framework
  4. Output → Hand back to conversation

example:
  "add a React component with tests":
    1. Auto-switch → @frontend
    2. Frontend loads → @implement + @test skills
    3. Skills execute → 5-phase framework
    4. Output → Component + tests
```
