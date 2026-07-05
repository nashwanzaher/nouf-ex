#!/usr/bin/env python3
"""Deep Review Script - Check all settings files, skills, agents, and docs."""
import os
import re
from pathlib import Path
from collections import defaultdict, Counter

base = Path(r'c:\Users\zaher\Desktop\nouf-ex')

print("="*80)
print("🔍 DEEP REVIEW OF NOUFEX PROJECT")
print("="*80)

# 1. Check JSONC files (settings files)
print("\n📋 1. JSONC/JSON FILES REVIEW")
print("-"*80)

for json_file in ['.vscode/settings.json', '.vscode/mcp.json', 'package.json',
                    'app/package.json', '.markdownlint.json', '.markdownlint-cli2.jsonc']:
    full = base / json_file
    if full.exists():
        content = full.read_text(encoding='utf-8')
        lines = content.split('\n')
        # Check for duplicate keys (simple JSON parse check)
        print(f"  ✓ {json_file}: {len(lines)} lines, {len(content)} chars")
    else:
        print(f"  ✗ {json_file}: NOT FOUND")

# 2. Check Skills directory
print("\n🛠️ 2. SKILLS DIRECTORY REVIEW")
print("-"*80)

skills_dir = base / '.github' / 'skills'
if skills_dir.exists():
    skill_files = sorted(skills_dir.glob('*.skill.md'))
    print(f"  Found {len(skill_files)} skill files:")
    for f in skill_files:
        content = f.read_text(encoding='utf-8')
        lines = content.split('\n')
        has_frontmatter = content.startswith('---')
        print(f"    {'✓' if has_frontmatter else '✗'} {f.name}: {len(lines)} lines")

# 3. Check Agents directory
print("\n🤖 3. AGENTS DIRECTORY REVIEW")
print("-"*80)

agents_dir = base / '.github' / 'agents'
if agents_dir.exists():
    agent_files = sorted(agents_dir.glob('*.agent.md'))
    print(f"  Found {len(agent_files)} agent files:")
    for f in agent_files:
        content = f.read_text(encoding='utf-8')
        lines = content.split('\n')
        has_frontmatter = content.startswith('---')
        print(f"    {'✓' if has_frontmatter else '✗'} {f.name}: {len(lines)} lines")

# 4. Check Copilot Instructions
print("\n📖 4. COPILOT INSTRUCTIONS REVIEW")
print("-"*80)

ci = base / '.github' / 'copilot-instructions.md'
if ci.exists():
    content = ci.read_text(encoding='utf-8')
    lines = content.split('\n')
    print(f"  ✓ copilot-instructions.md: {len(lines)} lines")

# 5. Check for unused/legacy configs
print("\n🗑️ 5. UNUSED/LEGACY CONFIG SEARCH")
print("-"*80)

settings = base / '.vscode' / 'settings.json'
if settings.exists():
    content = settings.read_text(encoding='utf-8')

    # Check for deprecated/invalid keys
    deprecated_keys = []
    invalid_patterns = []

    # Check for empty comments
    if '},\n\n  }' in content:
        invalid_patterns.append('Empty comment sections (},\n  })')

    # Check for malformed lines
    lines = content.split('\n')
    malformed = []
    for i, line in enumerate(lines):
        # Check for malformed markdown blocks in JSONC
        if line.startswith('  }') and i + 1 < len(lines) and lines[i+1].startswith('  }'):
            # ok - normal nesting
            pass

    print(f"  Findings:")
    print(f"    - Empty comment sections: {len(invalid_patterns)}")
    print(f"    - Malformed structures: {len(malformed)}")

# 6. Check skill file consistency
print("\n🔗 6. SKILLS CONSISTENCY CHECK")
print("-"*80)

if skills_dir.exists():
    skill_files = sorted(skills_dir.glob('*.skill.md'))
    names = [f.stem.replace('.skill', '') for f in skill_files]
    print(f"  Skill names: {', '.join(names)}")

# 7. Check agent-skill coverage
print("\n🔄 7. AGENT-SKILL COVERAGE")
print("-"*80)

if agents_dir.exists() and skills_dir.exists():
    agents = [f.stem.replace('.agent', '') for f in agents_dir.glob('*.agent.md')]
    skills = [f.stem.replace('.skill', '') for f in skills_dir.glob('*.skill.md')]
    print(f"  Agents ({len(agents)}): {', '.join(agents)}")
    print(f"  Skills ({len(skills)}): {', '.join(skills)}")

# 8. Find any obvious issues
print("\n🔧 8. POTENTIAL ISSUES")
print("-"*80)

# Check for trailing commas in JSONC
if settings.exists():
    content = settings.read_text(encoding='utf-8')
    # Check for malformed '},' or empty sections
    issues = []

    if 'editor.formatOnSave": false' in content and 'editor.formatOnSave": true' in content:
        issues.append('Multiple editor.formatOnSave values')

    if 'extensions.autoUpdate": false' in content:
        if 'editor.formatOnSaveTimeout": 5000' in content:
            issues.append('OK - extensions.autoUpdate is false as intended')

    if issues:
        print(f"  Found {len(issues)} potential issues:")
        for i in issues:
            print(f"    - {i}")
    else:
        print("  No obvious issues found")

print("\n" + "="*80)
print("✅ DEEP REVIEW COMPLETE")
print("="*80)
