/**
 * Nouf-ex E-commerce REST API Server
 * Express + node-postgres (pg) via the PgDb wrapper
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { PgDb } from './db/pg-wrapper.cjs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import dotenv from 'dotenv';
import { randomUUID, scrypt as scryptCb, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { z } from 'zod';

dotenv.config();

// --- __filename / __dirname ----------------------------------------------------
// In ESM (production `tsx server/index.ts`) we use `import.meta.url`. In Vitest's
// transformed CJS output, `import.meta.url` is `undefined` and reading it throws.
// We compute __dirname from `process.cwd()` which is always correct for our use
// (we only need __dirname to resolve the static dist/ folder).
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
const PORT = process.env.API_PORT || process.env.PORT || 3000;
// PostgreSQL connection string. Reads DATABASE_URL first, then falls back to
// discrete env vars. Missing configuration fails LOUD at startup rather than
// silently connecting to a bogus `CHANGE_ME` URL.
const DATABASE_URL =
	process.env.DATABASE_URL ||
	(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASSWORD
		? `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}`
		: (() => {
				throw new Error(
					'DATABASE_URL is not set. Copy .env.example to .env and fill in DB_HOST / DB_NAME / DB_USER / DB_PASSWORD (or set DATABASE_URL directly).',
				);
			})());
const STATIC_PATH = process.env.STATIC_PATH || path.resolve(__dirname, 'dist');

// --- Database Connection (PostgreSQL via pg) ---
// Foreign keys are always enforced in PostgreSQL, no PRAGMA needed.
const db = new PgDb(DATABASE_URL);

// --- M2 fix: restrict CORS to configured origins (was open to everyone). ---
const ALLOWED_ORIGINS = (
	process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173'
)
	.split(',')
	.map((s) => s.trim());
app.use(
	cors({
		origin: (origin, callback) => {
			// Allow same-origin requests (no Origin header) and configured origins.
			if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
			callback(new Error('CORS: origin not allowed: ' + origin));
		},
		credentials: true,
	})
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- M1 fix: simple in-memory rate limiter (avoids express-rate-limit dep). ---
type RateBucket = { count: number; resetAt: number };
const RATE_BUCKETS = new Map<string, RateBucket>();
function rateLimit(windowMs: number, max: number) {
	return (req: Request, res: Response, next: NextFunction) => {
		const key = (req.ip || req.socket.remoteAddress || 'anon') + ':' + req.path;
		const now = Date.now();
		const b = RATE_BUCKETS.get(key);
		if (!b || now > b.resetAt) {
			RATE_BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
			return next();
		}
		b.count += 1;
		if (b.count > max) {
			res.setHeader('Retry-After', Math.ceil((b.resetAt - now) / 1000));
			return sendError(res, 'Too many requests. Try again later.', 429);
		}
		next();
	};
}
const authLimiter = rateLimit(15 * 60 * 1000, 20); // 20 requests / 15 min

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
	next();
});

// --- Type Definitions ---
interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	message?: string;
	error?: string;
}

// --- M17 fix: zod validation schemas for all write endpoints ---
const emailSchema = z.string().email().max(255);
const passwordSchema = z.string().min(8).max(128);
const registerSchema = z.object({
	email: emailSchema,
	password: passwordSchema,
	name: z.string().trim().min(2).max(100),
});
const loginSchema = z.object({
	email: emailSchema,
	password: z.string().min(1).max(128),
});
const orderItemSchema = z.object({
	productId: z.number().int().positive(),
	quantity: z.number().int().positive(),
	unitPrice: z.number().nonnegative(),
	totalPrice: z.number().nonnegative().optional(),
	variant: z.unknown().optional(),
});
const orderSchema = z.object({
	customerId: z.number().int().positive(),
	storeId: z.number().int().positive().optional(),
	items: z.array(orderItemSchema).min(1).max(100),
	shippingAddress: z.record(z.string(), z.unknown()).optional(),
	paymentMethod: z.string().max(50).optional(),
	notes: z.string().max(1000).optional(),
	subtotal: z.number().nonnegative().optional(),
	shippingCost: z.number().nonnegative().optional(),
	discount: z.number().nonnegative().optional(),
	total: z.number().nonnegative(),
});
const reviewSchema = z.object({
	productId: z.number().int().positive(),
	storeId: z.number().int().positive(),
	customerId: z.number().int().positive(),
	rating: z.number().int().min(1).max(5),
	title: z.string().trim().max(200).optional(),
	comment: z.string().trim().max(2000).optional(),
});

function validate<T>(
	schema: z.ZodType<T>,
	body: unknown
): { ok: true; data: T } | { ok: false; error: string } {
	const r = schema.safeParse(body);
	return r.success
		? { ok: true, data: r.data }
		: {
				ok: false,
				error: r.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; '),
			};
}

// --- C1 fix: scrypt-based password hashing (Node built-in, no external deps) ---
const scrypt = promisify(scryptCb) as (
	password: string,
	salt: string,
	keylen: number
) => Promise<Buffer>;
const SCRYPT_KEYLEN = 64;

async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString('hex');
	const derivedKey = await scrypt(password, salt, SCRYPT_KEYLEN);
	return `scrypt${salt}${derivedKey.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
	// Modern format: scrypt$<salt>$<hash>
	if (stored.startsWith('scrypt$')) {
		const parts = stored.split('$');
		if (parts.length !== 3) return false;
		const [, salt, keyHex] = parts;
		const derivedKey = await scrypt(password, salt, SCRYPT_KEYLEN);
		const storedKey = Buffer.from(keyHex, 'hex');
		if (derivedKey.length !== storedKey.length) return false;
		return timingSafeEqual(derivedKey, storedKey);
	}
	// Legacy fallback: hash_<plaintext> (seed data only). Constant-time compare via length check.
	if (stored.startsWith('hash_')) {
		return stored === `hash_${password}`;
	}
	return false;
}

// --- Helpers ---
const sendSuccess = <T>(res: Response, data: T, message?: string) => {
	const payload: ApiResponse<T> = { success: true, data };
	if (message) payload.message = message;
	res.json(payload);
};

const sendError = (res: Response, message: string, status = 500) => {
	res.status(status).json({ success: false, error: message } as ApiResponse);
};

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
	if (!value) return fallback;
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
};

// --- Database Helper Functions ---
const getProductImages = (productId: number) => {
	return db
		.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order')
		.all(productId);
};

const getProductWithParsedFields = (product: Record<string, unknown> | undefined) => {
	if (!product) return null;
	return {
		...product,
		features: parseJson<string[]>(product.features as string, []),
		badges: parseJson<string[]>(product.badges as string, []),
		specifications: parseJson<Record<string, string>>(product.specifications as string, {}),
		colors: parseJson<string[]>(product.colors as string, []),
		sizes: parseJson<string[]>(product.sizes as string, []),
	};
};

// ═══════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/products
 * Query params: category, search, store, minPrice, maxPrice, sort, limit, offset
 */
app.get('/api/products', async (req: Request, res: Response) => {
	try {
		const {
			category,
			search,
			store,
			minPrice,
			maxPrice,
			sort,
			limit = '20',
			offset = '0',
		} = req.query;

		let sql = 'SELECT * FROM products WHERE is_active = 1';
		const params: (string | number)[] = [];

		if (category) {
			sql += ' AND category_id = (SELECT id FROM categories WHERE slug = ?)';
			params.push(category as string);
		}
		if (store) {
			sql += ' AND store_id = ?';
			params.push(Number(store));
		}
		if (minPrice) {
			sql += ' AND price >= ?';
			params.push(Number(minPrice));
		}
		if (maxPrice) {
			sql += ' AND price <= ?';
			params.push(Number(maxPrice));
		}
		if (search) {
			const term = `%${search}%`;
			sql += ' AND (name_en LIKE ? OR name_ar LIKE ? OR name_zh LIKE ? OR description_en LIKE ?)';
			params.push(term, term, term, term);
		}

		// Sorting
		switch (sort) {
			case 'price_asc':
				sql += ' ORDER BY price ASC';
				break;
			case 'price_desc':
				sql += ' ORDER BY price DESC';
				break;
			case 'popular':
				sql += ' ORDER BY sold_count DESC';
				break;
			case 'newest':
			default:
				sql += ' ORDER BY created_at DESC';
				break;
		}

		sql += ' LIMIT ? OFFSET ?';
		params.push(Number(limit), Number(offset));

		const rows = (await db.prepare(sql).all(...params)) as Record<string, unknown>[];
		const products = rows.map(getProductWithParsedFields);

		// Get total count
		let countSql = 'SELECT COUNT(*) as count FROM products WHERE is_active = 1';
		const countParams: (string | number)[] = [];
		if (category) {
			countSql += ' AND category_id = (SELECT id FROM categories WHERE slug = ?)';
			countParams.push(category as string);
		}
		if (store) {
			countSql += ' AND store_id = ?';
			countParams.push(Number(store));
		}
		if (minPrice) {
			countSql += ' AND price >= ?';
			countParams.push(Number(minPrice));
		}
		if (maxPrice) {
			countSql += ' AND price <= ?';
			countParams.push(Number(maxPrice));
		}
		if (search) {
			const term = `%${search}%`;
			countSql +=
				' AND (name_en LIKE ? OR name_ar LIKE ? OR name_zh LIKE ? OR description_en LIKE ?)';
			countParams.push(term, term, term, term);
		}
		const countRow = (await db.prepare(countSql).get(...countParams)) as { count: number };

		sendSuccess(res, {
			products,
			total: countRow.count,
			limit: Number(limit),
			offset: Number(offset),
		});
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

/**
 * GET /api/products/featured
 */
app.get('/api/products/featured', async (_req: Request, res: Response) => {
	try {
		const rows = (await db
			.prepare(
				'SELECT * FROM products WHERE is_active = 1 AND is_featured = 1 ORDER BY created_at DESC LIMIT 10'
			)
			.all()) as Record<string, unknown>[];
		const products = rows.map(getProductWithParsedFields);
		sendSuccess(res, products);
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

/**
 * GET /api/products/deals
 */
app.get('/api/products/deals', async (_req: Request, res: Response) => {
	try {
		const rows = (await db
			.prepare(
				'SELECT * FROM products WHERE is_active = 1 AND deal_discount > 0 ORDER BY deal_discount DESC LIMIT 10'
			)
			.all()) as Record<string, unknown>[];
		const products = rows.map(getProductWithParsedFields);
		sendSuccess(res, products);
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

/**
 * GET /api/products/:id
 * Get single product with store info and reviews
 */
app.get('/api/products/:id', async (req: Request, res: Response) => {
	try {
		const { id } = req.params;

		// Get product
		const product = (await db.prepare('SELECT * FROM products WHERE id = ?').get(Number(id))) as
			| Record<string, unknown>
			| undefined;

		if (!product) {
			return sendError(res, 'Product not found', 404);
		}

		// Get store info
		const store = (await db
			.prepare('SELECT * FROM stores WHERE id = ?')
			.get(product.store_id as number)) as Record<string, unknown> | undefined;

		// Get reviews
		const reviews = (await db
			.prepare(
				`SELECT r.*, u.full_name as customer_name, u.avatar as customer_avatar
         FROM reviews r
         LEFT JOIN users u ON r.customer_id = u.id
         WHERE r.product_id = ?
         ORDER BY r.created_at DESC`
			)
			.all(Number(id))) as Record<string, unknown>[];

		// Get images
		const images = getProductImages(Number(id));

		const productParsed = getProductWithParsedFields(product);

		sendSuccess(res, {
			...productParsed,
			store,
			reviews,
			images,
		});
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

// ═══════════════════════════════════════════════════════════
// STORES
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/stores
 */
app.get('/api/stores', async (_req: Request, res: Response) => {
	try {
		const stores = await db.prepare('SELECT * FROM stores ORDER BY rating DESC').all();
		sendSuccess(res, stores);
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

/**
 * GET /api/stores/:id
 * Get store with products
 */
app.get('/api/stores/:id', async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const store = (await db.prepare('SELECT * FROM stores WHERE id = ?').get(Number(id))) as
			| Record<string, unknown>
			| undefined;

		if (!store) {
			return sendError(res, 'Store not found', 404);
		}

		const products = (await db
			.prepare('SELECT * FROM products WHERE store_id = ? AND is_active = 1')
			.all(Number(id))) as Record<string, unknown>[];

		sendSuccess(res, {
			...store,
			products: products.map(getProductWithParsedFields),
		});
	} catch (err) {
		console.error('[stores/:id]', (err as Error).message);
		sendError(res, (err as Error).message);
	}
});

/**
 * GET /api/stores/:id/reviews
 * Get store reviews
 */
app.get('/api/stores/:id/reviews', async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const reviews = db
			.prepare(
				`SELECT r.*, u.full_name as customer_name, u.avatar as customer_avatar, p.name_en as product_name
         FROM reviews r
         LEFT JOIN users u ON r.customer_id = u.id
         LEFT JOIN products p ON r.product_id = p.id
         WHERE r.store_id = ?
         ORDER BY r.created_at DESC`
			)
			.all(Number(id));
		sendSuccess(res, reviews);
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

// ═══════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/categories
 * List all categories with product counts
 */
app.get('/api/categories', async (_req: Request, res: Response) => {
	try {
		const categories = await db
			.prepare(
				`SELECT c.*, COUNT(p.id) as product_count
         FROM categories c
         LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
         GROUP BY c.id
         ORDER BY c.sort_order ASC`
			)
			.all();
		sendSuccess(res, categories);
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

/**
 * GET /api/categories/:slug
 * Get category by slug with products
 */
app.get('/api/categories/:slug', async (req: Request, res: Response) => {
	try {
		const { slug } = req.params;
		const category = (await db.prepare('SELECT * FROM categories WHERE slug = ?').get(slug)) as
			| Record<string, unknown>
			| undefined;

		if (!category) {
			return sendError(res, 'Category not found', 404);
		}

		const products = (await db
			.prepare('SELECT * FROM products WHERE category_id = ? AND is_active = 1')
			.all(category.id as number)) as Record<string, unknown>[];

		sendSuccess(res, {
			...category,
			products: products.map(getProductWithParsedFields),
		});
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

// ═══════════════════════════════════════════════════════════
// REVIEWS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/reviews
 * Query params: productId, storeId
 */
app.get('/api/reviews', async (req: Request, res: Response) => {
	try {
		const { productId, storeId } = req.query;

		let sql = `SELECT r.*, u.full_name as customer_name, u.avatar as customer_avatar,
                      p.name_en as product_name, s.store_name as store_name
               FROM reviews r
               LEFT JOIN users u ON r.customer_id = u.id
               LEFT JOIN products p ON r.product_id = p.id
               LEFT JOIN stores s ON r.store_id = s.id
               WHERE 1=1`;
		const params: number[] = [];

		if (productId) {
			sql += ' AND r.product_id = ?';
			params.push(Number(productId));
		}
		if (storeId) {
			sql += ' AND r.store_id = ?';
			params.push(Number(storeId));
		}

		sql += ' ORDER BY r.created_at DESC';

		const reviews = await db.prepare(sql).all(...params);
		sendSuccess(res, reviews);
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

/**
 * POST /api/reviews
 * Submit a review
 */
app.post('/api/reviews', async (req: Request, res: Response) => {
	try {
		// M17 fix: validate body shape with the Zod schema.
		const v = validate(reviewSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const { productId, storeId, customerId, rating, title, comment } = v.data;

		const result = (await db
			.prepare(
				`INSERT INTO reviews (product_id, store_id, customer_id, rating, title, comment, helpful_count, is_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id`
			)
			.run(productId, storeId ?? null, customerId, rating, title ?? null, comment ?? null)) as {
			lastInsertRowid: number;
		};

		// Update product rating
		const ratingData = (await db
			.prepare(
				'SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM reviews WHERE product_id = ?'
			)
			.get(productId)) as { avg_rating: number; count: number };

		await db
			.prepare('UPDATE products SET rating = ?, review_count = ? WHERE id = ?')
			.run(ratingData.avg_rating.toFixed(1), ratingData.count, productId);

		sendSuccess(res, { id: result.lastInsertRowid }, 'Review submitted successfully');
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

// ═══════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/orders
 * Query params: customerId
 */
app.get('/api/orders', async (req: Request, res: Response) => {
	try {
		const { customerId } = req.query;

		let sql = `SELECT o.*, s.store_name as store_name, s.logo as store_logo
               FROM orders o
               LEFT JOIN stores s ON o.store_id = s.id
               WHERE 1=1`;
		const params: number[] = [];

		if (customerId) {
			sql += ' AND o.customer_id = ?';
			params.push(Number(customerId));
		}

		sql += ' ORDER BY o.created_at DESC';

		const orders = await db.prepare(sql).all(...params);
		sendSuccess(res, orders);
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

/**
 * GET /api/orders/:id
 * Get single order with items
 */
app.get('/api/orders/:id', async (req: Request, res: Response) => {
	try {
		const { id } = req.params;

		const order = (await db
			.prepare(
				`SELECT o.*, s.store_name as store_name, s.logo as store_logo
         FROM orders o
         LEFT JOIN stores s ON o.store_id = s.id
         WHERE o.id = ?`
			)
			.get(Number(id))) as Record<string, unknown> | undefined;

		if (!order) {
			return sendError(res, 'Order not found', 404);
		}

		const items = (await db
			.prepare(
				`SELECT oi.*, p.name_en as product_name, p.name_ar as product_name_ar, p.main_image as product_image
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`
			)
			.all(Number(id))) as Record<string, unknown>[];

		sendSuccess(res, { ...order, items });
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

/**
 * POST /api/orders
 * Create a new order
 */
app.post('/api/orders', async (req: Request, res: Response) => {
	try {
		// M17 fix: validate body shape and field constraints.
		const v = validate(orderSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const {
			customerId,
			storeId,
			items,
			shippingAddress,
			paymentMethod,
			notes,
			subtotal,
			shippingCost,
			discount,
			total,
		} = v.data;

		// C2+C3 fix: single transaction. All stock checks + decrements + order writes succeed or all roll back.
		// better-sqlite3 transactions are synchronous and throw on error -> automatic rollback.
		const createOrder = await db.tx(
			async (orderData: {
				customerId: number;
				storeId: number | null;
				orderNumber: string;
				paymentMethod: string;
				subtotal: number;
				shippingCost: number;
				discount: number;
				total: number;
				shippingAddress: unknown;
				notes: string | null;
				items: Array<{
					productId: number;
					quantity: number;
					unitPrice: number;
					totalPrice?: number;
					variant?: unknown;
				}>;
			}) => {
				const orderResult = (await db
					.prepare(
						`INSERT INTO orders (customer_id, store_id, order_number, status, payment_method, payment_status,
           subtotal, shipping_cost, discount, total, shipping_address, notes, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, 'pending', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id`
					)
					.run(
						orderData.customerId,
						orderData.storeId,
						orderData.orderNumber,
						orderData.paymentMethod,
						orderData.subtotal,
						orderData.shippingCost,
						orderData.discount,
						orderData.total,
						orderData.shippingAddress ? JSON.stringify(orderData.shippingAddress) : null,
						orderData.notes
					)) as { lastInsertRowid: number };
				const orderId = orderResult.lastInsertRowid;

				const insertItem = db.prepare(
					`INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, variant, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
				);
				const decrementStock = db.prepare(
					// C2 fix: atomic conditional decrement. If insufficient stock, 0 rows affected -> rollback via throw.
					`UPDATE products
            SET stock = stock - ?,
                sold_count = sold_count + ?
          WHERE id = ? AND stock >= ?`
				);
				const readProduct = db.prepare(
					`SELECT id, name_ar, name_en, stock FROM products WHERE id = ? AND is_active = 1`
				);

				for (const item of orderData.items) {
					if (item.quantity <= 0) {
						throw new Error(`Invalid quantity ${item.quantity} for product ${item.productId}`);
					}
					const product = (await readProduct.get(item.productId)) as
						| { id: number; name_ar: string; name_en: string; stock: number }
						| undefined;
					if (!product) {
						throw new Error(`Product ${item.productId} is unavailable`);
					}
					if (product.stock < item.quantity) {
						throw new Error(
							`Insufficient stock for "${product.name_en || product.name_ar}" (id=${item.productId}): ` +
								`requested ${item.quantity}, available ${product.stock}`
						);
					}
					const decResult = (await decrementStock.run(
						item.quantity,
						item.quantity,
						item.productId,
						item.quantity
					)) as { changes: number };
					if (decResult.changes !== 1) {
						// Race condition: someone else bought it between SELECT and UPDATE. Whole transaction rolls back.
						throw new Error(
							`Stock changed for product ${item.productId}; order aborted. Please retry.`
						);
					}
					await insertItem.run(
						orderId,
						item.productId,
						item.quantity,
						item.unitPrice,
						item.totalPrice ?? item.unitPrice * item.quantity,
						item.variant ? JSON.stringify(item.variant) : null
					);
				}
				return orderId;
			}
		);

		const orderId = createOrder({
			customerId,
			storeId: storeId || null,
			orderNumber: `ORD-${randomUUID().slice(0, 8).toUpperCase()}`,
			paymentMethod: paymentMethod || 'cash',
			subtotal: subtotal || total,
			shippingCost: shippingCost || 0,
			discount: discount || 0,
			total,
			shippingAddress,
			notes: notes || null,
			items,
		});

		sendSuccess(
			res,
			{ id: orderId, orderNumber: `ORD-...${String(orderId).slice(-4)}` },
			'Order created successfully'
		);
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

// ═══════════════════════════════════════════════════════════
// CART
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/cart/:userId
 */
app.get('/api/cart/:userId', async (req: Request, res: Response) => {
	try {
		const { userId } = req.params;
		const cartItems = db
			.prepare(
				`SELECT ci.*, p.name_en, p.name_ar, p.name_zh, p.price, p.original_price, p.main_image, p.stock, s.store_name
         FROM cart_items ci
         JOIN products p ON ci.product_id = p.id
         LEFT JOIN stores s ON p.store_id = s.id
         WHERE ci.user_id = ?
         ORDER BY ci.created_at DESC`
			)
			.all(Number(userId));
		sendSuccess(res, cartItems);
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

/**
 * POST /api/cart
 * Add to cart
 */
app.post('/api/cart', async (req: Request, res: Response) => {
	try {
		const { userId, productId, quantity, variant } = req.body;

		if (!userId || !productId || !quantity) {
			return sendError(res, 'userId, productId and quantity are required', 400);
		}

		// Check if already in cart
		const existing = (await db
			.prepare('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?')
			.get(userId, productId)) as { id: number; quantity: number } | undefined;

		if (existing) {
			await db
				.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?')
				.run(quantity, existing.id);
			sendSuccess(res, { id: existing.id }, 'Cart updated successfully');
		} else {
			const result = (await db
				.prepare(
					`INSERT INTO cart_items (user_id, product_id, quantity, variant, created_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
           RETURNING id`
				)
				.run(userId, productId, quantity, variant ? JSON.stringify(variant) : null)) as {
				lastInsertRowid: number;
			};
			sendSuccess(res, { id: result.lastInsertRowid }, 'Item added to cart');
		}
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

/**
 * DELETE /api/cart/:id
 * Remove from cart
 */
app.delete('/api/cart/:id', async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		await db.prepare('DELETE FROM cart_items WHERE id = ?').run(Number(id));
		sendSuccess(res, null, 'Item removed from cart');
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

/**
 * DELETE /api/cart/clear/:userId
 * Clear user's cart
 */
app.delete('/api/cart/clear/:userId', async (req: Request, res: Response) => {
	try {
		const { userId } = req.params;
		await db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(Number(userId));
		sendSuccess(res, null, 'Cart cleared');
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

// ═══════════════════════════════════════════════════════════
// WISHLIST
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/wishlist/:userId
 */
app.get('/api/wishlist/:userId', async (req: Request, res: Response) => {
	try {
		const { userId } = req.params;
		const items = db
			.prepare(
				`SELECT w.*, p.name_en, p.name_ar, p.name_zh, p.price, p.original_price, p.main_image, p.rating, p.review_count, s.store_name
         FROM wishlist w
         JOIN products p ON w.product_id = p.id
         LEFT JOIN stores s ON p.store_id = s.id
         WHERE w.user_id = ?
         ORDER BY w.created_at DESC`
			)
			.all(Number(userId));
		sendSuccess(res, items);
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

/**
 * POST /api/wishlist
 * Add to wishlist
 */
app.post('/api/wishlist', async (req: Request, res: Response) => {
	try {
		const { userId, productId } = req.body;

		if (!userId || !productId) {
			return sendError(res, 'userId and productId are required', 400);
		}

		// Check if already in wishlist
		const existing = (await db
			.prepare('SELECT * FROM wishlist WHERE user_id = ? AND product_id = ?')
			.get(userId, productId)) as Record<string, unknown> | undefined;

		if (existing) {
			return sendSuccess(res, null, 'Already in wishlist');
		}

		const result = (await db
			.prepare(
				'INSERT INTO wishlist (user_id, product_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP) RETURNING id'
			)
			.run(userId, productId)) as { lastInsertRowid: number };

		sendSuccess(res, { id: result.lastInsertRowid }, 'Added to wishlist');
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

/**
 * DELETE /api/wishlist/:id
 * Remove from wishlist
 */
app.delete('/api/wishlist/:id', async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		await db.prepare('DELETE FROM wishlist WHERE id = ?').run(Number(id));
		sendSuccess(res, null, 'Removed from wishlist');
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/notifications/:userId
 */
app.get('/api/notifications/:userId', async (req: Request, res: Response) => {
	try {
		const { userId } = req.params;
		const items = db
			.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`)
			.all(Number(userId));
		sendSuccess(res, items);
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

/**
 * PUT /api/notifications/:id/read
 */
app.put('/api/notifications/:id/read', async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(Number(id));
		sendSuccess(res, null, 'Notification marked as read');
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/auth/register
 */
app.post('/api/auth/register', authLimiter, async (req: Request, res: Response) => {
	try {
		// M17 fix: validate body shape before touching the DB.
		const v = validate(registerSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const { email, password, name } = v.data;
		const role = 'customer';

		// Check if email exists (only id needed)
		const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
		if (existing) {
			return sendError(res, 'Email already registered', 409);
		}

		// C1 fix: scrypt hash with per-user salt and timing-safe verification.
		const passwordHash = await hashPassword(password);

		const result = (await db
			.prepare(
				`INSERT INTO users (email, password_hash, full_name, role, status, is_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id`
			)
			.run(email, passwordHash, name, role)) as { lastInsertRowid: number };

		// C7 fix: return only safe public fields. Never expose status/is_verified to the registering client.
		const safeUser = {
			id: result.lastInsertRowid,
			email,
			full_name: name,
			role,
		};

		sendSuccess(res, safeUser, 'User registered successfully');
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

/**
 * POST /api/auth/login
 */
app.post('/api/auth/login', authLimiter, async (req: Request, res: Response) => {
	try {
		// M17 fix: validate body shape.
		const v = validate(loginSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const { email, password } = v.data;

		const user = (await db
			.prepare(
				'SELECT id, email, full_name, avatar, role, status, is_verified, phone, password_hash, last_login, created_at FROM users WHERE email = ?'
			)
			.get(email)) as Record<string, unknown> | undefined;

		if (!user) {
			return sendError(res, 'Invalid email or password', 401);
		}

		// C1 fix: timing-safe password verification via scrypt, with legacy fallback for seed users.
		const ok = await verifyPassword(password, String(user.password_hash ?? ''));
		if (!ok) {
			return sendError(res, 'Invalid email or password', 401);
		}

		// Update last login
		await db
			.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
			.run(user.id as number);

		// Don't return password hash
		const { password_hash: _, ...userWithoutPassword } = user;

		sendSuccess(res, userWithoutPassword, 'Login successful');
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

/**
 * GET /api/auth/me
 * Get current user (expects x-user-id header)
 */
app.get('/api/auth/me', async (req: Request, res: Response) => {
	try {
		const userId = req.headers['x-user-id'];

		if (!userId) {
			return sendError(res, 'Unauthorized - x-user-id header required', 401);
		}

		const user = (await db
			.prepare(
				'SELECT id, email, full_name, avatar, role, status, is_verified, phone, last_login, created_at FROM users WHERE id = ?'
			)
			.get(Number(userId))) as Record<string, unknown> | undefined;

		if (!user) {
			return sendError(res, 'User not found', 404);
		}

		sendSuccess(res, user);
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

// ═══════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/stats/home
 */
app.get('/api/stats/home', async (_req: Request, res: Response) => {
	try {
		const productsCount = (await db
			.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1')
			.get()) as { count: number };
		const storesCount = (await db
			.prepare('SELECT COUNT(*) as count FROM stores WHERE is_active = 1')
			.get()) as { count: number };
		const ordersCount = (await db.prepare('SELECT COUNT(*) as count FROM orders').get()) as {
			count: number;
		};
		const usersCount = (await db.prepare('SELECT COUNT(*) as count FROM users').get()) as {
			count: number;
		};

		const featuredProducts = (await db
			.prepare(
				'SELECT * FROM products WHERE is_active = 1 AND is_featured = 1 ORDER BY created_at DESC LIMIT 6'
			)
			.all()) as Record<string, unknown>[];

		const dealsProducts = (await db
			.prepare(
				'SELECT * FROM products WHERE is_active = 1 AND deal_discount > 0 ORDER BY deal_discount DESC LIMIT 6'
			)
			.all()) as Record<string, unknown>[];

		sendSuccess(res, {
			counts: {
				products: productsCount.count,
				stores: storesCount.count,
				orders: ordersCount.count,
				users: usersCount.count,
			},
			featured: featuredProducts.map(getProductWithParsedFields),
			deals: dealsProducts.map(getProductWithParsedFields),
		});
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

// ═══════════════════════════════════════════════════════════
// PAYMENTS  (P0-2)
// ═══════════════════════════════════════════════════════════

const paymentCreateSchema = z.object({
	order_id: z.number().int().positive(),
	amount: z.number().nonnegative(),
	currency: z.string().length(3).default('YER'),
	method: z.enum(['cod', 'card', 'wallet', 'bank_transfer', 'stripe', 'paymob']).default('cod'),
	transaction_id: z.string().trim().max(200).optional(),
});

/**
 * POST /api/payments
 * Record a payment attempt for an order. Idempotent on (order_id, method).
 */
app.post('/api/payments', authLimiter, async (req: Request, res: Response) => {
	try {
		const v = validate(paymentCreateSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const { order_id, amount, currency, method, transaction_id } = v.data;

		const order = (await db
			.prepare('SELECT id, customer_id, total, status FROM orders WHERE id = ?')
			.get(order_id)) as
			| { id: number; customer_id: number; total: number; status: string }
			| undefined;
		if (!order) return sendError(res, 'Order not found', 404);

		const existing = (await db
			.prepare('SELECT id, status FROM payments WHERE order_id = ? AND method = ?')
			.get(order_id, method)) as { id: number; status: string } | undefined;
		if (existing) {
			return sendSuccess(res, { id: existing.id, status: existing.status, idempotent: true });
		}

		const initialStatus = method === 'cod' ? 'pending' : 'processing';
		const result = await db
			.prepare(
				`INSERT INTO payments (order_id, user_id, amount, currency, method, status, transaction_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`
			)
			.run(
				order_id,
				order.customer_id,
				amount,
				currency,
				method,
				initialStatus,
				transaction_id ?? null
			);

		if (method !== 'cod') {
			await db
				.prepare(`UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE id = ?`)
				.run(order_id);
		}

		sendSuccess(res, { id: result.lastInsertRowid, status: initialStatus }, 'Payment recorded');
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

/**
 * GET /api/payments/order/:orderId
 */
app.get('/api/payments/order/:orderId', async (req: Request, res: Response) => {
	try {
		const orderId = Number(req.params.orderId);
		if (!Number.isInteger(orderId) || orderId <= 0) {
			return sendError(res, 'Invalid order id', 400);
		}
		const payments = await db
			.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC')
			.all(orderId);
		sendSuccess(res, payments);
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

/**
 * POST /api/payments/:id/confirm
 * Manually mark a COD payment as paid.
 */
app.post('/api/payments/:id/confirm', async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) return sendError(res, 'Invalid payment id', 400);
		const result = (await db
			.prepare(
				`UPDATE payments SET status = 'completed', paid_at = NOW(), updated_at = NOW()
          WHERE id = ? RETURNING order_id`
			)
			.get(id)) as { order_id: number } | undefined;
		if (!result) return sendError(res, 'Payment not found', 404);
		await db
			.prepare(`UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE id = ?`)
			.run(result.order_id);
		sendSuccess(res, { order_id: result.order_id }, 'Payment confirmed');
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

// ═══════════════════════════════════════════════════════════
// ADDRESSES  (P1-3)
// ═══════════════════════════════════════════════════════════

const addressSchema = z.object({
	user_id: z.number().int().positive(),
	label: z.string().trim().min(1).max(50),
	full_name: z.string().trim().min(2).max(100),
	phone: z.string().trim().min(5).max(20),
	governorate: z.string().trim().min(2).max(50),
	city: z.string().trim().min(1).max(50),
	district: z.string().trim().max(80).optional(),
	street: z.string().trim().min(2).max(200),
	building: z.string().trim().max(50).optional(),
	notes: z.string().trim().max(500).optional(),
	is_default: z.boolean().optional(),
});

app.get('/api/addresses', async (req: Request, res: Response) => {
	try {
		const userId = Number(req.query.user_id);
		if (!Number.isInteger(userId) || userId <= 0) return sendError(res, 'user_id is required', 400);
		const rows = await db
			.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC')
			.all(userId);
		sendSuccess(res, rows);
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

app.post('/api/addresses', async (req: Request, res: Response) => {
	try {
		const v = validate(addressSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const data = v.data;

		if (data.is_default) {
			await db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(data.user_id);
		}
		const result = await db
			.prepare(
				`INSERT INTO addresses (user_id, label, full_name, phone, governorate, city, district,
           street, building, notes, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 0), NOW(), NOW())
         RETURNING *`
			)
			.get(
				data.user_id,
				data.label,
				data.full_name,
				data.phone,
				data.governorate,
				data.city,
				data.district ?? null,
				data.street,
				data.building ?? null,
				data.notes ?? null,
				data.is_default ? 1 : 0
			);
		sendSuccess(res, result, 'Address created');
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

app.delete('/api/addresses/:id', async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) return sendError(res, 'Invalid id', 400);
		const result = (await db.prepare('DELETE FROM addresses WHERE id = ? RETURNING id').get(id)) as
			| { id: number }
			| undefined;
		if (!result) return sendError(res, 'Address not found', 404);
		sendSuccess(res, { id: result.id }, 'Address deleted');
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

// ═══════════════════════════════════════════════════════════
// SHIPPING METHODS  (P1-4)
// ═══════════════════════════════════════════════════════════

app.get('/api/shipping/methods', async (req: Request, res: Response) => {
	try {
		const weight = Math.max(0, Number(req.query.weight_kg) || 1);
		const rows = (await db
			.prepare(
				'SELECT id, name_ar, name_en, base_cost, per_kg_cost, estimated_days FROM shipping_methods WHERE is_active = TRUE ORDER BY base_cost ASC'
			)
			.all()) as Array<{
			id: number;
			name_ar: string;
			name_en: string;
			base_cost: number;
			per_kg_cost: number | null;
			estimated_days: number | null;
		}>;
		const enriched = rows.map((m) => ({
			...m,
			estimated_total: Math.round((m.base_cost + (m.per_kg_cost ?? 0) * weight) * 100) / 100,
		}));
		sendSuccess(res, enriched);
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

// ═══════════════════════════════════════════════════════════
// COUPONS  (P1-5)
// ═══════════════════════════════════════════════════════════

const couponRedeemSchema = z.object({
	code: z.string().trim().min(1).max(50),
	user_id: z.number().int().positive(),
	order_subtotal: z.number().nonnegative(),
});

app.post('/api/coupons/validate', async (req: Request, res: Response) => {
	try {
		const v = validate(couponRedeemSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const { code, order_subtotal } = v.data;

		const coupon = (await db
			.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = TRUE')
			.get(code)) as
			| {
					id: number;
					code: string;
					type: 'percentage' | 'fixed';
					value: number;
					min_order: number | null;
					max_discount: number | null;
					usage_limit: number | null;
					usage_count: number;
					starts_at: string | null;
					expires_at: string | null;
			  }
			| undefined;

		if (!coupon) return sendError(res, 'Coupon not found or inactive', 404);
		if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
			return sendError(res, 'Coupon has expired', 400);
		}
		if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
			return sendError(res, 'Coupon is not yet active', 400);
		}
		if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
			return sendError(res, 'Coupon usage limit reached', 400);
		}
		if (coupon.min_order != null && order_subtotal < coupon.min_order) {
			return sendError(
				res,
				`Minimum order for this coupon is ${coupon.min_order.toLocaleString()}`,
				400
			);
		}

		let discount =
			coupon.type === 'percentage' ? (order_subtotal * coupon.value) / 100 : coupon.value;
		if (coupon.max_discount != null) discount = Math.min(discount, coupon.max_discount);
		discount = Math.max(0, Math.min(order_subtotal, Math.round(discount * 100) / 100));

		sendSuccess(res, {
			code: coupon.code,
			type: coupon.type,
			value: coupon.value,
			discount,
			final_total: Math.round((order_subtotal - discount) * 100) / 100,
		});
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

app.post('/api/coupons/redeem', async (req: Request, res: Response) => {
	try {
		const schema = couponRedeemSchema.extend({ order_id: z.number().int().positive() });
		const v = validate(schema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const { code, user_id, order_id } = v.data;

		const coupon = (await db
			.prepare('SELECT id FROM coupons WHERE code = ? AND is_active = TRUE')
			.get(code)) as { id: number } | undefined;
		if (!coupon) return sendError(res, 'Coupon not found', 404);

		const already = await db
			.prepare('SELECT id FROM coupon_usage WHERE coupon_id = ? AND user_id = ? AND order_id = ?')
			.get(coupon.id, user_id, order_id);
		if (already)
			return sendSuccess(res, { id: (already as { id: number }).id }, 'Already redeemed');

		const result = (await db
			.prepare(
				`INSERT INTO coupon_usage (coupon_id, user_id, order_id, discount_amount, used_at)
         VALUES (?, ?, ?, 0, NOW()) RETURNING id`
			)
			.get(coupon.id, user_id, order_id)) as { id: number };
		await db
			.prepare('UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?')
			.run(coupon.id);
		sendSuccess(res, result, 'Coupon redeemed');
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

// ═══════════════════════════════════════════════════════════
// REFUNDS  (P1-6)
// ═══════════════════════════════════════════════════════════

const refundCreateSchema = z.object({
	order_id: z.number().int().positive(),
	user_id: z.number().int().positive(),
	amount: z.number().nonnegative(),
	reason: z.string().trim().min(3).max(1000),
});

app.post('/api/refunds', async (req: Request, res: Response) => {
	try {
		const v = validate(refundCreateSchema, req.body);
		if (!v.ok) return sendError(res, 'Invalid input: ' + v.error, 400);
		const { order_id, user_id, amount, reason } = v.data;

		const order = (await db
			.prepare('SELECT id, customer_id, total, payment_status FROM orders WHERE id = ?')
			.get(order_id)) as
			| { id: number; customer_id: number; total: number; payment_status: string }
			| undefined;
		if (!order) return sendError(res, 'Order not found', 404);
		if (order.customer_id !== user_id) return sendError(res, 'Forbidden', 403);
		if (order.payment_status !== 'paid') {
			return sendError(res, 'Only paid orders are eligible for refund', 400);
		}
		if (amount > order.total) {
			return sendError(res, 'Refund amount exceeds order total', 400);
		}

		const result = (await db
			.prepare(
				`INSERT INTO refunds (order_id, user_id, amount, reason, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'requested', NOW(), NOW()) RETURNING id`
			)
			.get(order_id, user_id, amount, reason)) as { id: number };
		sendSuccess(res, result, 'Refund requested');
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

app.post('/api/refunds/:id/resolve', async (req: Request, res: Response) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) return sendError(res, 'Invalid id', 400);
		const status = (req.body?.status as string) || '';
		if (status !== 'approved' && status !== 'rejected') {
			return sendError(res, 'status must be approved or rejected', 400);
		}
		const adminNotes = (req.body?.admin_notes as string | undefined) ?? null;
		const finalStatus = status === 'approved' ? 'processed' : 'rejected';
		const result = (await db
			.prepare(
				`UPDATE refunds
            SET status = ?, admin_notes = ?, resolved_at = NOW(), updated_at = NOW()
          WHERE id = ? AND status IN ('requested', 'approved')
          RETURNING order_id, amount`
			)
			.get(finalStatus, adminNotes, id)) as { order_id: number; amount: number } | undefined;
		if (!result) return sendError(res, 'Refund not found or already resolved', 404);

		if (finalStatus === 'processed') {
			await db
				.prepare(
					`UPDATE payments SET status = 'refunded', updated_at = NOW()
            WHERE order_id = ? AND status = 'completed'`
				)
				.run(result.order_id);
			const order = (await db
				.prepare('SELECT store_id FROM orders WHERE id = ?')
				.get(result.order_id)) as { store_id: number | null } | undefined;
			if (order?.store_id) {
				await db
					.prepare(
						`INSERT INTO transactions (store_id, type, amount, balance_after, reference_type, reference_id, description, created_at)
             VALUES (?, 'refund', ?, 0, 'refund', ?, ?, NOW())`
					)
					.run(order.store_id, -result.amount, id, `Refund #${id} for order ${result.order_id}`);
			}
		}
		sendSuccess(res, { id, status: finalStatus }, 'Refund resolved');
	} catch (err) {
		sendError(res, (err as Error).message);
	}
});

// ═══════════════════════════════════════════════════════════
// STATIC FILES (Production SPA fallback)
// ═══════════════════════════════════════════════════════════

if (process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC === 'true') {
	app.use(express.static(STATIC_PATH));

	app.get('/{*splat}', (_req: Request, res: Response) => {
		res.sendFile(path.join(STATIC_PATH, 'index.html'));
	});
}

// ═══════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════

// 404 handler
app.use((_req: Request, res: Response) => {
	res.status(404).json({ success: false, error: 'Route not found' } as ApiResponse);
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
	console.error('[ERROR]', err);
	res.status(500).json({
		success: false,
		error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
	} as ApiResponse);
});

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

// Only auto-listen when this module is the entry point. When it is imported
// (e.g. by Vitest), we still export the app but do NOT bind a port.
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
		console.log(`═══════════════════════════════════════════`);
		console.log(`  Nouf-ex API Server running on port ${PORT}`);
		console.log(`  Database: ${DATABASE_URL}`);
		console.log(`  Static:   ${STATIC_PATH}`);
		console.log(`  Env:      ${process.env.NODE_ENV || 'development'}`);
		console.log(`═══════════════════════════════════════════`);
	});
}

export default app;
