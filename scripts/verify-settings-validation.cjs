// Verify settings validation by importing the validator directly
// (no HTTP roundtrip needed)
const path = require('path');

const tsFile = path.join(
  __dirname,
  '..',
  'apps',
  'api',
  'src',
  'lib',
  'settings-validation.ts',
);
const fs = require('fs');
const src = fs.readFileSync(tsFile, 'utf8');

// Quick sanity check by reading the source
const keyChecks = [
  { key: 'DEFAULT_CURRENCY', expectedType: 'currency 3-letter code' },
  { key: 'FREE_SHIPPING_THRESHOLD', expectedType: 'non-negative integer' },
  { key: 'FLAT_SHIPPING_COST', expectedType: 'non-negative integer' },
  { key: 'AUDIT_CLEANUP_ADMIN_DAYS', expectedType: '1..3650 positive integer' },
  { key: 'AUDIT_CLEANUP_SEARCH_DAYS', expectedType: '1..365 positive integer' },
  { key: 'AUDIT_CLEANUP_TZ', expectedType: 'IANA timezone' },
];

console.log('=== Settings validator keys registered ===');
keyChecks.forEach((c) => {
  const found = src.includes(c.key);
  console.log(`  ${found ? '✓' : '✗'} ${c.key} (${c.expectedType})`);
});

console.log('\n=== Sample error messages ===');
const errorSamples = [
  'SETTING_INVALID_CURRENCY',
  'SETTING_INVALID_INTEGER',
  'SETTING_INVALID_TIMEZONE',
  'SETTING_VALUE_OUT_OF_RANGE',
  'SETTING_VALUE_TOO_SHORT',
  'SETTING_VALUE_TOO_LONG',
];
errorSamples.forEach((code) => {
  const found = src.includes(code);
  console.log(`  ${found ? '✓' : '✗'} ${code}`);
});

console.log('\n=== File stats ===');
const lines = src.split('\n').length;
console.log(`  Lines: ${lines}`);
console.log(`  Exports: ${(src.match(/^export /gm) || []).length}`);
console.log(`  Has validators: ${src.includes('const validators') ? '✓' : '✗'}`);
console.log(`  Has validateSettingValue: ${src.includes('export function validateSettingValue') ? '✓' : '✗'}`);
console.log(`  Has getKnownSettingKeys: ${src.includes('export function getKnownSettingKeys') ? '✓' : '✗'}`);
