#!/usr/bin/env python3
"""Fix all duplicate keys in settings.json - keep LAST occurrence of each key."""
import re
from pathlib import Path

file_path = Path(r'c:\Users\zaher\Desktop\nouf-ex\.vscode\settings.json')
content = file_path.read_text(encoding='utf-8')
lines = content.split('\n')

def find_block_end(start_line_idx, all_lines, base_indent=2):
    """Find the end line index of a block starting at start_line_idx."""
    i = start_line_idx + 1
    while i < len(all_lines):
        line = all_lines[i]
        stripped = line.lstrip()
        if not stripped or stripped.startswith('//'):
            i += 1
            continue
        indent = len(line) - len(stripped)
        if indent < base_indent:
            return i - 1
        if indent == base_indent:
            return i - 1
        i += 1
    return len(all_lines) - 1

# Find all top-level keys
top_level_keys = {}
for i, line in enumerate(lines):
    match = re.match(r'^  "([^"]+)"\s*:\s*', line)
    if match:
        key = match.group(1)
        start = i
        end = find_block_end(i, lines)
        if key not in top_level_keys:
            top_level_keys[key] = []
        top_level_keys[key].append((start, end))

duplicates = {k: v for k, v in top_level_keys.items() if len(v) > 1}
print(f"Found {len(duplicates)} duplicate top-level keys")
print(f"Total duplicate blocks: {sum(len(v) for v in duplicates.values())}")

# Build set of lines to remove (all but last of each duplicate)
lines_to_remove = set()
for key, positions in duplicates.items():
    sorted_positions = sorted(positions, key=lambda x: x[0])
    keep = sorted_positions[-1]
    for start, end in sorted_positions[:-1]:
        for line_idx in range(start, end + 1):
            lines_to_remove.add(line_idx)

print(f"Total lines to remove: {len(lines_to_remove)}")

# Write new file
new_lines = []
for i, line in enumerate(lines):
    if i not in lines_to_remove:
        new_lines.append(line)

new_content = '\n'.join(new_lines)
# Remove multiple consecutive blank lines
new_content = re.sub(r'\n{3,}', '\n\n', new_content)

file_path.write_text(new_content, encoding='utf-8')
print(f"\nWrote cleaned file: {len(new_content)} chars, {len(new_lines)} lines")
print(f"   Was: {len(content)} chars, {len(lines)} lines")
print(f"   Removed: {len(lines) - len(new_lines)} lines")