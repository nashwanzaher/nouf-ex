/**
 * backup-codes.cts — single-use recovery codes for P0-5 (2FA).
 *
 * Each user with 2FA enabled gets 10 backup codes at enrollment time.
 * Each code is shown ONCE to the user in plaintext, then hashed with
 * scrypt and stored in `users.totp_backup_codes` (TEXT[]).
 *
 * When a backup code is used:
 *   1. The user supplies it in place of a TOTP code.
 *   2. We hash it with the same scrypt settings as the password.
 *   3. We compare the hash to every entry in the array (constant-time
 *      per-entry).
 *   4. On a match, the entry is REMOVED from the array (single-use).
 *
 * The remaining count is surfaced in the settings UI so the user
 * knows when to regenerate.
 *
 * Format: 10 characters, uppercase alphanumerics minus the ambiguous
 * ones (0/O, 1/I/L). The set is `ABCDEFGHJKMNPQRSTUVWXYZ23456789` —
 * 31 chars, no padding, no checksum (checksum on the wire would
 * require a separate algorithm and is not standard for backup codes).
 */
import { scrypt as scryptCb, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scryptCb) as (
	password: string,
	salt: Buffer,
	keylen: number,
) => Promise<Buffer>;

const BACKUP_CODE_LENGTH = 10;
const BACKUP_CODE_COUNT = 10;
// Alphabet chosen to avoid look-alikes: no 0, O, 1, I, L.
const BACKUP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const SCRYPT_KEYLEN = 32;
const SCRYPT_SALT_LEN = 16;

/** Random character from the safe alphabet. */
function pickChar(): string {
	return BACKUP_ALPHABET.charAt(
		// CSPRNG modulo the alphabet length. The alphabet is 31
		// characters (well under 256) so the modulo bias is at
		// most 31/256 ≈ 12% — acceptable for a non-cryptographic
		// identifier (the security is in the hash, not the code).
		randomBytes(1)[0] % BACKUP_ALPHABET.length,
	);
}

/** Generate one fresh backup code (e.g. "K7M3P9QXR4"). */
export function generateBackupCode(): string {
	let s = '';
	for (let i = 0; i < BACKUP_CODE_LENGTH; i++) s += pickChar();
	return s;
}

/** Generate a fresh batch of N codes. The array is returned in the
 *  same order they will be shown to the user (1..N). */
export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
	return Array.from({ length: count }, () => generateBackupCode());
}

/** Hash a backup code with scrypt — same primitive as the password
 *  hash so a leak of the backup_codes column doesn't compromise
 *  the password column (or vice versa). */
export async function hashBackupCode(code: string): Promise<string> {
	const salt = randomBytes(SCRYPT_SALT_LEN);
	const derived = await scryptAsync(code, salt, SCRYPT_KEYLEN);
	// Format: `scrypt$<base64-salt>$<base64-key>` — matches the
	// password hash format in middleware.ts so the verification
	// helper can use the same parsing logic.
	return 'scrypt$' + salt.toString('base64') + '$' + derived.toString('base64');
}

/** Parse a stored hash into its salt and key components.
 *  Returns null if the format is unrecognised. */
function parseStoredHash(stored: string): { salt: Buffer; key: Buffer } | null {
	const parts = stored.split('$');
	if (parts.length !== 3) return null;
	if (parts[0] !== 'scrypt') return null;
	try {
		const salt = Buffer.from(parts[1], 'base64');
		const key = Buffer.from(parts[2], 'base64');
		if (key.length !== SCRYPT_KEYLEN) return null;
		return { salt, key };
	} catch {
		return null;
	}
}

/** Verify a supplied code against ONE stored hash. Constant-time
 *  on success; non-constant on a length mismatch (acceptable — the
 *  salt + key lengths are public). */
export async function verifyBackupCodeHash(code: string, stored: string): Promise<boolean> {
	const parsed = parseStoredHash(stored);
	if (!parsed) return false;
	const derived = await scryptAsync(code, parsed.salt, SCRYPT_KEYLEN);
	// timingSafeEqual throws on length mismatch. We pre-check.
	if (derived.length !== parsed.key.length) return false;
	return timingSafeEqual(derived, parsed.key);
}

/** Find and consume a backup code. Returns the index of the consumed
 *  code in the input array, or -1 if no match was found.
 *
 *  Use this on the LOGIN path: the caller can then UPDATE the
 *  row to drop the index from the array, marking the code as used.
 *
 *  Iterates with a constant-time per-entry comparison so a timing
 *  oracle can't be used to figure out which positions match.
 */
export async function findBackupCode(code: string, storedHashes: string[]): Promise<number> {
	const normalized = code.replace(/[\s-]/g, '').toUpperCase();
	if (normalized.length !== BACKUP_CODE_LENGTH) return -1;
	// Always check every entry so the loop duration is data-independent
	// (the ORDER of checks doesn't leak whether a match was found).
	let matched = -1;
	for (let i = 0; i < storedHashes.length; i++) {
		const ok = await verifyBackupCodeHash(normalized, storedHashes[i]);
		if (ok && matched === -1) matched = i;
	}
	return matched;
}

/** Format a stored hash list for inclusion in a SQL UPDATE.
 *  Postgres TEXT[] literal format: `{"hash1","hash2"}`. */
export function arrayLiteral(hashes: string[]): string {
	const escape = (s: string) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
	return '{' + hashes.map(escape).join(',') + '}';
}
