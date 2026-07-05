#!/usr/bin/env python3
"""Verify the capabilities sections in settings.json."""
import re
from pathlib import Path

file_path = Path(r'c:\Users\zaher\Desktop\nouf-ex\.vscode\settings.json')
content = file_path.read_text(encoding='utf-8')
lines = content.split('\n')

# Find all section headers
sections = []
for i, line in enumerate(lines):
    match = re.match(r'//\s*─+\s*(\d+\.\s+[^─]+)', line)
    if match:
        sections.append((i + 1, match.group(1).strip()))

print("=== Capability Sections in settings.json ===\n")
for line_num, name in sections:
    print(f"  Line {line_num}: {name}")

# Count specific capabilities
print(f"\n=== Total sections: {len(sections)}")

# Check for key keywords
keywords = {
    'Code Generation': r'codeGeneration\.enabled.*true',
    'Code Completion': r'codeCompletion\.enabled.*true',
    'Bug Fix': r'bugFix\.enabled.*true',
    'Refactoring': r'refactoring\.enabled.*true',
    'Test Generation': r'testGeneration\.enabled.*true',
    'Frontend React': r'frontend\.react\.enabled.*true',
    'Frontend Next.js': r'frontend\.nextjs\.enabled.*true',
    'Tailwind': r'frontend\.tailwind\.enabled.*true',
    'Backend Node.js': r'backend\.nodejs\.enabled.*true',
    'Backend Express': r'backend\.express\.enabled.*true',
    'REST API': r'api\.rest\.enabled.*true',
    'JWT Auth': r'auth\.jwt\.enabled.*true',
    'OAuth': r'auth\.oauth2\.enabled.*true',
    'WebSocket': r'realtime\.websocket\.enabled.*true',
    'Socket.IO': r'realtime\.socketIO\.enabled.*true',
    'PDF Generation': r'docs\.pdfGeneration\.enabled.*true',
    'Excel': r'docs\.excel\.enabled.*true',
    'PowerPoint': r'docs\.powerpoint\.enabled.*true',
    'Word': r'docs\.word\.enabled.*true',
    'Multi-Agent Coordination': r'subagent\.coordination\.enabled.*true',
    'Long Context 1M': r'chat\.context\.maxTokens.*1000000',
    'Claude Code': r'integrations\.claudeCode\.enabled.*true',
    'Cursor': r'integrations\.cursor\.enabled.*true',
    'VS Code Integration': r'integrations\.vscode\.enabled.*true',
    'MCP Enabled': r'chat\.mcp\.enabled.*true',
    'MCP Filesystem': r'mcp\.servers\.filesystem\.enabled.*true',
    'MCP Git': r'mcp\.servers\.git\.enabled.*true',
    'MCP Memory': r'mcp\.servers\.memory\.enabled.*true',
    'MCP Sequential Thinking': r'mcp\.servers\.sequentialThinking\.enabled.*true',
    'Subagent Tools': r'tools\.defaultToolsGrouped.*true',
    'Custom Commands': r'chat\.agent\.customCommands',
    'Permissions': r'chat\.permissions\.',
    'Memory Persistence': r'memory\.persistence\.enabled.*true',
}

print("\n=== Key Capabilities Check ===\n")
for name, pattern in keywords.items():
    found = bool(re.search(pattern, content))
    status = '✅' if found else '❌'
    print(f"  {status} {name}")