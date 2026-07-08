/**
 * Nouf-ex E-commerce REST API Server
 * Express + node-postgres (pg) via the PgDb wrapper
 */

import cors from 'cors';
import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
// Side-effect import: must run BEFORE shared.cts is loaded,
// because shared.cts reads process.env.DATABASE_URL at module
// evaluation time and throws if it is missing. A bare
// `dotenv.config()` call would run too late (after the imports).
import 'dotenv/config';
import {
    configureTrustProxy,
    errorHandler,
    healthRateLimit,
    loadEnv,
    log,
    notFoundHandler,
    optionalAuth,
    requestId,
    requestLogger,
    securityHeaders,
} from './middleware';
// Re-use the single shared DB pool (shared.ts creates it once from
// DATABASE_URL). Creating a second PgDb here would double the max
// connection count and waste resources.
import { db } from './lib/shared.ts';
import { addressesRouter } from './routes/addresses.ts';
import { adminReadRouter } from './routes/admin-read.ts';
import { adminRouter } from './routes/admin.ts';
import { auth2faRouter } from './routes/auth-2fa.ts';
import { authRouter } from './routes/auth.ts';
import { cartRouter } from './routes/cart.ts';
import { catalogRouter } from './routes/catalog.ts';
import { couponsRouter } from './routes/coupons.ts';
import { messagesRouter } from './routes/messages.ts';
import { notificationsRouter } from './routes/notifications.ts';
import { ordersRouter } from './routes/orders.ts';
import { paymentsRouter } from './routes/payments.ts';
import { refundsRouter } from './routes/refunds.ts';
import { reviewsRouter } from './routes/reviews.ts';
import { sellerRouter } from './routes/seller.ts';
import { shippingRouter } from './routes/shipping.ts';
import { statsRouter } from './routes/stats.ts';
import { storeFollowersRouter } from './routes/store-followers.ts';
import { wishlistRouter } from './routes/wishlist.ts';

// Note: `import 'dotenv/config'` above already loaded .env.
// Keep this comment as a marker so future readers know not to
// re-add the `dotenv.config()` call below — it would be a no-op
// but the call site order is the whole reason the side-effect
// import is in place.

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
const STATIC_PATH = env.STATIC_PATH || path.resolve(__dirname, 'dist');

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
// SECURITY (M-1): the previous 10 MB JSON limit was a DoS vector — a
// single attacker could pin ~10 MB of heap per concurrent request.
// 1 MB is more than enough for any of our documented payloads (the
// largest legal body is a 100-item cart with full shipping address,
// well under 50 KB). File uploads go through a separate, multipart
// endpoint that we haven't introduced yet; when we do, it will use
// its own busboy config with a per-route limit.
//
// SECURITY (C-1, 2026-07-02): capture the raw body bytes into
// `req.rawBody` so payment webhooks can verify HMAC signatures
// over the EXACT bytes Stripe/Paymob signed. Without this, every
// real webhook was being rejected because `rawBody` was the
// empty string (default), causing `verifyWebhook()` to compute
// HMAC over '' and timingSafeEqual to fail. JSON.parse followed
// by JSON.stringify does NOT round-trip byte-identically (key
// order, whitespace, Unicode escapes differ), so we MUST
// capture the buffer before parsing. This is the canonical
// Express pattern — the `verify` callback is the only hook
// Express gives us access to the raw Buffer.
app.use(
	express.json({
		limit: '1mb',
		verify: (req, _res, buf) => {
			(req as Request & { rawBody?: string }).rawBody = buf.toString('utf8');
		},
	}),
);
// urlencoded needs the same raw capture. Express's urlencoded
// does NOT support a `verify` callback, so we register a tiny
// pre-parser that buffers the body for application/x-www-form-
// urlencoded requests (Paymob's webhook format) before delegating
// to the standard urlencoded parser. JSON requests skip this
// entirely and use the json() parser above (which also captures
// the raw body via `verify`).
app.use((req, _res, next) => {
	const contentType = String(req.headers['content-type'] ?? '');
	if (!contentType.startsWith('application/x-www-form-urlencoded')) {
		return next();
	}
	let buf = '';
	req.setEncoding('utf8');
	req.on('data', (chunk) => (buf += chunk));
	req.on('end', () => {
		(req as Request & { rawBody?: string }).rawBody = buf;
		try {
			req.body = Object.fromEntries(new URLSearchParams(buf));
		} catch {
			req.body = {};
		}
		next();
	});
	req.on('error', next);
});
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
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

// Background sweeper — evict expired rate-limit + used_jti rows every minute
setInterval(async () => {
	try {
		const r = (await db.prepare('SELECT cleanup_rate_limits() AS n').get()) as
			| { n: number }
			| undefined;
		if (r && r.n > 0) log.debug({ msg: 'rate_limit_cleanup', deleted: r.n });
		const j = (await db.prepare('SELECT cleanup_used_jtis() AS n').get()) as
			| { n: number }
			| undefined;
		if (j && j.n > 0) log.debug({ msg: 'used_jtis_cleanup', deleted: j.n });
	} catch {
		/* ignore */
	}
}, 60 * 1000).unref();

// ── Router mounts ─────────────────────────────────────────────────────────

/**
 * Attach a small `Cache-Control: public, max-age=N, stale-while-revalidate=N/2`
 * header on the response (only when the handler hasn't already set one).
 * Lets the browser + any CDN cache the payload for a few seconds. We
 * deliberately keep the TTL short because catalog data changes often
 * (admin PATCHes, new products, etc.) and longer max-age would mask
 * those changes from end users.
 */
function cacheControl(seconds: number, router: express.Router) {
	const cacheMw: RequestHandler = (req, res, next) => {
		if (!res.getHeader('Cache-Control') && req.method === 'GET') {
			res.setHeader(
				'Cache-Control',
				`public, max-age=${seconds}, stale-while-revalidate=${Math.floor(seconds / 2)}`,
			);
		}
		next();
	};
	// Compose middleware + router into a single RequestHandler-like object
	const composed = [cacheMw, router] as unknown as express.RequestHandler;
	return composed;
}

app.use('/api/admin', adminRouter);
app.use('/api', cacheControl(60, catalogRouter)); // catalog = 60s edge cache

app.use('/api/auth', authRouter);
app.use('/api/auth/2fa', auth2faRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/cart', cartRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/seller', sellerRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/refunds', refundsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/stats', cacheControl(30, statsRouter)); // stats = 30s edge cache
app.use('/api/shipping', cacheControl(300, shippingRouter)); // shipping = 5min
app.use('/api/store-followers', storeFollowersRouter);
app.use('/api/addresses', addressesRouter);

app.use('/api/admin', adminReadRouter);

// ═══════════════════════════════════════════════════════════
// STATIC FILES (Production SPA fallback)
// ═══════════════════════════════════════════════════════════

if (process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC === 'true') {
	// Serve static assets but NOT index.html (we handle that below so we
	// can inject the CSP nonce). The `index: false` flag stops express.static
	// from serving index.html for "/" automatically.
	app.use(express.static(STATIC_PATH, { index: false }));

	app.get('/{*splat}', (req: Request, res: Response, next: NextFunction) => {
		if (req.path.startsWith('/api/')) return next();
		const indexPath = path.join(STATIC_PATH, 'index.html');
		fs.access(indexPath, fs.constants.R_OK, (err) => {
			if (err) return next();
			// Read the static index.html, inject the CSP nonce onto every
			// <script> and <style> tag, plus a <meta> tag the SPA can read
			// to attach the nonce to dynamically-created tags. The nonce
			// itself is generated by the securityHeaders middleware and
			// stored on res.locals.cspNonce.
			fs.readFile(indexPath, 'utf8', (readErr, html) => {
				if (readErr) return next();
				const nonce = res.locals.cspNonce as string | undefined;
				if (!nonce) return res.send(html); // CSP middleware not active — pass through.
				const inject = ` nonce="${nonce}"`;
				const patched = html
					.replace(/<script(\s)/g, `<script${inject}$1`)
					.replace(/<script>/g, `<script${inject}>`)
					.replace(/<style(\s)/g, `<style${inject}$1`)
					.replace(/<style>/g, `<style${inject}>`)
					.replace(/<head>/i, `<head><meta name="csp-nonce" content="${nonce}">`);
				res.setHeader('Content-Type', 'text/html; charset=utf-8');
				res.send(patched);
			});
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
