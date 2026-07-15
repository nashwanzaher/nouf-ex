/**
 * API introspection tools for the Nouf-ex MCP server.
 *
 * Parses `apps/api/src/index.ts` and extracts every Express route
 * declaration so an LLM can answer questions like
 *   "which routes require auth?"
 *   "what does GET /api/products/:id return?"
 * without re-reading the entire 1700-line file.
 */
import { z } from 'zod';
import fs from 'node:fs';
import type { ProjectContext } from './project.js';

type ToolHandler = (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>;

interface ToolSpec {
	name: string;
	description: string;
	schema: z.ZodTypeAny;
	handler: ToolHandler;
}

interface Route {
	method: string;
	path: string;
	handlerSignature: string;
	middleware: string[];
	body?: string;
	auth: 'public' | 'authed' | 'role:admin' | 'role:merchant' | 'role:any';
	line: number;
}

function asText(payload: unknown): string {
	if (typeof payload === 'string') return payload;
	return JSON.stringify(payload, null, 2);
}

/** Parse `app.get('/api/foo', requireAuth, async (req, res) => { … })` declarations. */
function parseRoutes(src: string): Route[] {
	const out: Route[] = [];
	const lines = src.split('\n');
	// We only care about `app.METHOD(...)` calls where METHOD ∈ http verbs.
	const re =
		/app\.(get|post|put|delete|patch|options|head)\(\s*([`'"])([^`'"]+)\2\s*,([\s\S]*?)\)\s*;?/gi;
	const verbRe = /app\.(get|post|put|delete|patch|options|head)\b/i;

	let m: RegExpExecArray | null;
	while ((m = re.exec(src))) {
		const verb = m[1]!.toLowerCase();
		const route = m[3]!;
		const middle = m[4]!;
		const lineNumber = src.slice(0, m.index).split('\n').length;

		// Find middleware names (identifiers passed between route and arrow fn).
		const middlewares: string[] = [];
		// We only want to capture identifiers that *look like* middleware:
		// - camelCase / PascalCase tokens ending with a verb (Auth, Role, Limiter, …)
		// - or known names (authLimiter, rateLimit, validate, …)
		// We explicitly skip req/res/next/Request/Response which are parameter names.
		const idRe = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
		const knownMw = new Set([
			'requireAuth',
			'requireRole',
			'optionalAuth',
			'rateLimit',
			'authLimiter',
			'validate',
			'loadEnv',
		]);
		const skip = new Set([
			'async',
			'function',
			'const',
			'let',
			'var',
			'return',
			'await',
			'try',
			'catch',
			'throw',
			'new',
			'if',
			'else',
			'for',
			'while',
			'switch',
			'case',
			'break',
			'continue',
			'true',
			'false',
			'null',
			'undefined',
			'this',
			'super',
			'class',
			'extends',
			'export',
			'import',
			'from',
			'as',
			'default',
		]);
		const skipParams = new Set([
			'req',
			'res',
			'next',
			'Request',
			'Response',
			'NextFunction',
			'err',
			'error',
		]);
		let idMatch: RegExpExecArray | null;
		while ((idMatch = idRe.exec(middle))) {
			const tok = idMatch[1]!;
			if (skip.has(tok) || skipParams.has(tok)) continue;
			// Heuristic: accept known middleware names, or any token whose first
			// letter is uppercase (PascalCase) — that's the Express convention
			// for middleware factories like `requireAuth`, `authLimiter`, etc.
			// Lowercase tokens like `req`, `res` have already been filtered.
			if (knownMw.has(tok) || /^[A-Z]/.test(tok) || tok === 'authLimiter' || tok === 'rateLimit') {
				middlewares.push(tok);
			}
		}

		// Heuristic auth detection.
		const middleStr = String(middle);
		const requiresAuth =
			middlewares.some((mw) => mw === 'requireAuth') ||
			/requireAuth\(/.test(middleStr) ||
			/req\.user\b/.test(middleStr);
		const adminRole =
			middlewares.some((mw) => /admin/i.test(mw)) || /requireRole\([^)]*admin/i.test(middleStr);
		const merchantRole =
			middlewares.some((mw) => /merchant/i.test(mw)) ||
			/requireRole\([^)]*merchant/i.test(middleStr);
		const auth: Route['auth'] = !requiresAuth
			? 'public'
			: adminRole
				? 'role:admin'
				: merchantRole
					? 'role:merchant'
					: 'authed';

		// Capture a short signature of the handler — first 220 chars after the
		// opening `{` of the callback.
		const cbStart = middle.indexOf('=>');
		const bodyStart = cbStart >= 0 ? middle.indexOf('{', cbStart) : middle.indexOf('{');
		const body =
			bodyStart >= 0 ? middle.slice(bodyStart, Math.min(bodyStart + 220, middle.length)) : '';

		out.push({
			method: verb.toUpperCase(),
			path: route,
			handlerSignature: body.replace(/\s+/g, ' ').trim(),
			middleware: Array.from(new Set(middlewares)),
			body: undefined,
			auth,
			line: lineNumber,
		});
	}

	// Deduplicate by method+path (regex could match duplicate spans; keep the
	// first / earliest one).
	const seen = new Set<string>();
	return out.filter((r) => {
		const key = `${r.method} ${r.path}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export function buildApiTools(ctx: ProjectContext): ToolSpec[] {
	const apiServerPath = ctx.paths.apiServerTs;
	let cached: { routes: Route[]; mtime: number } | null = null;

	function loadRoutes(): Route[] {
		const stat = fs.statSync(apiServerPath);
		if (cached && cached.mtime === stat.mtimeMs) return cached.routes;
		const src = fs.readFileSync(apiServerPath, 'utf8');
		const routes = parseRoutes(src);
		cached = { routes, mtime: stat.mtimeMs };
		return routes;
	}

	const listEndpoints: ToolSpec = {
		name: 'api_list_endpoints',
		description:
			'List every Express route declared in apps/api/src/index.ts (verb, path, auth requirement, file line).',
		schema: z.object({
			method: z
				.string()
				.optional()
				.describe('Optional method filter (GET/POST/...) — case-insensitive.'),
			auth: z
				.enum(['public', 'authed', 'role:admin', 'role:merchant', 'role:any'])
				.optional()
				.describe('Optional auth filter.'),
		}),
		handler: async (args) => {
			const { method, auth } = args as { method?: string; auth?: Route['auth'] };
			let routes = loadRoutes();
			if (method) routes = routes.filter((r) => r.method === method.toUpperCase());
			if (auth) routes = routes.filter((r) => r.auth === auth);
			return { content: [{ type: 'text', text: asText(routes) }] };
		},
	};

	const getEndpoint: ToolSpec = {
		name: 'api_get_endpoint',
		description:
			'Get details for a single endpoint (verb + path), plus a window of source code from its declaration.',
		schema: z.object({
			method: z.string().describe('HTTP verb (GET/POST/...) — case-insensitive.'),
			path: z.string().describe('Route path, e.g. /api/products/:id'),
			context_lines: z.number().int().min(0).optional().default(40),
		}),
		handler: async (args) => {
			const {
				method,
				path: p,
				context_lines,
			} = args as {
				method: string;
				path: string;
				context_lines?: number;
			};
			const verb = method.toUpperCase();
			const route = loadRoutes().find((r) => r.method === verb && r.path === p);
			if (!route) {
				return {
					content: [
						{ type: 'text', text: `No endpoint ${verb} ${p} found in apps/api/src/index.ts.` },
					],
				};
			}
			const src = fs.readFileSync(apiServerPath, 'utf8').split('\n');
			const lo = Math.max(0, route.line - 1);
			const hi = Math.min(src.length, route.line + (context_lines ?? 40));
			const excerpt = src
				.slice(lo, hi)
				.map((line, i) => `${String(lo + i + 1).padStart(5, ' ')} │ ${line}`)
				.join('\n');
			return {
				content: [
					{
						type: 'text',
						text: asText({ ...route, source_excerpt: excerpt }),
					},
				],
			};
		},
	};

	const searchApi: ToolSpec = {
		name: 'api_search',
		description:
			'Search for endpoints whose path matches a substring (e.g. "/api/cart" → all cart routes).',
		schema: z.object({
			query: z.string().min(1),
		}),
		handler: async (args) => {
			const { query } = args as { query: string };
			const routes = loadRoutes().filter((r) => r.path.includes(query));
			return { content: [{ type: 'text', text: asText(routes) }] };
		},
	};

	return [listEndpoints, getEndpoint, searchApi];
}
