// scripts/scan-unused.cjs - Find unused dependencies
const fs = require('fs');
const path = require('path');
const pkg = require('../app/package.json');

const all = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
];

function walk(d) {
  const r = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue;
      r.push(...walk(f));
    } else if (/\.(ts|tsx|cts)$/.test(e.name)) {
      r.push(f);
    }
  }
  return r;
}

const files = [...walk('app/src'), ...walk('app/server')];
const unused = [];
for (const dep of all) {
  const re = new RegExp('\\b' + dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
  const found = files.some((f) => re.test(fs.readFileSync(f, 'utf8')));
  if (!found) unused.push(dep);
}

console.log('Total deps:', all.length);
console.log('Unused:', unused.length);
console.log('--- UNUSED ---');
unused.forEach((d) => console.log('  ❌ ' + d));
