#!/usr/bin/env python3
"""Final fix: remove any duplicate top-level key occurrences (last wins for JSONC, but VS Code may flag duplicates).
We keep the LAST occurrence of each duplicate key.
"""
import re
from pathlib import Path

p = Path(r'c:\Users\zaher\Desktop\nouf-ex\.vscode\settings.json')
text = p.read_text(encoding='utf-8')
lines = text.split('\n')

# Match top-level keys (2-space indent, or sections like "[typescript]")
key_re = re.compile(r'^(\s*)(("[^"]+"|\[[^\]]+\])\s*):')

# Track last occurrence of each key (line number -> key)
last_occ = {}
for i, line in enumerate(lines):
    m = key_re.match(line)
    if m:
        last_occ[m.group(2).strip()] = i

# Determine which lines to drop (any earlier occurrence of a key whose last occurrence is later)
to_drop = set()
for key, last in last_occ.items():
    for i, line in enumerate(lines):
        if i == last:
            continue
        m = key_re.match(line)
        if m and m.group(2).strip() == key:
            to_drop.add(i)

# Build output preserving everything except dropped lines
new_lines = [line for i, line in enumerate(lines) if i not in to_drop]
removed = len(lines) - len(new_lines)
p.write_text('\n'.join(new_lines), encoding='utf-8')
print(f"Removed {removed} duplicate line(s)")
