#!/usr/bin/env python3
"""Find files with most markdown errors."""
import re
from collections import Counter
from pathlib import Path

results_file = Path(r'c:\Users\zaher\Desktop\nouf-ex\markdownlint-results.txt')
content = results_file.read_text(encoding='utf-8')

# Match: filename:line:col error MDxxx
pattern = r'^(.+?\.md):\d+:\d+ error'
matches = re.findall(pattern, content, re.MULTILINE)

counts = Counter(matches)
print("Top 30 files with most errors:")
print("=" * 60)
for filename, count in counts.most_common(30):
    print(f"{count:6d}  {filename}")
print(f"\nTotal unique files with errors: {len(counts)}")
