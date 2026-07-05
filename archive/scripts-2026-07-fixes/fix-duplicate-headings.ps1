# Fix duplicate headings and separator lines
$filePath = 'c:\Users\zaher\Desktop\nouf-ex\.github\copilot-instructions.md'
$lines = [System.IO.File]::ReadAllLines($filePath, [System.Text.Encoding]::UTF8)
$output = New-Object System.Collections.Generic.List[string]
$skipNext = $false
$separatorPattern = '^[\s╔═╗║╚╝─│]*$'

for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    $trimmed = $line.Trim()

    # Check if this is a separator-only line (containing mostly ═ or ╔ ║ ╚)
    if ($trimmed -match '^[═╔╗║╚╝─]+$') {
        # This is a separator line - skip it
        continue
    }

    # If line is empty, ensure we don't have multiple blank lines
    if ([string]::IsNullOrWhiteSpace($line)) {
        if ($output.Count -gt 0 -and [string]::IsNullOrWhiteSpace($output[$output.Count - 1])) {
            # Skip consecutive blank lines (keep max 1)
            continue
        }
    }

    $output.Add($line)
}

# Now fix headings without blank lines before/after
$result = New-Object System.Collections.Generic.List[string]
for ($i = 0; $i -lt $output.Count; $i++) {
    $line = $output[$i]
    $trimmed = $line.Trim()

    if ($trimmed -match '^#{1,6}\s') {
        # It's a heading - ensure blank line before (unless first line)
        if ($result.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($result[$result.Count - 1])) {
            $result.Add("")
        }
        $result.Add($line)
        # Ensure blank line after
        if ($i + 1 -lt $output.Count -and -not [string]::IsNullOrWhiteSpace($output[$i + 1])) {
            $result.Add("")
        }
    } else {
        $result.Add($line)
    }
}

# Write back
[System.IO.File]::WriteAllLines($filePath, $result, [System.Text.UTF8Encoding]::new($false))
Write-Host "Fixed $($lines.Length) lines -> $($result.Count) lines"
Write-Host "Removed $($lines.Length - $result.Count) lines"
