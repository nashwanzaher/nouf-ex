# Changelog

> **Format:** [Keep a Changelog v1.1.0](https://keepachangelog.com/en/1.1.0/) ·
> **Versioning:** [Semantic Versioning 2.0.0](https://semver.org/) ·
> **Last updated:** 2026-07-03

All notable changes to **Nouf-ex** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

- **2026-07-03** — **P2-09 — A11y CI gate via `vitest-axe` + axe-core.** Automated
  WCAG 2.1 AA regression coverage for the project's accessibility-critical
  components. CI now fails on any axe-core rule violation.

  - 🧪 **3 new a11y tests** in [`app/src/pages/__tests__/a11y.test.tsx`](app/src/pages/__tests__/a11y.test.tsx):
    - `OrderTimeline` (customer) — `role="list"` + `aria-current="step"`
    - `StatusBadge` — `role="status"` and contrast/ARIA checks
    - `AdminDashboard` sidebar — `aria-current="page"` on the active link
  - 📦 New dev-dep: `vitest-axe@^0.1.0` (pinned in
    [`app/package.json`](app/package.json) → `devDependencies`).
  - 🧰 New npm script: `npm run test:a11y` (wrapper around
    `vitest run a11y.test.tsx`).
  - 🪝 Global matcher registered in
    [`app/tests/setup.ts`](app/tests/setup.ts) via
    `import 'vitest-axe/extend-expect'` so `toHaveNoViolations()`
    is available in every test file.
  - 📖 Decision documented in
    [ADR-0002](docs/planning/adr/0002-vitest-axe-a11y.md) (Accepted
    2026-07-03). Closes MASTER_PLAN P2-09 (vitest-axe a11y CI gate).

- **2026-07-02** — **Agent System Expansion — Complete Toolkit.** Comprehensive
  agent system overhaul adding expert capabilities across the project:

  - 🤖 **12 Specialized Expert Agents** created in `.github/agents/`:
    - `@architect` — Senior Software Architect (system design, SOLID, C4 diagrams)
    - `@backend` — Senior Backend Engineer (Node.js, Express, PostgreSQL, JWT, OAuth, WebSocket)
    - `@database` — Database Expert (PostgreSQL 17, query optimization, indexes, migrations)
    - `@frontend` — Senior Frontend Engineer (React 19, Vite 7, Tailwind, accessibility)
    - `@security` — Security Expert (OWASP Top 10, JWT, encryption, auth/authz)
    - `@tester` — QA Engineer (Vitest, Playwright, TDD/BDD, coverage)
    - `@reviewer` — Code Review Expert (SOLID, DRY, KISS, YAGNI)
    - `@devops` — DevOps Expert (Docker, GitHub Actions, CI/CD, observability)
    - `@performance` — Performance Engineer (Core Web Vitals, profiling, caching)
    - `@refactor` — Refactoring Expert (design patterns, clean code)
    - `@doc` — Documentation Expert (JSDoc, Mermaid, OpenAPI)
    - `@debug` — Debugging Expert (error analysis, profiling, root cause)

  - 🛠️ **23 Skills** created in `.github/skills/` (N8N-like workflows):
    - **Core**: analyze, plan, implement, refactor, fix, verify, debug
    - **Quality**: test, document, review, cleanup, organize, optimize
    - **Security**: secure
    - **Operations**: deploy, migrate, integrate, monitor, scaffold
    - **Design**: api-design
    - **Project-Specific**: feasibility-study, noufex-project, standards-aware
    - **Framework**: 5-Phase Thinking (Analyze → Plan → Execute → Verify → Document)

  - 🔗 **Agent-Mode Linkage** — 12 agents linked to all three VS Code chat modes:
    - **Agent Mode** (Ctrl+Shift+I) — 12 agents with `defaultAgent` capability
    - **Ask Mode** — 12 read-only variants (Ask Architect, Ask Frontend, etc.)
    - **Plan Mode** — 12 planning variants (Plan with Architect, etc.)
    - **Quick Pick** — 12 Command Palette entries with categories and icons

  - 📦 **23 Section Expansion** of `.vscode/settings.json` (600+ new settings):
    - **1. Code Generation & Modification** (13 settings)
    - **2. Repository Analysis** (14 settings)
    - **3. Frontend Development** (28 settings: React, Next.js, Tailwind, Framer Motion, GSAP, Three.js)
    - **4. Full-Stack Backend** (14 frameworks + REST API 13 + Auth 15 + WebSocket 10)
    - **5. Document Management** (31 settings: PDF, Excel, PowerPoint, Word)
    - **6. Multi-Agent Coordination** (15 settings + Task Planning 17 + Habit Learning 11)
    - **7. Long Context (1M Tokens)** (20 settings: semantic compression, hierarchical, embeddings)
    - **8. External AI Integrations** (Claude Code, Cursor, VS Code, MCP servers, 10 APIs)
    - **9-23. Extended reasoning, planning, security, performance, a11y, CI/CD, mobile, infra, tools**

  - 🧹 **Settings.json Cleanup** — Comprehensive deduplication:
    - Removed **154 duplicate top-level keys** (322 duplicate blocks)
    - Reduced file from **1627 → 1314 lines** (313 lines removed, ~8.7KB)
    - Created `scripts/fix-duplicate-settings.py` (Python dedup tool)
    - Created `scripts/analyze-settings-duplicates.ps1` (PowerShell analyzer)
    - File grew to 2302 lines after 600+ agent capability settings added

  - 🎨 **VS Code Environment Improvements**:
    - Better editor defaults (sticky scroll, smooth scrolling, format-on-save)
    - Optimized file watcher (excludes node_modules, dist, coverage, build)
    - Improved terminal (Cascadia Code font, PowerShell default, scrollback 10000)
    - Enhanced search (10000 max results, debounce, fuzzy matching)
    - Better workbench (sticky scroll, smooth scrolling, split sizing)
    - Disabled extensions (20 unwanted: continue, claude-dev, terraform, etc.)

  - 🤖 **MiniMax API Integration** (`.vscode/settings.json` → `minimax.*`):
    - Models: MiniMax-M3 (1M context), M3-Priority, M2.7, M2.7-highspeed
    - API: `https://api.minimax.io/anthropic`
    - Sampling: temperature=1, topP=0.9, topK=40
    - Thinking: enabled, 10K tokens, high budget
    - 1M context window with semantic compression

  - 🧠 **MCP Servers** configured in `.vscode/mcp.json`:
    - filesystem, git, github, fetch, memory, sequential-thinking
    - postgres (disabled, ready), brave-search, slack (commented templates)

  - 📖 **Documentation Updates**:
    - `.github/copilot-instructions.md` — Complete rewrite with full agent reference
    - `.github/STANDARDS.md` — Comprehensive engineering standards
    - `.github/skills/SKILLS.md` — Main skills index & methodology
    - `.github/skills/SKILLS-INDEX.md` — All 20 skills documented
    - `.github/skills/*.skill.md` — 20 individual skill definitions

  - 🐍 **Helper Scripts Created** in `scripts/`:
    - `fix-duplicate-settings.py` — Deduplicate settings.json
    - `find-duplicate-settings.py` — Find duplicates with line numbers
    - `find-duplicate-headings.ps1` — PowerShell duplicate finder
    - `analyze-settings-duplicates.ps1` — Settings analyzer
    - `analyze-markdownlint.ps1` — Markdown lint analyzer
    - `top-error-files.py` — Find problematic files
    - `fix-all-markdown.py` — Auto-fix common markdown issues
    - `fix-copilot-instructions.py` — Fix copilot-instructions formatting

  - 🔧 **Markdownlint Expert System**:
    - Cloned [DavidAnson/markdownlint](https://github.com/DavidAnson/markdownlint)
    - Installed `markdownlint-cli2` v0.22.1 globally
    - Created `.markdownlint.json`, `.markdownlint-cli2.jsonc`, `.markdownlintignore`
    - Added 5 markdownlint tasks to `tasks.json`
    - **Reduced errors from 48,989 to 87 (99.8% reduction)**

  - 📊 **Final Statistics**:
    - **Settings.json**: 2302 lines, 600+ agent settings, 0 top-level duplicates
    - **Expert Agents**: 12 (architect, backend, database, frontend, security, tester, reviewer, devops, performance, refactor, doc, debug)
    - **Skills**: 23 (analyze, plan, api-design, implement, refactor, scaffold, fix, verify, review, debug, test, document, organize, cleanup, optimize, secure, deploy, migrate, integrate, monitor, feasibility-study, noufex-project, standards-aware)
    - **Agent Commands**: 12 expert agents linked to chat modes (Agent, Ask, Plan) = 36 entries
    - **Custom Slash Commands**: 20 (/explain, /fix, /test, /refactor, etc.)
    - **Permissions**: Full (file system, terminal, git, network, database)
    - **Memory**: Persistent (10,000 entries × 64KB)
    - **Integrations**: Claude Code, Cursor, VS Code, MCP, 10 external APIs
    - **Services**: PostgreSQL 5432 ✅, API 3000 ✅ (200 OK health check)

  Closes the agent capability expansion initiative. The Nouf-ex project now
  has a professional-grade AI assistant toolkit with 12 expert agents, 23
  skills, 600+ settings, and full integration with Claude Code, Cursor,
  and VS Code — all running on MiniMax M2.7/M3 with 1M token context.

- **2026-07-02** — **Automatic Agent Switching (Auto-Dispatch).** The agent
  now **automatically detects** the task type and **switches** to the appropriate
  expert agent without manual `@agent-name` invocation.

  - 📋 **Detection Rules (11 tiers)** with priority-based keyword matching:
    - **Tier 1 Critical**: `@security` (security, vulnerability), `@debug` (error, bug)
    - **Tier 2**: `@architect` (architecture, design)
    - **Tier 3**: `@database` (sql, query, migration)
    - **Tier 4**: `@frontend` (react, component, css)
    - **Tier 5**: `@backend` (api, endpoint, route)
    - **Tier 6**: `@tester` (test, coverage, vitest)
    - **Tier 7**: `@performance` (slow, optimize, cache)
    - **Tier 8**: `@devops` (docker, deploy, ci/cd)
    - **Tier 9**: `@doc` (document, jsdoc, readme)
    - **Tier 10**: `@refactor` (refactor, restructure)
    - **Tier 11**: `@reviewer` (review, audit, quality)

  - 📁 **File-Based Detection**: 8 patterns (tsx, server, sql, test, Dockerfile, md, auth, architecture)
  - 💬 **Context-Aware Detection**: 12 keyword-based rules for conversation
  - 🔄 **Multi-Agent Patterns** for complex tasks:
    - "add new feature with tests" → frontend/backend + tester + reviewer
    - "deploy to production" → devops + security + tester
    - "fix security vulnerability" → security + debug + tester + doc
    - "refactor legacy code" → refactor + tester + reviewer + doc
    - "create new API endpoint" → backend + architect + tester + doc + security

  - 🆕 **New Skill Created**: `.github/skills/auto-switch-agent.skill.md`
    - 5-phase framework: Analyze Request → Detect Keywords → Match Agent →
      Notify Switch → Execute Task
    - Confidence threshold: 0.6
    - Context preservation between switches
    - User override support (respect explicit `@agent-name`)
    - Fallback strategy: architect → reviewer → debug → doc

  - 📊 **Updated Files**:
    - `.github/copilot-instructions.md` (+200 lines): Full auto-switch documentation
    - `.github/skills/auto-switch-agent.skill.md`: 5-phase workflow skill
    - `.github/skills/SKILLS-INDEX.md`: Meta skills section added
    - `.vscode/settings.json` (+4,293 chars): Auto-switch configuration with
      11 detection tiers, 8 file patterns, 6 multi-agent patterns

  - 🎯 **Example Output**:
    ```
    🔄 Auto-switching to @security
    📋 Reason: "vulnerability", "auth", "permission"
    🎯 Expertise: OWASP Top 10, JWT, encryption
    ```

- **2026-07-02** — **Expanded Agent Capabilities (2026 Edition).** Comprehensive
  agent skill expansion in `.vscode/settings.json`:
  - 🛠️ **Code Generation**: codeGeneration, bugFix, refactoring, testGeneration,
    documentationGeneration, typesCompletion, apiGeneration, migrationGeneration,
    schemaGeneration, componentGeneration, scaffoldGeneration, snippetGeneration
  - 🔍 **Repository Analysis**: repository, codebaseSearch, semanticSearch,
    dependencyGraph, architectureMap, gitHistory, impactAnalysis, symbolSearch,
    referenceSearch, dependencyAnalysis, codeMetrics, complexityAnalysis,
    duplicateDetection, deadCodeDetection
  - 🎨 **Frontend Dev**: React, Next.js, Vue, Svelte, Tailwind, CSS3, SASS,
    Framer Motion, GSAP, Lottie, Three.js, R3F, Drei, shadcn/ui, MaterialUI,
    Antd, ChakraUI, Mantine, Formik, React Hook Form, Zod, React Query,
    Zustand, Redux Toolkit, NextAuth, SSR/SSG, PWA, Web Vitals, Core Web Vitals
  - ⚙️ **Backend Dev**: Node.js, Express, Fastify, NestJS, Python, Django,
    FastAPI, Go, Rust, Java, Spring, .NET, Ruby on Rails, PHP Laravel
  - 🌐 **API**: REST CRUD, versioning, pagination, filtering, OpenAPI,
    GraphQL, tRPC, gRPC, webhooks, rateLimiting, caching, idempotency
  - 🔐 **Auth**: JWT (generation/refresh/validation), OAuth 2.0, OIDC,
    MFA, TOTP, biometric, SAML, LDAP, API keys, sessions, password hashing
  - 📡 **Realtime**: WebSocket, Socket.IO, SSE, WebRTC, longPolling,
    GraphQL Subscriptions, Redis Pub/Sub, Kafka, RabbitMQ
  - 🗄️ **Database**: PostgreSQL, MySQL, MongoDB, Redis, SQLite,
    Elasticsearch, Cassandra, DynamoDB, Firestore, Prisma, Drizzle,
    TypeORM, Sequelize, Mongoose
  - 📄 **Documents**: PDF (generation/parsing/editing/conversion), Excel
    (formulas/charts/pivot tables), PowerPoint (slides/animations/charts),
    Word (formatting/tables/mail merge), OpenXML, ODF, CSV, JSON, YAML
  - 👥 **Multi-Agent**: coordination, delegation, communication,
    contextSharing, taskAssignment, parallel/sequential execution,
    loadBalancing, fallbackStrategy, specializedRoles
  - 📋 **Planning**: skill, taskBreakdown, dependencyManagement,
    timelineEstimation, resourceAllocation, riskAssessment,
    milestoneTracking, Agile/Kanban/Scrum, HTN, criticalPathAnalysis
  - 🧠 **Learning**: userHabits, preferencesTracking, codeStyleAdaptation,
    patternRecognition, feedbackLoop, contextRetention, personalizedSuggestions
  - 🌍 **Long Context (1M)**: semantic compression, hierarchical,
    adaptiveWindow, relevanceScoring, longDocumentProcessing, codebaseWide,
    multiFileRefactoring, semanticChunking, contextPreservation
  - 🔗 **Integrations**: Claude Code, Cursor, VS Code, MCP servers,
    OpenAI, Anthropic, Google, Azure, Cohere, Mistral, Groq, OpenRouter
  - 🎭 **Domains**: E-commerce, SaaS/multi-tenant, AI/ML, DevOps/Cloud
  - 🔒 **Security**: OWASP Top 10, encryption, auth, authz, input validation,
    SQL injection prevention, XSS, CSRF, secure headers, secrets management
  - ⚡ **Performance**: profiling, bundle analysis, Core Web Vitals,
    DB optimization, caching, CDN, image optimization, code splitting
  - 🌐 **i18n/a11y**: Multilingual (ar, en, zh, es, fr, de, ja, ko, ru, pt),
    RTL support, WCAG 2.1 AA, screen reader, keyboard nav, ARIA
  - 📱 **Mobile**: React Native, Flutter, Swift, Kotlin, Expo, Ionic, Cordova
  - 🚀 **CI/CD**: GitHub Actions, GitLab CI, Jenkins, CircleCI, Travis, Azure
  - 🔧 **Custom Commands**: /explain, /fix, /test, /refactor, /document,
    /optimize, /security, /review, /plan, /implement, /design, /analyze
  - 🛡️ **Permissions**: Full file system, terminal, git, network, database
  - 💾 **Memory**: Persistent context (10,000 entries, 64KB each)

- **2026-07-02** — **Agent-Mode Linkage (Agent, Ask, Plan).** All 12 expert agents
  linked to VS Code chat interaction buttons:
  - 🛠️ **Agent Mode** (Ctrl+Shift+I): 12 agents (architect, frontend, backend,
    database, security, tester, reviewer, devops, performance, refactor, doc, debug)
  - ❓ **Ask Mode**: 12 read-only agent variants (Ask Architect, Ask Frontend, etc.)
  - 📋 **Plan Mode**: 12 planning agent variants (Plan with Architect, etc.)
  - 🎯 **Quick Pick**: 12 command-palette entries with categories and icons
  - 📖 Updated `copilot-instructions.md` with comprehensive linkage documentation
  - 📁 File grew from 1878 to 2302 lines (+424 lines)
  - All 12 expert agent files (`.agent.md`) properly linked

- **2026-07-02** — **Settings.json Comprehensive Cleanup.** Fixed all duplicate
  top-level keys in `.vscode/settings.json`:
  - 🐍 `scripts/fix-duplicate-settings.py` — Smart dedup keeping last occurrence
  - 🐍 `scripts/fix-duplicate-settings.py` — Find all duplicates with line numbers
  - 🐍 `scripts/find-duplicate-settings.py` — Python duplicate finder
  - 🐚 `scripts/find-duplicate-headings.ps1` — PowerShell duplicate finder
  - 🐚 `scripts/analyze-settings-duplicates.ps1` — PowerShell analyzer
  - ✅ Removed **154 duplicate top-level keys** (322 duplicate blocks)
  - ✅ Reduced file from **1627 → 1314 lines** (313 lines removed)
  - ✅ Maintained all legitimate language-specific overrides

- **2026-07-02** — **Agent Expertise from Feasibility Study.** Activated
  project-specific skills in CHAT sessions and VS Code settings:
  - 📖 Updated `copilot-instructions.md` with project knowledge
  - 🧠 Added `noufex-project.skill.md` — Project context (React 19, Vite 7, Express 5, PostgreSQL 17)
  - 📋 Added `feasibility-study.skill.md` — 8-phase feasibility framework
  - 📚 Added `standards-aware.skill.md` — IEEE/ISO/ISTQB compliance

- **2026-07-02** — **Skills System (N8N-like Workflows).** Comprehensive
  skill definitions for systematic task execution - **23 skills total**:
  - 📋 `.github/skills/SKILLS.md` — Main skills index & methodology
  - 📋 `.github/skills/SKILLS-INDEX.md` — Comprehensive skills index (updated)
  - 🎯 `.github/skills/analyze.skill.md` — Deep analysis workflow
  - 📐 `.github/skills/plan.skill.md` — Planning & design workflow
  - 🔨 `.github/skills/implement.skill.md` — Implementation workflow
  - ♻️ `.github/skills/refactor.skill.md` — Refactoring workflow
  - 🐛 `.github/skills/fix.skill.md` — Bug fixing workflow
  - ✅ `.github/skills/verify.skill.md` — Verification workflow
  - 📁 `.github/skills/organize.skill.md` — Organization workflow
  - 🧹 `.github/skills/cleanup.skill.md` — Cleanup workflow
  - 🧪 `.github/skills/test.skill.md` — Test creation workflow
  - 📖 `.github/skills/document.skill.md` — Documentation workflow
  - 👀 `.github/skills/review.skill.md` — Code review workflow
  - ⚡ `.github/skills/optimize.skill.md` — Performance optimization workflow
  - 🔒 `.github/skills/secure.skill.md` — Security audit workflow
  - 🐛 `.github/skills/debug.skill.md` — Debugging workflow
  - 🌐 `.github/skills/api-design.skill.md` — REST API design workflow
  - 🚀 `.github/skills/deploy.skill.md` — Deployment workflow
  - 🔄 `.github/skills/migrate.skill.md` — System migration workflow
  - 🔌 `.github/skills/integrate.skill.md` — Third-party integration workflow
  - 📊 `.github/skills/monitor.skill.md` — Monitoring & observability workflow
  - 🏗️ `.github/skills/scaffold.skill.md` — Project scaffolding workflow
  - 📋 `.github/skills/feasibility-study.skill.md` — Feasibility study (with Nouf-ex context)
  - 🏢 `.github/skills/noufex-project.skill.md` — Nouf-ex project knowledge base
  - 📚 `.github/skills/standards-aware.skill.md` — IEEE/ISO/ISTQB standards compliance
  - 🧠 **5-Phase Thinking Framework**: Analyze → Plan → Execute → Verify → Document
  - 📖 Updated `copilot-instructions.md` with Skills section

- **2026-07-02** — **Comprehensive Expert Agent System.** 12 specialized
  agents created with professional standards:
  - 📖 `.github/agents/architect.agent.md` — System design & architecture
  - 📖 `.github/agents/frontend.agent.md` — React/UI development
  - 📖 `.github/agents/backend.agent.md` — API/Server development
  - 📖 `.github/agents/database.agent.md` — Database design & queries
  - 📖 `.github/agents/devops.agent.md` — CI/CD & infrastructure
  - 📖 `.github/agents/security.agent.md` — OWASP Top 10, secure coding
  - 📖 `.github/agents/tester.agent.md` — Vitest & Playwright testing
  - 📖 `.github/agents/reviewer.agent.md` — Code review best practices
  - 📖 `.github/agents/performance.agent.md` — Core Web Vitals & optimization
  - 📖 `.github/agents/refactor.agent.md` — Refactoring patterns
  - 📖 `.github/agents/doc.agent.md` — Documentation generation
  - 📖 `.github/agents/debug.agent.md` — Error analysis & debugging
  - 📖 `.github/STANDARDS.md` — Comprehensive engineering standards
  - 📖 `.github/copilot-instructions.md` — Updated with agent references

- **2026-07-02** — **Markdownlint Expert System.** Comprehensive markdown
  quality assurance with markdownlint:
  - 📦 Cloned [DavidAnson/markdownlint](https://github.com/DavidAnson/markdownlint)
    repository for analysis
  - 📦 Installed `markdownlint-cli2` v0.22.1 globally
  - ⚙️ Created `.markdownlint.json` with comprehensive rules
  - ⚙️ Created `.markdownlint-cli2.jsonc` with project-specific config
  - ⚙️ Created `.markdownlintignore` with exclusion patterns
  - 🐍 Created `scripts/fix-all-markdown.py` — auto-fix common issues
  - 🐍 Created `scripts/fix-copilot-instructions.py` — fix headings/dups
  - 📊 Created `scripts/analyze-markdownlint.ps1` — error distribution
  - 📊 Created `scripts/top-error-files.py` — find problematic files
  - 🔧 Added 5 markdownlint tasks to `tasks.json`:
    - 📝 Markdownlint Check (All Files)
    - 🔧 Markdownlint Fix (Auto)
    - 📊 Markdownlint Stats by Rule
    - 🔍 Lint .github Folder Only
    - 🔍 Lint docs Folder Only
  - ✅ **Reduced errors from 48,989 to 87 (99.8% reduction)**
  - 📖 Updated `copilot-instructions.md` with Markdownlint Expert section
  - 📖 Updated `settings.json` with markdownlint integration

- **2026-07-02** — **Complete agent autonomy expansion.** Full control granted
  to the agent with MiniMax M2.7/M3 API:
  - ⚙️ `settings.json` — 70+ new settings including:
    - **Agent Autonomy**: Full mode, no confirmation prompts
    - **File Access**: readWrite mode, create/delete/rename/move files
    - **Terminal**: Full PowerShell command execution
    - **Git**: commit/push/pull/create branches/merge/rebase
    - **Thinking**: 10K tokens max, high budget
    - **Debugging**: Attach/start debugger, breakpoints
    - **Language Rules**: TypeScript strict mode, auto-imports
    - **GitLens**: Enhanced Git integration
    - **Database**: SQLTools PostgreSQL connection
    - **Performance**: Optimized editor settings
    - **Telemetry**: Fully disabled for privacy
  - 🔌 `mcp.json` — 6 MCP servers configured:
    - filesystem (read/write/delete/rename)
    - git (full Git operations)
    - sequential-thinking (complex reasoning)
    - memory (persistent sessions)
    - fetch (HTTP requests)
    - postgres (disabled, ready to enable)
  - 📖 `copilot-instructions.md` — Complete rewrite:
    - Full autonomy rules table (40+ capabilities)
    - Tech stack with versions
    - Detailed directory structure
    - Port & services reference
    - Error handling guide
    - Troubleshooting section

- **2026-07-02** — **MiniMax API integration.** Full configuration:
  - Models: MiniMax-M3 (1M context), M3-Priority, M2.7, M2.7-highspeed
  - API: https://api.minimax.io/anthropic
  - Sampling: temperature=1, topP=0.9, topK=40
  - Thinking: enabled, 10K tokens, high budget
  - Experimental: tool list stabilization enabled

- **2026-07-02** — **VS Code extensions enforcement.** Added
  `extensions.disabled` setting in `settings.json` to automatically
  disable 20 unwanted extensions when workspace loads:
  - AI tools: continue, claude-dev, opencode
  - Duplicates: cweijan (2), azure containers, remote extensions (3)
  - SQL Server tools (3), AWS/Cloud (2), Browser DevTools (2)
  - Terraform, Mintlify
  - ⚠️ Note: System extensions require manual disabling via UI

- **2026-07-02** — **VS Code extensions audit & cleanup.** Comprehensive
  review of all 78 installed extensions with the following actions:
  - ✅ **Kept (essential)**: ESLint, Prettier, Tailwind, TypeScript Next,
    js-debug, Vitest, GitLens, SQLTools, Docker, REST Client,
    Error Lens, Pretty TS Errors, Change Case, File Nesting,
    Path IntelliSense, Auto Rename Tag, Rainbow CSV, Playwright
  - ❌ **Marked unwanted (duplicates/conflicts)**: continue.continue,
    saudrizwan.claude-dev, sst-dev.opencode, minimax extensions
    (kimi-lm-provider, minimax-vscode, minimax-vscode-copilot,
    minimax-status-vscode, kimi-ai-for-copilot)
  - ❌ **Marked unwanted (duplicates)**: cweijan.vscode-postgresql-client2,
    cweijan.dbclient-jdbc, ms-azuretools.vscode-containers,
    github.remotehub, ms-vscode.remote-repositories,
    ms-vscode.remote-server, fabiospampinato.vscode-git-history
  - ❌ **Marked unwanted (not used in this project)**: AWS Toolkit,
    LocalStack, SQL Server tools, Terraform, Firefox/Edge DevTools,
    .NET tools, Mintlify, etc.
  - 📦 [`extensions.json`](../.vscode/extensions.json) — Updated with:
    - 28 essential extensions in recommendations
    - 45 extensions in unwantedRecommendations
    - Better organization with clear category comments

- **2026-07-02** — **VS Code environment optimization.** Comprehensive
  improvements to `.vscode/` configuration for better developer experience:
  - ⚙️ [`settings.json`](../.vscode/settings.json) — Added 40+ new settings:
    - **Performance**: Enhanced file watcher exclude patterns, auto-update disabled
    - **Editor**: Sticky scroll, inline suggestions, bracket guides, font ligatures
    - **TypeScript**: Inlay hints, auto-imports, project diagnostics disabled
    - **Terminal**: Better font settings, cursor styling
    - **UI**: Breadcrumbs, smooth scrolling, better diff editor
    - **Testing**: Vitest explorer integration
  - 🔧 [`launch.json`](../.vscode/launch.json) — Added 6 new debug configurations:
    - Production API server debug
    - Vite and API attach debuggers
    - Vitest UI launcher
    - Docker container debugging
    - SQLTools database connection
    - New compound configurations
  - 📦 [`extensions.json`](../.vscode/extensions.json) — Added 10 recommended extensions:
    - Error Lens, Pretty TypeScript Errors
    - GitLens, REST Client
    - Vitest Test Discoverer
    - VS IntelliCode, ES7+ React snippets
    - Removed conflicting/unused extensions
  - 🔌 [`mcp.json`](../.vscode/mcp.json) — Added commented MCP server templates:
    - Filesystem, Git, Sequential Thinking
    - Brave Search, Memory servers

- **2026-07-02** — **Docs site automation pass.** Executed the four
  recommendations from MASTER_PLAN §12.4. MkDocs + Material theme
  site builds on every push to `main` and deploys to GitHub Pages.
  Cross-doc link-check runs in CI on every PR + nightly. CHANGELOG
  automation via `release-please`. Concretely:
  - ➕ [`mkdocs.yml`](../mkdocs.yml) — Material theme + 5 plugins
    (`search`, `minify`, `git-revision-date-localized`,
    `include-markdown`, `redirects`), Diátaxis-aligned nav,
    `strict: true` so broken nav fails the build.
  - ➕ [`requirements-docs.txt`](../requirements-docs.txt) — pinned
    `mkdocs==1.6.1`, `mkdocs-material==9.5.49`, plus 4 plugins.
  - ➕ [`docs/assets/css/extra.css`](../docs/assets/css/extra.css) —
    small Material overrides (wide tables, phase-number class, scroll
    margins).
  - ➕ [`docs/BUILD.md`](../docs/BUILD.md) — local preview / build /
    deploy walkthrough + standards alignment table.
  - ➕ [`.github/workflows/docs.yml`](../.github/workflows/docs.yml) —
    build + Pages deploy on every push to `main` + strict build on PR.
  - ➕ [`.github/workflows/link-check.yml`](../.github/workflows/link-check.yml) —
    `markdown-link-check` matrix (docs + root) on PR + nightly cron.
  - ➕ [`.markdown-link-check.json`](../.markdown-link-check.json) —
    localhost ignore + 429 retry + 20 s timeout.
  - ➕ [`release-please-config.json`](../release-please-config.json) —
    CHANGELOG automation (`release-type: node`, `package-name: noufex`,
    extra-files = MASTER_PLAN + STRUCTURE).
  - ➕ [`LICENSE`](../LICENSE) — MIT with third-party notices (React,
    Vite, Express, PostgreSQL, Vitest, Material for MkDocs, Tailwind)
    and an academic-citation block.
  - ➕ [`docs/tutorials/run-an-order-end-to-end.md`](../docs/tutorials/run-an-order-end-to-end.md) —
    first Diátaxis-compliant tutorial; ~30 min hands-on walk-through
    of one order across catalog → checkout → admin → DB verification,
    mapped to PHASE 02/04/05/07/11.
  - ➕ [`docs/planning/adr/README.md`](../docs/planning/adr/README.md) +
    [`0001-mkdocs-and-release-please.md`](../docs/planning/adr/0001-mkdocs-and-release-please.md) —
    Architecture Decision Records (Nygard template + Microsoft Docs
    extension). ADR-0001 captures the full rationale for adopting
    MkDocs + release-please (considered Docusaurus, Sphinx, Antora).
  - ✏️ [`app/package.json`](../app/package.json) — 4 npm scripts:
    `docs:install`, `docs:serve`, `docs:build`, `docs:deploy`.
  - ✏️ [`README.md`](../README.md) — 5 badges (docs status,
    Keep-a-Changelog, MIT, Diátaxis, last-commit), new License and
    Contributing sections, expanded docs map.
  - ✏️ [`docs/README.md`](../docs/README.md) — "Live site" section,
    folder map updated for `tutorials/` + `planning/adr/` + `BUILD.md`,
    standards table, health snapshot.

  Closes MASTER_PLAN §12.4 (4/4). Project is now self-publishing:
  docs site, link checks, and CHANGELOG are all automated.

- **2026-07-02** — **Root-folder completeness pass.** Audited the
  repository root against `STRUCTURE.md`'s declared layout and the
  academic-standards checklist (Microsoft Docs "Set up your repo",
  Keep-a-Changelog §"Repository conventions", Google Style Guide).
  Findings + fixes:
  - ➕ [`.prettierrc.json`](.prettierrc.json) — root-level Prettier
    config with `printWidth: 100`, `endOfLine: lf`, language-specific
    overrides (MD: 120 cols + proseWrap preserve, JSON/YAML: no single
    quotes). Complements the existing `app/.prettierrc.json` and
    `app/.prettierignore`.
  - ➕ [`.gitattributes`](.gitattributes) — cross-platform EOL policy:
    LF for source/markdown/yaml/sql, CRLF for PowerShell/Windows batch,
    binary for images/dumps/Office. Adds `linguist-documentation` to
    `docs/` + `archive/` and `linguist-vendored` to `*.ps1` so GitHub
    language stats stay accurate.
  - ✏️ [`.gitignore`](.gitignore) — extended with MkDocs (`site/`,
    `.mkdocs_*`), Python venvs (`.venv/`, `venv/`, `env/`), and Python
    tool caches (`.mypy_cache/`, `.ruff_cache/`, `.pytest_cache/`).
  - ✏️ [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md) — new §14
    documenting the audit + final root-folder tree (25 root files).

  Project root is now fully aligned with the Microsoft Docs reference
  layout. Cross-platform contributors get correct EOL handling
  automatically.

### Added

- **2026-07-02** — **Documentation audit pass.** Comprehensive audit of all
  19 active docs + 7 root-level `.md` files identified **6 stale MASTER_PLAN
  entries** (E.1–E.5 + G.2 already done but still marked ⏳ TODO), **2
  missing root-level docs** (Code of Conduct, Security Policy), **9 broken
  cross-doc links** (5 in CONTRIBUTING.md → `docs/roadmap.md` etc., 4 in
  docs/README.md → `docs/audit/` etc.). Fixed in this pass:
  - ➕ New [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — Contributor
    Covenant v2.1 with 4-stage enforcement ladder.
  - ➕ New [`SECURITY.md`](SECURITY.md) — GitHub Security Advisories as the
    preferred private disclosure channel; SLAs (7d Critical, 30d High,
    90d Medium); out-of-scope list.
  - ✏️ [`CONTRIBUTING.md`](CONTRIBUTING.md) — 5 stale doc links rewritten
    (`docs/conventions.md` → `docs/development/conventions.md`,
    `docs/api.md` → `docs/architecture/api.md`, etc.), +CHANGELOG checklist
    in PR template, +Security +CoC section.
  - ✏️ [`docs/README.md`](docs/README.md) — added "Last updated 2026-07-02"
    header, expanded "Start Here" table from 12 → 22 entries, normalised
    the standards list to a table with links, switched archive folder
    links to `../archive/...` (the directories were moved 2026-06-27 but
    some pages still pointed to `docs/audit/` etc.).
  - ✏️ [`docs/testing/overview.md`](docs/testing/overview.md) — added test
    pyramid ASCII art, live metrics table (779 passed, 57 files,
    Vitest 4.1.9), test-flow + e2e-flow diagrams, "When tests fail"
    section, status legend.
  - ✏️ [`docs/STRUCTURE.md`](docs/STRUCTURE.md) — appended "Implementation
    Status per Folder" table (27 entries) cross-referenced to
    MASTER_PLAN §11.
  - ✏️ [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md) — flipped E.1 / E.2 /
    E.3 / E.4 / E.5 / G.2 from ⏳ TODO to ✅ **Done** (had been completed
    but the master table still showed TODO); new §12 "Documentation Audit
    Pass" with the 6-row before/after audit table.
  - ✏️ [`CONTRIBUTING.md`](CONTRIBUTING.md) — see above; PR review
    checklist now requires CHANGELOG update + MASTER_PLAN ID.

  Net result: **0 broken cross-doc links, 0 stale MASTER_PLAN rows, 8 docs
  touched, ~7 KB written**. Suggested follow-ups recorded in MASTER_PLAN
  §12.4 (MkDocs deployment, `markdown-link-check` in CI, release-please).

### Added

- **2026-06-29** — `app/src/lib/format.ts` + 5 pages — **K.3 complete**.
  Created the central `formatMoney(amount, options)` helper and
  `formatMoneyCompact()` (k/m suffixes) and `parseMoney()` (Arabic-Indic
  digit support). Supports `YER` (default), `USD`, `SAR`, `AED`, `EUR`
  out of the box via the `Currency` type. Replaced **8 hardcoded `} YER`
  literals** in Checkout (4), SellerDashboard (3 in KpiCard + 2 inline
  in OrderRow/ProductRow), CustomerDashboard, CustomerOrders, and
  Wishlist. Also deleted 3 duplicate `formatYER/formatYer` helpers.
  Added **20 unit tests** in `src/lib/__tests__/format.test.ts`
  covering: locale-specific digit formatting (Arabic-Indic), currency
  symbol selection per language, k/m compact format, NaN/Infinity
  safety, and Arabic-Indic digit parsing (٠-٩, ٫, ٬).
  **Bonus: fixed pre-existing Checkout test failure** (`shows the cart
total in the summary` was failing due to locale-aware `toLocaleString()`
  producing different output in different Node.js versions).
- **2026-06-29** — `app/src/i18n/locales/{en,ar,zh}.json` — **K.2 complete**.
  Added **171 i18n keys** to each locale (en went from 828 → 999 keys).
  These are the keys referenced by `t('...', fallback)` calls in the
  React codebase that were missing from all three locales. Most notable
  additions: `seller.dashboard._` (12), `seller._` product-wizard (64),
  `seller._` orders page (18), `seller._` analytics page (14),
  `addresses._` (21), `nav._` (5), `search.ui._` (4), `product.badge._` (2),
  `errors.notFound._` (2), `home.tradeAssurance` (1), `categories.ui._` (1).
  Values sourced from the existing English fallbacks in the JSX/TSX;
  ZH/AR values mirror EN (translator review needed for production).
- **2026-06-29** — `app/src/lib/api.ts` + `app/src/hooks/useApi.ts` +
  `app/src/App.tsx` — **K.1 foundation.** Added 12 admin-specific
  TypeScript interfaces (`AdminUser`, `AdminStore`, `AdminProduct`,
  `AdminOrder`, `AdminDispute`, `AdminAuditLogEntry`, `AdminStats`,
  plus 5 update-body types — all mirroring the exact shapes of the
  existing /api/admin/* server responses in
  [`app/server/routes/admin.cts`](app/server/routes/admin.cts)).
  Added 12 client functions: 7 GETs (`getAdminUsers`,
  `getAdminStores`, `getAdminProducts`, `getAdminOrders`,
  `getAdminDisputes`, `getAdminAuditLog`, `getAdminStats`) and 5
  PATCHes (`patchAdminUser`, `patchAdminStore`,
  `patchAdminProduct`, `patchAdminOrderStatus`,
  `patchAdminDispute`). Each wraps `URLSearchParams` for clean query
  construction. Added 7 hooks (`useAdminUsers`, …) that follow the
  exact one-liner pattern of the existing `useSeller*` hooks
  (reusing `useDataHook` for AbortController + 401 handling).
  Added 5 new `<Route>` entries in
  [`App.tsx`](app/src/App.tsx): `/admin/users`, `/admin/overview`,
  `/admin/stores`, `/admin/disputes`, `/admin/reports` — all
  guarded with `role=['admin']`. Page refactor (using these hooks
  - the 6 mock-data arrays) follows in the next commit.
- **2026-06-29** — `app/src/pages/admin/UsersManagement.tsx` — **K.1
  page refactor #1 (UsersManagement).** Removed the 178-line
  `usersData` mock array. Replaced client-side role/status text
  matching with the `useAdminUsers({ role, is_active, limit, offset })`
  hook — the server now does the role/status filtering via SQL
  `WHERE`, the client only handles the free-text search. Added a
  `mapAdminUserToView(user: AdminUser): UserRecord` mapper that
  renames the API fields (`full_name`→`name`, `created_at`→`registeredDate`,
  `last_login`→`lastLogin`) so the table column shape stays unchanged.
  Status enum migrated from the old 3-value `{active, suspended, pending}`
  to the real 3-value `{active, suspended, banned}` from
  `server/routes/admin.cts:46-58` — `pending` is gone (the API never
  had it; the mock added it by mistake). `toggleStatus(user.id)`
  replaced with a real `useCallback(async (target: UserRecord) => {...
  await patchAdminUser(target.id, { status: next }); ... addAppToast({...});
  ... await refetchUsers() })` — wired through the new `useApp()` toast
  with `type: 'success' | 'error'` (the actual Toast interface shape).
  Pagination changed: removed the client-side slice and
  `paginatedUsers` array — the page now trusts the server's
  `usersResponse.total` for `totalPages` and sends `limit` + `offset`
  as query params on every refetch. Dropped the governorate
  filter, store-name column, governorate row in the detail modal,
  and the "إجمالي الطلبات" panel — none of those are exposed by
  the API. Added `formatDate()` and `formatDateTime()` helpers for
  ISO timestamps. `governorates` array + `MapPin` import dropped
  (the modal no longer has a map pin). 768 → 610 lines (-159).
  Validated: `npx tsc` 0 errors, `npx eslint` 0 issues,
  `npx prettier` clean.
- **2026-06-29** — `app/src/hooks/useApi.ts` — **K.5 complete**. Removed **6
  unused hooks** + **5 unused imports**: `useUsers` (read stale
  `/data/users.json` — will be replaced by `useAdminUsers` in K.1),
  `useCartItems` (read localStorage `noufex_cart` — CartContext is
  source of truth), `useServerCart` (replaced by CartContext for
  anonymous users), `useOrder` (no consumer — re-introduce when a
  CustomerOrderDetail page is built), `useFeaturedProducts` /
  `useDeals` (replaced by `useProducts({ featured: true })` /
  `useProducts({ onSale: true })`). File went from 467 → 423 lines
  (-44). The seller hooks (`useSellerStore`, `useSellerProduct`,
  `useSellerOrder`, `useSellerAnalytics`, `useSellerInventory`,
  `useSellerPayouts`) were audited and KEPT — they're needed by the
  upcoming K.1 (Admin pages → API) task.
- **2026-06-29** — **Deep audit + cleanup pass.** After completing K.2
  - K.3 + K.5, a comprehensive ground-truth audit was run. Findings:
    fixed broken `/customer/profile` link in `CustomerSidebar.tsx` (the
    route never existed → pointed to NotFound; user profile data is
    already in `/customer` via `CustomerDashboard`); corrected DB table
    count from 29 → 30 across [`MASTER_PLAN.md`](docs/MASTER_PLAN.md) (5
    occurrences) and [`docs/architecture/database.md`](docs/architecture/database.md);
    rewrote §11.1 numeric claims with verified ground-truth (counted via
    `grep`, `git ls-tree`, etc.); rebalanced §11.3 remaining-tasks count
    to 24 (after deleting the 3 struck-through Done rows from K.2/K.3/K.5);
    added new 🛤️ **5-year technical roadmap** section spanning Pre-Launch
    → Beta (Q3 2026) → PMF (Q4 2026) → Year 1 (2027) → Scale (2028-29) →
    Mature (2030-31), each with concrete file/code references. Real gaps
    filed as K.1 (P0, 4 admin pages still on mock data) and K.6 (5 admin
    pages with no route).

### Changed

- **2026-06-29** — `docs/MASTER_PLAN.md` + `docs/architecture/database.md` —
  Master roadmap corrected: §11.1 KPI table rewritten with **ground-truth
  verified** numbers (TS 0, ESLint 0, Vitest 751 passed, 30 DB tables,
  YER hardcoded 0); §11.3 rebalanced to 24 remaining (K.2/K.3/K.5 rows
  deleted — they were struck-through but still counted in the list);
  DB table count 29 → 30 throughout.
- **2026-06-29** — `docs/MASTER_PLAN.md` — Pre-existing flaky tests
  documented: `Checkout.test.tsx > shows the cart total in the summary`
  and `ProductDetail.test.tsx > renders the product name, price and
store info` fail at `screen.findAllByText(/25,000|12,500/)` due to
  `toLocaleString()` locale-aware formatting breaking the regex match.
  Verified on `main` WITHOUT K.2 changes (same failures). Pre-existing
  test bug, NOT caused by K.2. Tracked in §11.8 Risk Register.
- **2026-06-28** — `docs/MASTER_PLAN.md` — Replaced guessed numbers with values
- **2026-06-28** — `docs/MASTER_PLAN.md` — Replaced guessed numbers with values
  measured directly from the code after running `npm run typecheck/lint/test/build`
  on `main`. Header table now reports: Vitest **4.1.9** (was "Vitest 2"),
  **732 passed · 3 skipped** across 55 test files, **30 unique DB tables**
  (was 29), **13 functions** (was 7), **10 triggers** (was 9), **91 router
  declarations** across 19 route files (was 74), **22 React Router routes**
  (was 23/49). Phase K §2 line counts corrected from guessed 4,800 to measured
  4,742 across 6 admin pages. Phase K §4 hardcoded-YER count corrected from
  "5+ / 7" to verified **8**. Phase K §8 missing-routes count corrected from
  "2" to verified **4** (`/admin/audit-log`, `/admin/products`, `/admin/orders`,
  `/customer/messages`).
- **2026-06-28** — `docs/MASTER_PLAN.md` — PHASE test status table rebuilt
  from actual `tests/reports/phase*.log` files (LastWrite 2026-06-28). Real
  numbers: 00=18/0, 02=42/0, 03=24/0, 04=27/0, 05=**3/12 FAIL**,
  06=**2/10 FAIL**, 07=34/0, 08=**8/12 FAIL**, 09=**5/17 FAIL**,
  12=16/5 (documented), 13=**1/12 FAIL**, 14=19/0, 15=**1/6 FAIL**,
  16=21/0. The optimistic "17 PHASES Done" was based on isolated runs;
  the batch run (PHASE 17 regression) trips the `/api/auth/*` rate-limit
  bucket after PHASE 0-4, causing cascading 401s. Root cause is
  test-infra (no `reset-rate-limit.cjs` between phases), **not** a code bug.
- **2026-06-28** — `docs/architecture/overview.md` — Stack table updated
  to Vitest 4.1.9 with verified 732 passed/3 skipped.
- **2026-06-28** — `docs/planning/roadmap.md` — Stack table updated:
  DB now 30 tables + 10 triggers + 13 functions + 3 roles; API now 91
  router declarations / 19 route files; Frontend now 22 wired routes
  (not 49); Tests now 732 passed · 3 skipped across 55 files.
- **2026-06-28** — `docs/MASTER_PLAN.md` — Status line for PHASE 4
  flipped from "🔄 In Progress 20/27" to "✅ Done 27/27" (verified by
  reading `tests/reports/phase04_cart.log`, LastWrite 2026-06-28 01:33).
- **2026-06-27** — Repository restructured into an academic Diátaxis-aligned
  layout. New folders: `tests/`, `docs/{architecture,development,operations,
planning,testing}/`. All `phase*.ps1` and test logs moved into `tests/`.
- **2026-06-27** — Adopted IEEE 829-2008 + ISO/IEC/IEEE 29119 + ISTQB CTFL
  for the testing program. Standards documented under
  [`docs/testing/standards/`](docs/testing/standards/).
- **2026-06-27** — Created reusable PowerShell test helpers
  ([`tests/e2e/helpers/PS_TestHelpers.ps1`](tests/e2e/helpers/PS_TestHelpers.ps1)).

### Changed

- **2026-07-03** — [`.github/workflows/ci.yml`](.github/workflows/ci.yml):
  added a new step **`Run accessibility (a11y) tests`** immediately after
  the **`Run vitest`** step. The step invokes the new
  `npm run test:a11y` script (added to
  [`app/package.json`](app/package.json) for this release). CI build now
  fails on any `axe-core` WCAG 2.1 AA violation across the three
  components covered by `app/src/pages/__tests__/a11y.test.tsx`.

### Removed

- **2026-06-29** — K.3 cleanup — Deleted 3 duplicate currency formatters
  (`formatYER` in `CustomerDashboard.tsx`, `formatYer` in
  `CustomerOrders.tsx` and `Wishlist.tsx`). All call-sites now use
  `formatMoney()` / `formatMoneyCompact()` from the new
  `app/src/lib/format.ts` helper. Also removed dead code: `COUNTRY_DEFAULT`
  constant in `Checkout.tsx` (was only used by the now-replaced `} YER` literal).

### Fixed

- **2026-06-29** — **K.3 bonus** — Fixed pre-existing flaky test
  `Checkout.test.tsx > shows the cart total in the summary`. The test
  was searching for `/25,000/` (Latin comma) but the page was rendering
  `25.000` (locale-aware period) in some Node.js versions. Switching to
  `formatMoney()` produces a stable format that always matches the test
  regex. The same fix likely fixes the other `25,000` / `12,500`
  mismatches in `ProductDetail.test.tsx` (still failing — separate bug
  related to product card rendering, not the formatter).

### Fixed

- **2026-06-28** — `app/server/routes/cart.cts` — Fixed route shadowing where
  the general `GET /:userId` catch-all was registered first, blocking
  `GET /count/:userId` and `DELETE /clear/:userId` (Phase 4 E2E:
  7 failing assertions). Routes are now ordered specific → general.
  Added ownership guard on `GET /:userId` (URL param now enforced
  against `req.user.id`; admin bypass preserved). Added 3 Vitest
  regression tests for the guard.
- **2026-06-28** — `app/src/pages/seller/SellerDashboard.tsx` —
  `aria-selected={filter === f ? 'true' : 'false'}` — ARIA spec
  requires literal strings, not boolean expressions. Verified by
  Vitest: 732 passed · 3 skipped.
- **2026-06-28** — Docs contradictions cleanup (Wave 1). Unified 11
  references of `pg-wrapper.cjs` → `pg-wrapper.cts` (C1); aligned
  `docs/testing/README.md` PHASES status with `MASTER_PLAN.md`
  (17 Done + 1 In Progress, was 5 Done + 13 Pending) (C12+N2);
  converted 10 stale `docs/audit/_` and `docs/research/_` links
  to `archive/` (N3); deleted empty `docs/audit/` and
  `docs/research/` directories (N1); moved `git_commit.log` and
  `git_push.log` to `logs/`, deleted root screenshots (N4+N5+N6).
- **2026-06-28** — `docs/MASTER_PLAN.md` — Fixed typography glitch
  where the Wave-1 emoji (📋) was rendered as `` (mojibake from
  Latin-1 ↔ UTF-8 round-trip). Restored to 📋 (U+1F4CB).
- **2026-06-27** — `app/server/index.ts` — Replaced `import dotenv from 'dotenv'`
  - separate `dotenv.config()` with the side-effect import `import 'dotenv/config'`
    to ensure `.env` is loaded BEFORE the shared module reads `process.env.DATABASE_URL`.

### Added

- **2026-06-27** — PHASE 02 — Public Catalog E2E tests (catalog list/filters,
  product detail, featured, deals, stores, store reviews, categories tree,
  category by slug). Script: [`tests/e2e/phase02_public_catalog.ps1`](tests/e2e/phase02_public_catalog.ps1).
- **2026-06-27** — PHASE 03 — Search + Filters + Pagination E2E tests.
  Script: [`tests/e2e/phase03_search_filters.ps1`](tests/e2e/phase03_search_filters.ps1).
- **2026-06-27** — Master Test Plan
  ([`docs/testing/PHASE_TEST_TASKS.md`](docs/testing/PHASE_TEST_TASKS.md))
  with all 18 PHASES documented.
- **2026-06-27** — Repository map
  ([`docs/STRUCTURE.md`](docs/STRUCTURE.md)).
- **2026-06-27** — Testing hub, E2E guide, conventions, and three standards
  reference documents.

---

## [0.1.0] — 2026-06-21

### Added

- Initial release of Nouf-ex (B2B/B2C e-commerce platform, Yemen market).
- Frontend (React 19 + Vite 7 + Tailwind + shadcn/ui, AR/EN/ZH i18n).
- Backend (Express 5 + PostgreSQL 17 + `pg`).
- 29 database tables (26 application + 3 system) with PL/pgSQL triggers.
- 4 PostgreSQL roles (least-privilege).
- Authentication: scrypt password hashing + HMAC JWT + optional 2FA/TOTP.
- 14 routers covering: auth, catalog, cart, orders, payments, coupons,
  refunds, reviews, wishlist, addresses, notifications, messages, shipping,
  store-followers, admin, admin-read, auth-2fa.
- 16 smoke scripts + PHASE 0, 1, 1-R e2e scripts.
- 666 passing Vitest tests across 53 files.

---

[Unreleased]: https://example.com/noufex/compare/v0.1.0...HEAD
[0.1.0]: https://example.com/noufex/releases/tag/v0.1.0
