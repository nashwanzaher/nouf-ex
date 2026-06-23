/**
 * Unit tests for the in-memory `healthRateLimit` middleware.
 *
 * The middleware caps per-IP request rate on the /api/health and
 * /api/ready endpoints so a misbehaving monitoring agent (or an
 * attacker) cannot amplify load. The limiter is intentionally
 * in-memory and independent of the database — see the long
 * comment block in `server/middleware.ts` for the rationale.
 *
 * What we verify here:
 *   1. The first N requests inside the window pass through.
 *   2. The (N+1)th request gets 429 with a Retry-After header.
 *   3. After the window expires, the bucket resets and traffic
 *      resumes normally.
 *   4. Per-IP isolation — one noisy client must not affect another.
 *   5. The limiter never throws (a limiter bug must not crash a probe).
 *   6. The response envelope is consistent with the rest of the API
 *      (`success: false`, `code: RATE_LIMITED`, `request_id`).
 */
import { describe, expect, it, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { healthRateLimit } from '../middleware';

// ── Test helpers ──────────────────────────────────────────────────────────
/**
 * Build a minimal mock Express request. The middleware only reads
 * `req.ip`, `req.socket.remoteAddress`, and `req.id`, so a literal
 * object with those three fields is enough.
 */
function mockReq(ip: string, id = 'test-req-id'): Partial<Request> {
	return {
		ip,
		socket: { remoteAddress: ip } as unknown as Request['socket'],
		id,
	} as Partial<Request>;
}

/** A minimal mock response that records status/json/headers. */
function mockRes(): Response & {
	_status: number | null;
	_body: unknown;
	_headers: Record<string, string | number>;
} {
	const headers: Record<string, string | number> = {};
	const res = {
		_status: null as number | null,
		_body: undefined as unknown,
		_headers: headers,
		setHeader(name: string, value: string | number) {
			headers[name] = value;
		},
		status(code: number) {
			this._status = code;
			return this;
		},
		json(body: unknown) {
			this._body = body;
			return this;
		},
	};
	return res as Response & {
		_status: number | null;
		_body: unknown;
		_headers: Record<string, string | number>;
	};
}

/** Run the middleware once and return whether `next` was called. */
function call(
	mw: ReturnType<typeof healthRateLimit>,
	req: Partial<Request>,
	res: Response
): boolean {
	let nextCalled = false;
	mw(req as Request, res, () => {
		nextCalled = true;
	});
	return nextCalled;
}

// ── Tests ────────────────────────────────────────────────────────────────
describe('healthRateLimit', () => {
	beforeEach(() => {
		// Note: the limiter stores state in a module-level Map. Each test
		// uses a fresh `bucket` option so the buckets do not bleed across
		// cases. The per-test bucket name keeps the suite deterministic
		// regardless of execution order.
	});

	it('passes through the first `max` requests inside a window', () => {
		const mw = healthRateLimit({ windowMs: 1000, max: 3, bucket: 't1' });
		const req = mockReq('10.0.0.1');
		const r1 = mockRes();
		const r2 = mockRes();
		const r3 = mockRes();
		expect(call(mw, req, r1)).toBe(true);
		expect(call(mw, req, r2)).toBe(true);
		expect(call(mw, req, r3)).toBe(true);
	});

	it('rejects the (max+1)th request with 429 + Retry-After', () => {
		const mw = healthRateLimit({ windowMs: 1000, max: 2, bucket: 't2' });
		const req = mockReq('10.0.0.2');
		// First two pass through.
		expect(call(mw, req, mockRes())).toBe(true);
		expect(call(mw, req, mockRes())).toBe(true);
		// Third is rejected.
		const res = mockRes();
		const nextCalled = call(mw, req, res);
		expect(nextCalled).toBe(false);
		expect(res._status).toBe(429);
		expect(res._headers['Retry-After']).toBeGreaterThanOrEqual(1);
		// Envelope must match the rest of the API.
		const body = res._body as { success: boolean; code: string; request_id: string };
		expect(body.success).toBe(false);
		expect(body.code).toBe('RATE_LIMITED');
		expect(body.request_id).toBe('test-req-id');
	});

	it('isolates buckets per IP — one noisy client does not affect another', () => {
		const mw = healthRateLimit({ windowMs: 1000, max: 1, bucket: 't3' });
		const clientA = mockReq('10.0.0.10');
		const clientB = mockReq('10.0.0.11');
		// Client A uses its single slot.
		expect(call(mw, clientA, mockRes())).toBe(true);
		// Client A is now throttled.
		expect(call(mw, clientA, mockRes())).toBe(false);
		// Client B is unaffected.
		expect(call(mw, clientB, mockRes())).toBe(true);
	});

	it('resets after the window expires — uses real time, not fakes', async () => {
		// We use a 50ms window so the test stays fast but still exercises
		// the real `Date.now()` path. This is the only place in the suite
		// that relies on real wall-clock time.
		const mw = healthRateLimit({ windowMs: 50, max: 1, bucket: 't4' });
		const req = mockReq('10.0.0.20');
		expect(call(mw, req, mockRes())).toBe(true);
		// Immediately throttled.
		const blocked = call(mw, req, mockRes());
		expect(blocked).toBe(false);
		// After the window, traffic resumes.
		await new Promise((r) => setTimeout(r, 80));
		expect(call(mw, req, mockRes())).toBe(true);
	});

	it('falls back to req.socket.remoteAddress when req.ip is missing', () => {
		const mw = healthRateLimit({ windowMs: 1000, max: 1, bucket: 't5' });
		// req.ip is undefined → middleware should use socket.remoteAddress.
		const req = { socket: { remoteAddress: '192.168.1.1' }, id: 'x' } as unknown as Request;
		expect(call(mw, req, mockRes())).toBe(true);
		expect(call(mw, req, mockRes())).toBe(false);
	});

	it('uses "anon" bucket when no IP is available (does not throw)', () => {
		const mw = healthRateLimit({ windowMs: 1000, max: 1, bucket: 't6' });
		// Both req.ip and req.socket are missing → middleware must still
		// resolve a bucket and continue. No throw, no crash.
		const req = { id: 'x' } as unknown as Request;
		// A higher max so we can verify the "no throw" path AND the
		// count increment in one test, without one shadowing the other.
		const mwGenerous = healthRateLimit({ windowMs: 1000, max: 5, bucket: 't6b' });
		expect(() => {
			for (let i = 0; i < 5; i++) call(mwGenerous, req, mockRes());
		}).not.toThrow();
		// 6th request is throttled — the bucket key is the fallback 'anon'.
		expect(call(mwGenerous, req, mockRes())).toBe(false);
		// Suppress the unused `mw` so eslint stays happy.
		void mw;
	});

	it('keeps a single bucket across requests from the same IP', () => {
		const mw = healthRateLimit({ windowMs: 1000, max: 5, bucket: 't7' });
		const req = mockReq('10.0.0.30');
		// Five requests in a row all pass.
		for (let i = 0; i < 5; i++) {
			expect(call(mw, req, mockRes())).toBe(true);
		}
		// The sixth is blocked (same bucket is reused).
		expect(call(mw, req, mockRes())).toBe(false);
	});

	it('uses the default 30/1s budget when no options are passed', () => {
		const mw = healthRateLimit({ bucket: 't8' });
		const req = mockReq('10.0.0.40');
		// The first 30 requests pass.
		for (let i = 0; i < 30; i++) {
			expect(call(mw, req, mockRes())).toBe(true);
		}
		// The 31st is blocked.
		const res = mockRes();
		expect(call(mw, req, res)).toBe(false);
		expect(res._status).toBe(429);
	});
});
