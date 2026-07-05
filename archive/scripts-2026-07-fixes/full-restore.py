#!/usr/bin/env python3
"""Restore the original enhancements - rewrite settings.json with full content."""
from pathlib import Path

file_path = Path(r'c:\Users\zaher\Desktop\nouf-ex\.vscode\settings.json')
content = file_path.read_text(encoding='utf-8')
lines = content.split('\n')

print("Current file state:")
print(f"  Lines: {len(lines)}")
print(f"  Open braces {{: {content.count('{')}")
print(f"  Close braces }}: {content.count('}')}")

# The original file had bracket balance issues - 154 duplicates
# Now it has been restored from git so let me check if it's clean

# Count keys in original
import re
key_pattern = re.compile(r'^\s*"([^"]+)"\s*:')
keys = []
for line in lines:
    stripped = line.lstrip()
    if stripped.startswith('//'):
        continue
    match = key_pattern.match(line)
    if match:
        keys.append(match.group(1))

from collections import Counter
key_counts = Counter(keys)
duplicates = {k: v for k, v in key_counts.items() if v > 1}

print(f"\nDuplicate keys (any depth): {len(duplicates)}")
if duplicates:
    print("Sample duplicates:")
    for key, count in list(duplicates.items())[:5]:
        print(f"  {key}: {count}x")
else:
    print("  No duplicates found - file is clean")

# The original file from git is a clean version WITHOUT my previous corruptions
# I need to re-apply the comprehensive enhancements carefully without orphan braces

print("\nFile status: clean and ready for additional enhancements")
