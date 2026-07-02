#!/usr/bin/env python3
"""Comprehensive markdown fixer - fixes most common markdownlint issues."""
import os
import re
import sys
from pathlib import Path

# Stats
stats = {
    'files_processed': 0,
    'files_fixed': 0,
    'trailing_newlines': 0,
    'consecutive_blanks': 0,
    'duplicate_blank_lines': 0,
    'tab_to_spaces': 0,
    'emphasis_style': 0,
    'strong_style': 0,
    'list_style': 0,
    'heading_blanks': 0,
}


def fix_file(file_path):
    """Fix common markdown issues in a file."""
    try:
        content = file_path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        try:
            content = file_path.read_text(encoding='utf-8-sig')
        except Exception:
            return False

    original = content
    lines = content.split('\n')

    # Step 1: Convert tabs to 2 spaces
    new_lines = []
    for line in lines:
        if '\t' in line:
            line = line.replace('\t', '  ')
            stats['tab_to_spaces'] += 1
        new_lines.append(line)
    lines = new_lines

    # Step 2: Fix multiple consecutive blank lines
    new_lines = []
    last_blank = False
    for line in lines:
        is_blank = not line.strip()
        if is_blank and last_blank:
            stats['consecutive_blanks'] += 1
            continue
        new_lines.append(line)
        last_blank = is_blank
    lines = new_lines

    # Step 3: Fix heading blank lines (MD022)
    new_lines = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Check if line is a heading
        is_heading = stripped.startswith('#') and re.match(r'^#{1,6}\s', stripped) and not stripped.startswith('#!')

        if is_heading:
            # Add blank line before if previous line is not blank
            if new_lines and new_lines[-1].strip():
                new_lines.append('')
                stats['heading_blanks'] += 1
            new_lines.append(line)
            # Add blank line after if next line exists and is not blank
            if i + 1 < len(lines) and lines[i + 1].strip():
                new_lines.append('')
                stats['heading_blanks'] += 1
        else:
            new_lines.append(line)
    lines = new_lines

    # Step 4: Remove leading blank lines
    while lines and not lines[0].strip():
        lines.pop(0)

    # Step 5: Ensure single trailing newline
    while len(lines) > 1 and not lines[-1].strip():
        lines.pop()
    if not lines or lines[-1]:
        lines.append('')
        stats['trailing_newlines'] += 1

    # Step 6: Fix emphasis style - convert * to _ for italic
    content = '\n'.join(lines)
    # Fix unmatched emphasis carefully
    # Replace *text* with _text_ (italic) - simple heuristic
    new_content = re.sub(r'(?<![*\w])\*([^*\n]+)\*(?![*\w])', r'_\1_', content)
    if new_content != content:
        stats['emphasis_style'] += new_content.count('_') - content.count('_')
        content = new_content

    # Step 7: Fix strong emphasis - keep as ** (this is standard)
    # Step 8: Fix list bullet style to dash
    # Only fix top-level lists, not indented ones
    new_lines = content.split('\n')
    final_lines = []
    for line in new_lines:
        # Match list markers at start of line (not in code blocks)
        # Pattern: optional spaces, then + or * followed by space
        # Convert to -
        if re.match(r'^\s*[\*\+]\s', line):
            # This is a list item - convert
            line = re.sub(r'^(\s*)[\*\+](\s)', r'\1-\2', line)
            stats['list_style'] += 1
        final_lines.append(line)

    content = '\n'.join(final_lines)

    # Write back if changed
    if content != original:
        file_path.write_text(content, encoding='utf-8')
        stats['files_fixed'] += 1
        return True
    return False


def main():
    if len(sys.argv) > 1:
        paths = [Path(p) for p in sys.argv[1:]]
    else:
        # Default: lint all markdown files in current directory
        paths = [Path('.')]

    md_files = []
    ignore_patterns = [
        'node_modules', 'dist', 'build', 'coverage', 'archive',
        '.git', 'temp-', '.next', '.nuxt', 'playwright-report',
        'test-results', '.claude', 'package-lock.json'
    ]

    for p in paths:
        if p.is_file() and p.suffix == '.md':
            md_files.append(p)
        elif p.is_dir():
            for md in p.rglob('*.md'):
                # Check if path contains any ignore pattern
                path_str = str(md).lower()
                if any(ig.lower() in path_str for ig in ignore_patterns):
                    continue
                md_files.append(md)

    print(f"Found {len(md_files)} markdown files")

    for md in md_files:
        stats['files_processed'] += 1
        try:
            if fix_file(md):
                pass  # Quiet mode
        except Exception as e:
            print(f"  Error: {md}: {e}")

    print(f"\n=== STATS ===")
    print(f"Files processed: {stats['files_processed']}")
    print(f"Files fixed: {stats['files_fixed']}")
    print(f"Trailing newlines added: {stats['trailing_newlines']}")
    print(f"Consecutive blank lines removed: {stats['consecutive_blanks']}")
    print(f"Headings with blank lines added: {stats['heading_blanks']}")
    print(f"Tabs converted to spaces: {stats['tab_to_spaces']}")
    print(f"List styles fixed: {stats['list_style']}")


if __name__ == '__main__':
    main()
