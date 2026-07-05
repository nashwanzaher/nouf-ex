#!/usr/bin/env python3
"""Add auto-switch configuration to settings.json before the closing brace."""
from pathlib import Path

file_path = Path(r'c:\Users\zaher\Desktop\nouf-ex\.vscode\settings.json')
content = file_path.read_text(encoding='utf-8')

# Find the last closing brace
last_brace_idx = content.rfind('}')

# Auto-switch configuration to insert
auto_switch_config = '''  // ═══════════════════════════════════════════════════════════════════════════
  // AUTOMATIC AGENT SWITCHING - 2026 Edition
  // Auto-detect task type and switch to appropriate expert agent
  // ═══════════════════════════════════════════════════════════════════════════
  "chat.agent.autoSwitch.enabled": true,
  "chat.agent.autoSwitch.confidenceThreshold": 0.6,
  "chat.agent.autoSwitch.showNotification": true,
  "chat.agent.autoSwitch.preserveContext": true,
  "chat.agent.autoSwitch.allowOverride": true,
  "chat.agent.autoSwitch.preferredAgent": "auto",
  "chat.agent.autoSwitch.fallbackAgent": "architect",
  "chat.agent.autoSwitch.preserveContextBetweenSwitches": true,
  "chat.agent.autoSwitch.excludedAgents": [],
  "chat.agent.autoSwitch.customKeywords": {},
  "chat.agent.autoSwitch.notificationFormat": "🔄 Auto-switching to @{agent_name}\\n📋 Reason: {reasons}\\n🎯 Expertise: {expertise}",

  // Detection Tiers (Priority-Based)
  "chat.agent.autoSwitch.tiers.security": ["security", "vulnerability", "exploit", "xss", "csrf", "injection", "auth", "password", "token", "oauth", "jwt", "permission", "owasp", "vulnerab"],
  "chat.agent.autoSwitch.tiers.debug": ["error", "bug", "crash", "broken", "not working", "failing", "stack trace", "exception", "undefined", "null", "fix this"],
  "chat.agent.autoSwitch.tiers.architect": ["architecture", "design", "pattern", "structure", "microservice", "monolith", "scalability", "diagram", "c4", "system design"],
  "chat.agent.autoSwitch.tiers.database": ["sql", "query", "database", "table", "schema", "migration", "index", "postgresql", "postgres", "join", "select", "where", "transaction"],
  "chat.agent.autoSwitch.tiers.frontend": ["react", "component", "jsx", "tsx", "ui", "ux", "css", "tailwind", "shadcn", "html", "dom", "page", "view", "form", "button", "modal"],
  "chat.agent.autoSwitch.tiers.backend": ["api", "endpoint", "route", "express", "node", "server", "controller", "middleware", "rest", "request", "response", "handler", "service"],
  "chat.agent.autoSwitch.tiers.tester": ["test", "spec", "coverage", "vitest", "playwright", "mock", "stub", "assertion", "tdd", "bdd", "unit test", "integration test", "e2e"],
  "chat.agent.autoSwitch.tiers.performance": ["slow", "performance", "optimize", "speed", "fast", "memory", "cpu", "cache", "bundle", "lighthouse", "core web vitals", "lcp", "fid", "cls"],
  "chat.agent.autoSwitch.tiers.devops": ["docker", "kubernetes", "deploy", "ci/cd", "github actions", "pipeline", "build", "release", "monitoring", "logging"],
  "chat.agent.autoSwitch.tiers.doc": ["document", "docs", "readme", "jsdoc", "tsdoc", "comment", "explain", "documentation", "guide", "tutorial", "reference"],
  "chat.agent.autoSwitch.tiers.refactor": ["refactor", "clean up", "reorganize", "restructure", "improve code", "clean code", "design pattern", "extract method", "rename"],
  "chat.agent.autoSwitch.tiers.reviewer": ["review", "check", "audit", "lint", "quality", "best practices", "solid", "dry", "kiss", "yagni", "code smell"],

  // File-Based Detection
  "chat.agent.autoSwitch.filePatterns": {
    "frontend": ["**/*.tsx", "**/*.jsx", "**/*.css", "**/*.scss", "**/components/**", "**/pages/**", "**/hooks/**"],
    "backend": ["**/server/**", "**/routes/**", "**/controllers/**", "**/services/**", "**/api/**"],
    "database": ["**/*.sql", "database/**", "**/migrations/**", "**/schema/**"],
    "tester": ["**/*.test.ts", "**/*.spec.tsx", "**/tests/**", "**/__tests__/**"],
    "devops": ["Dockerfile", "docker-compose.yml", ".github/workflows/**"],
    "doc": ["**/*.md", "docs/**", "README.md", "CHANGELOG.md"],
    "security": ["**/auth/**", "**/security/**", "**/middleware/auth*"],
    "architect": ["docs/architecture/**", ".vscode/**", "settings.json"]
  },

  // Multi-Agent Task Patterns
  "chat.agent.multiAgentPatterns": {
    "add new feature with tests": ["frontend_or_backend", "tester", "reviewer"],
    "deploy to production": ["devops", "security", "tester"],
    "optimize database performance": ["database", "performance", "architect"],
    "fix security vulnerability": ["security", "debug", "tester", "doc"],
    "refactor legacy code": ["refactor", "tester", "reviewer", "doc"],
    "create new API endpoint": ["backend", "architect", "tester", "doc", "security"]
  },
'''

# Insert before the last closing brace
new_content = content[:last_brace_idx] + auto_switch_config + content[last_brace_idx:]

file_path.write_text(new_content, encoding='utf-8')
print(f"Added {len(auto_switch_config)} chars")
print(f"Original: {len(content)} chars")
print(f"New: {len(new_content)} chars")
print(f"Increase: {len(new_content) - len(content)} chars")