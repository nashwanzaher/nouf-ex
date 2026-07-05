#!/usr/bin/env python3
"""Find duplicate keys in settings.json with line numbers."""
import re
import sys
from pathlib import Path
from collections import defaultdict

file_path = Path(r'c:\Users\zaher\Desktop\nouf-ex\.vscode\settings.json')
content = file_path.read_text(encoding='utf-8')
lines = content.split('\n')

key_lines = defaultdict(list)

# Match top-level keys (not nested in objects)
# A key is at the top level if the indentation matches the base level
# Find the base indent by looking at the first key
base_indent = None
for i, line in enumerate(lines):
    stripped = line.lstrip()
    if stripped.startswith('"') and ':' in stripped:
        indent = len(line) - len(stripped)
        if base_indent is None and indent > 0:
            base_indent = indent
            break

print(f"Base indent: {base_indent}")
print(f"Looking for top-level keys with this indent\n")

# Find top-level keys
in_object = False
brace_depth = 0
for i, line in enumerate(lines):
    stripped = line.lstrip()
    indent = len(line) - len(stripped)

    # Track brace depth to know if we're in a nested object
    opens = line.count('{')
    closes = line.count('}')
    brace_depth_before = brace_depth
    brace_depth += opens - closes

    # Match top-level key (indent matches base)
    if base_indent is not None and indent == base_indent:
        match = re.match(r'^"([^"]+)"\s*:', stripped)
        if match:
            key = match.group(1)
            key_lines[key].append((i + 1, brace_depth_before == 0))

# Print duplicates
duplicates = {k: v for k, v in key_lines.items() if len(v) > 1}
if duplicates:
    print("Duplicate top-level keys found:")
    for key, positions in sorted(duplicates.items()):
        line_nums = [p[0] for p in positions]
        print(f'  "{key}" - lines: {", ".join(map(str, line_nums))}')
else:
    print("No top-level duplicates found")

# Also check all keys (including nested)
print("\n--- All keys (for reference) ---")
all_key_lines = defaultdict(list)
for i, line in enumerate(lines):
    stripped = line.lstrip()
    if stripped.startswith('"') and ':' in stripped:
        match = re.match(r'^"([^"]+)"\s*:', stripped)
        if match:
            all_key_lines[match.group(1)].append(i + 1)

all_duplicates = {k: v for k, v in all_key_lines.items() if len(v) > 1}
print(f"Total keys with duplicates: {len(all_duplicates)}")
for key in sorted(all_duplicates.keys()):
    line_nums = all_duplicates[key]
    if key.startswith('['):  # Language-specific
        continue
    print(f'  "{key}" - {len(line_nums)} occurrences at lines: {", ".join(map(str, line_nums))}')