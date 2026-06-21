/**
 * Nouf-ex — server-side middlewares
 *
 * Self-contained security, logging, and error-handling layer. Imported
 * once from `app/server/index.ts` and applied before any route.
 *
 * No external dependencies (helmet-style headers are inlined; structured
 * JSON logging goes to stdout so a future log shipper can pick it up
 * without code changes).
 */

import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import type { Response, RequestHandler, ErrorRequestHandler } from 'express';
import { PgDb } from './db/pg-wrapper.cjs';

// =========================================================================
// 1. Request ID — generated per request, exposed in response + logs
// =========================================================================
declare module 'express-serve-static-core' {
    interface Request {
        id?: string;
        user?: { id: number; role: 'customer' | 'merchant' | 'admin' };
    }
}

export const requestId: RequestHandler = (req, res, next) => {
    const incoming = req.header('x-request-id');
    const id = incoming && incoming.length <= 64 ? incoming : randomUUID();
    req.id = id;
    res.setHeader('x-request-id', id);
    next();
};

// =========================================================================
// 2. Trust proxy — required for correct req.ip behind nginx / Docker / k8s
// =========================================================================
export function configureTrustProxy(app: import('express').Express): void {
    const v = process.env.TRUST_PROXY;
    if (!v) return;
    // 'true' = trust first hop; '1' = same; 'loopback' = 127.0.0.1; or
    // comma-separated CIDR list.
    app.set('trust proxy', v);
}

// =========================================================================
// 3. Security headers — helmet-equivalent, no dependency
// =========================================================================
export const securityHeaders: RequestHandler = (_req, res, next) => {
    // Hardening (OWASP Secure Headers Project baseline).
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    // HSTS only when we are behind HTTPS (the env tells us).
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    next();
};

// =========================================================================
// 4. Structured JSON logger — one line per request
// =========================================================================
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
function shouldLog(level: LogLevel): boolean {
    return LEVELS[level] >= LEVELS[LOG_LEVEL];
}
function emit(level: LogLevel, obj: Record<string, unknown>): void {
    if (!shouldLog(level)) return;
    // Single-line JSON, one event per line (log-shipper friendly).
    process.stdout.write(JSON.stringify({ t: new Date().toISOString(), level, ...obj }) + '\n');
}
export const log = {
    debug: (obj: Record<string, unknown>) => emit('debug', obj),
    info: (obj: Record<string, unknown>) => emit('info', obj),
    warn: (obj: Record<string, unknown>) => emit('warn', obj),
    error: (obj: Record<string, unknown>) => emit('error', obj),
};

/** Request/response logger — emits one line at the end of the request. */
export const requestLogger: RequestHandler = (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        log.info({
            msg: 'request',
            request_id: req.id,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration_ms: Math.round(durationMs * 100) / 100,
            // user_id is set by auth middleware (or undefined for anon).
            user_id: req.user?.id,
        });
    });
    next();
};

// =========================================================================
// 5. Postgres error translation
//    Map PG error codes → HTTP status + user-safe message.
//    The raw `err.message` is NEVER sent to clients in production.
// =========================================================================
type PgError = { code?: string; constraint?: string; detail?: string; message?: string };
function asPg(err: unknown): PgError {
    if (err && typeof err === 'object') return err as PgError;
    return {};
}

const PG_TRANSLATION: Record<string, { status: number; msg: string }> = {
    '23505': { status: 409, msg: 'A record with that unique value already exists.' },
    '23503': { status: 409, msg: 'Referenced record does not exist.' },
    '23502': { status: 400, msg: 'A required field is missing.' },
    '23514': { status: 400, msg: 'A field value violates a database constraint.' },
    '22P02': { status: 400, msg: 'Invalid input format (e.g. wrong type for an ID).' },
    '40001': { status: 409, msg: 'Serialization failure — retry the transaction.' },
    '40P01': { status: 503, msg: 'Database is unreachable. Try again shortly.' },
};

/**
 * Custom error class that carries an HTTP status. Route handlers can throw
 * an `HttpError(status, message, code?)` and the global error handler will
 * translate it cleanly.
 */
export class HttpError extends Error {
    public readonly status: number;
    public readonly code?: string;
    public readonly details?: unknown;
    constructor(status: number, message: string, opts: { code?: string; details?: unknown } = {}) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        this.code = opts.code;
        this.details = opts.details;
    }
}

/**
 * Global error handler — last middleware in the chain. Returns
 * `{ success:false, error: <safe-message> }` for every failure.
 *
 * Translation order:
 *   1. HttpError → use its status + message
 *   2. PG error code → translated message
 *   3. Zod error → 400 with flattened issues
 *   4. Anything else → 500 (no message leak in production)
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    const requestId = req.id;
    // 1. Custom HttpError.
    if (err instanceof HttpError) {
        log.warn({ msg: 'http_error', request_id: requestId, status: err.status, code: err.code, path: req.path });
        return res.status(err.status).json({
            success: false,
            error: err.message,
            ...(err.code ? { code: err.code } : {}),
            ...(err.details ? { details: err.details } : {}),
            request_id: requestId,
        });
    }
    // 2. Postgres error.
    const pg = asPg(err);
    if (pg.code && PG_TRANSLATION[pg.code]) {
        const t = PG_TRANSLATION[pg.code];
        log.warn({ msg: 'pg_error', request_id: requestId, pg_code: pg.code, pg_constraint: pg.constraint, path: req.path });
        return res.status(t.status).json({
            success: false,
            error: t.msg,
            code: pg.code,
            request_id: requestId,
        });
    }
    // 3. Zod validation error (when using `schema.parse`).
    const zodErr = err as { name?: string; issues?: unknown };
    if (zodErr && (zodErr.name === 'ZodError' || Array.isArray(zodErr.issues))) {
        log.warn({ msg: 'validation_error', request_id: requestId, path: req.path });
        return res.status(400).json({
            success: false,
            error: 'Invalid input.',
            code: 'VALIDATION_ERROR',
            details: zodErr.issues,
            request_id: requestId,
        });
    }
    // 4. Anything else — log full detail, return generic message.
    log.error({
        msg: 'unhandled_error',
        request_id: requestId,
        path: req.path,
        method: req.method,
        error_name: (err as Error)?.name,
        error_message: (err as Error)?.message,
        stack: (err as Error)?.stack,
    });
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({
        success: false,
        error: isDev ? (err as Error)?.message || 'Internal error' : 'Internal server error.',
        request_id: requestId,
    });
};

/**
 * 404 handler — express 5 path.
 */
export const notFoundHandler: RequestHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: `Not found: ${req.method} ${req.path}`,
        request_id: req.id,
    });
};

// =========================================================================
// 6. HMAC-signed bearer-token auth
//
// Replaces the previous `x-user-id: <number>` header forgery. The token is
// `<base64url(payload)>.<base64url(hmac(payload))>` where payload is JSON
// `{ sub, role, exp }`. The signing key is `AUTH_SECRET`.
//
// Usage:
//   app.post('/api/auth/login', ...) → return { token, user }
//   app.use(requireAuth)            → sets req.user = { id, role }
// =========================================================================
export type AuthRole = 'customer' | 'merchant' | 'admin';

interface TokenPayload {
    sub: number;
    role: AuthRole;
    exp: number; // unix seconds
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function base64url(buf: Buffer): string {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(s: string): Buffer {
    const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
    return Buffer.from(b64, 'base64');
}

function getAuthSecret(): string {
    const s = process.env.AUTH_SECRET;
    if (s && s.length >= 32) return s;
    // Dev-only fallback. Throw in production.
    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            'AUTH_SECRET env var is required in production (≥32 random chars). ' +
                'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"',
        );
    }
    return 'dev-only-secret-' + 'x'.repeat(40);
}

export function signAuthToken(payload: { sub: number; role: AuthRole }): string {
    const full: TokenPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS };
    const body = base64url(Buffer.from(JSON.stringify(full)));
    const sig = base64url(createHmac('sha256', getAuthSecret()).update(body).digest());
    return `${body}.${sig}`;
}

export function verifyAuthToken(token: string): TokenPayload | null {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [body, sig] = token.split('.', 2);
    if (!body || !sig) return null;
    const expected = base64url(createHmac('sha256', getAuthSecret()).update(body).digest());
    // timingSafeEqual requires same length.
    if (expected.length !== sig.length) return null;
    let ok = false;
    try {
        ok = timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    } catch {
        return null;
    }
    if (!ok) return null;
    let payload: TokenPayload;
    try {
        payload = JSON.parse(fromBase64url(body).toString('utf8'));
    } catch {
        return null;
    }
    if (
        typeof payload?.sub !== 'number' ||
        typeof payload?.role !== 'string' ||
        typeof payload?.exp !== 'number'
    ) {
        return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
}

/** Optional auth — sets `req.user` if a valid token is present, otherwise continues. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
    const header = req.header('authorization') || req.header('Authorization');
    if (header && /^Bearer\s+/i.test(header)) {
        const token = header.replace(/^Bearer\s+/i, '').trim();
        const payload = verifyAuthToken(token);
        if (payload) req.user = { id: payload.sub, role: payload.role };
    }
    next();
};

/** Required auth — 401 if no valid token. */
export const requireAuth: RequestHandler = (req, res, next) => {
    const header = req.header('authorization') || req.header('Authorization');
    if (!header || !/^Bearer\s+/i.test(header)) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required.',
            code: 'AUTH_REQUIRED',
            request_id: req.id,
        });
    }
    const token = header.replace(/^Bearer\s+/i, '').trim();
    const payload = verifyAuthToken(token);
    if (!payload) {
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired token.',
            code: 'AUTH_INVALID',
            request_id: req.id,
        });
    }
    req.user = { id: payload.sub, role: payload.role };
    next();
};

/** Require a specific role (admin / merchant). */
export const requireRole = (...allowed: AuthRole[]): RequestHandler => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required.',
                code: 'AUTH_REQUIRED',
                request_id: req.id,
            });
        }
        if (!allowed.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions.',
                code: 'FORBIDDEN',
                request_id: req.id,
            });
        }
        next();
    };
};

// =========================================================================
// 7. Response helpers — strict envelope, automatic request_id
// =========================================================================
// 3rd arg is overloaded: if it's a number, treat as HTTP status; if string,
// treat as a friendly message and default to 200. This keeps call sites
// short and tolerant of the existing `sendSuccess(res, data, 'msg')` style.
export function sendSuccess<T>(
    res: Response,
    data?: T,
    statusOrMessage: number | string = 200,
    message?: string,
): void {
    const isNumeric = typeof statusOrMessage === 'number' && Number.isFinite(statusOrMessage);
    const status = isNumeric ? (statusOrMessage as number) : 200;
    const finalMessage = isNumeric ? message : (statusOrMessage as string | undefined);
    res.status(status).json({
        success: true,
        ...(data !== undefined ? { data } : {}),
        ...(finalMessage ? { message: finalMessage } : {}),
        request_id: res.req?.id,
    });
}

export function sendError(res: Response, error: string, status = 500, code?: string): void {
    res.status(status).json({
        success: false,
        error,
        ...(code ? { code } : {}),
        request_id: res.req?.id,
    });
}

// =========================================================================
// 8. Pagination helper — clamps `limit` to [1, maxLimit] and rejects NaN
// =========================================================================
export function parsePagination(
    raw: { limit?: unknown; offset?: unknown },
    maxLimit = 100,
): { limit: number; offset: number } {
    const limitNum = Number(raw.limit);
    const offsetNum = Number(raw.offset ?? 0);
    const limit = Number.isFinite(limitNum) ? Math.min(Math.max(1, limitNum), maxLimit) : 20;
    const offset = Number.isFinite(offsetNum) ? Math.max(0, offsetNum) : 0;
    return { limit, offset };
}

// =========================================================================
// 9. Env validation (zod) — run once at module load
// =========================================================================
import { z as zod } from 'zod';

const envSchema = zod.object({
    NODE_ENV: zod.enum(['development', 'production', 'test']).default('development'),
    API_PORT: zod.coerce.number().int().positive().default(3000),
    HOST: zod.string().default('0.0.0.0'),
    DATABASE_URL: zod.string().optional(),
    DB_HOST: zod.string().optional(),
    DB_PORT: zod.coerce.number().int().positive().default(5432),
    DB_NAME: zod.string().optional(),
    DB_USER: zod.string().optional(),
    DB_PASSWORD: zod.string().optional(),
    DB_SSL: zod.enum(['true', 'false']).default('false'),
    ALLOWED_ORIGINS: zod.string().default('http://localhost:3000,http://localhost:5173'),
    STATIC_PATH: zod.string().optional(),
    SERVE_STATIC: zod.enum(['true', 'false']).default('true'),
    AUTH_SECRET: zod.string().optional(),
    LOG_LEVEL: zod.enum(['debug', 'info', 'warn', 'error']).default('info'),
    TRUST_PROXY: zod.string().optional(),
});

export type Env = zod.infer<typeof envSchema>;

let _env: Env | null = null;
export function loadEnv(): Env {
    if (_env) return _env;
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
        const issues = parsed.error.issues
            .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
            .join('\n');
        throw new Error(`Invalid environment variables:\n${issues}`);
    }
    _env = parsed.data;
    return _env;
}

/** Helper: derive DATABASE_URL from discrete DB_* env vars if not set. */
export function resolveDatabaseUrl(env: Env): string {
    if (env.DATABASE_URL) return env.DATABASE_URL;
    if (env.DB_HOST && env.DB_NAME && env.DB_USER && env.DB_PASSWORD) {
        return `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;
    }
    throw new Error(
        'DATABASE_URL is not set. Copy .env.example to .env and fill in DB_HOST / DB_NAME / DB_USER / DB_PASSWORD (or set DATABASE_URL directly).',
    );
}

// Re-export PgDb for convenience
export { PgDb };
