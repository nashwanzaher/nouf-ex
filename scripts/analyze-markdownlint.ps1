# Analyze markdownlint errors by rule
$content = Get-Content 'c:\Users\zaher\Desktop\nouf-ex\markdownlint-results.txt' -Raw
$pattern = 'MD(\d+)/'
$matches_found = [regex]::Matches($content, $pattern)
$ruleCounts = @{}
foreach ($m in $matches_found) {
    $rule = $m.Groups[1].Value
    if ($ruleCounts.ContainsKey($rule)) {
        $ruleCounts[$rule]++
    } else {
        $ruleCounts[$rule] = 1
    }
}
$ruleCounts.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
    Write-Host ("MD" + $_.Key + ": " + $_.Value + " errors")
}

# Count files
Write-Host ""
Write-Host "Total errors: $($matches_found.Count)"
