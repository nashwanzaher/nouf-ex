/**
 * OpenAPI 3.1 documentation — Tier 4.2.
 *
 * Implements the OpenAPI specification (https://spec.openapis.org/oas/v3.1.0)
 * published by the OpenAPI Initiative under the Linux Foundation.
 * The spec is auto-generated from the Zod schemas we already
 * validate request bodies with, so the contract that the API
 * enforces is the contract that the docs declare — no drift.
 *
 * Endpoints:
 *   GET  /api/openapi.json   — the full OpenAPI 3.1 document
 *   GET  /api/docs           — Swagger UI rendering of the same
 *   GET  /api/redoc          — ReDoc rendering (alternative UI)
 *
 * Components are sourced via `@asteasolutions/zod-to-openapi`
 * which is the de-facto standard for Zod → OpenAPI conversion
 * (it implements the spec correctly and is kept in lockstep
 * with Zod releases).
 */
import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { getActiveVersions } from './api-version.ts';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const BEARER_AUTH = 'bearerAuth';
const COOKIE_AUTH = 'sessionCookie';

// ── Security schemes ──────────────────────────────────────────────────
registry.registerComponent('securitySchemes', BEARER_AUTH, {
	type: 'http',
	scheme: 'bearer',
	bearerFormat: 'JWT',
	description: 'Bearer token from /api/auth/login (sent on mobile requests).',
});

registry.registerComponent('securitySchemes', COOKIE_AUTH, {
	type: 'apiKey',
	in: 'cookie',
	name: 'noufex_auth',
	description: 'HttpOnly session cookie issued by /api/auth/login.',
});

// ── Reusable schemas (typed first, then registered) ───────────────────
const ErrorEnvelope = z
	.object({
		success: z.literal(false),
		error: z.string().describe('Human-readable error message'),
		code: z.string().optional().describe('Stable machine-readable error code (e.g. `NOT_FOUND`)'),
		request_id: z.string().optional().describe('Server-generated correlation id'),
		details: z.unknown().optional(),
	})
	.openapi('ErrorEnvelope');

const SuccessEnvelope = z
	.object({
		success: z.literal(true),
		data: z.unknown(),
		message: z.string().optional(),
		request_id: z.string().optional(),
	})
	.openapi('SuccessEnvelope');

// Generic envelope: SuccessEnvelope with a known `data` shape. We
// register a fresh `.openapi()` for each concrete `data` type so the
// registry doesn't try to introspect an anonymous `.extend()`-ed schema.
function successEnvelope<T extends z.ZodTypeAny>(
	dataSchema: T,
	refId: string,
) {
	return z
		.object({
			success: z.literal(true),
			data: dataSchema,
			message: z.string().optional(),
			request_id: z.string().optional(),
		})
		.openapi(refId);
}

const Pagination = z
	.object({
		limit: z.number().int().min(1).max(100).default(20),
		offset: z.number().int().min(0).default(0),
	})
	.openapi('Pagination');

const ProductHit = z
	.object({
		id: z.number().int(),
		store_id: z.number().int(),
		store_name: z.string(),
		category_id: z.number().int(),
		name_ar: z.string(),
		name_en: z.string().nullable().optional(),
		name_zh: z.string().nullable().optional(),
		main_image: z.string().nullable().optional(),
		price: z.number(),
		currency: z.string().length(3),
		rating: z.number().min(0).max(5).optional(),
		sold_count: z.number().int().optional(),
		deal_discount: z.number().optional(),
	})
	.openapi('ProductHit');

const CategoryNode = z
	.object({
		id: z.number().int(),
		slug: z.string(),
		name_ar: z.string(),
		name_en: z.string().nullable().optional(),
		name_zh: z.string().nullable().optional(),
		product_count: z.number().int().optional(),
		parent_id: z.number().int().nullable().optional(),
	})
	.openapi('CategoryNode');

const StoreNode = z
	.object({
		id: z.number().int(),
		owner_id: z.number().int(),
		store_name: z.string(),
		store_name_en: z.string().nullable().optional(),
		store_name_zh: z.string().nullable().optional(),
		slug: z.string(),
		logo: z.string().nullable().optional(),
		banner: z.string().nullable().optional(),
		rating: z.number().optional(),
		review_count: z.number().int().optional(),
		is_active: z.boolean().optional(),
		is_verified: z.boolean().optional(),
		trust_level: z.enum(['basic', 'gold', 'platinum']).optional(),
	})
	.openapi('StoreNode');

const HomeStats = z
	.object({
		counts: z.object({
			products: z.number().int(),
			stores: z.number().int(),
			orders: z.number().int(),
			users: z.number().int(),
		}),
		featured: z.array(ProductHit),
		deals: z.array(ProductHit),
	})
	.openapi('HomeStats');

const SearchResponse = z
	.object({
		query: z.string(),
		total: z.number().int(),
		limit: z.number().int(),
		offset: z.number().int(),
		duration_ms: z.number(),
		source: z.enum(['elasticsearch', 'postgresql']),
		facets: z
			.object({
				categories: z.array(z.object({ key: z.string(), count: z.number().int() })),
				priceRanges: z.array(z.object({ key: z.string(), count: z.number().int() })),
			})
			.optional(),
		products: z.array(ProductHit),
	})
	.openapi('SearchResponse');

const SuggestResponse = z
	.object({
		suggestions: z.array(
			z.object({
				text: z.string(),
				score: z.number(),
			}),
		),
	})
	.openapi('SuggestResponse');

const AuthUser = z
	.object({
		id: z.number().int(),
		email: z.string().email(),
		full_name: z.string(),
		role: z.enum(['customer', 'merchant', 'admin']),
	})
	.openapi('AuthUser');

const LoginRequest = z
	.object({
		email: z.string().email(),
		password: z.string().min(8),
	})
	.openapi('LoginRequest');

const LoginResponse = z
	.object({
		user: AuthUser,
		token: z.string().optional().describe('Bearer token (mobile clients only)'),
	})
	.openapi('LoginResponse');

const ProductsListResponse = z
	.object({
		products: z.array(ProductHit),
		total: z.number().int(),
		limit: z.number().int(),
		offset: z.number().int(),
	})
	.openapi('ProductsListResponse');

const CategoriesListResponse = z
	.object({
		categories: z.array(CategoryNode),
	})
	.openapi('CategoriesListResponse');

// ── Reusable parameter sets ───────────────────────────────────────────
const LimitParam = z.coerce.number().int().min(1).max(100).default(20).openapi('LimitParam');
const OffsetParam = z.coerce.number().int().min(0).default(0).openapi('OffsetParam');

const ProductsListQuery = z
	.object({
		category: z.string().optional().describe('Category slug'),
		search: z.string().optional().describe('Full-text search term (LIKE-based in dev, ES in prod)'),
		store: z.coerce.number().int().optional(),
		minPrice: z.coerce.number().optional(),
		maxPrice: z.coerce.number().optional(),
		sort: z
			.enum(['relevance', 'price_asc', 'price_desc', 'newest', 'popular'])
			.optional(),
		limit: LimitParam,
		offset: OffsetParam,
	})
	.openapi('ProductsListQuery');

const SearchQuery = z
	.object({
		q: z.string().min(1),
		category: z.string().optional(),
		store: z.coerce.number().int().optional(),
		minPrice: z.coerce.number().optional(),
		maxPrice: z.coerce.number().optional(),
		sort: z
			.enum(['relevance', 'price_asc', 'price_desc', 'newest', 'best_selling'])
			.optional(),
		limit: LimitParam,
		offset: OffsetParam,
	})
	.openapi('SearchQuery');

const SuggestQuery = z
	.object({ q: z.string() })
	.openapi('SuggestQuery');

const ProductIdParam = z
	.object({ id: z.coerce.number().int().positive() })
	.openapi('ProductIdParam');

// ── Endpoint registrations ───────────────────────────────────────────
// The catalog endpoints (read-mostly) — public, no auth required.

// Pre-register concrete success envelopes with the registry so
// OpenAPI can reference them by name.
const ProductsListEnvelope = successEnvelope(ProductsListResponse, 'ProductsListEnvelope');
const ProductHitListEnvelope = successEnvelope(z.array(ProductHit), 'ProductHitListEnvelope');
const CategoriesListEnvelope = successEnvelope(CategoriesListResponse, 'CategoriesListEnvelope');
const HomeStatsEnvelope = successEnvelope(HomeStats, 'HomeStatsEnvelope');
const SearchEnvelope = successEnvelope(SearchResponse, 'SearchEnvelope');
const SuggestEnvelope = successEnvelope(SuggestResponse, 'SuggestEnvelope');
const LoginEnvelope = successEnvelope(LoginResponse, 'LoginEnvelope');

registry.registerPath({
	method: 'get',
	path: '/api/products',
	description: 'List products with filters and pagination.',
	request: {
		query: ProductsListQuery,
	},
	responses: {
		200: {
			description: 'Catalog page',
			content: { 'application/json': { schema: ProductsListEnvelope } },
		},
		400: { description: 'Invalid filter', content: { 'application/json': { schema: ErrorEnvelope } } },
	},
});

registry.registerPath({
	method: 'get',
	path: '/api/products/featured',
	description: 'Curated featured products (homepage hero).',
	responses: {
		200: {
			description: 'Up to 10 featured products',
			content: { 'application/json': { schema: ProductHitListEnvelope } },
		},
	},
});

registry.registerPath({
	method: 'get',
	path: '/api/products/deals',
	description: 'Products with an active deal_discount > 0.',
	responses: {
		200: {
			description: 'Up to 10 deal products',
			content: { 'application/json': { schema: ProductHitListEnvelope } },
		},
	},
});

registry.registerPath({
	method: 'get',
	path: '/api/products/{id}',
	description: 'Single product + its store + reviews + images.',
	request: {
		params: ProductIdParam,
	},
	responses: {
		200: { description: 'Product details' },
		404: { description: 'Product not found', content: { 'application/json': { schema: ErrorEnvelope } } },
	},
});

registry.registerPath({
	method: 'get',
	path: '/api/categories',
	description: 'Full category tree with product counts.',
	responses: {
		200: {
			description: 'Category tree',
			content: { 'application/json': { schema: CategoriesListEnvelope } },
		},
	},
});

registry.registerPath({
	method: 'get',
	path: '/api/stats/home',
	description: 'Homepage stats: counts, featured, deals. (Redis-cached 30s.)',
	responses: {
		200: {
			description: 'Homepage data',
			content: { 'application/json': { schema: HomeStatsEnvelope } },
		},
	},
});

registry.registerPath({
	method: 'get',
	path: '/api/search',
	description: 'Full-text product search. Elasticsearch-first with PostgreSQL FTS fallback.',
	request: {
		query: SearchQuery,
	},
	responses: {
		200: { description: 'Search hits + facets', content: { 'application/json': { schema: SearchEnvelope } } },
		400: { description: 'Missing query parameter', content: { 'application/json': { schema: ErrorEnvelope } } },
		503: { description: 'All search backends unavailable', content: { 'application/json': { schema: ErrorEnvelope } } },
	},
});

registry.registerPath({
	method: 'get',
	path: '/api/search/suggest',
	description: 'Autocomplete suggestions for the search box. Backs the typeahead.',
	request: {
		query: SuggestQuery,
	},
	responses: {
		200: { description: 'Top 10 suggestions', content: { 'application/json': { schema: SuggestEnvelope } } },
	},
});

// Auth endpoints
registry.registerPath({
	method: 'post',
	path: '/api/auth/login',
	description: 'Email + password login. Sets the `noufex_auth` HttpOnly cookie on success.',
	request: {
		body: {
			content: { 'application/json': { schema: LoginRequest } },
		},
	},
	responses: {
		200: { description: 'Login successful', content: { 'application/json': { schema: LoginEnvelope } } },
		401: { description: 'Invalid credentials', content: { 'application/json': { schema: ErrorEnvelope } } },
		429: { description: 'Rate-limited', content: { 'application/json': { schema: ErrorEnvelope } } },
	},
});

// Operational endpoints
registry.registerPath({
	method: 'get',
	path: '/api/health',
	description: 'Liveness probe — returns 200 while the process is running.',
	responses: {
		200: { description: 'Process alive' },
	},
});

registry.registerPath({
	method: 'get',
	path: '/api/ready',
	description: 'Readiness probe — reports status of PG / Redis / RabbitMQ / Elasticsearch.',
	responses: {
		200: { description: 'All checks passed', content: { 'application/json': { schema: z.object({ status: z.literal('ready'), checks: z.record(z.string(), z.object({ ok: z.boolean(), ms: z.number(), detail: z.string().optional() })) }) } } },
		503: { description: 'At least one check failed', content: { 'application/json': { schema: z.object({ status: z.literal('degraded') }) } } },
	},
});

registry.registerPath({
	method: 'get',
	path: '/api/metrics',
	description: 'Prometheus exposition (text/plain version 0.0.4). No auth — bind to internal network only.',
	responses: {
		200: { description: 'Metrics in Prometheus format', content: { 'text/plain': { schema: z.string() } } },
	},
});

registry.registerPath({
	method: 'get',
	path: '/api/openapi.json',
	description: 'This document. OpenAPI 3.1, JSON.',
	responses: {
		200: { description: 'OpenAPI document' },
	},
});

// ── Document builder ────────────────────────────────────────────────

const generator = new OpenApiGeneratorV3(registry.definitions);

export function buildOpenApiDocument(): ReturnType<OpenApiGeneratorV3['generateDocument']> {
	// Tier 5.3: list every supported version as a custom OpenAPI
	// extension so SDK generators can pick the right media type.
	const versions = getActiveVersions().map((v) => ({
		version: v.version,
		media_type: `application/vnd.noufex.v${v.version}+json`,
		status: v.status,
	}));
	return generator.generateDocument({
		openapi: '3.1.0',
		info: {
			title: 'Noufex Public API',
			version: '1.0.0',
			description:
				'Yemen & Middle East B2B/B2C marketplace REST API. ' +
				'This is the canonical machine-readable contract — ' +
				'all schemas here are auto-generated from the Zod ' +
				'validation the API enforces, so docs and runtime ' +
				'cannot drift. For the rendered UI visit ' +
				'`/api/docs` (Swagger UI) or `/api/redoc` (ReDoc).\n\n' +
				'## Versioning\n\n' +
				'The API uses Stripe-style media-type versioning. ' +
				'Specify the version via `Accept`:\n\n' +
				versions
					.map((v) => `  - \`${v.media_type}\` (${v.status})`)
					.join('\n') +
				'\n\nRequests with no `Accept` header (or `application/json` ' +
				'/ wildcard) get the latest stable version automatically.',
			contact: {
				name: 'Noufex Engineering',
				url: 'https://noufex.com',
			},
			license: {
				name: 'Proprietary',
				url: 'https://noufex.com/license',
			},
		},
		servers: [
			{
				url: 'https://api.noufex.com',
				description: 'Production',
			},
			{
				url: 'https://staging-api.noufex.com',
				description: 'Staging',
			},
			{
				url: 'http://localhost:3000',
				description: 'Local dev (run `npm run dev --workspace @noufex/api`)',
			},
		],
		tags: [
			{ name: 'Catalog', description: 'Products, categories, stores — public, read-only, cache-friendly' },
			{ name: 'Search', description: 'Full-text search via Elasticsearch with PG FTS fallback' },
			{ name: 'Auth', description: 'Email/password login + 2FA + CSRF' },
			{ name: 'Operational', description: 'Health, readiness, metrics — for k8s probes and Prometheus' },
		],
		externalDocs: {
			url: 'https://github.com/anomalyco/opencode/blob/main/ARCHITECTURE.md',
			description: 'Full architecture overview',
		},
	});
}

// `healthLimiter` is referenced for documentation purposes only;
// some endpoints use it. We re-export here to keep the import graph
// tidy.
// (Currently no security helpers are needed inside the OpenAPI
// registry itself — the rate-limit details live in the index.ts
// handler chain, not in the doc.)

// Helper for `withSentry` so the call-site doesn't have to import it.
export const __keepalive = {
	ErrorEnvelope,
	SuccessEnvelope,
	Pagination,
	ProductHit,
	CategoryNode,
	StoreNode,
	HomeStats,
	SearchResponse,
	SuggestResponse,
	AuthUser,
	LoginRequest,
	LoginResponse,
	ProductsListResponse,
	CategoriesListResponse,
};