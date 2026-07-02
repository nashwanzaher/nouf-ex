#!/usr/bin/env python3
"""Find unbalanced braces in settings.json"""
from pathlib import Path

file_path = Path(r'c:\Users\zaher\Desktop\nouf-ex\.vscode\settings.json')
content = file_path.read_text(encoding='utf-8')
lines = content.split('\n')

# Track brace balance line by line
balance = 0
last_brace_line = None
issues = []

for i, line in enumerate(lines):
    # Remove comments
    stripped = line
    if '//' in line:
        # Simple approach - only remove if // is at start or after whitespace
        # Need to be careful inside strings
        stripped = line  # Keep full line for now

    # Count braces (excluding those in comments and strings)
    # Simple approach: just count open/close braces outside of comments
    in_comment = stripped.lstrip().startswith('//')

    if not in_comment:
        open_count = line.count('{')
        close_count = line.count('}')
        balance += open_count - close_count

        if balance < 0:
            issues.append((i + 1, balance, line.strip()[:80]))

print(f"Final balance: {balance}")
print(f"Total issues (negative balance): {len(issues)}")
if issues:
    print("\nFirst 10 issues:")
    for line_num, bal, content in issues[:10]:
        print(f"  Line {line_num}: balance={bal} | {content}")
