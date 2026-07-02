#!/usr/bin/env python3
import re
import sys
from pathlib import Path

file_path = Path(r'c:\Users\zaher\Desktop\nouf-ex\.vscode\settings.json')
content = file_path.read_text(encoding='utf-8')
lines = content.split('\n')

keys_seen = {}
duplicates = []

for i, line in enumerate(lines, 1):
    stripped = line.lstrip()
    if stripped.startswith('//'):
        continue
    if line.startswith('  "') and not line.startswith('   "'):
        match = re.match(r'^  "([^"]+)"\s*:', line)
        if match:
            key = match.group(1)
            if key in keys_seen:
                duplicates.append((i, key, keys_seen[key]))
            else:
                keys_seen[key] = i

print('Total: ' + str(len(keys_seen) + len(duplicates)))
print('Unique: ' + str(len(keys_seen)))
print('Duplicates: ' + str(len(duplicates)))
if duplicates:
    for line, key, first in duplicates:
        print('  Line ' + str(line) + ': ' + key + ' (first at ' + str(first) + ')')
else:
    print('OK')
