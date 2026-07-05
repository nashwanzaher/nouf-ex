// scripts/scan-unused-v2.cjs
const fs = require('fs');
const path = require('path');
const pkg = require('../app/package.json');

const all = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
];

function walk(d) {
  const r = [];
  try {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'coverage') continue;
        r.push(...walk(f));
      } else if (/\.(ts|tsx|cts|js|mjs|cjs|json|css|html|yml|yaml|toml|lock)$/.test(e.name)) {
        r.push(f);
      }
    }
  } catch (e) {}
  return r;
}

const files = [...walk('app/src'), ...walk('app/server'), ...walk('app/tests')];
const configFiles = ['app/vite.config.ts','app/vitest.config.ts','app/eslint.config.js','app/tailwind.config.js','app/postcss.config.js','app/tsconfig.json','app/tsconfig.app.json','app/tsconfig.server.json','app/tsconfig.node.json','app/components.json','app/package.json'];
configFiles.forEach(c => { if (fs.existsSync(c)) files.push(c); });

const unused = [];
for (const dep of all) {
  // Check whole word match (no regex word boundaries with hyphens)
  const escaped = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = files.some((f) => {
    try { return fs.readFileSync(f, 'utf8').includes(dep); } catch(e) { return false; }
  });
  if (!found) unused.push(dep);
}

console.log('Total deps:', all.length);
console.log('Unused:', unused.length);
console.log('--- UNUSED ---');
unused.forEach((d) => console.log('  ❌ ' + d));
