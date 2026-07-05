#!/usr/bin/env python3
"""Fix orphan closing braces in settings.json."""
from pathlib import Path
import re

file_path = Path(r'c:\Users\zaher\Desktop\nouf-ex\.vscode\settings.json')
content = file_path.read_text(encoding='utf-8')
lines = content.split('\n')

print("Fixing orphan closing braces in settings.json...")
print(f"Original lines: {len(lines)}")

# Find orphan `},` (closing brace without a matching opening brace before it)
# These appear when there's a section like:
#   "key": "value",
#   },   <-- ORPHAN - should be removed
#
# A valid pattern is:
#   "key": { ... },
# or
#   "key": "value"

fixed_lines = []
removed = 0

i = 0
while i < len(lines):
    line = lines[i]
    stripped = line.strip()

    # Check if this is an orphan `},` line
    # Pattern: line is just `},` and previous non-comment line didn't end with `{`
    if stripped == '},' or stripped == '}':
        # Look back to find the last non-comment, non-empty line
        prev_significant = None
        for j in range(len(fixed_lines) - 1, -1, -1):
            prev = fixed_lines[j].strip()
            if not prev or prev.startswith('//'):
                continue
            prev_significant = prev
            break

        # If the previous significant line ends with `{` or contains `{` not closed, this is a close
        # If the previous significant line ends with `,` (key-value) this is an orphan `},`
        is_orphan = False
        if prev_significant:
            prev_stripped = prev_significant.rstrip(',').rstrip()
            # If previous was a key-value (not an object), then `},` is orphan
            if prev_stripped.endswith('"') or prev_stripped.endswith('true') or \
               prev_stripped.endswith('false') or prev_stripped.endswith(']') or \
               prev_stripped.endswith('null') or prev_stripped.isdigit() or \
               prev_stripped.startswith('//') or '": "' in prev_stripped or \
               '": true' in prev_stripped or '": false' in prev_stripped or \
               '": [' in prev_stripped:
                is_orphan = True

        if is_orphan:
            removed += 1
            i += 1
            continue

    fixed_lines.append(line)
    i += 1

# Now we need to verify and add the final closing brace
# Count braces again
new_content = '\n'.join(fixed_lines)

# Check if we need a final closing brace
open_b = new_content.count('{')
close_b = new_content.count('}')

print(f"After first pass: open={open_b}, close={close_b}, removed={removed}")

# If still unbalanced, try a more careful approach
if open_b != close_b:
    print(f"Still unbalanced: open={open_b}, close={close_b}")
    print("Need more aggressive fix...")

# Write back
file_path.write_text(new_content, encoding='utf-8')
print(f"\nFinal: {len(fixed_lines)} lines (removed {removed} orphan braces)")
print(f"Final balance: open={open_b}, close={close_b}")
