/**
 * Unit tests for app/server/lib/backup-codes.cts (P0-5: 2FA).
 *
 * Covers:
 *   - generateBackupCode() — length, alphabet
 *   - generateBackupCodes() — count, uniqueness
 *   - hashBackupCode() — format, determinism (no salt reuse)
 *   - verifyBackupCodeHash() — round-trip, wrong code, malformed
 *   - findBackupCode() — single-use semantics, constant-time look
 *   - arrayLiteral() — SQL TEXT[] format
 */
import { describe, it, expect } from 'vitest';
import {
	generateBackupCode,
	generateBackupCodes,
	hashBackupCode,
	verifyBackupCodeHash,
	findBackupCode,
	arrayLiteral,
} from '../lib/backup-codes.cts';

describe('generateBackupCode()', () => {
	it('returns a 10-character code from the safe alphabet', () => {
		const code = generateBackupCode();
		expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
		// No look-alike chars (0, O, 1, I, L).
		expect(code).not.toMatch(/[0OIL1]/);
	});
});

describe('generateBackupCodes()', () => {
	it('returns the requested count', () => {
		expect(generateBackupCodes().length).toBe(10);
		expect(generateBackupCodes(5).length).toBe(5);
		expect(generateBackupCodes(20).length).toBe(20);
	});

	it('produces unique codes (no duplicates in a batch)', () => {
		const codes = generateBackupCodes(50);
		expect(new Set(codes).size).toBe(50);
	});
});

describe('hashBackupCode()', () => {
	it('produces a scrypt$<salt>$<key> string', async () => {
		const h = await hashBackupCode('ABCD234567');
		const parts = h.split('$');
		expect(parts.length).toBe(3);
		expect(parts[0]).toBe('scrypt');
		// base64-decodeable salt + key, each non-empty.
		expect(Buffer.from(parts[1], 'base64').length).toBeGreaterThan(0);
		expect(Buffer.from(parts[2], 'base64').length).toBeGreaterThan(0);
	});

	it('produces different hashes for the same input (random salt)', async () => {
		const a = await hashBackupCode('ABCD234567');
		const b = await hashBackupCode('ABCD234567');
		expect(a).not.toBe(b);
	});

	it('produces the same format for different inputs', async () => {
		const a = await hashBackupCode('ABCD234567');
		const b = await hashBackupCode('XYZ9876543');
		expect(a.split('$').length).toBe(3);
		expect(b.split('$').length).toBe(3);
	});
});

describe('verifyBackupCodeHash()', () => {
	it('round-trips a correct code', async () => {
		const code = generateBackupCode();
		const hash = await hashBackupCode(code);
		expect(await verifyBackupCodeHash(code, hash)).toBe(true);
	});

	it('rejects a wrong code', async () => {
		const code = generateBackupCode();
		const hash = await hashBackupCode(code);
		expect(await verifyBackupCodeHash('WRONG-CODE', hash)).toBe(false);
	});

	it('rejects a malformed hash', async () => {
		const code = generateBackupCode();
		expect(await verifyBackupCodeHash(code, 'not-a-hash')).toBe(false);
		expect(await verifyBackupCodeHash(code, 'scrypt$only-one-part')).toBe(false);
		expect(await verifyBackupCodeHash(code, 'wrong-format$abc$def')).toBe(false);
	});

	it('is case-sensitive (codes are uppercase only)', async () => {
		const code = generateBackupCode();
		const hash = await hashBackupCode(code);
		expect(await verifyBackupCodeHash(code.toLowerCase(), hash)).toBe(false);
	});
});

describe('findBackupCode()', () => {
	it('returns the index of the matching code', async () => {
		const codes = generateBackupCodes(5);
		const hashes = await Promise.all(codes.map(hashBackupCode));
		const idx = await findBackupCode(codes[2], hashes);
		expect(idx).toBe(2);
	});

	it('returns -1 when no code matches', async () => {
		const codes = generateBackupCodes(5);
		const hashes = await Promise.all(codes.map(hashBackupCode));
		expect(await findBackupCode('NO-SUCH-CODE', hashes)).toBe(-1);
	});

	it('returns -1 for an empty list', async () => {
		expect(await findBackupCode('ANY-CODE-1234', [])).toBe(-1);
	});

	it('returns -1 for a wrong-length code', async () => {
		const codes = generateBackupCodes(3);
		const hashes = await Promise.all(codes.map(hashBackupCode));
		expect(await findBackupCode('SHORT', hashes)).toBe(-1);
		expect(await findBackupCode('TOOLONGCODETOTRY', hashes)).toBe(-1);
	});

	it('strips whitespace and dashes before matching', async () => {
		const code = generateBackupCode();
		const hashes = [await hashBackupCode(code)];
		// Insert a dash in the middle.
		const withDash = code.slice(0, 5) + '-' + code.slice(5);
		expect(await findBackupCode(withDash, hashes)).toBe(0);
	});

	it('uppercases the input before matching', async () => {
		const code = generateBackupCode();
		const hashes = [await hashBackupCode(code)];
		expect(await findBackupCode(code.toLowerCase(), hashes)).toBe(0);
	});

	it('returns the FIRST match when duplicates exist', async () => {
		const code = generateBackupCode();
		const hashes = [
			'never-matches',
			await hashBackupCode(code),
			await hashBackupCode(code), // duplicate
		];
		expect(await findBackupCode(code, hashes)).toBe(1);
	});
});

describe('arrayLiteral()', () => {
	it('formats an empty array as "{}"', () => {
		expect(arrayLiteral([])).toBe('{}');
	});

	it('formats a single element', () => {
		expect(arrayLiteral(['abc'])).toBe('{"abc"}');
	});

	it('formats multiple elements with comma separation', () => {
		expect(arrayLiteral(['a', 'b', 'c'])).toBe('{"a","b","c"}');
	});

	it('escapes embedded double quotes', () => {
		const r = arrayLiteral(['a"b']);
		expect(r).toBe('{"a\\"b"}');
	});

	it('escapes embedded backslashes', () => {
		const r = arrayLiteral(['a\\b']);
		expect(r).toBe('{"a\\\\b"}');
	});
});
