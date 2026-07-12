/**
 * Auth helpers — password hashing and verification.
 *
 * Extracted from `shared.cts` on 2026-07-03 as part of the god object
 * refactor (Finding 1 from the deep audit). Self-contained — does NOT
 * import from `db` or `shared.cts`, so it can be moved or tested
 * in isolation. The only runtime dep is the Node built-in `crypto`
 * module via the `promisify` helper.
 *
 * Algorithms / parameters:
 *   - scrypt with 16-byte random salt, 64-byte derived key (256-bit)
 *   - timingSafeEqual for the comparison to prevent timing attacks
 *   - on-disk format: `scrypt$<salt-base64>$<key-base64>`
 *     (the same string is the only valid prefix; `verifyPassword`
 *     short-circuits false on anything else)
 *
 * Where this is used:
 *   - auth.cts: register (initial hash), login (verify), change-password
 *   - any other route that mutates `users.password_hash` directly
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCb) as (
	password: string,
	salt: string | Buffer,
	keylen: number,
) => Promise<Buffer>;

/** Length of the derived key. 64 bytes (512 bits) matches the
 *  recommended scrypt output size for password hashing. */
const SCRYPT_KEYLEN = 64;

/** Generate a fresh scrypt hash for the given plaintext password.
 *  Returns the on-disk format `scrypt$<saltB64>$<keyB64>`. */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const derivedKey = await scrypt(password, salt, SCRYPT_KEYLEN);
	return `scrypt$${salt.toString('base64')}$${derivedKey.toString('base64')}`;
}

/** Constant-time compare a plaintext password to a stored scrypt hash.
 *  Returns `false` for any input that does not match the expected
 *  on-disk format (so we never throw on corrupt rows). */
export async function verifyPassword(
	password: string,
	stored: string,
): Promise<boolean> {
	if (!stored.startsWith('scrypt$')) return false;
	const parts = stored.split('$');
	if (parts.length !== 3) return false;
	const [, saltB64, keyB64] = parts;
	const salt = Buffer.from(saltB64, 'base64');
	const derivedKey = await scrypt(password, salt, SCRYPT_KEYLEN);
	const storedKey = Buffer.from(keyB64, 'base64');
	if (derivedKey.length !== storedKey.length) return false;
	return timingSafeEqual(derivedKey, storedKey);
}