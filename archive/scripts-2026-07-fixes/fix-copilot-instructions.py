#!/usr/bin/env python3
"""Fix copilot-instructions.md - remove duplicate separator lines and fix headings."""
import sys
from pathlib import Path

file_path = Path(r'c:\Users\zaher\Desktop\nouf-ex\.github\copilot-instructions.md')

# Read the file with UTF-8
content = file_path.read_text(encoding='utf-8')
lines = content.split('\n')

# Step 1: Remove lines that are just separator characters
separator_chars = set('═╔╗║╚╝─━')
def is_separator_line(line):
    stripped = line.strip()
    if not stripped:
        return False
    # Check if line contains mostly separator chars (at least 80%)
    sep_count = sum(1 for c in stripped if c in separator_chars)
    return sep_count >= len(stripped) * 0.5

output = []
for line in lines:
    if is_separator_line(line):
        continue
    output.append(line)

# Step 2: Remove consecutive blank lines
result = []
for line in output:
    if not line.strip() and result and not result[-1].strip():
        continue
    result.append(line)

# Step 3: Ensure blank lines around headings
final = []
for i, line in enumerate(result):
    stripped = line.strip()
    if stripped.startswith('#') and not stripped.startswith('#!'):
        # This is a heading
        # Ensure blank line before (unless it's the first line)
        if final and final[-1].strip():
            final.append('')
        final.append(line)
        # Ensure blank line after (unless it's the last line)
        if i + 1 < len(result) and result[i + 1].strip():
            final.append('')
    else:
        final.append(line)

# Step 4: Remove leading blank lines
while final and not final[0].strip():
    final.pop(0)

# Step 5: Ensure single trailing newline
while len(final) > 1 and not final[-1].strip():
    final.pop()

if not final or final[-1]:
    final.append('')

# Write back
new_content = '\n'.join(final)
file_path.write_text(new_content, encoding='utf-8')

print(f"Original: {len(lines)} lines")
print(f"Final: {len(final)} lines")
print(f"Removed: {len(lines) - len(final)} lines")
