/**
 * tests/mocks/handlers.ts — MSW request handlers for the API.
 *
 * Tests start the MSW server via `server.listen()` in their setup, and the
 * frontend's fetch() calls hit these handlers instead of the real Express
 * server. This gives us deterministic, isolated integration tests that
 * don't need Docker/Postgres.
 *
 * Adding a new endpoint to test? Add a handler here. The default behavior
 * for unhandled requests is to return a 404 with a clear message.
 */

import { http, HttpResponse, delay } from 'msw';

// ─── Tiny in-memory fixtures ────────────────────────────────────────────────

const productsFixture = [
	{
		id: 1,
		store_id: 1,
		category_id: 1,
		name_ar: 'سماعات لاسلكية',
		name_en: 'Wireless Headphones',
		name_zh: '无线耳机',
		description: 'صوت عالي الجودة',
		description_en: 'High quality sound',
		description_zh: '高品质音效',
		price: 12_500,
		original_price: 15_000,
		currency: 'YER',
		stock: 50,
		sold_count: 124,
		rating: 4.8,
		review_count: 24,
		features: [],
		specifications: {},
		badges: [],
		colors: [],
		sizes: [],
		main_image: '/category-electronics.jpg',
		is_active: 1,
		is_featured: 1,
		deal_discount: 0,
		deal_ends_at: '',
		created_at: '2024-01-01',
		updated_at: '2024-01-01',
	},
	{
		id: 2,
		store_id: 1,
		category_id: 1,
		name_ar: 'لابتوب احترافي',
		name_en: 'Pro Laptop',
		name_zh: '专业笔记本',
		description: 'لابتوب سريع',
		description_en: 'Fast laptop',
		description_zh: '快速笔记本',
		price: 350_000,
		original_price: 400_000,
		currency: 'YER',
		stock: 10,
		sold_count: 50,
		rating: 4.6,
		review_count: 10,
		features: [],
		specifications: {},
		badges: [],
		colors: [],
		sizes: [],
		main_image: '/category-electronics.jpg',
		is_active: 1,
		is_featured: 0,
		deal_discount: 13,
		deal_ends_at: '',
		created_at: '2024-01-01',
		updated_at: '2024-01-01',
	},
];

const categoriesFixture = [
	{
		id: 1,
		name_ar: 'إلكترونيات',
		name_en: 'Electronics',
		name_zh: '电子产品',
		slug: 'electronics',
		parent_id: null,
		sort_order: 1,
		is_active: 1,
		product_count: 24,
		icon: '',
		image: '',
	},
	{
		id: 2,
		name_ar: 'أزياء',
		name_en: 'Fashion',
		name_zh: '服装',
		slug: 'fashion',
		parent_id: null,
		sort_order: 2,
		is_active: 1,
		product_count: 18,
		icon: '',
		image: '',
	},
];

const storesFixture = [
	{
		id: 1,
		owner_id: 1,
		store_name: 'متجر 1',
		store_name_en: 'Store One',
		store_name_zh: '店铺一',
		slug: 'store-1',
		description: '',
		description_en: '',
		description_zh: '',
		logo: '',
		banner: '',
		location: 'Sanaa',
		governorate: 'Sanaa',
		trust_level: 'verified',
		response_rate: 95,
		on_time_delivery: 92,
		rating: 4.8,
		review_count: 124,
		products_count: 24,
		sales_count: 1500,
		followers_count: 200,
		since_year: '2020',
		is_active: 1,
		is_verified: 1,
		products: [],
	},
];

const homeStats = {
	products_count: 24,
	stores_count: 12,
	orders_count: 1500,
	users_count: 5000,
	featured_products: productsFixture.filter((p) => p.is_featured),
	deals_products: productsFixture.filter((p) => p.deal_discount > 0),
};

// ─── Handlers ───────────────────────────────────────────────────────────────

export const handlers = [
	// Categories
	http.get('*/api/categories', async () => {
		await delay(50);
		return HttpResponse.json({ success: true, data: categoriesFixture });
	}),
	http.get('*/api/categories/:slug', async ({ params }) => {
		const cat = categoriesFixture.find((c) => c.slug === params.slug);
		if (!cat) {
			return HttpResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
		}
		return HttpResponse.json({ success: true, data: { ...cat, products: productsFixture } });
	}),

	// Products
	http.get('*/api/products', async ({ request }) => {
		await delay(50);
		const url = new URL(request.url);
		const category = url.searchParams.get('category');
		const search = url.searchParams.get('search');
		let products: typeof productsFixture = productsFixture;
		if (category) {
			// fixtures all have category_id=1; OK for now
		}
		if (search) {
			products = products.filter((p) => p.name_en.toLowerCase().includes(search.toLowerCase()));
		}
		return HttpResponse.json({
			success: true,
			data: { products, total: products.length, limit: 50, offset: 0 },
		});
	}),
	http.get('*/api/products/featured', async () => {
		return HttpResponse.json({ success: true, data: homeStats.featured_products });
	}),
	http.get('*/api/products/deals', async () => {
		return HttpResponse.json({ success: true, data: homeStats.deals_products });
	}),
	http.get('*/api/products/:id', async ({ params }) => {
		const product = productsFixture.find((p) => p.id === Number(params.id));
		if (!product) {
			return HttpResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
		}
		return HttpResponse.json({
			success: true,
			data: { ...product, store: storesFixture[0], reviews: [], images: [] },
		});
	}),

	// Stores
	http.get('*/api/stores', async () => {
		return HttpResponse.json({ success: true, data: storesFixture });
	}),
	http.get('*/api/stores/:id', async ({ params }) => {
		const store = storesFixture.find((s) => s.id === Number(params.id));
		if (!store) {
			return HttpResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
		}
		return HttpResponse.json({
			success: true,
			data: { ...store, products: productsFixture.filter((p) => p.store_id === store.id) },
		});
	}),

	// Reviews
	http.get('*/api/reviews', async () => {
		return HttpResponse.json({ success: true, data: [] });
	}),

	// Stats
	http.get('*/api/stats/home', async () => {
		return HttpResponse.json({
			success: true,
			data: {
				counts: {
					products: homeStats.products_count,
					stores: homeStats.stores_count,
					orders: homeStats.orders_count,
					users: homeStats.users_count,
				},
				featured: homeStats.featured_products,
				deals: homeStats.deals_products,
			},
		});
	}),

	// Auth
	http.post('*/api/auth/login', async () => {
		return HttpResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
	}),
	http.post('*/api/auth/register', async () => {
		return HttpResponse.json({ success: false, error: 'Email already in use' }, { status: 409 });
	}),

	// Cart
	http.get('*/api/cart/:userId', async () => {
		return HttpResponse.json({ success: true, data: [] });
	}),

	// Wishlist
	http.get('*/api/wishlist/:userId', async () => {
		return HttpResponse.json({ success: true, data: [] });
	}),

	// Notifications
	http.get('*/api/notifications/:userId', async () => {
		return HttpResponse.json({ success: true, data: [] });
	}),

	// Coupons
	http.post('*/api/coupons/validate', async ({ request }) => {
		const body = (await request.json()) as { code: string; order_subtotal: number };
		if (body.code !== 'SAVE10') {
			return HttpResponse.json(
				{ success: false, error: 'Coupon not found or inactive' },
				{ status: 404 }
			);
		}
		const discount = Math.round(body.order_subtotal * 0.1 * 100) / 100;
		return HttpResponse.json({
			success: true,
			data: {
				code: 'SAVE10',
				type: 'percentage',
				value: 10,
				discount,
				final_total: body.order_subtotal - discount,
			},
		});
	}),

	// Shipping
	http.get('*/api/shipping/methods', async () => {
		return HttpResponse.json({
			success: true,
			data: [
				{
					id: 1,
					name_ar: 'عادي',
					name_en: 'Standard',
					base_cost: 500,
					per_kg_cost: 200,
					estimated_days: 3,
					estimated_total: 700,
				},
				{
					id: 2,
					name_ar: 'سريع',
					name_en: 'Express',
					base_cost: 1500,
					per_kg_cost: 500,
					estimated_days: 1,
					estimated_total: 2000,
				},
			],
		});
	}),

	// Addresses
	http.post('*/api/addresses', async ({ request }) => {
		const body = (await request.json()) as Record<string, unknown>;
		return HttpResponse.json({ success: true, data: { id: 1, ...body } });
	}),

	// Refunds
	http.post('*/api/refunds', async ({ request }) => {
		const body = (await request.json()) as Record<string, unknown>;
		return HttpResponse.json({ success: true, data: { id: 1, ...body } });
	}),

	// Payments
	http.post('*/api/payments', async ({ request }) => {
		const body = (await request.json()) as Record<string, unknown>;
		return HttpResponse.json({ success: true, data: { id: 1, status: 'pending', ...body } });
	}),
];
