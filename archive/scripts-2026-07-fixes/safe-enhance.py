#!/usr/bin/env python3
"""Safely add auto-switch configuration without breaking the file."""
import re
from pathlib import Path

file_path = Path(r'c:\Users\zaher\Desktop\nouf-ex\.vscode\settings.json')
content = file_path.read_text(encoding='utf-8')

# Find the last closing brace (before final newline)
# JSONC format has }, then maybe newline then }
last_closing_brace = content.rfind('}')

print(f"Current chars: {len(content)}")
print(f"Last '}}' position: {last_closing_brace}")

# Auto-switch configuration to add
auto_switch = '''  // ─────────────────────────────────────────────────────────────────────────
  // AUTOMATIC AGENT SWITCHING - Auto-detect task and switch to expert agent
  // ─────────────────────────────────────────────────────────────────────────
  "chat.agent.autoSwitch.enabled": true,
  "chat.agent.autoSwitch.confidenceThreshold": 0.6,
  "chat.agent.autoSwitch.showNotification": true,
  "chat.agent.autoSwitch.preserveContext": true,
  "chat.agent.autoSwitch.allowOverride": true,
  "chat.agent.autoSwitch.preferredAgent": "auto",
  "chat.agent.autoSwitch.fallbackAgent": "architect",

  // Detection Tiers
  "chat.agent.autoSwitch.tiers.security": [
    "security", "vulnerability", "exploit", "xss", "csrf",
    "injection", "auth", "password", "token", "oauth", "jwt"
  ],
  "chat.agent.autoSwitch.tiers.debug": [
    "error", "bug", "crash", "broken", "not working",
    "failing", "stack trace", "exception", "undefined"
  ],
  "chat.agent.autoSwitch.tiers.frontend": [
    "react", "component", "jsx", "tsx", "ui",
    "css", "tailwind", "shadcn", "html", "page"
  ],
  "chat.agent.autoSwitch.tiers.backend": [
    "api", "endpoint", "route", "express", "node",
    "server", "middleware", "rest", "request"
  ],
  "chat.agent.autoSwitch.tiers.database": [
    "sql", "query", "database", "table", "schema",
    "migration", "index", "postgresql"
  ],
  "chat.agent.autoSwitch.tiers.tester": [
    "test", "spec", "coverage", "vitest", "playwright",
    "mock", "tdd", "bdd"
  ],
  "chat.agent.autoSwitch.tiers.devops": [
    "docker", "kubernetes", "deploy", "ci/cd", "github actions",
    "pipeline", "build", "release"
  ],
  "chat.agent.autoSwitch.tiers.performance": [
    "slow", "performance", "optimize", "speed",
    "memory", "cache", "lighthouse", "core web vitals"
  ],
  "chat.agent.autoSwitch.tiers.security": [
    "security", "vulnerability", "auth", "permission"
  ],

  // Agent Commands with Expert Files
  "chat.agent.commands": [
    { "name": "architect", "description": "Senior Software Architect", "model": "MiniMax-M3", "agentFile": ".github/agents/architect.agent.md" },
    { "name": "backend", "description": "Senior Backend Engineer - Node.js, Express, PostgreSQL", "model": "MiniMax-M3", "agentFile": ".github/agents/backend.agent.md" },
    { "name": "frontend", "description": "Senior Frontend Engineer - React, TypeScript, Tailwind", "model": "MiniMax-M3", "agentFile": ".github/agents/frontend.agent.md" },
    { "name": "database", "description": "Database Expert - PostgreSQL, queries, indexes", "model": "MiniMax-M3", "agentFile": ".github/agents/database.agent.md" },
    { "name": "security", "description": "Security Expert - OWASP, JWT, OAuth", "model": "MiniMax-M3", "agentFile": ".github/agents/security.agent.md" },
    { "name": "tester", "description": "QA Engineer - Vitest, Playwright", "model": "MiniMax-M3", "agentFile": ".github/agents/tester.agent.md" },
    { "name": "reviewer", "description": "Code Review Expert", "model": "MiniMax-M3", "agentFile": ".github/agents/reviewer.agent.md" },
    { "name": "devops", "description": "DevOps Expert - Docker, CI/CD", "model": "MiniMax-M3", "agentFile": ".github/agents/devops.agent.md" },
    { "name": "performance", "description": "Performance Engineer - Core Web Vitals", "model": "MiniMax-M3", "agentFile": ".github/agents/performance.agent.md" },
    { "name": "refactor", "description": "Refactoring Expert", "model": "MiniMax-M3", "agentFile": ".github/agents/refactor.agent.md" },
    { "name": "doc", "description": "Documentation Expert - JSDoc, OpenAPI", "model": "MiniMax-M3", "agentFile": ".github/agents/doc.agent.md" },
    { "name": "debug", "description": "Debugging Expert - error analysis", "model": "MiniMax-M3", "agentFile": ".github/agents/debug.agent.md" }
  ]
'''

# Insert before the final closing brace
new_content = content[:last_closing_brace] + auto_switch + '\n}\n'

file_path.write_text(new_content, encoding='utf-8')

# Verify
open_b = new_content.count('{')
close_b = new_content.count('}')
print(f"\nAfter update:")
print(f"  Chars: {len(new_content)}")
print(f"  Lines: {len(new_content.split(chr(10)))}")
print(f"  Open braces {{: {open_b}")
print(f"  Close braces }}: {close_b}")
print(f"  Status: {'OK' if open_b == close_b else 'MISMATCH!'}")
