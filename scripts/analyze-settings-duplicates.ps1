# Find duplicate JSON keys in a file
param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,

    [Parameter(Mandatory=$false)]
    [int]$Indent = 2
)

$content = Get-Content $FilePath -Encoding UTF8 -Raw
$lines = $content -split "`n"

# Find all keys at specified indent level
$pattern = "^" + (' ' * $Indent) + '"([^"]+)"\s*:'
$keys = @{}

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    if ($line -match $pattern) {
        $key = $matches[1]
        if ($keys.ContainsKey($key)) {
            $keys[$key] += @($i + 1)
        } else {
            $keys[$key] = @($i + 1)
        }
    }
}

# Find duplicates
$duplicates = $keys.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 } | Sort-Object Name

Write-Host "=== Top-level keys with duplicates (indent=$Indent) ==="
foreach ($dup in $duplicates) {
    $lineStr = $dup.Value -join ", "
    Write-Host "  '$($dup.Key)' - $($dup.Value.Count)x at lines: $lineStr"
}

# Also report any nested keys that look like duplicates
Write-Host "`n=== All keys with multiple occurrences (any depth) ==="
$allKeys = @{}
$allPattern = '^\s+"([^"]+)"\s*:'
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $allPattern) {
        $key = $matches[1]
        if ($allKeys.ContainsKey($key)) {
            $allKeys[$key] += @($i + 1)
        } else {
            $allKeys[$key] = @($i + 1)
        }
    }
}

# Filter to non-language-section keys
$allDupes = $allKeys.GetEnumerator() | Where-Object {
    $_.Value.Count -gt 1 -and
    -not $_.Key.StartsWith('[') -and
    -not $_.Key.StartsWith('//')
}

foreach ($dup in $allDupes | Sort-Object Name) {
    $lineStr = $dup.Value -join ", "
    Write-Host "  '$($dup.Key)' - $($dup.Value.Count)x at lines: $lineStr"
}