#!/usr/bin/env node
// Bulk replace .cts -> .ts in import statements across the server tree.
// Run: node scripts/maintenance/rename-cts-references.cjs
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', 'app', 'server');
// Match: from 'X.cts'   OR   from "X.cts"   OR   dynamic import('X.cts')
const IMPORT_RE = /(from|import)\s+(['"])([^'"]+)\.cts\2/g;
const DYN_IMPORT_RE = /(import\s*\(\s*['"])([^'"]+)\.cts(['"]\s*\))/g;

let touched = 0;
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === 'coverage') continue;
      walk(full);
    } else if (ent.isFile() && /\.tsx?$/.test(ent.name)) {
      const src = fs.readFileSync(full, 'utf8');
      let out = src.replace(IMPORT_RE, (_m, kw, q, p) => `${kw} ${q}${p}.ts${q}`);
      out = out.replace(DYN_IMPORT_RE, (_m, head, p, tail) => `${head}${p}.ts${tail}`);
      if (out !== src) {
        fs.writeFileSync(full, out);
        touched++;
        console.log('updated:', path.relative(ROOT, full));
      }
    }
  }
}
walk(ROOT);
console.log(`---DONE (${touched} files updated)---`);
