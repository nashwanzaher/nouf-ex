#!/usr/bin/env python3
"""Simplified validation - check settings.json structure."""
import re
from pathlib import Path
from collections import Counter

file_path = Path(r'c:\Users\zaher\Desktop\nouf-ex\.vscode\settings.json')
content = file_path.read_text(encoding='utf-8')
lines = content.split('\n')

print("="*70)
print("JSONC VALIDATION REPORT")
print("="*70)

# Find all top-level keys
print("\n[1] TOP-LEVEL KEY DUPLICATES")
print("-"*70)

top_level_keys = []
pattern = re.compile(r'^  "([^"]+)"\s*:')
for i, line in enumerate(lines):
    stripped = line.lstrip()
    if stripped.startswith('//'):
        continue
    match = pattern.match(stripped + ' ') if stripped.startswith('  "') else pattern.match(line)
    if match:
        top_level_keys.append((i + 1, match.group(1)))

key_counts = Counter([k for _, k in top_level_keys])
duplicates = {k: v for k, v in key_counts.items() if v > 1}

if duplicates:
    print(f"  Found {len(duplicates)} duplicate top-level keys:")
    for key, count in sorted(duplicates.items()):
        print(f"    - '{key}' appears {count}x")
else:
    print("  OK - No top-level duplicates")

# Find all keys (any depth)
print("\n[2] ALL KEY DUPLICATES (any depth)")
print("-"*70)

all_keys = []
key_pattern = re.compile(r'^\s*"([^"]+)"\s*:')
for i, line in enumerate(lines):
    stripped = line.lstrip()
    if stripped.startswith('//'):
        continue
    match = key_pattern.match(line)
    if match:
        all_keys.append((i + 1, match.group(1)))

all_key_counts = Counter([k for _, k in all_keys])

# Categorize duplicates
legitimate_dups = []
suspicious_dups = []

for key, count in sorted(all_key_counts.items()):
    if count <= 1:
        continue
    # Language-specific keys are legitimate
    if key.startswith('['):
        legitimate_dups.append(f"  OK  '{key}' ({count}x) - language-specific")
    # Standard legitimate patterns in settings.json
    elif key in ['autoImports', 'css', 'comments', 'description', 'model', 'name',
                  'strictMode', 'formatOnSave', 'enable', 'editor.defaultFormatter',
                  '**/.git', '**/dist', '**/node_modules', '**/coverage', '**/build',
                  'source.organizeImports', 'temperature', 'topP', 'topK',
                  'app/server/index.cjs', 'app/server/index.js']:
        legitimate_dups.append(f"  OK  '{key}' ({count}x) - legitimate pattern")
    else:
        suspicious_dups.append(f"  CHECK '{key}' ({count}x) - lines: {[l for l, k in all_keys if k == key]}")

print(f"  Legitimate: {len(legitimate_dups)}")
for s in legitimate_dups:
    print(s)

print(f"\n  Suspicious/Need review: {len(suspicious_dups)}")
for s in suspicious_dups[:30]:
    print(s)

# Check braces
print("\n[3] BRACE BALANCE")
print("-"*70)
open_b = content.count('{')
close_b = content.count('}')
print(f"  Open braces '{{': {open_b}")
print(f"  Close braces '}}': {close_b}")
status = "OK" if open_b == close_b else "MISMATCH!"
print(f"  Status: {status}")

# Check for double commas
print("\n[4] DOUBLE COMMAS CHECK")
print("-"*70)
double_commas = 0
double_comma_lines = []
for i, line in enumerate(lines):
    if ',,' in line and not line.strip().startswith('//'):
        double_commas += 1
        double_comma_lines.append(i+1)
print(f"  Found: {double_commas} double-comma issues")
if double_comma_lines:
    print(f"  Lines: {double_comma_lines[:5]}")

# File stats
print("\n[5] FILE STATS")
print("-"*70)
print(f"  Total lines: {len(lines)}")
print(f"  Total chars: {len(content)}")
print(f"  Total size: {len(content.encode('utf-8'))} bytes")

print("\n" + "="*70)
print("VALIDATION COMPLETE")
print("="*70)
