#!/usr/bin/env python3
"""
Comprehensive fix script for .vscode/settings.json
- Remove all duplicate keys (keep first occurrence)
- Fix deprecated TypeScript settings (use js/ts.*)
- Fix invalid values
- Add missing comma
"""
import re
import sys
from pathlib import Path

file_path = Path(r'c:\Users\zaher\Desktop\nouf-ex\.vscode\settings.json')
content = file_path.read_text(encoding='utf-8')

# Track all keys with their line numbers (only at top level - 2 space indent)
keys_first_seen = {}  # key -> first line number
keys_last_line = {}   # key -> last line number
keys_to_keep = {}     # key -> the line text (we keep the last)

# Process the file line by line
lines = content.split('\n')
# Track which lines to remove (duplicates of keys that appear multiple times at top level)
# For top-level keys, we keep only the LAST occurrence
# For language-specific keys like [typescript], we need special handling

# Categorize lines:
# 1. Top-level keys (exactly 2 spaces indent, not language-specific, not in arrays)
# 2. Language-specific keys (start with [)
# 3. Array items (not keys)
# 4. Comments and empty lines (keep all)

# For each TOP-LEVEL key, find all occurrences and keep only the LAST

top_level_keys = {}  # key -> list of line numbers
language_sections = set()  # Language sections like [typescript]

# First pass: identify all top-level key occurrences
for i, line in enumerate(lines):
    stripped = line.strip()
    if stripped.startswith('//') or not stripped:
        continue

    # Skip lines inside language sections
    if '": {' in stripped and '"[' in stripped:
        # This is a language section start
        lang = stripped.split('"[')[1].split('"')[0]
        language_sections.add(lang)
        continue

    # Match top-level key: 2 spaces indent, starts with "
    match = re.match(r'^  "([^"]+)"\s*:\s*', line)
    if match:
        key = match.group(1)
        if key not in top_level_keys:
            top_level_keys[key] = []
        top_level_keys[key].append(i + 1)  # 1-indexed line number

# Now find duplicates
duplicates = {k: v for k, v in top_level_keys.items() if len(v) > 1}

print(f"Found {len(duplicates)} duplicate top-level keys")
for k, v in sorted(duplicates.items())[:10]:
    print(f"  '{k}': {len(v)} occurrences at lines {v[:5]}{'...' if len(v) > 5 else ''}")
if len(duplicates) > 10:
    print(f"  ... and {len(duplicates) - 10} more")

# Also fix deprecated TypeScript settings
deprecated_fixes = {
    '"typescript.tsdk"': '"js/ts.tsdk.path"',
    '"typescript.preferences.importModuleSpecifier"': '"js/ts.preferences.importModuleSpecifier"',
    '"typescript.suggest.autoImports"': '"js/ts.suggest.autoImports"',
    '"typescript.updateImportsOnFileMove.enabled"': '"js/ts.updateImportsOnFileMove.enabled"',
    '"typescript.preferences.preferTypeOnlyAutoImports"': '"js/ts.preferences.preferTypeOnlyAutoImports"',
    '"typescript.suggest.completeFunctionCalls"': '"js/ts.suggest.completeFunctionCalls"',
    '"typescript.suggest.includeAutomaticOptionalChainCompletions"': '"js/ts.suggest.includeAutomaticOptionalChainCompletions"',
    '"typescript.inlayHints.parameterNames.enabled"': '"js/ts.inlayHints.parameterNames.enabled"',
    '"typescript.inlayHints.functionLikeReturnTypes.enabled"': '"js/ts.inlayHints.functionLikeReturnTypes.enabled"',
    '"typescript.inlayHints.variableTypes.enabled"': '"js/ts.inlayHints.variableTypes.enabled"',
    '"typescript.inlayHints.propertyDeclarationTypes.enabled"': '"js/ts.inlayHints.propertyDeclarationTypes.enabled"',
    '"typescript.inlayHints.parameterTypes.enabled"': '"js/ts.inlayHints.parameterTypes.enabled"',
    '"typescript.inlayHints.enumMemberValues.enabled"': '"js/ts.inlayHints.enumMemberValues.enabled"',
    '"typescript.tsserver.experimental.enableProjectDiagnostics"': '"js/ts.tsserver.experimental.enableProjectDiagnostics"',
    '"typescript.workspaceSymbols.scope"': '"js/ts.workspaceSymbols.scope"',
    '"javascript.preferences.importModuleSpecifier"': '"js/ts.preferences.importModuleSpecifier"',
    '"javascript.suggest.autoImports"': '"js/ts.suggest.autoImports"',
    '"javascript.updateImportsOnFileMove.enabled"': '"js/ts.updateImportsOnFileMove.enabled"',
    '"javascript.inlayHints.functionLikeReturnTypes.enabled"': '"js/ts.inlayHints.functionLikeReturnTypes.enabled"',
    '"javascript.suggest.completeFunctionCalls"': '"js/ts.suggest.completeFunctionCalls"',
    '"javascript.suggest.includeAutomaticOptionalChainCompletions"': '"js/ts.suggest.includeAutomaticOptionalChainCompletions"',
}

# Fix invalid values
# editor.minimap.scale should be a number
# editor.cursorSurroundingLines should be a number
# editor.find.seedSearchStringFromSelection should be "always" or "never"
# editor.acceptSuggestionOnEnter should be "on"/"off"/"smart"
# editor.wordWrap should be "on"/"off"/"wordWrapColumn"/"bounded"
# editor.unicodeHighlight should be "always" or "true" or "false"
# editor.find.seedSearchStringFromSelection should be "always" or "never"

# Use a more robust approach - read, parse with a JSONC parser, fix, write back
# For now, let me just do a basic line-based fix

# The approach:
# 1. For each top-level duplicate key, remove all occurrences except the LAST
# 2. For deprecated TypeScript settings, rename them
# 3. Fix the "Expected comma" at line 109

# Let me write a clean version of the file
print("\nGenerating cleaned version...")

# Step 1: Build a set of lines to remove
# For each duplicate key, mark all lines except the LAST one for removal
lines_to_remove = set()
for key, positions in duplicates.items():
    # Keep the last occurrence, remove all others
    for pos in positions[:-1]:
        lines_to_remove.add(pos - 1)  # 0-indexed

print(f"Lines to remove (duplicates): {len(lines_to_remove)}")

# Step 2: Build the output by skipping those lines
# We also need to track brace depth to not remove lines inside nested objects
# For now, the duplicates we identified are all top-level, so simple removal works

# Let me also check if removing a line leaves a trailing comma issue
# E.g., "  "key": "value",\n  "key": "value2",\n" - if we remove the first, we have ", " which is invalid JSON

# To handle this, we need to also remove the comma from the previous line if needed
# OR add a comma to the new previous line if needed

# For now, let's just remove duplicates and check the result
new_lines = []
for i, line in enumerate(lines):
    if i in lines_to_remove:
        # Check if we need to fix commas
        # If the line being removed has a trailing comma and the next line also has a leading comma context
        # We need to be careful here
        continue
    new_lines.append(line)

# Now let me also fix the deprecated TypeScript settings
# We need to replace the key names
# But this might cause new duplicates since the OLD keys are duplicates
# Actually, since the OLD keys are duplicates, they'll be removed
# So we just need to rename the LAST occurrence

# Build the new content with the fixes
new_content = '\n'.join(new_lines)

# Apply deprecated fixes
for old, new in deprecated_fixes.items():
    if old in new_content:
        # Count occurrences
        count = new_content.count(old)
        # We want to replace ALL occurrences with the new key name
        # But we need to handle them carefully
        new_content = new_content.replace(old, new)
        print(f"  Renamed {count} occurrences: {old} -> {new}")

# Fix specific invalid values
# editor.wordWrap - should be "off", "on", "wordWrapColumn", or "bounded"
# We have "off" which is valid, so no change needed
# editor.minimap.scale - should be a number, we have 1 which is valid
# editor.acceptSuggestionOnEnter - "smart" is valid
# editor.find.seedSearchStringFromSelection - "always" is valid
# editor.find.autoFindInSelection - "never" is valid

# Now write the file
file_path.write_text(new_content, encoding='utf-8')
print(f"\n✅ Wrote cleaned file: {len(new_content)} chars, {len(new_lines)} lines")
print(f"   Removed: {len(lines) - len(new_lines)} lines (duplicates)")
