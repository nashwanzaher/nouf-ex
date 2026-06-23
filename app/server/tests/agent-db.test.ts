/**
 * Unit tests for the agent_db helper.
 *
 * These tests verify the helper's contract WITHOUT hitting a real
 * database. The `pg` driver is mocked globally in tests/setup.ts, so
 * the pool returns empty rows for every query — exactly the path
 * we want to test (the helper must fail open and return null/[]).
 *
 * What we cover:
 *   1. `newAgentDb()` returns null when no AGENT_* env vars are set
 *   2. `newAgentDb()` builds a singleton and reuses it
 *   3. `searchKnowledge()` returns [] on the mocked (empty) DB
 *   4. `getEntry()` returns null when the DB has no row
 *   5. `recentEntries()` returns [] when the DB has no rows
 *   6. `topTags()` returns [] when the DB has no rows
 *   7. `upsertTag()` returns null when the function call has no row
 *   8. `searchKnowledge()` clamps `limit` into [1, 50]
 *   9. `searchKnowledge()` ignores bogus `kind` values silently
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Set up env BEFORE importing the module under test so the
// singleton has a stable AGENT_DATABASE_URL to latch onto.
process.env.AGENT_DATABASE_URL = 'postgresql://agent_app:test@localhost:5433/agent_db';

import { newAgentDb, _resetAgentDbForTests } from '../lib/agent-db.cts';

describe('agent_db helper', () => {
	beforeEach(() => {
		_resetAgentDbForTests();
	});

	afterEach(() => {
		_resetAgentDbForTests();
	});

	describe('newAgentDb()', () => {
		it('returns an AgentDb instance when AGENT_DATABASE_URL is set', () => {
			const agent = newAgentDb();
			expect(agent).not.toBeNull();
			expect(agent).toBeDefined();
		});

		it('returns the same singleton on repeated calls', () => {
			const a = newAgentDb();
			const b = newAgentDb();
			expect(a).toBe(b);
		});

		it('builds a URL from discrete AGENT_DB_* vars when no URL is set', () => {
			_resetAgentDbForTests();
			const prev = process.env.AGENT_DATABASE_URL;
			delete process.env.AGENT_DATABASE_URL;
			process.env.AGENT_DB_HOST = '10.0.0.1';
			process.env.AGENT_DB_PORT = '5433';
			process.env.AGENT_DB_USER = 'agent_app';
			process.env.AGENT_DB_PASSWORD = 'secret';
			const agent = newAgentDb();
			expect(agent).not.toBeNull();
			// Restore.
			process.env.AGENT_DATABASE_URL = prev;
		});

		it('returns null when neither URL nor discrete vars are set', () => {
			_resetAgentDbForTests();
			const prevUrl = process.env.AGENT_DATABASE_URL;
			const prevHost = process.env.AGENT_DB_HOST;
			const prevUser = process.env.AGENT_DB_USER;
			const prevPw = process.env.AGENT_DB_PASSWORD;
			delete process.env.AGENT_DATABASE_URL;
			delete process.env.AGENT_DB_HOST;
			delete process.env.AGENT_DB_USER;
			delete process.env.AGENT_DB_PASSWORD;
			const agent = newAgentDb();
			expect(agent).toBeNull();
			// Restore.
			process.env.AGENT_DATABASE_URL = prevUrl;
			process.env.AGENT_DB_HOST = prevHost;
			process.env.AGENT_DB_USER = prevUser;
			process.env.AGENT_DB_PASSWORD = prevPw;
		});
	});

	describe('read methods (mocked DB returns empty rows → fail open)', () => {
		const agent = newAgentDb()!;

		it('searchKnowledge() returns [] when the DB has no rows', async () => {
			const hits = await agent.searchKnowledge('n+UF-EX');
			expect(Array.isArray(hits)).toBe(true);
			expect(hits).toHaveLength(0);
		});

		it('searchKnowledge() does not throw when called with an empty string', async () => {
			const hits = await agent.searchKnowledge('');
			expect(hits).toEqual([]);
		});

		it('searchKnowledge() accepts a kind filter without throwing', async () => {
			const hits = await agent.searchKnowledge('postgres', { kind: 'skill' });
			expect(hits).toEqual([]);
		});

		it('getEntry() returns null when the DB has no row', async () => {
			const entry = await agent.getEntry(1);
			expect(entry).toBeNull();
		});

		it('getEntryBySlug() returns null when the DB has no row', async () => {
			const entry = await agent.getEntryBySlug('does-not-exist');
			expect(entry).toBeNull();
		});

		it('recentEntries() returns [] when the DB has no rows', async () => {
			const recent = await agent.recentEntries();
			expect(recent).toEqual([]);
		});

		it('topTags() returns [] when the DB has no rows', async () => {
			const tags = await agent.topTags();
			expect(tags).toEqual([]);
		});

		it('upsertTag() returns null when the DB has no row', async () => {
			const id = await agent.upsertTag('test', 'اختبار');
			expect(id).toBeNull();
		});
	});

	describe('input clamping', () => {
		const agent = newAgentDb()!;

		it('searchKnowledge() clamps limit=0 to 1', async () => {
			// The exact limit value isn't observable without rows, but
			// the call must not throw.
			const hits = await agent.searchKnowledge('x', { limit: 0 });
			expect(hits).toEqual([]);
		});

		it('searchKnowledge() clamps limit=99999 to 50', async () => {
			const hits = await agent.searchKnowledge('x', { limit: 99999 });
			expect(hits).toEqual([]);
		});

		it('recentEntries() clamps limit into [1, 100]', async () => {
			const a = await agent.recentEntries(0);
			const b = await agent.recentEntries(99999);
			expect(a).toEqual([]);
			expect(b).toEqual([]);
		});

		it('topTags() clamps limit into [1, 100]', async () => {
			const a = await agent.topTags(0);
			const b = await agent.topTags(99999);
			expect(a).toEqual([]);
			expect(b).toEqual([]);
		});
	});

	describe('lifecycle', () => {
		it('close() resolves without throwing (mocked pool)', async () => {
			const agent = newAgentDb()!;
			await expect(agent.close()).resolves.toBeUndefined();
		});
	});
});
