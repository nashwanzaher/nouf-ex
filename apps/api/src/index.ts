/**
 * Nouf-ex E-commerce REST API Server
 * Express + node-postgres (pg) via the PgDb wrapper
 */

import cors from 'cors';
import express, {
	type NextFunction,
	type Request,
	type RequestHandler,
	type Response,
} from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
// Side-effect import: must run BEFORE shared.ts is loaded,
// because shared.ts reads process.env.DATABASE_URL at module
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
import { PgDb } from './db/pg-wrapper.ts';
import { db } from './lib/shared.ts';
import cookieParser from 'cookie-parser';
import {
	csrfProtection,
	csrfTokenEndpoint,
	startAuditCleanupScheduler,
	stopAuditCleanupScheduler,
} from './lib/shared.ts';
import { addressesRouter } from './modules/addresses/index.ts';
import { adminExtrasRouter, adminRouter } from './modules/admin/index.ts';
import { auth2faRouter } from './modules/auth-2fa/index.ts';
import { authRouter } from './modules/auth/index.ts';
import { cartRouter } from './modules/cart/index.ts';
import { catalogRouter } from './modules/catalog/index.ts';
import { couponsRouter } from './modules/coupons/index.ts';
import { customerReviewsRouter } from './modules/customer-reviews/index.ts';
import { deliveryAgentRouter } from './modules/delivery-agent/index.ts';
import { messagesRouter } from './modules/messages/index.ts';
import { notificationsRouter } from './modules/notifications/index.ts';
import { ordersRouter } from './modules/orders/index.ts';
import { paymentsRouter } from './modules/payments/index.ts';
import { refundsRouter } from './modules/refunds/index.ts';
import { reviewsRouter } from './modules/reviews/index.ts';
import { sellerRouter } from './modules/seller/index.ts';
import { shippingRouter } from './modules/shipping/index.ts';
import { statsRouter } from './modules/stats/index.ts';
import { storeFollowersRouter } from './modules/store-followers/index.ts';
import { wishlistRouter } from './modules/wishlist/index.ts';

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
		methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'x-csrf-token'],
		exposedHeaders: ['x-request-id'],
		maxAge: 86400,
	}),
);
// Cookie parsing — required by the CSRF middleware below. The cookie
// secret is irrelevant because the SPA never sends its auth cookie
// via document.cookie (it's HttpOnly). The parser only needs to
// populate `req.cookies` for the CSRF double-submit comparison.
app.use(cookieParser('noufex-csrf-double-submit'));

// P0 (2026-07-12): CSRF double-submit protection. Applied globally so
// every mutating endpoint (POST/PATCH/DELETE) requires the SPA to
// echo back the `x-csrf-token` header from the `noufex_csrf`
// non-HttpOnly cookie. Unauthenticated routes (login, register,
// health, ready, /api/auth/csrf itself) are exempt.
app.use(csrfProtection());

// Lightweight endpoint the SPA calls once on app boot to mint a fresh
// token (and get the JSON mirror for the API client to cache).
app.get('/api/auth/csrf', csrfTokenEndpoint);
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
	// SECURITY: enforce a 1MB size limit to prevent memory exhaustion
	// DoS attacks via oversized urlencoded bodies.
	const contentLength = Number(req.headers['content-length'] || 0);
	if (contentLength > 1_048_576) {
		req.destroy();
		_res.writeHead(413);
		_res.end('Payload Too Large');
		return;
	}
	let buf = '';
	req.setEncoding('utf8');
	req.on('data', (chunk) => {
		buf += chunk;
		if (buf.length > 1_048_576) {
			req.destroy();
			_res.writeHead(413);
			_res.end('Payload Too Large');
		}
	});
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

	// ── Memory check (NIST SP 800-53 SI-4, OWASP ASVS 7.1) ────────────
	// Detect memory pressure that could cause OOM kills or GC pauses.
	// Heap limit is typically ~1.5 GB on 64-bit Node; warn at 80%.
	const mem = process.memoryUsage();
	const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
	const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
	const rssMB = Math.round(mem.rss / 1024 / 1024);
	const externalMB = Math.round(mem.external / 1024 / 1024);
	const heapUtilization = mem.heapTotal > 0 ? mem.heapUsed / mem.heapTotal : 0;
	const memoryOk = heapUtilization < 0.85;
	checks.memory = {
		ok: memoryOk,
		ms: 0,
		detail: memoryOk
			? undefined
			: `heap ${Math.round(heapUtilization * 100)}% (${heapUsedMB}/${heapTotalMB} MB)`,
	};

	// ── GC pressure detection (NIST SP 800-53 SI-4, OWASP ASVS 7.1) ──
	// Detect GC pressure that indicates memory churn or leak.
	// Thresholds:
	//   - Total pause >500ms → degraded (GC is blocking requests)
	//   - Major GC >10 in measurement window → degraded (heap is stressed)
	//   - GC frequency >1/sec sustained → warning (high allocation rate)
	const gcStats = { major: 0, minor: 0, incremental: 0, totalPauseMs: 0 };
	try {
		const { PerformanceObserver } = await import('node:perf_hooks');
		const obs = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				if (entry.entryType === 'gc') {
					gcStats.totalPauseMs += entry.duration;
					// V8 GC kinds: 'major' (mark-sweep), 'minor' (scavenge),
					// 'incremental', 'commit', 'process_weak_callbacks'
					const kind = (entry as { kind?: string }).kind;
					if (kind === 'major') gcStats.major++;
					else if (kind === 'minor') gcStats.minor++;
					else gcStats.incremental++;
				}
			}
		});
		obs.observe({ entryTypes: ['gc'], buffered: true } as never);
		await new Promise((r) => setImmediate(r));
		obs.disconnect();
	} catch {
		// perf_hooks GC observer not available — skip silently
	}
	const gcPauseOk = gcStats.totalPauseMs < 500;
	const gcMajorOk = gcStats.major <= 10;
	const gcOk = gcPauseOk && gcMajorOk;
	const gcDetail = !gcOk
		? [
				gcPauseOk ? undefined : `total pause ${Math.round(gcStats.totalPauseMs)}ms`,
				gcMajorOk ? undefined : `major GCs ${gcStats.major} (heap stressed)`,
			]
				.filter(Boolean)
				.join(', ')
		: undefined;
	checks.gc = {
		ok: gcOk,
		ms: Math.round(gcStats.totalPauseMs),
		detail: gcDetail,
	};

	// ── Event loop lag check ────────────────────────────────────────────
	// A blocked event loop (>500ms) means the server cannot handle
	// requests. We measure by scheduling a immediate and checking
	// how much time elapsed.
	const loopStart = process.hrtime.bigint();
	await new Promise((r) => setImmediate(r));
	const loopLagMs = Number(process.hrtime.bigint() - loopStart) / 1e6;
	const loopOk = loopLagMs < 500;
	checks.event_loop = {
		ok: loopOk,
		ms: Math.round(loopLagMs),
		detail: loopOk ? undefined : `event loop lag ${Math.round(loopLagMs)}ms`,
	};

	// ── Pool connection metrics ─────────────────────────────────────────
	const poolStats = db.getPoolStats();
	const poolHealthy = poolStats.totalCount > 0 && poolStats.waitingCount < poolStats.totalCount;
	checks.pool = {
		ok: poolHealthy,
		ms: 0,
		detail: poolHealthy
			? undefined
			: `waiting=${poolStats.waitingCount} total=${poolStats.totalCount}`,
	};

	const allOk = Object.values(checks).every((c) => c.ok);
	res.status(allOk ? 200 : 503).json({
		status: allOk ? 'ready' : 'degraded',
		uptime_s: Math.round((Date.now() - READY_STARTED_AT) / 1000),
		checks,
		pool: {
			total: poolStats.totalCount,
			idle: poolStats.idleCount,
			waiting: poolStats.waitingCount,
		},
		memory: {
			heap_used_mb: heapUsedMB,
			heap_total_mb: heapTotalMB,
			rss_mb: rssMB,
			external_mb: externalMB,
		},
	});
});

// Background sweeper — evict expired rate-limit + used_jti rows every minute.
// Jitter prevents multiple replicas from sweeping at the same instant.
const SWEEP_INTERVAL_MS = 60_000 + Math.random() * 10_000; // 60-70s jitter
setInterval(async () => {
	try {
		const r = (await db.prepare('SELECT cleanup_rate_limits() AS n').get()) as
			{ n: number } | undefined;
		if (r && r.n > 0) log.debug({ msg: 'rate_limit_cleanup', deleted: r.n });
		const j = (await db.prepare('SELECT cleanup_used_jtis() AS n').get()) as
			{ n: number } | undefined;
		if (j && j.n > 0) log.debug({ msg: 'used_jtis_cleanup', deleted: j.n });
	} catch (err) {
		// Log so operators can see if the DB is sick or migrations
		// have dropped the cleanup functions.
		log.warn({ msg: 'background_sweeper_error', error: (err as Error).message });
	}
}, SWEEP_INTERVAL_MS).unref();

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
app.use('/api/admin', adminExtrasRouter);
app.use('/api', cacheControl(60, catalogRouter)); // catalog = 60s edge cache

app.use('/api/auth', authRouter);
app.use('/api/auth/2fa', auth2faRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/cart', cartRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/seller', sellerRouter);
app.use('/api/delivery-agent', deliveryAgentRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/refunds', refundsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/customer/reviews', customerReviewsRouter);
app.use('/api/stats', cacheControl(30, statsRouter)); // stats = 30s edge cache
app.use('/api/shipping', cacheControl(300, shippingRouter)); // shipping = 5min
app.use('/api/store-followers', storeFollowersRouter);
app.use('/api/addresses', addressesRouter);

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

const __isMainModule = (() => {
	try {
		const here = import.meta.url;
		const argv1 = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
		return here === argv1;
	} catch {
		return false;
	}
})();
let server: import('http').Server | null = null;

/** Graceful shutdown: stop accepting new connections, wait for
 *  in-flight requests to complete (up to 10s), then close the DB pool.
 *
 *  Cross-platform notes (2026-07-11):
 *    - On Linux/macOS, process supervisors send SIGTERM/SIGINT and the
 *      handlers below run cleanly.
 *    - On Windows, `Stop-Process` and `taskkill /PID` send a hard
 *      terminate that does NOT fire the signal handlers. To get a
 *      clean shutdown on Windows, the user must run the server in a
 *      console and press Ctrl+C (which fires SIGINT) OR send
 *      Ctrl+Break. The `process.stdin.on('end')` listener below is
 *      a safety net: it fires if the controlling terminal is closed
 *      cleanly (e.g. `exit` from a shell that owns the process).
 *    - As an absolute fallback, the process.stdin.unref() trick below
 *      keeps the process alive only as long as stdin is connected,
 *      so closing the parent shell eventually drains connections. */
async function gracefulShutdown(signal: string): Promise<void> {
	log.info({ msg: 'shutdown_started', signal });
	// Stop the audit-cleanup scheduler first so we don't kick off a
	// new run mid-shutdown.
	stopAuditCleanupScheduler();
	if (server) {
		await new Promise<void>((resolve) => {
			server!.close(() => resolve());
			// Force exit after 10s if connections don't drain
			setTimeout(() => {
				log.warn({ msg: 'shutdown_force_exit' });
				resolve();
			}, 10_000).unref();
		});
	}
	try {
		await db.close();
	} catch (err) {
		log.warn({ msg: 'db_close_error', error: (err as Error).message });
	}
	log.info({ msg: 'shutdown_complete' });
	process.exit(0);
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

// Windows-friendly fallback: when the parent shell closes its end
// of stdin (e.g. user closes the terminal), Node emits 'end' on
// process.stdin. We treat it as an implicit SIGTERM.
//
// Guard: only attach when stdin is actually a TTY. When the process
// is launched by `Start-Process` (or by `npm run` with stdout
// redirected to a file), stdin is NOT a TTY and the 'end' event
// fires immediately at startup — which would shut the server down
// before any request could be served. We check `process.stdin.isTTY`
// AND `process.stdin.readable` to avoid that false positive.
if (
	process.stdin &&
	typeof process.stdin.on === 'function' &&
	process.stdin.isTTY === true
) {
	process.stdin.on('end', () => void gracefulShutdown('STDIN_EOF'));
	process.stdin.resume();
}
if (__isMainModule) {
	// P0 (2026-07-12): start the audit-log retention scheduler. This
	// kicks off `cleanup_audit_logs()` once per day at 03:00 (UTC by
	// default; configurable via env vars) and dead-letters to logs
	// on failure. Started BEFORE the listener so the first run happens
	// after the DB pool is up but before the first request lands.
	startAuditCleanupScheduler();
	server = app.listen(PORT, () => {
		log.info({
			msg: 'server_started',
			port: PORT,
			database: env.DATABASE_URL ? PgDb.redactUrl(env.DATABASE_URL) : 'via DB_* vars',
			static_path: STATIC_PATH,
			env: process.env.NODE_ENV || 'development',
		});
	});
}

export default app;
