const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'apps', 'web', 'src', 'i18n', 'locales');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'));
}
function save(name, obj) {
  fs.writeFileSync(path.join(DIR, name), JSON.stringify(obj, null, '\t') + '\n');
}

function flattenKeys(obj, prefix = '') {
  const out = [];
  if (obj === null || typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => {
      const next = prefix ? `${prefix}.${i}` : String(i);
      out.push(...flattenKeys(v, next));
    });
    return out;
  }
  for (const k of Object.keys(obj)) {
    const value = obj[k];
    const next = prefix ? `${prefix}.${k}` : k;
    if (value !== null && typeof value === 'object') {
      out.push(...flattenKeys(value, next));
    } else {
      out.push(next);
    }
  }
  return out;
}

function setVal(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in cur) || typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function getVal(obj, dotPath) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function buildMap(locale) {
  const map = {};
  const flat = flattenKeys(locale);
  for (const key of flat) {
    map[key] = getVal(locale, key);
  }
  return map;
}

const AR = load('ar.json');
const EN = load('en.json');
const ZH = load('zh.json');

const arMap = buildMap(AR);
const enMap = buildMap(EN);
const zhMap = buildMap(ZH);

const allKeys = new Set([...Object.keys(arMap), ...Object.keys(enMap), ...Object.keys(zhMap)]);

let arAdded = 0, enAdded = 0, zhAdded = 0;

for (const key of allKeys) {
  if (!(key in arMap)) {
    const val = enMap[key] !== undefined ? enMap[key] : zhMap[key];
    setVal(AR, key, val);
    arAdded++;
  }
  if (!(key in enMap)) {
    const val = arMap[key] !== undefined ? arMap[key] : zhMap[key];
    setVal(EN, key, val);
    enAdded++;
  }
  if (!(key in zhMap)) {
    const val = arMap[key] !== undefined ? arMap[key] : enMap[key];
    setVal(ZH, key, val);
    zhAdded++;
  }
}

console.log(`ar.json +${arAdded}, en.json +${enAdded}, zh.json +${zhAdded}`);

save('ar.json', AR);
save('en.json', EN);
save('zh.json', ZH);

const arFinal = new Set(flattenKeys(AR));
const enFinal = new Set(flattenKeys(EN));
const zhFinal = new Set(flattenKeys(ZH));

console.log(`ar: ${arFinal.size} keys, en: ${enFinal.size} keys, zh: ${zhFinal.size} keys`);
console.log(`ar-en missing: ${[...arFinal].filter(x => !enFinal.has(x)).length === 0 ? 'PASS' : 'FAIL'}`);
console.log(`ar-zh missing: ${[...arFinal].filter(x => !zhFinal.has(x)).length === 0 ? 'PASS' : 'FAIL'}`);
console.log(`en-ar extra: ${[...enFinal].filter(x => !arFinal.has(x)).length === 0 ? 'PASS' : 'FAIL'}`);
console.log(`zh-ar extra: ${[...zhFinal].filter(x => !arFinal.has(x)).length === 0 ? 'PASS' : 'FAIL'}`);
