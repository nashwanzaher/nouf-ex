# Comprehensive settings.json deduplication script
# Removes duplicates by keeping the LAST occurrence of each key

param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath
)

$content = Get-Content $FilePath -Encoding UTF8 -Raw
$lines = $content -split "`n"

# Strategy:
# 1. Find all top-level keys and remove earlier duplicates
# 2. Track last line of each top-level key
# 3. Anything between duplicate keys is removed
# But we need to preserve comments and structure

# Better strategy: Process line by line, track which top-level keys we've seen
# Keep only the LAST definition (using last value wins)

# Build a map: top-level key -> last (start_line, end_line)

# Parse JSON manually using PowerShell's JSON converter with JSONC support
# Use regex to find top-level keys and their ranges
$keys_info = @{}
$current_key = $null
$current_start = 0

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]

    # Check if this line starts a new top-level key
    if ($line -match '^  "([^"]+)"\s*:\s*') {
        # Save previous key info
        if ($null -ne $current_key -and $current_start -le ($i - 1)) {
            $keys_info[$current_key] = @{
                Start = $current_start
                End = $i - 1
                Indent = 2
            }
        }
        $current_key = $matches[1]
        $current_start = $i

        # Check if value is object or inline
        # If line ends with { or [, it's multi-line
        $trimmed_line = $line.TrimEnd()
        if ($trimmed_line.EndsWith('{') -or $trimmed_line.EndsWith('[')) {
            # Multi-line value - wait for closing
            $current_key = $current_key  # Keep tracking
        } else {
            # Single line value - done immediately
            $keys_info[$current_key] = @{
                Start = $current_start
                End = $i
                Indent = 2
            }
            $current_key = $null
        }
    }
}

# Save last key
if ($null -ne $current_key) {
    $keys_info[$current_key] = @{
        Start = $current_start
        End = $lines.Count - 1
        Indent = 2
    }
}

# Group by key name and find duplicates
$key_groups = $keys_info.GetEnumerator() | Group-Object Name
$duplicates = @{}
foreach ($group in $key_groups) {
    if ($group.Count -gt 1) {
        # Sort by start line, keep only the last
        $sorted = $group.Group | Sort-Object Start
        # All but the last should be removed (we'll keep ranges)
        $toRemove = $sorted | Select-Object -First ($sorted.Count - 1)
        foreach ($r in $toRemove) {
            $duplicates[$r.Start] = $r
        }
    }
}

# Now build the result: skip lines that are in removed ranges
# But preserve structure - we need to also remove comments/blank lines between them

# Get the ranges that need to be removed (the duplicate blocks)
# A block to remove starts at the key's indentation and goes until a line with less indentation

$sorted_removals = $duplicates.Values | Sort-Object Start

# Create a list of (start, end) ranges to remove
$remove_ranges = @()
foreach ($r in $sorted_removals) {
    # The block starts at $r.Start (the duplicate key line)
    # It ends just before the next valid block
    $block_end = $r.End
    # Find where this block actually ends (next line with <= indent 2)
    for ($j = $r.End + 1; $j -lt $lines.Count; $j++) {
        $next_line = $lines[$j]
        if ($next_line -match '^( {0,2})\S' -and $next_line.Trim() -ne '' -and -not $next_line.Trim().StartsWith('//')) {
            # Has same or less indentation = end of this block
            $block_end = $j - 1
            break
        }
    }
    $remove_ranges += @{ Start = $r.Start; End = $block_end }
}

# Write report
Write-Host "=== Duplicates to Remove ==="
foreach ($group in $key_groups) {
    if ($group.Count -gt 1) {
        $sorted = $group.Group | Sort-Object Start
        Write-Host "  '$($group.Name)' - $($group.Count) occurrences at lines: $(($sorted | ForEach-Object { $_.Start + 1 }) -join ', ')"
    }
}

Write-Host "`nTotal ranges to remove: $($remove_ranges.Count)"
