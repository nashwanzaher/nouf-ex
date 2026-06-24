/**
 * Nouf-ex E-commerce REST API Server
 * Express + node-postgres (pg) via the PgDb wrapper
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs';
import { PgDb } from './db/pg-wrapper.cts';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import dotenv from 'dotenv';
import {
	requestId,
	securityHeaders,
	requestLogger,
	errorHandler,
	notFoundHandler,
	optionalAuth,
	loadEnv,
	resolveDatabaseUrl,
	configureTrustProxy,
	healthRateLimit,
	log,
} from './middleware';
import { adminRouter } from './routes/admin.cts';
import { adminReadRouter } from './routes/admin-read.cts';
import { catalogRouter } from './routes/catalog.cts';
import { auth2faRouter } from './routes/auth-2fa.cts';
import { authRouter } from './routes/auth.cts';
import { ordersRouter } from './routes/orders.cts';
import { cartRouter } from './routes/cart.cts';
import { wishlistRouter } from './routes/wishlist.cts';
import { notificationsRouter } from './routes/notifications.cts';
import { paymentsRouter } from './routes/payments.cts';
import { couponsRouter } from './routes/coupons.cts';
import { refundsRouter } from './routes/refunds.cts';
import { reviewsRouter } from './routes/reviews.cts';
import { statsRouter } from './routes/stats.cts';
import { shippingRouter } from './routes/shipping.cts';
import { storeFollowersRouter } from './routes/store-followers.cts';
import { addressesRouter } from './routes/addresses.cts';

dotenv.config();

// --- Env validation -----------------------------------------------------------
const env = loadEnv();

// --- __filename / __dirname ----------------------------------------------------
const __dirname = (() => {
	try {
		if (typeof import.meta.url === 'string' && import.meta.url.length > 0) {
			return path.dirname(fileURLToPath(import.meta.url));
		}
	} catch {
		/* fall through to cwd */
	}
	return process.cwd();
})();

const app = express();
const PORT = env.API_PORT;
const DATABASE_URL = resolveDatabaseUrl(env);
const STATIC_PATH = env.STATIC_PATH || path.resolve(__dirname, 'dist');

// --- Database Connection (PostgreSQL via pg) ---
const db = new PgDb(DATABASE_URL);

// --- Middleware stack (order matters) ---
configureTrustProxy(app);
app.use(requestId);
app.use(securityHeaders);

const ALLOWED_ORIGINS = env.ALLOWED_ORIGINS.split(',')
	.map((s) => s.trim())
	.filter(Boolean);
app.use(
	cors({
		origin: ALLOWED_ORIGINS,
		credentials: true,
	}),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(optionalAuth);
app.use(requestLogger);

// --- Health & readiness endpoints (un-authenticated, log-skipped) ---
const healthLimiter = healthRateLimit({ windowMs: 1000, max: 30, bucket: 'health' });

app.get('/api/health', healthLimiter, (_req: Request, res: Response) => {
	res.status(200).json({
		status: 'ok',
		uptime_s: Math.round(process.uptime()),
		ts: new Date().toISOString(),
	});
});

const READY_STARTED_AT = Date.now();
app.get('/api/ready', healthLimiter, async (_req: Request, res: Response) => {
	const checks: Record<string, { ok: boolean; ms: number; detail?: string }> = {};
	const startedAt = Date.now();
	let timeoutId: NodeJS.Timeout | undefined;
	try {
		const timeout = new Promise<never>((_, reject) => {
			timeoutId = setTimeout(() => reject(new Error('db timeout')), 2000);
		});
		const result = await Promise.race([db.prepare('SELECT 1 AS ok').get(), timeout]);
		if (timeoutId) clearTimeout(timeoutId);
		checks.db = { ok: !!result, ms: Date.now() - startedAt };
	} catch (e) {
		if (timeoutId) clearTimeout(timeoutId);
		checks.db = { ok: false, ms: Date.now() - startedAt, detail: (e as Error).message };
	}
	const allOk = Object.values(checks).every((c) => c.ok);
	res.status(allOk ? 200 : 503).json({
		status: allOk ? 'ready' : 'degraded',
		uptime_s: Math.round((Date.now() - READY_STARTED_AT) / 1000),
		checks,
	});
});

// Background sweeper — evict expired rate-limit rows every minute
setInterval(async () => {
	try {
		const r = (await db.prepare('SELECT cleanup_rate_limits() AS n').get()) as
			| { n: number }
			| undefined;
		if (r && r.n > 0) log.debug({ msg: 'rate_limit_cleanup', deleted: r.n });
	} catch {
		/* ignore */
	}
}, 60 * 1000).unref();

// ── Router mounts ─────────────────────────────────────────────────────────
app.use('/api/admin', adminRouter);
app.use('/api', catalogRouter);

app.use('/api/auth', authRouter);
app.use('/api/auth/2fa', auth2faRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/cart', cartRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/refunds', refundsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/shipping', shippingRouter);
app.use('/api/store-followers', storeFollowersRouter);
app.use('/api/addresses', addressesRouter);

app.use('/api/admin', adminReadRouter);

// ═══════════════════════════════════════════════════════════
// STATIC FILES (Production SPA fallback)
// ═══════════════════════════════════════════════════════════

if (process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC === 'true') {
	app.use(express.static(STATIC_PATH));

	app.get('/{*splat}', (req: Request, res: Response, next: NextFunction) => {
		if (req.path.startsWith('/api/')) return next();
		const indexPath = path.join(STATIC_PATH, 'index.html');
		fs.access(indexPath, fs.constants.R_OK, (err) => {
			if (err) return next();
			res.sendFile(indexPath);
		});
	});
}

// ═══════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════

app.use(notFoundHandler);
app.use(errorHandler);

// ═══════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════

process.on('SIGTERM', async () => {
	await db.close();
	process.exit(0);
});
process.on('SIGINT', async () => {
	await db.close();
	process.exit(0);
});

const __isMainModule = (() => {
	try {
		const here = import.meta.url;
		const argv1 = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
		return here === argv1;
	} catch {
		return false;
	}
})();
if (__isMainModule) {
	app.listen(PORT, () => {
		log.info({
			msg: 'server_started',
			port: PORT,
			database: PgDb.redactUrl(DATABASE_URL),
			static_path: STATIC_PATH,
			env: process.env.NODE_ENV || 'development',
		});
	});
}

export default app;
