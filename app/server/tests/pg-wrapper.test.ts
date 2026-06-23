/**
 * Unit tests for the pgify SQL placeholder rewriter in pg-wrapper.cjs.
 *
 * The rewriter is the only thing standing between the SQLite-style
 * `?` placeholders used throughout the route handlers and the
 * PostgreSQL `$1, $2, ...` placeholders that the pg driver expects.
 * If it silently mis-parses a quoted region, the wrong piece of
 * SQL gets fed to the driver — usually a syntax error, but
 * occasionally a successfully-parsed-but-semantically-wrong query.
 *
 * We exercise the awkward cases here: doubled single quotes inside
 * literals, E-strings, double-quoted identifiers, line and nested
 * block comments, and dollar-quoted PL/pgSQL bodies.
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { pgify, normalizeSql } = require('../db/pg-wrapper.cjs');

describe('pgify() — SQL placeholder rewriter', () => {
	it('rewrites a single placeholder', () => {
		expect(pgify('SELECT * FROM users WHERE id = ?')).toBe('SELECT * FROM users WHERE id = $1');
	});

	it('rewrites multiple placeholders in order', () => {
		expect(pgify('SELECT * FROM t WHERE a = ? AND b = ?')).toBe(
			'SELECT * FROM t WHERE a = $1 AND b = $2'
		);
	});

	it('does NOT rewrite `?` inside a single-quoted literal', () => {
		expect(pgify("SELECT 'a ? b' FROM t WHERE id = ?")).toBe("SELECT 'a ? b' FROM t WHERE id = $1");
	});

	it('handles doubled single quotes (PG escape) inside a literal', () => {
		// This is the regression case the P1-8 fix targets. The old
		// implementation saw the second `'` and dropped out of the
		// string, then rewrote the trailing `s'?` as a placeholder.
		expect(pgify("SELECT 'it''s a test' WHERE col = ?")).toBe(
			"SELECT 'it''s a test' WHERE col = $1"
		);
	});

	it('handles E-strings with backslash escapes', () => {
		expect(pgify("SELECT E'line1\\nline2' WHERE id = ?")).toBe(
			"SELECT E'line1\\nline2' WHERE id = $1"
		);
	});

	it('handles E-strings with both backslash AND doubled-quote escapes', () => {
		expect(pgify("SELECT E'it\\'s also ''quoted''' WHERE id = ?")).toBe(
			"SELECT E'it\\'s also ''quoted''' WHERE id = $1"
		);
	});

	it('does NOT rewrite `?` inside a double-quoted identifier', () => {
		expect(pgify('SELECT "weird?col" FROM t WHERE id = ?')).toBe(
			'SELECT "weird?col" FROM t WHERE id = $1'
		);
	});

	it('handles doubled double quotes (PG escape) in an identifier', () => {
		expect(pgify('SELECT "odd""name" FROM t WHERE id = ?')).toBe(
			'SELECT "odd""name" FROM t WHERE id = $1'
		);
	});

	it('skips line comments', () => {
		expect(
			pgify(`SELECT * FROM t -- a comment with ? here
            WHERE id = ?`)
		).toBe(`SELECT * FROM t -- a comment with ? here
            WHERE id = $1`);
	});

	it('skips block comments', () => {
		expect(pgify('SELECT /* ? */ * FROM t WHERE id = ?')).toBe(
			'SELECT /* ? */ * FROM t WHERE id = $1'
		);
	});

	it('handles nested block comments', () => {
		// Both `?` markers sit inside the outer comment (the first
		// inside the nested one, the second between the two `*/`).
		// Neither should be rewritten -- the rewriter must hold the
		// `inString`/`inComment` state until the outer `*/` is seen.
		expect(pgify('SELECT /* outer /* inner ? still in */ ? */ FROM t')).toBe(
			'SELECT /* outer /* inner ? still in */ ? */ FROM t'
		);
	});

	it('handles dollar-quoted strings ($$ ... $$)', () => {
		expect(pgify(`SELECT $$ contains ? $$ AS body, ? AS id`)).toBe(
			'SELECT $$ contains ? $$ AS body, $1 AS id'
		);
	});

	it('handles tagged dollar-quoted strings ($tag$ ... $tag$)', () => {
		expect(pgify(`SELECT $func$ body with ? inside $func$ AS x, ? AS id`)).toBe(
			'SELECT $func$ body with ? inside $func$ AS x, $1 AS id'
		);
	});

	it('handles a query that combines every feature', () => {
		const sql = `
            -- pick a user by email
            SELECT id, "full name", 'it''s a test' AS greeting
              FROM users
             WHERE email = ?             -- E-string with escapes
               AND metadata = E'{"k":"v"}'
               /* block comment with ? here */
               AND body = $$ ? inside dollar-quote $$
               AND id IN (SELECT user_id FROM logins WHERE ts > ?)
        `;
		const rewritten = pgify(sql);
		// The two placeholders outside any quoted region must become
		// $1 and $2; everything inside quotes/comments must survive
		// intact.
		expect(rewritten).toContain("'it''s a test'");
		expect(rewritten).toContain('E\'{"k":"v"}\'');
		expect(rewritten).toContain('/* block comment with ? here */');
		expect(rewritten).toContain('$$ ? inside dollar-quote $$');
		expect(rewritten).toContain('email = $1');
		expect(rewritten).toContain('ts > $2');
	});

	it('treats an unterminated string at EOF as best-effort literal', () => {
		// No closing quote. The rewriter should not throw; it just
		// copies the rest of the input as-is.
		expect(() => pgify("SELECT 'unterminated")).not.toThrow();
	});
});

describe('normalizeSql() — SQLite-flavoured fragment normalizer', () => {
	it("replaces datetime('now') with CURRENT_TIMESTAMP", () => {
		expect(normalizeSql("UPDATE t SET x = datetime('now')")).toBe(
			'UPDATE t SET x = CURRENT_TIMESTAMP'
		);
	});

	it('normalizes is_<col> = 1 / 0 to TRUE / FALSE', () => {
		expect(normalizeSql('SELECT * FROM t WHERE is_active = 1')).toBe(
			'SELECT * FROM t WHERE is_active = TRUE'
		);
		expect(normalizeSql('SELECT * FROM t WHERE is_active = 0')).toBe(
			'SELECT * FROM t WHERE is_active = FALSE'
		);
	});
});
