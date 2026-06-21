#!/usr/bin/env node
/**
 * Generate scrypt password hashes for the seed data.
 * Format: scrypt$<salt_b64>$<hash_b64>
 * Run once, copy output into seed.sql.
 */
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');
const scryptAsync = promisify(scrypt);

const SEED_USERS = [
  ['admin@noufex.com',          'admin123',    'admin'],
  ['ahmed@gmail.com',           'customer123', 'customer'],
  ['sara@gmail.com',            'customer123', 'customer'],
  ['omar@gmail.com',            'customer123', 'customer'],
  ['fatima@spice-yemen.com',    'merchant123', 'merchant'],
  ['hassan@dates-yemen.com',    'merchant123', 'merchant'],
  ['mohammed@handicrafts-yemen.com', 'merchant123', 'merchant'],
  ['khalid@electronics-yemen.com',   'merchant123', 'merchant'],
  ['noor@perfume-yemen.com',    'merchant123', 'merchant'],
  ['layla@mokha-coffee.com',    'merchant123', 'merchant'],
];

(async () => {
  for (const [email, password] of SEED_USERS) {
    const salt = randomBytes(16);
    const hash = await scryptAsync(password, salt, 64);
    console.log(
      `-- ${email} / ${password}\n` +
      `UPDATE users SET password_hash = 'scrypt$$' || encode('${salt.toString('base64')}', 'base64') || '$$' || encode('${hash.toString('base64')}', 'base64')\n` +
      `  WHERE email = '${email}';\n`
    );
  }
})();
