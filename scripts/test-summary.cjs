// Run tests and produce a clean summary by stripping large SQL content from output.
const { spawnSync } = require('child_process');

const result = spawnSync('npx', ['vitest', 'run', '--reporter=verbose'], {
  cwd: process.cwd(),
  shell: true,
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
});

let out = (result.stdout || '') + (result.stderr || '');

// Collapse huge quoted strings (the SQL dump content shown in failures).
out = out.replace(/"[^"]{200,}"/g, '"<SQL_CONTENT>"');

// Keep only lines that look like test progress or errors.
const keep = [];
for (const line of out.split('\n')) {
  if (/^(\s*)(✓|✗|✘|×|FAIL|PASS|✔|✖|⎯|⎯⎯|❯|Test Files|Tests|Start at|Duration|>|FAIL )/.test(line)
    || /Error|expected|Expected|missing|Missing/i.test(line)
    || line.includes('node_modules')
    || line.trim().startsWith('at ')
    || line.includes('tests/')) {
    keep.push(line);
  }
}

console.log(keep.join('\n'));
console.log('\nEXIT:', result.status);
process.exit(result.status || 0);
