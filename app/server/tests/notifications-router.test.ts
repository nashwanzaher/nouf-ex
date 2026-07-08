/**
 * Integration tests for the notifications router.
 *
 *   - GET  /api/notifications/:userId           — list
 *   - PUT  /api/notifications/:id/read          — mark as read
 *   - GET  /api/notifications/unread-count/:userId — count
 *
 * All endpoints are auth-gated. The list and mark-as-read
 * endpoints trust only `req.user!.id`. The unread-count endpoint
 * allows admins to read any user's count.
 *
 * Auth strategy: drive the real `requireAuth` by signing a real
 * Bearer token with `signTestToken` (see ./test-token.ts).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { notificationsRouter } from '../routes/notifications.ts';
import { signTestToken } from './test-token';

const CUSTOMER_TOKEN = signTestToken({ sub: 7, role: 'customer' });
const ADMIN_TOKEN = signTestToken({ sub: 1, role: 'admin' });
const bearer = { Authorization: `Bearer ${CUSTOMER_TOKEN}` };

function buildApp(): Express {
	const app = express();
	app.set('trust proxy', true);
	app.use(express.json());
	app.use('/api/notifications', notificationsRouter);
	return app;
}

describe('notificationsRouter — auth gate', () => {
	it('GET /:userId → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app).get('/api/notifications/7');
		expect(res.status).toBe(401);
	});

	it('PUT /:id/read → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app).put('/api/notifications/1/read');
		expect(res.status).toBe(401);
	});

	it('GET /unread-count/:userId → 401 without token', async () => {
		const app = buildApp();
		const res = await request(app).get('/api/notifications/unread-count/7');
		expect(res.status).toBe(401);
	});
});

describe('notificationsRouter — GET /:userId', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with an array envelope', async () => {
		const res = await request(app).get('/api/notifications/7').set(bearer);
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ success: true });
		expect(Array.isArray(res.body.data)).toBe(true);
	});
});

describe('notificationsRouter — PUT /:id/read', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 400 on a non-integer id', async () => {
		const res = await request(app).put('/api/notifications/abc/read').set(bearer);
		expect(res.status).toBe(400);
	});

	it('returns 400 on id=0', async () => {
		const res = await request(app).put('/api/notifications/0/read').set(bearer);
		expect(res.status).toBe(400);
	});

	it('returns 404 when the mock pg finds no row', async () => {
		// The handler scopes UPDATE by user_id, so a non-existent id
		// returns "Notification not found" (404).
		const res = await request(app).put('/api/notifications/123/read').set(bearer);
		expect(res.status).toBe(404);
	});
});

describe('notificationsRouter — GET /unread-count/:userId', () => {
	let app: Express;
	beforeEach(() => {
		app = buildApp();
	});

	it('returns 200 with `unread` (mocked pg returns 0)', async () => {
		const res = await request(app).get('/api/notifications/unread-count/7').set(bearer);
		expect(res.status).toBe(200);
		expect(res.body.data.user_id).toBe(7);
		expect(res.body.data.unread).toBe(0);
	});

	it('returns 400 on a non-integer userId', async () => {
		const res = await request(app).get('/api/notifications/unread-count/abc').set(bearer);
		expect(res.status).toBe(400);
	});

	it('returns 400 on userId=0', async () => {
		const res = await request(app).get('/api/notifications/unread-count/0').set(bearer);
		expect(res.status).toBe(400);
	});

	it('returns 403 when a customer asks for another user', async () => {
		const res = await request(app).get('/api/notifications/unread-count/99').set(bearer);
		expect(res.status).toBe(403);
		expect(res.body.code).toBe('FORBIDDEN');
	});

	it('returns 200 when an admin asks for another user', async () => {
		const res = await request(app)
			.get('/api/notifications/unread-count/99')
			.set('Authorization', `Bearer ${ADMIN_TOKEN}`);
		expect(res.status).toBe(200);
	});
});
