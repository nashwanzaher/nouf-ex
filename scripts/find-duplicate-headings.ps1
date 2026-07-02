# Find duplicate keys in settings.json
$filePath = 'c:\Users\zaher\Desktop\nouf-ex\.vscode\settings.json'
$content = Get-Content $filePath -Encoding UTF8 -Raw
$lines = $content -split "`n"

# Find all top-level keys (indent = 2 spaces)
$keys = @{}
for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i].TrimEnd()
    if ($line -match '^  "([^"]+)"\s*:\s') {
        $key = $matches[1]
        if ($keys.ContainsKey($key)) {
            $keys[$key] += @($i + 1)
        } else {
            $keys[$key] = @($i + 1)
        }
    }
}

# Find duplicates
$duplicates = $keys.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 }
Write-Host "Top-level duplicates:"
foreach ($dup in $duplicates) {
    $lineStr = $dup.Value -join ", "
    Write-Host "  '$($dup.Key)' - lines: $lineStr"
}

# Also check all keys
$allKeys = @{}
for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i].TrimEnd()
    if ($line -match '^\s+"([^"]+)"\s*:\s') {
        $key = $matches[1]
        if ($allKeys.ContainsKey($key)) {
            $allKeys[$key] += @($i + 1)
        } else {
            $allKeys[$key] = @($i + 1)
        }
    }
}

# Find all duplicates (excluding language-specific)
$allDuplicates = $allKeys.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 -and -not $_.Key.StartsWith('[') -and -not $_.Key.StartsWith('//') }
Write-Host "`nAll non-language duplicates:"
foreach ($dup in $allDuplicates) {
    $lineStr = $dup.Value -join ", "
    Write-Host "  '$($dup.Key)' - $($dup.Value.Count) occurrences at lines: $lineStr"
}

# Check files.exclude and search.exclude (these are objects that get duplicated)
$filesExcludeLines = @()
$searchExcludeLines = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '"files\.exclude"') { $filesExcludeLines += ($i + 1) }
    if ($lines[$i] -match '"search\.exclude"') { $searchExcludeLines += ($i + 1) }
}
Write-Host "`nfiles.exclude at lines: $($filesExcludeLines -join ', ')"
Write-Host "search.exclude at lines: $($searchExcludeLines -join ', ')"