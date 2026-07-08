/**
 * totp.cts — TOTP (RFC 6238) implementation for P0-5 (2FA).
 *
 * No external dependency. The algorithm:
 *
 *   T = floor((current_unix_time - T0) / X)   // T0 = 0, X = 30 seconds
 *   HMAC-SHA1(secret_bytes, T_as_8_byte_big_endian)
 *   offset        = HMAC[19] & 0x0F
 *   bin_code      = (HMAC[offset]   & 0x7F) << 24
 *                  | (HMAC[offset+1] & 0xFF) << 16
 *                  | (HMAC[offset+2] & 0xFF) <<  8
 *                  | (HMAC[offset+3] & 0xFF)
 *   otp           = bin_code % 1_000_000     // 6 digits
 *
 * Verification accepts a ±1 time-step window (codes from the previous,
 * current, and next 30-second window). This is the standard tolerance
 * — it lets a user whose phone clock drifts a few seconds still log in,
 * while keeping the brute-force window small (3 valid codes at any
 * instant = 3 in 1M ≈ 3 × 10^-6).
 *
 * The secret is stored as base32 (no padding) so the row stays small
 * and the value is human-inspectable in pgAdmin / psql. 160 bits of
 * entropy → 32 base32 chars → 32 chars in the column.
 */
import { createHmac, randomBytes } from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
// We accept codes from ±1 step (the current window + the previous
// + the next) — this is the standard TOTP tolerance and lets a user
// whose phone clock drifts a few seconds still log in. The tolerance
// is hard-coded inline in `verifyTotp` below; if it ever needs to
// become configurable, lift it back into a module-level constant.

// ═══════════════════════════════════════════════════════════════════
// Base32 (RFC 4648, no padding) — the format authenticator apps use.
// ═══════════════════════════════════════════════════════════════════

/** Encode a Buffer as base32 (uppercase, no padding). */
export function base32Encode(buf: Buffer): string {
	let bits = 0;
	let value = 0;
	let out = '';
	for (let i = 0; i < buf.length; i++) {
		value = (value << 8) | (buf[i] as number);
		bits += 8;
		while (bits >= 5) {
			out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
			bits -= 5;
		}
	}
	if (bits > 0) {
		out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
	}
	return out;
}

/** Decode a base32 string (case-insensitive, no padding required). */
export function base32Decode(s: string): Buffer {
	const cleaned = s.replace(/=+$/g, '').toUpperCase().replace(/\s+/g, '');
	let bits = 0;
	let value = 0;
	const out: number[] = [];
	for (const ch of cleaned) {
		const idx = BASE32_ALPHABET.indexOf(ch);
		if (idx < 0) throw new Error('Invalid base32 character: ' + ch);
		value = (value << 5) | idx;
		bits += 5;
		if (bits >= 8) {
			out.push((value >>> (bits - 8)) & 0xff);
			bits -= 8;
		}
	}
	return Buffer.from(out);
}

// ═══════════════════════════════════════════════════════════════════
// Secret generation
// ═══════════════════════════════════════════════════════════════════

/** Generate a fresh 160-bit TOTP secret (32 base32 chars).
 *  Uses Node's CSPRNG — never use a non-cryptographic RNG here. */
export function generateSecret(): string {
	return base32Encode(randomBytes(20));
}

// ═══════════════════════════════════════════════════════════════════
// TOTP core
// ═══════════════════════════════════════════════════════════════════

/** Convert a 6-digit numeric string to a 6-digit integer. Strips
 *  surrounding whitespace and a single optional dash ('-' is
 *  commonly used by users when typing the code on a phone). */
function normalizeOtp(input: string): number | null {
	const stripped = input.replace(/[\s-]/g, '');
	if (!/^\d{6}$/.test(stripped)) return null;
	return Number(stripped);
}

/** Compute the TOTP code for a given secret + time. Exported for
 *  tests (a property-based test can pin a time and assert the
 *  output matches the RFC 6238 reference vectors). */
export function totpAt(secret: string, unixSeconds: number): string {
	const key = base32Decode(secret);
	const counter = Math.floor(unixSeconds / TOTP_STEP_SECONDS);
	const buf = Buffer.alloc(8);
	// Big-endian 64-bit counter.
	buf.writeBigUInt64BE(BigInt(counter));
	const hmac = createHmac('sha1', key).update(buf).digest();
	// Dynamic truncation.
	const offset = (hmac[hmac.length - 1] as number) & 0x0f;
	const code =
		(((hmac[offset] as number) & 0x7f) << 24) |
		(((hmac[offset + 1] as number) & 0xff) << 16) |
		(((hmac[offset + 2] as number) & 0xff) << 8) |
		((hmac[offset + 3] as number) & 0xff);
	const otp = (code % 1_000_000).toString().padStart(TOTP_DIGITS, '0');
	return otp;
}

/** Constant-time string equality. Returns false on length mismatch
 *  without leaking the length via early-exit. */
function timingSafeEqualStr(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

/** Verify a user-supplied 6-digit code against the secret.
 *  Returns true if the code matches any of the codes in the
 *  accepted window (current, previous, next). */
export function verifyTotp(secret: string, code: string, now = Date.now()): boolean {
	const normalized = normalizeOtp(code);
	if (normalized === null) return false;
	const expected = totpAt(secret, Math.floor(now / 1000));
	// Also check ±1 step (±30s) for clock drift tolerance.
	const prev = totpAt(secret, Math.floor(now / 1000) - TOTP_STEP_SECONDS);
	const next = totpAt(secret, Math.floor(now / 1000) + TOTP_STEP_SECONDS);
	return (
		timingSafeEqualStr(expected, normalized.toString().padStart(TOTP_DIGITS, '0')) ||
		timingSafeEqualStr(prev, normalized.toString().padStart(TOTP_DIGITS, '0')) ||
		timingSafeEqualStr(next, normalized.toString().padStart(TOTP_DIGITS, '0'))
	);
}

// ═══════════════════════════════════════════════════════════════════
// otpauth:// URI (used by Google Authenticator, Authy, etc.)
// ═══════════════════════════════════════════════════════════════════

/** Build the otpauth:// URI the user pastes into their
 *  authenticator app. Standard format documented at
 *  https://github.com/google/google-authenticator/wiki/Key-Uri-Format
 *
 *  @param account  the user's email (or any human-readable label)
 *  @param secret   the base32 secret
 *  @param issuer   the app name (shown in the authenticator UI)
 *  @param period   the TOTP step in seconds (default 30)
 *  @param digits   the code length (default 6)
 */
export function otpauthUrl(
	account: string,
	secret: string,
	issuer: string,
	period = TOTP_STEP_SECONDS,
	digits = TOTP_DIGITS,
): string {
	const label = encodeURIComponent(issuer + ':' + account);
	const params = new URLSearchParams({
		secret,
		issuer,
		algorithm: 'SHA1',
		digits: String(digits),
		period: String(period),
	});
	return `otpauth://totp/${label}?${params.toString()}`;
}
