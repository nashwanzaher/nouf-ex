# Nouf-ex Copilot Instructions

> ## 🚨 MANDATORY COMPLIANCE — READ FIRST 🚨
>
> **Before performing ANY action in this repository, the agent MUST consult and adhere to:**
>
> 📜 **[`docs/architecture/SKILLS_MINDMAP.md`](../docs/architecture/SKILLS_MINDMAP.md) — *Nouf-ex End-to-End Developer Skills Mind Map* (v1.0.0)**
>
> This mind map is the **canonical, mandatory reference** for all work on Nouf-ex. It defines:
> - The 9 required skill domains (Frontend, Backend, Database, Security, Quality, DevOps, Documentation, AI Agents, Project Mgmt)
> - The academic standards enforced (ISO/IEC/IEEE 12207, ISO/IEC 25010, IEEE 829, ISO/IEC/IEEE 29119, OWASP API Top 10 2023, WCAG 2.1 Level AA, Diátaxis, Keep a Changelog, Conventional Commits, SemVer)
> - The skill-level matrix (Junior / Mid / Senior) with promotion criteria
> - The cross-cutting concerns that span domains
> - The self-audit checklist that must pass before any PR
> - The compliance verification process
>
> **NON-COMPLIANCE IS A BUILD-BLOCKING VIOLATION.** Any commit that violates the mind map's standards MUST be reverted or remediated before merge.

## AI Provider Configuration

This project uses **MiniMax API** as the primary AI provider for GitHub Copilot.

### API Configuration

- **Provider**: MiniMax (via minimax-vscode-copilot extension v2.5.3)
- **Models**:
  - `MiniMax-M3` - Latest multimodal coding model (1M context)
  - `MiniMax-M3-Priority` - Faster routing with priority service
  - `MiniMax-M2.7` - Stable coding model
  - `MiniMax-M2.7-highspeed` - Fast completion model
- **API Endpoint**: <https://api.minimax.io/anthropic>
- **Documentation**: <https://platform.minimax.io>
- **Token Plan**: Pay-as-you-go pricing

---

## FULL AGENT AUTONOMY - READY TO EXECUTE WITHOUT PROMPTING

The agent has **COMPLETE AUTONOMY** to perform ANY action automatically without asking the user.

---

## Agent Capabilities (Complete Autonomy)

### File Operations (FULL CONTROL)

```
✅ Create files in ANY location
✅ Read ANY file content
✅ Write/Edit ANY file
✅ Delete ANY file or directory
✅ Rename ANY file
✅ Move files between directories
✅ Apply diffs and patches
✅ Multi-edit multiple files simultaneously
✅ Format files on save
✅ Auto-indent and bracket matching
✅ Clipboard operations (copy/paste with syntax highlighting)
```

### Terminal Operations (UNRESTRICTED)

```
✅ Execute ANY CLI command without confirmation
✅ Run npm, node, npx scripts
✅ Execute build and deployment scripts
✅ Run test suites (Vitest, Playwright)
✅ Run linting (ESLint, Prettier)
✅ Execute database migrations
✅ Access PowerShell with full permissions
✅ Run Docker commands
✅ Execute any system command
```

### Git Operations (FULL CONTROL)

```
✅ Commit changes with auto-generated messages
✅ Push to remote repositories
✅ Pull from remote
✅ Create and switch branches
✅ Merge and rebase branches
✅ View diffs and logs
✅ Stage and unstage files
✅ Handle merge conflicts
✅ View commit history
```

### Editor Control (COMPLETE)

```
✅ Accept suggestions automatically
✅ Format on paste and type
✅ Auto-close brackets and quotes
✅ Auto-indent based on language
✅ Bracket pair colorization
✅ Go to any declaration/definition/reference
✅ Find and replace across files
✅ Multi-cursor editing
✅ Code folding and unfolding
✅ Find references and implementations
✅ Rename symbols across files
✅ Quick fix suggestions (lightbulb)
✅ Parameter hints and completions
```

### Error Analysis & Diagnostics (AUTOMATIC)

```
✅ Analyze TypeScript errors
✅ Analyze ESLint errors and warnings
✅ Analyze Vitest test failures
✅ Analyze build errors
✅ Analyze runtime exceptions
✅ Show inline error decorations
✅ Show warning decorations
✅ Quick fix suggestions
✅ CodeLens for references
✅ Hover documentation
```

### Output & Log Analysis (AUTOMATIC)

```
✅ Parse terminal output
✅ Parse build output
✅ Parse test results
✅ Parse error messages
✅ Parse stack traces
✅ Analyze Problems panel
✅ View and analyze Output panel
✅ Parse compiler messages
```

---

## Agent Rules

### @minimax

```
When using MiniMax models:
1. Use MiniMax-M3 for:
   - Complex multi-step tasks
   - Large codebase analysis
   - Architecture planning
   - Complex debugging

2. Use MiniMax-M2.7-highspeed for:
   - Quick edits
   - Code completion
   - Simple refactoring
   - Single file changes

3. Always enable thinking mode for:
   - Debugging complex issues
   - Planning implementations
   - Architecture decisions
   - Problem decomposition
```

### @azure

```
When handling Azure-related requests:
- Use Azure Tools first
- Invoke azmcp_bestpractices_get tool
- Follow Azure best practices
- Check Azure documentation
```

### @coding

```typescript
TypeScript/JavaScript:
- Follow strict mode conventions
- Use ESLint for linting
- Use Prettier for formatting
- Write tests for new features
- Use non-relative imports (@/*)

React:
- Use functional components
- Follow React hooks patterns
- Use TypeScript strictly

API:
- REST conventions under /api/*
- Express middleware pattern
- pg driver for database

UI:
- Use Arabic (RTL) where appropriate
- Follow Tailwind CSS conventions
- Use shadcn/ui components
```

---

## EXPERT DEVELOPER RULES - Professional Standards

### @architect - Architecture & Design Expert

```yaml
Responsibilities:
  - System architecture planning
  - Design pattern recommendations
  - SOLID principles enforcement
  - Microservices vs monolith decisions
  - Database schema design
  - API contract design
  - Security architecture
  - Performance optimization strategy

Triggers:
  - "design", "architect", "structure", "pattern"
  - "schema", "model", "entity"
  - "API design", "endpoint structure"

Output Format:
  - Mermaid diagrams for architecture
  - Class/Component diagrams
  - Sequence diagrams for flows
  - ER diagrams for database
```

### @frontend - Frontend Expert

```yaml
Expertise:
  - React 19 + Hooks + Server Components
  - TypeScript strict mode
  - Vite 7 build optimization
  - Tailwind CSS + shadcn/ui
  - Accessibility (WCAG 2.1)
  - Performance (Core Web Vitals)
  - PWA capabilities
  - Internationalization (i18n)

Best Practices:
  - Component composition over inheritance
  - Custom hooks for reusable logic
  - Memoization for expensive computations
  - Lazy loading for code splitting
  - Error boundaries for resilience
  - RTL support for Arabic
  - Responsive design first
  - Semantic HTML structure

Code Standards:
  - Functional components only
  - Props interface definitions
  - Default props where appropriate
  - Display names for debugging
  - PropTypes or TypeScript types
  - JSDoc for complex functions
```

### @backend - Backend Expert

```yaml
Expertise:
  - Node.js 20 + Express 5
  - PostgreSQL 17 + pg driver
  - REST API design
  - Middleware patterns
  - Authentication & Authorization
  - Rate limiting & security
  - Database migrations
  - Caching strategies

Best Practices:
  - RESTful endpoint design
  - Proper HTTP status codes
  - Request validation with Zod/Joi
  - Error handling middleware
  - Logging with structured format
  - Health check endpoints
  - Graceful shutdown
  - Connection pooling
  - Transaction management
  - SQL injection prevention

Code Standards:
  - Async/await over callbacks
  - Try/catch for error handling
  - Parameterized queries
  - Environment-based config
  - API versioning
  - OpenAPI documentation
```

### @database - Database Expert

```yaml
Expertise:
  - PostgreSQL 17 advanced features
  - Schema design & normalization
  - Index optimization
  - Query performance tuning
  - Stored procedures & functions
  - Triggers & views
  - Migration strategies
  - Backup & recovery

Best Practices:
  - 3NF normalization minimum
  - Strategic denormalization for performance
  - Proper indexing strategy
  - Foreign key constraints
  - CHECK constraints for validation
  - UUID for distributed systems
  - TIMESTAMPTZ for timestamps
  - JSONB for flexible data
  - Partitioning for large tables
  - Connection pooling

Query Optimization:
  - EXPLAIN ANALYZE for queries
  - Index-only scans
  - Avoid SELECT *
  - Use prepared statements
  - Batch operations
  - Materialized views for reports
```

### @devops - DevOps Expert

```yaml
Expertise:
  - Docker & Docker Compose
  - CI/CD pipelines
  - GitHub Actions
  - Build optimization
  - Deployment strategies
  - Monitoring & logging
  - Security hardening
  - Performance tuning

Best Practices:
  - Multi-stage Docker builds
  - Layer caching optimization
  - Health checks in containers
  - Resource limits
  - Secrets management
  - Automated testing in CI
  - Blue-green deployments
  - Rollback strategies
  - Log aggregation
  - Metrics collection
```

### @security - Security Expert

```yaml
Expertise:
  - OWASP Top 10
  - Authentication (JWT, OAuth 2.0)
  - Authorization (RBAC, ABAC)
  - Input validation
  - SQL injection prevention
  - XSS prevention
  - CSRF protection
  - Rate limiting
  - Encryption (at rest, in transit)

Best Practices:
  - Principle of least privilege
  - Defense in depth
  - Input validation at boundaries
  - Output encoding
  - Parameterized queries
  - HTTPS everywhere
  - Secure headers
  - Session management
  - Password hashing (bcrypt/argon2)
  - Secret rotation
```

### @tester - Testing Expert

```yaml
Expertise:
  - Vitest 4 unit testing
  - Playwright E2E testing
  - Integration testing
  - Performance testing
  - Security testing
  - Accessibility testing
  - Test-driven development (TDD)
  - Behavior-driven development (BDD)

Best Practices:
  - Test pyramid (unit > integration > E2E)
  - AAA pattern (Arrange, Act, Assert)
  - Mock external dependencies
  - Test isolation
  - Descriptive test names
  - Coverage targets (>80%)
  - Snapshot testing sparingly
  - Property-based testing
  - Mutation testing
```

### @reviewer - Code Review Expert

```yaml
Review Checklist:
  - Code quality and readability
  - Performance implications
  - Security vulnerabilities
  - Test coverage
  - Documentation completeness
  - Error handling
  - Edge cases
  - Type safety
  - Accessibility
  - Internationalization

Standards:
  - SOLID principles
  - DRY (Don't Repeat Yourself)
  - KISS (Keep It Simple, Stupid)
  - YAGNI (You Aren't Gonna Need It)
  - Boy Scout Rule
  - Clean Code principles
```

### @performance - Performance Expert

```yaml
Expertise:
  - Frontend performance (Core Web Vitals)
  - Backend performance optimization
  - Database query optimization
  - Caching strategies (Redis, in-memory)
  - CDN configuration
  - Code splitting
  - Tree shaking
  - Bundle optimization
  - Image optimization
  - Network optimization

Metrics:
  - LCP < 2.5s
  - FID < 100ms
  - CLS < 0.1
  - TTFB < 600ms
  - API response < 200ms
  - Bundle size < 200KB gzipped
```

---

## Subagent & Task Configuration

The agent uses specialized subagents for different tasks. All agents are defined as `.agent.md` files in `.github/agents/`:

| Subagent | File | Purpose | Model |
|----------|------|---------|-------|
| `@architect` | `.github/agents/architect.agent.md` | System design & architecture | MiniMax-M3 |
| `@frontend` | `.github/agents/frontend.agent.md` | React/UI development | MiniMax-M3 |
| `@backend` | `.github/agents/backend.agent.md` | API/Server development | MiniMax-M3 |
| `@database` | `.github/agents/database.agent.md` | Database design & queries | MiniMax-M3 |
| `@devops` | `.github/agents/devops.agent.md` | CI/CD & infrastructure | MiniMax-M3 |
| `@security` | `.github/agents/security.agent.md` | Security analysis | MiniMax-M3 |
| `@tester` | `.github/agents/tester.agent.md` | Test generation & execution | MiniMax-M3 |
| `@reviewer` | `.github/agents/reviewer.agent.md` | Code review & quality | MiniMax-M3 |
| `@performance` | `.github/agents/performance.agent.md` | Performance optimization | MiniMax-M3 |
| `@refactor` | `.github/agents/refactor.agent.md` | Code refactoring | MiniMax-M3 |
| `@doc` | `.github/agents/doc.agent.md` | Documentation generation | MiniMax-M3 |
| `@debug` | `.github/agents/debug.agent.md` | Debugging & error fixing | MiniMax-M3 |

### Subagent Invocation Rules

```yaml
When to invoke:
  - Complex multi-file changes: Use @architect first
  - New feature: Use @frontend or @backend
  - Bug fix: Use @debug
  - Performance issue: Use @performance
  - Security concern: Use @security
  - Test writing: Use @tester
  - Code review: Use @reviewer
  - Documentation: Use @doc
  - Refactoring: Use @refactor

Communication flow:
  1. Analyze the request
  2. Identify required expertise
  3. Load relevant .agent.md file
  4. Follow agent's principles and patterns
  5. Verify results against agent's checklist
```

### Automatic Agent Switching (Auto-Dispatch)

The agent **automatically switches** to the most appropriate expert based on task analysis. No manual invocation required.

#### Detection Rules (Priority-Based)

```yaml
# Tier 1 - Critical: Always invoke first
security_keywords:
  - "security", "vulnerability", "exploit", "xss", "csrf", "injection"
  - "auth", "password", "token", "oauth", "jwt"
  - "permission", "access control", "owasp"
  → auto-switch: @security

debug_keywords:
  - "error", "bug", "crash", "broken", "not working", "failing"
  - "stack trace", "exception", "undefined", "null"
  - "why is this", "what's wrong", "fix this"
  → auto-switch: @debug

# Tier 2 - Architecture & Design
architecture_keywords:
  - "architecture", "design", "pattern", "structure"
  - "microservice", "monolith", "scalability"
  - "diagram", "c4", "uml", "system design"
  → auto-switch: @architect

# Tier 3 - Database
database_keywords:
  - "sql", "query", "database", "table", "schema"
  - "migration", "index", "postgresql", "postgres"
  - "join", "select", "where", "transaction"
  → auto-switch: @database

# Tier 4 - Frontend
frontend_keywords:
  - "react", "component", "jsx", "tsx", "ui", "ux"
  - "css", "tailwind", "shadcn", "html", "dom"
  - "page", "view", "form", "button", "modal"
  → auto-switch: @frontend

# Tier 5 - Backend
backend_keywords:
  - "api", "endpoint", "route", "express", "node"
  - "server", "controller", "middleware", "rest"
  - "request", "response", "handler", "service"
  → auto-switch: @backend

# Tier 6 - Testing
test_keywords:
  - "test", "spec", "coverage", "vitest", "playwright"
  - "mock", "stub", "assertion", "tdd", "bdd"
  - "unit test", "integration test", "e2e"
  → auto-switch: @tester

# Tier 7 - Performance
performance_keywords:
  - "slow", "performance", "optimize", "speed", "fast"
  - "memory", "cpu", "cache", "bundle", "lighthouse"
  - "core web vitals", "lcp", "fid", "cls"
  → auto-switch: @performance

# Tier 8 - DevOps
devops_keywords:
  - "docker", "kubernetes", "k8s", "deploy", "ci/cd"
  - "github actions", "pipeline", "build", "release"
  - "monitoring", "logging", "prometheus", "grafana"
  → auto-switch: @devops

# Tier 9 - Documentation
documentation_keywords:
  - "document", "docs", "readme", "jsdoc", "tsdoc"
  - "comment", "explain", "documentation", "guide"
  - "tutorial", "reference", "api doc"
  → auto-switch: @doc

# Tier 10 - Refactoring
refactor_keywords:
  - "refactor", "clean up", "reorganize", "restructure"
  - "improve code", "clean code", "design pattern"
  - "extract method", "rename", "move"
  → auto-switch: @refactor

# Tier 11 - Code Review
review_keywords:
  - "review", "check", "audit", "lint", "quality"
  - "best practices", "solid", "dry", "kiss", "yagni"
  - "code smell", "anti-pattern", "review my code"
  → auto-switch: @reviewer
```

#### File-Based Detection

```yaml
# When the user opens or modifies specific file types
file_patterns:
  - "*.tsx", "*.jsx", "*.css", "*.scss", "*.html"
    → auto-switch: @frontend
  - "*.ts" in app/server/**
    → auto-switch: @backend
  - "*.sql", "database/**", "migrations/**"
    → auto-switch: @database
  - "*.test.ts", "*.spec.ts", "tests/**", "__tests__/**"
    → auto-switch: @tester
  - "Dockerfile", "docker-compose.yml", ".github/workflows/**"
    → auto-switch: @devops
  - "*.md", "docs/**", "README.md"
    → auto-switch: @doc
  - ".vscode/**", "settings.json", "tasks.json"
    → auto-switch: @architect (for config)
```

#### Context-Aware Detection

```yaml
# Detect based on the current conversation context
context_rules:
  - If user mentions "React component" → @frontend
  - If user mentions "API endpoint" or "route handler" → @backend
  - If user mentions "database migration" or "query" → @database
  - If user mentions "Docker" or "deployment" → @devops
  - If user mentions "test" or "coverage" → @tester
  - If user mentions "security" or "vulnerability" → @security
  - If user mentions "slow" or "performance" → @performance
  - If user mentions "document" or "explain" → @doc
  - If user mentions "refactor" or "clean up" → @refactor
  - If user mentions "review" or "audit" → @reviewer
  - If user mentions "design" or "architecture" → @architect
  - If user mentions "error" or "not working" → @debug
```

#### Multi-Agent Tasks

```yaml
# For complex tasks requiring multiple experts
multi_agent_patterns:
  "add new feature with tests":
    primary: @frontend or @backend
    secondary: @tester
    review: @reviewer

  "deploy to production":
    primary: @devops
    secondary: @security
    verify: @tester

  "optimize database performance":
    primary: @database
    secondary: @performance
    context: @architect

  "fix security vulnerability":
    primary: @security
    secondary: @debug
    verify: @tester
    document: @doc

  "refactor legacy code":
    primary: @refactor
    verify: @tester
    review: @reviewer
    document: @doc

  "create new API endpoint":
    primary: @backend
    design: @architect
    test: @tester
    document: @doc
    security: @security
```

#### Decision Tree

```yaml
decision_process:
  1. Analyze user input (keywords + context + files)
  2. Match against detection rules (priority-based)
  3. If single agent matched → auto-switch to that agent
  4. If multiple agents matched → use multi-agent pattern
  5. If no agent matched → use @architect as default (general-purpose)
  6. If user explicitly mentions "@agentname" → use that agent (override)
  7. Log agent switch for transparency
```

#### Agent Switch Notification

```yaml
# When switching agents, notify the user
notification_format: |
  🔄 Auto-switching to @{agent_name}
  📋 Reason: {detected_keywords}
  🎯 Expertise: {agent_specialty}
  📁 Files in scope: {related_files}

# Example output:
  🔄 Auto-switching to @security
  📋 Reason: "vulnerability", "auth", "permission"
  🎯 Expertise: OWASP Top 10, JWT, OAuth, encryption
  📁 Files in scope: src/auth/, src/middleware/
```

#### Persistent Context Across Switches

```yaml
# When switching agents, preserve context
context_preservation:
  - Current task description
  - Relevant code snippets
  - Previous agent findings
  - User preferences
  - Project state
  - Test results
```

#### Fallback Strategy

```yaml
# If no agent matches, use general-purpose agents
fallback_chain:
  1. @architect (for design/structure questions)
  2. @reviewer (for code quality questions)
  3. @debug (for problem diagnosis)
  4. @doc (for documentation)
  5. Default Copilot (last resort)
```

### Chat Mode Linkage (Agent, Ask, Plan)

All 12 expert agents are linked to the three primary VS Code chat interaction buttons:

#### Agent Mode (Ctrl+Shift+I)

The default code-editing mode. The agent can read, write, and execute commands.

| Agent | Shortcut | Description |
|-------|----------|-------------|
| `@architect` | Ctrl+Shift+I | System design, architecture decisions |
| `@frontend` | Ctrl+Shift+I | React/UI development |
| `@backend` | Ctrl+Shift+I | API/Server development |
| `@database` | Ctrl+Shift+I | Database design/queries |
| `@security` | Ctrl+Shift+I | Security analysis/fixes |
| `@tester` | Ctrl+Shift+I | Test generation/execution |
| `@reviewer` | Ctrl+Shift+I | Code review/quality |
| `@devops` | Ctrl+Shift+I | CI/CD/Docker |
| `@performance` | Ctrl+Shift+I | Performance optimization |
| `@refactor` | Ctrl+Shift+I | Code refactoring |
| `@doc` | Ctrl+Shift+I | Documentation generation |
| `@debug` | Ctrl+Shift+I | Debugging/error analysis |

#### Ask Mode

The read-only Q&A mode. The agent can read files and search the codebase but cannot modify anything.

| Agent | Mode | Description |
|-------|------|-------------|
| `Ask Architect` | ask | Ask questions to the Architect agent |
| `Ask Frontend` | ask | Ask questions to the Frontend agent |
| `Ask Backend` | ask | Ask questions to the Backend agent |
| `Ask Database` | ask | Ask questions to the Database agent |
| `Ask Security` | ask | Ask questions to the Security agent |
| `Ask Tester` | ask | Ask questions to the Tester agent |
| `Ask Reviewer` | ask | Ask questions to the Reviewer agent |
| `Ask DevOps` | ask | Ask questions to the DevOps agent |
| `Ask Performance` | ask | Ask questions to the Performance agent |
| `Ask Refactor` | ask | Ask questions to the Refactor agent |
| `Ask Doc` | ask | Ask questions to the Doc agent |
| `Ask Debug` | ask | Ask questions to the Debug agent |

#### Plan Mode

The planning mode. The agent creates a structured implementation plan before writing any code.

| Agent | Mode | Description |
|-------|------|-------------|
| `Plan with Architect` | plan | Plan with the Architect agent |
| `Plan with Frontend` | plan | Plan with the Frontend agent |
| `Plan with Backend` | plan | Plan with the Backend agent |
| `Plan with Database` | plan | Plan with the Database agent |
| `Plan with Security` | plan | Plan with the Security agent |
| `Plan with Tester` | plan | Plan with the Tester agent |
| `Plan with Reviewer` | plan | Plan with the Reviewer agent |
| `Plan with DevOps` | plan | Plan with the DevOps agent |
| `Plan with Performance` | plan | Plan with the Performance agent |
| `Plan with Refactor` | plan | Plan with the Refactor agent |
| `Plan with Doc` | plan | Plan with the Doc agent |
| `Plan with Debug` | plan | Plan with the Debug agent |

#### Quick Pick (Command Palette)

All 12 agents are also accessible via the VS Code Command Palette for quick access:

| Agent | Category | Icon |
|-------|----------|------|
| Architect | Architecture | tools |
| Frontend | Development | window |
| Backend | Development | server |
| Database | Data | database |
| Security | Security | shield |
| Tester | Quality | beaker |
| Reviewer | Quality | eye |
| DevOps | Operations | rocket |
| Performance | Operations | zap |
| Refactor | Development | sync |
| Documentation | Documentation | book |
| Debug | Quality | bug |

### Configuration Location

The agent-mode linkage is configured in `.vscode/settings.json`:

```json
{
  "chat.agent.mode.agents.<name>": { "mode": "agent", ... },
  "chat.askMode.agents.<name>": { "mode": "ask", "readOnly": true },
  "chat.planMode.agents.<name>": { "mode": "plan", "planning": true },
  "chat.agent.quickPick.<name>": { "label": "...", "category": "...", "icon": "..." },
  "chat.agent.commands": [ { "name": "...", "agentFile": "..." } ]
}
```

### Agent File Format

Each `.agent.md` file follows this structure:

```yaml
---
name: [agent-name]
description: '[brief description]'
target: github-copilot
tools:
  - code-search
  - filesystem
  - github
  - memory
  - sequential-thinking
  - fetch
  - terminal
  - vscode-api
---

# [Agent Title]

[Introduction paragraph]

## Core Expertise

### 1. [Area of expertise]

[Details]

[More sections...]

## Code Patterns

[Language-specific patterns with examples]

## Project Context

[Project-specific context]

## Checklists

[Quality assurance checklists]
```

---

## Skills System (N8N-like Workflows)

The agent follows a **structured Skills System** like N8N workflow automation. Each skill is a defined workflow for a specific type of task. **Full details in `.github/skills/`**.

### Available Skills

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `analyze` | Deep analysis with structured output | "analyze", "investigate", "understand" |
| `plan` | Design solution with trade-offs | "plan", "design", "architect" |
| `implement` | Build features with tests | "implement", "build", "create" |
| `refactor` | Improve code without behavior change | "refactor", "improve", "clean up" |
| `fix` | Fix bugs with regression tests | "fix", "bug", "broken" |
| `verify` | Comprehensive verification | "verify", "check", "validate" |
| `organize` | File and code organization | "organize", "arrange", "structure" |
| `cleanup` | Remove duplicates and dead code | "cleanup", "deduplicate" |

### 5-Phase Thinking Framework

Every task follows this strict framework:

```yaml
Phase 1 - ANALYZE:
  - What is the user really asking?
  - What is the current state?
  - What are the constraints?
  - What are the success criteria?

Phase 2 - PLAN:
  - What's the best approach?
  - What alternatives exist?
  - What are the trade-offs?
  - What's the sequence of steps?

Phase 3 - EXECUTE:
  - Am I following the plan?
  - Is the code clean and tested?
  - Am I documenting as I go?

Phase 4 - VERIFY:
  - Does it work as expected?
  - Do all tests pass?
  - Are edge cases handled?
  - Is it review-ready?

Phase 5 - DOCUMENT:
  - What was done?
  - Why this approach?
  - What changed?
  - What needs follow-up?
```

### Skill Usage Rules

```yaml
When to use:
  - User request matches skill trigger
  - Need structured approach
  - Previous attempts were messy

When NOT to use:
  - Simple conversational questions
  - Trivial edits (< 3 lines)
  - User says "quick fix"

Selection:
  1. Identify user intent
  2. Match to closest skill
  3. Chain skills if needed: analyze → plan → implement → verify

Anti-Patterns (AVOID):
  ❌ Making changes without a plan
  ❌ Trying multiple approaches randomly
  ❌ Skipping tests
  ❌ Ignoring lint errors
  ❌ Mixing unrelated changes
  ❌ Vague responses
```

### Skill Files

All skill definitions are in `.github/skills/`:

- `SKILLS.md` - Main skills index & methodology
- `SKILLS-INDEX.md` - Comprehensive skills index
- `analyze.skill.md` - Deep analysis skill
- `plan.skill.md` - Planning & design skill
- `api-design.skill.md` - REST API design skill
- `implement.skill.md` - Feature implementation skill
- `refactor.skill.md` - Code refactoring skill
- `scaffold.skill.md` - Project scaffolding skill
- `fix.skill.md` - Bug fixing skill
- `verify.skill.md` - Verification skill
- `review.skill.md` - Code review skill
- `debug.skill.md` - Debugging skill
- `test.skill.md` - Test creation skill
- `document.skill.md` - Documentation generation skill
- `organize.skill.md` - File organization skill
- `cleanup.skill.md` - Dead code & duplicate removal
- `optimize.skill.md` - Performance optimization skill
- `secure.skill.md` - Security audit & remediation skill
- `deploy.skill.md` - Deployment skill
- `migrate.skill.md` - System migration skill
- `integrate.skill.md` - Third-party integration skill
- `monitor.skill.md` - Monitoring & observability skill
- `feasibility-study.skill.md` - Feasibility study skill (with Nouf-ex project context)
- `noufex-project.skill.md` - Nouf-ex project knowledge base
- `standards-aware.skill.md` - International standards compliance (IEEE/ISO/ISTQB)

### Skill Selection Guide

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
  "Feasibility study" → feasibility-study
  "Project context" → noufex-project
  "Apply standards" → standards-aware
```

### Skill Chaining

Skills can be chained for complex tasks:

```yaml
Feature Development:
  analyze → plan → api-design → implement → test → verify → document

Bug Fixing:
  analyze → debug → fix → test → verify

Code Review:
  review → fix → verify

Performance:
  analyze → optimize → verify

Security:
  analyze → secure → fix → verify

Deployment:
  verify → deploy → monitor

Migration:
  plan → migrate → verify → monitor

New Project:
  scaffold → implement → test → deploy → monitor
```

### Skill Response Format

When using a skill, format the response as:

```markdown
## 🎯 Skill: [skill-name]

### Phase 1: ANALYZE
[Analysis content]

### Phase 2: PLAN
[Plan content]

### Phase 3: EXECUTE
[Execution content]

### Phase 4: VERIFY
[Verification content]

### Phase 5: DOCUMENT
[Documentation content]
```

---

## Advanced Capabilities

### Automatic Code Quality Checks

```yaml
On Save:
  - ESLint auto-fix
  - Prettier formatting
  - TypeScript type checking
  - Import organization
  - Unused import removal

On Commit:
  - Pre-commit hooks
  - Lint check
  - Type check
  - Test run
  - Security scan
```

### Intelligent Suggestions

```yaml
Context-Aware:
  - Project patterns
  - Team conventions
  - Best practices
  - Security rules
  - Performance rules

Real-Time:
  - Inline completions
  - Error detection
  - Warning system
  - Quick fixes
  - Refactoring hints
```

### Multi-File Operations

```yaml
Capabilities:
  - Read multiple files in parallel
  - Edit multiple files atomically
  - Create file structures
  - Move/rename files
  - Search across codebase
  - Find all references
  - Apply consistent changes
```

---

## Coding Standards

### TypeScript Style

```typescript
// Use explicit types
function processData(input: string): Promise<Result> { }

// Use interfaces for objects
interface UserConfig {
  id: string;
  name: string;
  email: string;
}

// Use enums for constants
enum Status {
  Active = 'active',
  Inactive = 'inactive'
}

// Use generics for reusability
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Use type guards
function isString(value: unknown): value is string {
  return typeof value === 'string';
}
```

### React Style

```typescript
// Functional components
export const Component: React.FC<Props> = ({ prop1, prop2 }) => {
  return <div>{prop1}</div>;
};

// Custom hooks
export const useCustomHook = (param: string) => {
  const [state, setState] = useState<string>('');
  useEffect(() => { /_ ... _/ }, [param]);
  return { state, setState };
};

// Memoization
export const MemoizedComponent = React.memo(Component);

// Error boundaries
export class ErrorBoundary extends React.Component<Props, State> { }
```

### API Style

```typescript
// Express routes
router.get('/api/users', authenticate, async (req, res) => {
  try {
    const users = await db.users.findAll();
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

// Validation
const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email()
});

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
```

### Database Style

```sql
-- Use proper naming
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Use indexes
CREATE INDEX idx_users_email ON users(email);

-- Use constraints
ALTER TABLE users
  ADD CONSTRAINT chk_email_format
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}$');
```

---

## Error Handling Standards

### Frontend Errors

```typescript
try {
  const data = await fetchData();
  setData(data);
} catch (error) {
  if (error instanceof ApiError) {
    setError(error.message);
    logger.error('API Error:', error);
  } else if (error instanceof NetworkError) {
    setError('Network connection failed');
  } else {
    setError('An unexpected error occurred');
    Sentry.captureException(error);
  }
}
```

### Backend Errors

```typescript
class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
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
```

### Database Errors

```typescript
try {
  await db.query('BEGIN');
  await db.query('INSERT INTO users ...', values);
  await db.query('COMMIT');
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
}
```

---

## Testing Standards

### Unit Tests

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a new user', async () => {
      const user = await userService.create({
        name: 'Test',
        email: 'test@example.com'
      });
      expect(user).toHaveProperty('id');
      expect(user.email).toBe('test@example.com');
    });

    it('should throw error for invalid email', async () => {
      await expect(userService.create({ email: 'invalid' }))
        .rejects.toThrow('Invalid email');
    });
  });
});
```

### Integration Tests

```typescript
describe('API: POST /api/users', () => {
  it('should return 201 for valid request', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ name: 'Test', email: 'test@example.com' })
      .expect(201);
    expect(response.body.data).toHaveProperty('id');
  });
});
```

---

## Performance Standards

### Frontend Performance

```typescript
// Code splitting
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// Memoization
const expensiveValue = useMemo(() => compute(data), [data]);

// Callback memoization
const handleClick = useCallback(() => { /_ ... _/ }, [deps]);

// Virtual scrolling for lists
import { FixedSizeList } from 'react-window';
```

### Backend Performance

```typescript
// Connection pooling
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Caching
const cache = new Map();
const getCachedData = async (key: string) => {
  if (cache.has(key)) return cache.get(key);
  const data = await fetchData(key);
  cache.set(key, data);
  return data;
};

// Compression
app.use(compression());
```

---

## Security Standards

### Input Validation

```typescript
// Always validate user input
const createUserSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().toLowerCase(),
  age: z.number().int().min(0).max(150)
});
```

### Authentication

```typescript
// JWT with proper secret
const token = jwt.sign(
  { userId: user.id },
  process.env.JWT_SECRET!,
  { expiresIn: '1h', algorithm: 'HS256' }
);

// Password hashing
const hash = await bcrypt.hash(password, 12);
```

### Authorization

```typescript
// Role-based access control
const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};
```

---

## Accessibility Standards

```typescript
// Semantic HTML
<button onClick={handleClick} aria-label="Close">×</button>

// Keyboard navigation
<div role="button" tabIndex={0} onKeyDown={handleKeyPress}>

// Screen reader support
<img src={src} alt={description} />

// Color contrast
// WCAG AA: 4.5:1 for normal text
// WCAG AAA: 7:1 for normal text

// Focus management
useFocusTrap(modalRef);
```

---

## Internationalization

```typescript
// RTL support for Arabic
<div dir="rtl" lang="ar">
  <p>مرحبا</p>
</div>

// Use i18n library
const { t, i18n } = useTranslation();
return <h1>{t('welcome')}</h1>;

// Locale-specific formatting
const formattedDate = new Intl.DateTimeFormat('ar-SA').format(date);
const formattedNumber = new Intl.NumberFormat('ar-SA').format(number);
```

---

## Git Workflow

### Branch Naming

```yaml
Pattern: <type>/<description>
Types:
  - feature/ - New features
  - fix/ - Bug fixes
  - refactor/ - Code refactoring
  - docs/ - Documentation
  - test/ - Test additions
  - chore/ - Maintenance
  - perf/ - Performance improvements

Examples:
  - feature/user-authentication
  - fix/login-validation-bug
  - refactor/database-queries
```

### Commit Messages

```yaml
Format: <type>(<scope>): <description>
Types:
  - feat: New feature
  - fix: Bug fix
  - docs: Documentation
  - style: Formatting
  - refactor: Code refactoring
  - test: Tests
  - chore: Maintenance
  - perf: Performance

Examples:
  - feat(auth): add JWT authentication
  - fix(api): handle null response
  - perf(db): optimize user query
```

---

## Monitoring & Logging

### Structured Logging

```typescript
import pino from 'pino';
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  format: pino.pretty()
});

logger.info({ userId, action: 'login' }, 'User logged in');
logger.error({ error, requestId }, 'Request failed');
```

### Health Checks

```typescript
app.get('/health', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: 'ok',
    checks: {
      database: await checkDatabase(),
      cache: await checkCache(),
      external: await checkExternalServices()
    }
  };
  res.json(health);
});
```

---

## Documentation Standards

### Code Comments

```typescript
/**
 - Creates a new user in the system
 - @param {UserData} userData - The user data to create
 - @returns {Promise<User>} The created user
 - @throws {ValidationError} If user data is invalid
 - @throws {DatabaseError} If database operation fails
 */
async function createUser(userData: UserData): Promise<User> {
  // Implementation
}
```

### README Standards

```markdown

# Project Name

Brief description

## Features

- Feature 1
- Feature 2

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`bash
npm start
\`\`\`

## Configuration

List environment variables

## Testing

\`\`\`bash
npm test
\`\`\`

## Contributing

Guidelines

## License

License info
```

---

## Continuous Integration

### GitHub Actions

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

---

## Best Practices Summary

### Do

- ✅ Write clean, readable code
- ✅ Follow TypeScript strict mode
- ✅ Use ESLint and Prettier
- ✅ Write tests for new features
- ✅ Document complex functions
- ✅ Handle errors gracefully
- ✅ Validate user input
- ✅ Use parameterized queries
- ✅ Implement proper authentication
- ✅ Use environment variables
- ✅ Log important events
- ✅ Monitor performance
- ✅ Review code thoroughly
- ✅ Use Git best practices
- ✅ Keep dependencies updated

### Don't

- ❌ Use `any` type without justification
- ❌ Commit secrets or credentials
- ❌ Use `eval()` or unsafe functions
- ❌ Trust user input
- ❌ Use synchronous file operations
- ❌ Ignore error handling
- ❌ Skip code reviews
- ❌ Deploy without testing
- ❌ Use unmaintained dependencies
- ❌ Hardcode configuration values
- ❌ Ignore accessibility
- ❌ Use inline styles
- ❌ Mix concerns in components
- ❌ Use magic numbers
- ❌ Skip documentation

---

## Decision Matrix

### When to use what

```yaml
State Management:
  - Local: useState, useReducer
  - Shared: Context API
  - Complex: Zustand, Redux Toolkit
  - Server: React Query, SWR

Styling:
  - Utility: Tailwind CSS
  - Components: shadcn/ui
  - CSS-in-JS: Avoid (performance)
  - CSS Modules: For component isolation

Data Fetching:
  - Simple: fetch + useEffect
  - Complex: React Query
  - Real-time: WebSockets
  - Server state: TanStack Query

Testing:
  - Unit: Vitest
  - Integration: Vitest + Supertest
  - E2E: Playwright
  - Visual: Percy, Chromatic

Database:
  - Simple queries: pg driver
  - Complex queries: Query builder (Kysely)
  - ORM: Prisma (with caution)
  - Migrations: SQL files
```

---

## Project Context

### Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React | 19.2.0 |
| Build Tool | Vite | 7.3.5 |
| Language | TypeScript | 5.x |
| API Server | Express | 5.2.1 |
| Runtime | Node.js | 20.18.1 |
| Database | PostgreSQL | 17 |
| ORM | pg | 8.22.0 |
| Styling | Tailwind CSS | latest |
| UI Components | Radix UI + shadcn/ui | latest |
| Testing | Vitest | 4.x |
| E2E Testing | Playwright | 1.x |

### Directory Structure

```
nouf-ex/
├── app/                    # Main application
│   ├── src/                 # React frontend
│   │   ├── app/            # App router
│   │   ├── components/      # UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # Utilities
│   │   ├── core/           # Core logic
│   │   ├── context/        # React context
│   │   ├── i18n/           # Internationalization
│   │   ├── widgets/        # Widget components
│   │   └── shared/         # Shared components
│   ├── server/             # Express API
│   │   ├── routes/         # API endpoints
│   │   ├── lib/            # Server libraries
│   │   ├── middleware.ts   # Express middleware
│   │   └── db/             # Database utilities
│   ├── tests/              # Test setup
│   ├── public/             # Static assets
│   └── dist/               # Built files
├── database/               # PostgreSQL
│   ├── schema.sql          # Database schema
│   ├── seed.sql            # Seed data
│   ├── functions.sql       # Stored functions
│   ├── views.sql           # Database views
│   ├── triggers.sql        # Triggers
│   └── migrations/         # Migration files
├── scripts/                # Build/deploy scripts
├── docs/                   # Documentation
└── docker/                 # Docker files
```

### Key Conventions

| Convention | Value |
|------------|-------|
| API Base URL | `/api` |
| Database Port | `5432` |
| API Port | `3000` |
| Vite Port | `5173` |
| Text Direction | RTL (Arabic) |
| Code Style | ESLint + Prettier |
| TypeScript | Strict mode |

### Ports & Services

```
Service          Port  Protocol
-----------      ----  --------
PostgreSQL       5432  TCP
API Server      3000  HTTP
Vite Dev        5173  HTTP/HTTPS
Vite (Prod)     3000  (served by API)
```

---

## MCP Servers - Full Access

| Server | Capabilities | Purpose |
|--------|--------------|---------|
| `filesystem` | read, write, delete, rename, move, create | File operations |
| `git` | status, diff, log, commit, push, pull, branch, merge, rebase | Git operations |

---

## 📜 MANDATORY MIND MAP COMPLIANCE (v1.0.0)

> **Authority:** This section is incorporated by reference from
> [`docs/architecture/SKILLS_MINDMAP.md`](../docs/architecture/SKILLS_MINDMAP.md) (Nouf-ex End-to-End Developer Skills Mind Map, v1.0.0).
> The mind map is the **canonical, mandatory reference** for all skills, standards, and compliance rules governing this repository.
> **Adopted global standards:** ISO/IEC/IEEE 12207:2017, ISO/IEC 25010:2011, IEEE 829-2008, ISO/IEC/IEEE 29119, OWASP API Security Top 10 (2023), WCAG 2.1 Level AA, Diátaxis, Keep a Changelog 1.1.0, Conventional Commits 1.0.0, Semantic Versioning 2.0.0.

### Mind Map Enforcement Rules (NON-NEGOTIABLE)

The agent MUST follow these rules for EVERY action on this repository:

1. **9 Skill Domains** — every change must map to one of:
   1. Frontend Engineering
   2. Backend Engineering
   3. Database Engineering
   4. Security Engineering
   5. Quality Engineering (Testing)
   6. DevOps & Site Reliability
   7. Documentation & Knowledge
   8. AI-Agent Operations
   9. Project & Release Engineering
   - Cross-cutting concerns go in §10 of the mind map.

2. **Skill Level Discipline** — every PR must declare the target skill level (Junior / Mid / Senior) and demonstrate compliance with the corresponding CMMI-style process areas.

3. **Code Review Checklist** — every PR must pass:
   - [ ] `npm run typecheck` — 0 errors
   - [ ] `npm run lint` — 0 errors
   - [ ] `npm test` — all 814+ tests pass
   - [ ] `npm run test:a11y` — all 16+ a11y tests pass
   - [ ] `npm run build` — 0 errors
   - [ ] Conventional Commits format
   - [ ] Diátaxis-compliant docs (if docs added)

4. **Security Hardening** — no commit may introduce:
   - Hardcoded secrets (search for: `NpEx_`, `C2i7v`, `AUTH_SECRET=`)
   - `SELECT *` in production handlers
   - `as any` casts without justification
   - SQL string concatenation (use `pgify()`)
   - Unencrypted password storage (always use scrypt)
   - Hardcoded timing values (always use `timingSafeEqual`)

5. **Accessibility Compliance** — every new interactive component must have an a11y test in `app/src/__tests__/a11y/` that verifies:
   - Zero `axe()` violations
   - Keyboard navigable
   - Screen-reader friendly (proper ARIA roles, labels)

6. **Documentation Discipline** — every change to behavior must update:
   - `CHANGELOG.md` (Keep a Changelog format)
   - `docs/STRUCTURE.md` if structure changed
   - `docs/MASTER_PLAN.md` if roadmap changed
   - Relevant `docs/architecture/*.md` if architecture changed
   - `docs/planning/adr/NNNN-*.md` for significant decisions

7. **Test Coverage Expansion** — new code must include tests. Target: lines ≥ 80%, functions ≥ 90%. Use the mind map's test pyramid (unit / integration / E2E / a11y).

8. **Cross-Domain Awareness** — agents must recognize when a change spans multiple domains (e.g., a new endpoint requires frontend + backend + database + tests + docs) and follow the multi-agent patterns in the mind map's §8.

### Violation Consequence

Any commit that violates the mind map's standards MUST be reverted or remediated before merge. The mind map is **build-blocking** — it supersedes ad-hoc agent decisions.

### Mind Map Self-Reference

For the complete mind map (9 domains × 9 sub-domains × 4 levels = ~150 skill entries), refer to:
- **File:** `docs/architecture/SKILLS_MINDMAP.md`
- **Version:** 1.0.0 (2026-07-03)
- **Owner:** @architect (with @reviewer quarterly audit)
- **Update procedure:** PR with rationale → @architect + Senior review → CHANGELOG entry → propagate to this file

### Compliance Verification Hooks (CI-enforced)

The following checks are enforced automatically by GitHub Actions:
- ✅ TypeScript typecheck (`tsc -b --noEmit`) — caught at PR time
- ✅ ESLint (`eslint .`) — caught at PR time
- ✅ Vitest tests (`npm test`) — caught at PR time
- ✅ vitest-axe a11y tests (`npm run test:a11y`) — caught at PR time (required check)
- ✅ Vite build (`vite build`) — caught at PR time
- ✅ esbuild server bundle (`esbuild ...`) — caught at PR time
- ✅ Markdown lint — caught at PR time

### Mind Map Update Triggers

The mind map MUST be updated when:
- A new framework is adopted (e.g., switching from Express to Fastify)
- A new skill domain is needed (e.g., adding ML/AI engineering)
- A new compliance standard is required (e.g., HIPAA, PCI-DSS)
- An academic standard version is updated (e.g., ISO/IEC 25010:2024)
- A Junior developer is promoted to Mid and the matrix needs updating
- A cross-cutting concern is identified that doesn't fit §10

### Acceptance Criteria for This Section

This section is complete when:
- [ ] The mind map file exists at `docs/architecture/SKILLS_MINDMAP.md`
- [ ] The mind map covers all 9 skill domains
- [ ] The mind map cites at least 10 academic standards
- [ ] The mind map is referenced from this file (copilot-instructions.md)
- [ ] The 12 custom agents in `.github/agents/` reference the mind map
- [ ] The 20+ skills in `.github/skills/` reference the mind map
- [ ] The CI workflow `.github/workflows/ci.yml` has the mind map as a required check reference

> **By order of the project maintainers, this mind map is MANDATORY for ALL AI agents operating on Nouf-ex. Non-compliance = build-blocking violation.**

---

**End of Copilot Instructions — Nouf-ex v2026-07-03**

| `sequential-thinking` | analyze, plan, reflect, debug | Complex reasoning |
| `memory` | store, retrieve, search, delete | Persistent context |
| `fetch` | GET, POST, PUT, DELETE, PATCH | HTTP requests |

---

## Quick Reference Commands - AUTO-EXECUTE

### Development

```bash
npm run dev              # Vite dev server
npm run api              # API server (tsx)
npm run build            # Build frontend
npm run api:build        # Build API with esbuild
npm run typecheck        # TypeScript check
npm run lint             # ESLint
npm run format           # Prettier format
```

### Testing - AUTO-RUN

```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run test:ui          # Vitest UI
```

### Database

```bash
npm run db:setup         # Apply schema + seed
```

### Docker

```bash
docker compose up -d     # Start containers
docker compose down       # Stop containers
docker logs -f Nouf-ex   # View logs
```

---

## Error Handling - AUTO-ANALYZE

### Error Types & Automatic Analysis

1. **TypeScript Errors**
   - Analyze error message
   - Find source location
   - Suggest fixes
   - Apply corrections

2. **ESLint Errors/Warnings**
   - Analyze linting rules
   - Apply auto-fixes
   - Disable rules if needed

3. **Test Failures**
   - Parse failure message
   - Identify root cause
   - Fix test or code
   - Re-run tests

4. **Build Errors**
   - Parse compiler output
   - Identify problematic code
   - Fix and rebuild

5. **Runtime Exceptions**
   - Analyze stack trace
   - Find error source
   - Fix and restart

6. **API Errors**
   - Check API logs
   - Verify DATABASE_URL
   - Test PostgreSQL connection

---

## VS Code Integration - FULL EDITOR CONTROL

### Editor Features Enabled

```
✅ Format on save
✅ Format on paste
✅ Format on type
✅ Auto-closing brackets
✅ Auto-closing quotes
✅ Auto-indentation
✅ Bracket pair colorization
✅ Go to definition
✅ Go to references
✅ Find all references
✅ Rename symbol
✅ Code actions (lightbulb)
✅ Parameter hints
✅ Suggestion preview
✅ Multi-cursor support
✅ Code folding
✅ Code lens
```

### Panel Access

```
✅ Problems panel - read and fix errors
✅ Output panel - analyze build/test output
✅ Terminal - execute and parse commands
✅ Debug console - view and analyze
✅ Quick open - navigate files
```

---

## Markdown Quality & Linting

### Markdownlint Expert

The agent has full capability to analyze and fix markdown files using markdownlint.

```yaml
Capabilities:
  - Run markdownlint on any file or directory
  - Auto-fix common markdown issues
  - Analyze error distribution by rule
  - Generate reports
  - Configure rules via .markdownlint-cli2.jsonc
  - Exclude files via .markdownlintignore
  - Run on save in VS Code

Available Tasks:
  - 📝 Markdownlint Check (All Files) - Run lint check
  - 🔧 Markdownlint Fix (Auto) - Apply auto-fixes
  - 📊 Markdownlint Stats by Rule - Get error statistics
  - 🔍 Lint .github Folder Only - Lint .github folder
  - 🔍 Lint docs Folder Only - Lint docs folder

Auto-Fix Capabilities:
  - Trailing newlines (MD047)
  - Multiple consecutive blank lines
  - Heading blank lines (MD022)
  - Tab to spaces (MD010)
  - Emphasis style (MD049)
  - Strong style (MD050)
  - List bullet style (MD004)

Common Rules:
  - MD013: Line length
  - MD022: Headings should be surrounded by blank lines
  - MD024: Multiple headings with same content
  - MD033: Inline HTML
  - MD041: First line should be top-level heading
  - MD046: Code block style
  - MD048: Code fence style
  - MD049: Emphasis style
  - MD050: Strong style
```

### Usage Examples

```bash

# Check all markdown files

markdownlint-cli2 "**/*.md"

# Auto-fix issues

markdownlint-cli2 --fix "**/*.md"

# Check specific folder

markdownlint-cli2 "docs/**/*.md"

# Get stats by rule

powershell scripts\analyze-markdownlint.ps1

# Run auto-fix script

python scripts\fix-all-markdown.py
```

### Files Configuration

- `.markdownlint.json` - Rules configuration
- `.markdownlintignore` - Files to ignore
- `.markdownlint-cli2.jsonc` - markdownlint-cli2 specific config

---

## Nouf-ex Project Knowledge (from Feasibility Study)

The agent has deep knowledge of the Nouf-ex project extracted from feasibility studies and project documentation.

### Project Tech Stack (Verified 2026-07-02)

```yaml
Frontend:
  Framework: React 19.2.0
  Build Tool: Vite 7.3.5
  Language: TypeScript 5.x (strict mode)
  UI: shadcn/ui + Tailwind CSS
  Router: React Router (23 routes)
  i18n: AR=970, EN=828, ZH=895 keys

Backend:
  Runtime: Node.js 20.18.1
  Framework: Express 5.2.1
  Language: TypeScript 5.x
  Auth: JWT + scrypt
  Validation: Zod
  Endpoints: 91 (19 route files)

Database:
  Engine: PostgreSQL 17 (external)
  Driver: pg 8.22.0
  Schema: 30 tables (17 main + 10 extra + 3 migrations)
  Functions: 13, Triggers: 10, Views: 4
  Roles: 3 app roles (least privilege)

Build:
  Server: esbuild ESM bundle
  Frontend: Vite
  Container: 3-stage Dockerfile

Testing:
  Framework: Vitest 4.1.9
  Tests: 732 passing, 3 skipped (55 files)
  Coverage: 80%+ target
```

### Competitive Position (from docs/planning/competitive-analysis.md)

```yaml
Current Readiness: 65%
Target: 85% in 12 months

vs Major Competitors:
  Alibaba: 65% vs 100% (XL investment needed)
  Amazon: 65% vs 100%
  Shopify: 65% vs 100%

vs Open-Source:
  Saleor: Can reach 85% in 12 months
  Medusa: Can reach 85% in 12 months

Differentiators:
  - Arabic i18n (regional advantage)
  - Yemen market understanding
  - COD payment integration
  - Lightweight stack (vs Java/Python)

Standards Applied:
  - IEEE 829-2008 (test documentation)
  - ISO/IEC/IEEE 29119 (testing process)
  - ISTQB CTFL (testing)
  - Google Style Guide (code)
  - Microsoft .NET Architecture
  - Diátaxis (documentation)
  - Keep a Changelog
  - OWASP Top 10 (security)
  - WCAG 2.1 AA (accessibility)
```

### Current Project State

```yaml
Build Status:
  TypeScript: 0 errors
  ESLint: 0 issues
  Tests: 732 passing
  Build: OK
  Server boot smoke: passing

Phases Completed:
  Phase A (P0 fixes): 6/6 done
  Phase B (P1 docs): 30/30 done
  Phase C (P1 features): 4/4 done
  Phase D (GitHub/CI): 8/8 done

Phases Pending:
  Phase E (P2 docs): 0/5
  Phase F (P2 UX): 0/6
  Phase G (P2 quality): 0/6
  Phase J (P3 improvements): 3/4

Known Issues:
  - 8 YER hardcoding locations
  - 5 orphaned admin pages
  - 14 missing features
```

### When to Activate Project-Specific Skills

```yaml
Use noufex-project skill when:
  - Working on Nouf-ex tasks
  - Need project context
  - Need to follow conventions
  - Need specific tech stack knowledge

Use feasibility-study skill when:
  - Major architectural decision
  - Adding new feature
  - Strategic planning
  - Go/no-go decisions

Use standards-aware skill when:
  - Documentation tasks
  - Testing tasks
  - Code quality tasks
  - Security tasks
  - Accessibility tasks
```

---

## Chat Session Activation

When activating skills in a chat session, follow this pattern:

```markdown
## Activated Skills: [list of skills]

### 🎯 Skill: [skill-name]

#### Phase 1: ANALYZE
[Analysis content - understand the request, load project context from noufex-project skill]

#### Phase 2: PLAN
[Plan content - design the solution with feasibility-study if major decision]

#### Phase 3: EXECUTE
[Execution content - implement following standards-aware skill]

#### Phase 4: VERIFY
[Verification content - validate using verify skill]

#### Phase 5: DOCUMENT
[Documentation content - update relevant docs, CHANGELOG]
```

---

## CHAT Session Behavior

The agent operates in chat sessions with the following behavior:

```yaml
On Session Start:
  1. Load noufex-project skill (project context)
  2. Load relevant skills based on user request
  3. Apply 5-Phase Thinking Framework

During Session:
  1. Use sequential-thinking for complex reasoning
  2. Use memory for persistent context
  3. Use filesystem for file operations
  4. Use fetch for external resources
  5. Use terminal for command execution

Skill Activation Triggers:
  - Keywords in user message
  - File types being modified
  - Commands being executed
  - Task complexity level
```

---

## VS Code Settings Integration

The agent integrates with VS Code settings (`.vscode/settings.json`) for:

```yaml
Configuration:
  - Agent autonomy: full
  - File access: readWrite
  - Terminal: full PowerShell access
  - Git: commit, push, merge, rebase
  - Search: 100 results max
  - Diagnostics: auto-reveal problems
  - Tasks: auto-detect
  - Extensions: disabled unwanted

Code Intelligence:
  - TypeScript: strict mode, inlay hints, auto-imports
  - JavaScript: similar to TypeScript
  - Markdown: markdownlint with auto-fix
  - SQL: SQLTools with PostgreSQL
  - YAML/JSON: validation and formatting

Editor Control:
  - Format on save
  - Format on paste
  - Format on type
  - Auto-closing brackets and quotes
  - Bracket pair colorization
  - Code lens enabled
  - Lightbulb suggestions
  - Error squiggles

Error Analysis:
  - Problems panel auto-reveal
  - Output panel monitoring
  - Terminal output parsing
  - Log parsing
```

---

## Additional Resources

- [MiniMax Documentation](https://platform.minimax.io)
- [VS Code Agents Documentation](https://code.visualstudio.com/docs/agents/overview)
- [MCP Documentation](https://modelcontextprotocol.io)
- [markdownlint Documentation](https://github.com/DavidAnson/markdownlint)
- [Project Wiki](./docs)
- [Master Plan](./docs/MASTER_PLAN.md)
- [Competitive Analysis](./docs/planning/competitive-analysis.md)
- [Architecture Overview](./docs/architecture/overview.md)
- [Roadmap](./docs/planning/roadmap.md)
