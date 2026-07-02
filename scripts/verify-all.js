// Check for duplicate top-level keys in settings.json
const fs = require('fs');
const content = fs.readFileSync('c:/Users/zaher/Desktop/nouf-ex/.vscode/settings.json', 'utf-8');
const lines = content.split('\n');

const keys = new Map();
const duplicates = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  if (trimmed.startsWith('//')) continue;
  if (line.startsWith('  "') && !line.startsWith('   "')) {
    const match = line.match(/^  "([^"]+)"\s*:/);
    if (match) {
      const key = match[1];
      if (keys.has(key)) {
        duplicates.push({ line: i + 1, key, firstLine: keys.get(key) });
      } else {
        keys.set(key, i + 1);
      }
    }
  }
}

console.log('Total keys:', keys.size + duplicates.length);
console.log('Unique keys:', keys.size);
console.log('Duplicates:', duplicates.length);
if (duplicates.length > 0) {
  duplicates.forEach(d => {
    console.log('  Line ' + d.line + ': ' + d.key + ' (first at line ' + d.firstLine + ')');
  });
} else {
  console.log('OK - no top-level duplicates');
}

// Also check if file ends cleanly
const lastNonEmpty = lines.filter(l => l.trim()).pop();
console.log('Last non-empty line: ' + lastNonEmpty);
