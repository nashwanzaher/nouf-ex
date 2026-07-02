#!/usr/bin/env python3
"""Verify no duplicate top-level keys in settings.json."""
import re
from pathlib import Path

p = Path(r'c:\Users\zaher\Desktop\nouf-ex\.vscode\settings.json')
text = p.read_text(encoding='utf-8')
lines = text.split('\n')

# Match top-level keys (start with 2 spaces or section headers)
key_re = re.compile(r'^(\s*)(("[^"]+"|\[[^\]]+\])\s*):')

key_lines = {}
for i, line in enumerate(lines, 1):
    m = key_re.match(line)
    if m:
        key = m.group(2).strip()
        key_lines.setdefault(key, []).append(i)

dupes = {k: v for k, v in key_lines.items() if len(v) > 1}
print(f"Total top-level keys: {len(key_lines)}")
print(f"Duplicate keys: {len(dupes)}")
for k, v in dupes.items():
    print(f"  {k}: lines {v}")

# Check for invalid chars in keys
print("\nKeys with quotes/specials (informational):")
for k in sorted(key_lines.keys()):
    if '\\' in k or '"' in k and not k.startswith('"'):
        print(f"  {k}")

print(f"\nFile: {len(lines)} lines, {len(text)} chars")
print(f"File ends with closing brace: {text.rstrip().endswith('}')}")
