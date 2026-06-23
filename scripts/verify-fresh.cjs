// filepath: scripts/verify-fresh.cjs
// Verify password hashes on the freshly-built test DB.
const path = require('node:path');
const { Client } = require(path.join(process.cwd(), 'app', 'node_modules', 'pg'));
const { scrypt, timingSafeEqual } = require('crypto');
const { promisify } = require('util');
const scryptAsync = promisify(scrypt);

async function verifyPassword(password, stored) {
  if (!stored.startsWith('scrypt$')) return false;
  const [, saltB64, keyB64] = stored.split('$');
  const salt = Buffer.from(saltB64, 'base64');
  const derivedKey = await scryptAsync(password, salt, 64);
  const storedKey = Buffer.from(keyB64, 'base64');
  return derivedKey.length === storedKey.length && timingSafeEqual(derivedKey, storedKey);
}

(async () => {
  const c = new Client({ connectionString: 'postgresql://postgres:***REDACTED***@localhost:5432/noufex_db_fresh' });
  await c.connect();
  const tests = [
    ['admin@noufex.com', 'admin123'],
    ['ahmed@gmail.com', 'customer123'],
    ['noor@perfume-yemen.com', 'merchant123'],
    ['layla@mokha-coffee.com', 'merchant123'],
  ];
  let ok = 0;
  for (const [email, password] of tests) {
    const r = await c.query('SELECT password_hash FROM users WHERE email = $1', [email]);
    if (r.rowCount === 0) { console.log('  X', email, '(not found)'); continue; }
    const valid = await verifyPassword(password, r.rows[0].password_hash);
    console.log('  ' + (valid ? 'OK' : 'X '), email);
    if (valid) ok++;
  }
  console.log('  Hashes verified:', ok, '/', tests.length);
  await c.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
