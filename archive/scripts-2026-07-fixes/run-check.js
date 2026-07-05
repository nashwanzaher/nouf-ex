// Simple check for duplicate top-level keys - write to output file
var fs = require('fs');
var settingsPath = 'c:/Users/zaher/Desktop/nouf-ex/.vscode/settings.json';
var mcpPath = 'c:/Users/zaher/Desktop/nouf-ex/.vscode/mcp.json';

function checkDuplicates(filePath) {
  var content = fs.readFileSync(filePath, 'utf-8');
  var lines = content.split('\n');
  var keys = {};
  var dups = [];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.trim().startsWith('//')) continue;
    if (line.match(/^  "/)) {
      var m = line.match(/^  "([^"]+)"\s*:/);
      if (m) {
        var key = m[1];
        if (keys[key]) {
          dups.push((i+1) + ':' + key + ' (first at ' + keys[key] + ')');
        } else {
          keys[key] = i + 1;
        }
      }
    }
  }

  return {
    file: filePath.replace('c:/Users/zaher/Desktop/nouf-ex/.vscode/', ''),
    total: Object.keys(keys).length + dups.length,
    unique: Object.keys(keys).length,
    duplicates: dups
  };
}

var settingsResult = checkDuplicates(settingsPath);
var mcpResult = checkDuplicates(mcpPath);

var output = '';
output += '=== SETTINGS.JSON ===\n';
output += 'Total: ' + settingsResult.total + ', Unique: ' + settingsResult.unique + '\n';
output += 'Duplicates: ' + settingsResult.duplicates.length + '\n';
if (settingsResult.duplicates.length > 0) {
  settingsResult.duplicates.forEach(function(d) {
    output += '  ' + d + '\n';
  });
} else {
  output += '  OK - no duplicates\n';
}

output += '\n=== MCP.JSON ===\n';
output += 'Total: ' + mcpResult.total + ', Unique: ' + mcpResult.unique + '\n';
output += 'Duplicates: ' + mcpResult.duplicates.length + '\n';
if (mcpResult.duplicates.length > 0) {
  mcpResult.duplicates.forEach(function(d) {
    output += '  ' + d + '\n';
  });
} else {
  output += '  OK - no duplicates\n';
}

// JSON validity
try {
  JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  output += '\n=== settings.json: Valid JSON ===\n';
} catch (e) {
  output += '\n=== settings.json: INVALID JSON ===\n  ' + e.message + '\n';
}

try {
  JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
  output += '=== mcp.json: Valid JSON ===\n';
} catch (e) {
  output += '=== mcp.json: INVALID JSON ===\n  ' + e.message + '\n';
}

fs.writeFileSync('c:/Users/zaher/Desktop/nouf-ex/.vscode/_verify.txt', output);
console.log('Wrote verification to .vscode/_verify.txt');
console.log('Settings:', settingsResult.total, 'unique:', settingsResult.unique, 'dups:', settingsResult.duplicates.length);
console.log('MCP:', mcpResult.total, 'unique:', mcpResult.unique, 'dups:', mcpResult.duplicates.length);
