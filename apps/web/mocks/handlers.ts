/**
 * mocks/handlers.ts — MSW request handlers for the API.
 */

import { http, HttpResponse, delay } from 'msw';

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

const ordersFixture = [
	{
		id: 1,
		order_number: 'ORD-1A2B3C4D',
		customer_id: 5,
		store_id: 1,
		status: 'pending',
		payment_method: 'cod',
		payment_status: 'pending',
		subtotal: 50000,
		shipping_cost: 700,
		discount: 5000,
		coupon_code: 'SAVE10',
		discount_amount: 5000,
		total: 45700,
		currency: 'YER',
		shipping_address: {
			label: 'Home',
			full_name: 'Ahmed Al-Maqtari',
			phone: '+967712345671',
			governorate: 'Sanaa',
			city: 'Sanaa',
			street: 'Hadda St',
		},
		notes: null,
		store_name: 'Test Store',
		store_logo: '/noufex-logo.svg',
		created_at: '2026-06-20T10:00:00Z',
		updated_at: '2026-06-20T10:00:00Z',
	},
	{
		id: 2,
		order_number: 'ORD-9Z8Y7X6W',
		customer_id: 5,
		store_id: 1,
		status: 'delivered',
		payment_method: 'cod',
		payment_status: 'paid',
		subtotal: 25000,
		shipping_cost: 700,
		discount: 0,
		coupon_code: null,
		discount_amount: 0,
		total: 25700,
		currency: 'YER',
		shipping_address: null,
		notes: null,
		store_name: 'Test Store',
		store_logo: '/noufex-logo.svg',
		created_at: '2026-05-15T08:00:00Z',
		updated_at: '2026-05-18T14:00:00Z',
	},
];

const addressesFixture = [
	{
		id: 1,
		user_id: 5,
		label: 'Home',
		full_name: 'Ahmed Al-Maqtari',
		phone: '+967712345671',
		governorate: 'Sanaa',
		city: 'Sanaa',
		district: 'Hadda',
		street: 'Hadda Main St',
		building: 'Al-Orwas Building, Floor 3',
		notes: 'Near Nahdi pharmacy',
		is_default: 1,
		created_at: '2026-01-15T10:00:00Z',
		updated_at: '2026-01-15T10:00:00Z',
	},
	{
		id: 2,
		user_id: 5,
		label: 'Office',
		full_name: 'Ahmed Al-Maqtari',
		phone: '+967712345671',
		governorate: 'Aden',
		city: 'Al-Mansoura',
		district: 'Al-Mansoura',
		street: 'Al-Jumhuriya St',
		building: 'Al-Saeed Building',
		notes: null,
		is_default: 0,
		created_at: '2026-02-01T08:00:00Z',
		updated_at: '2026-02-01T08:00:00Z',
	},
];

export const handlers = [
	// Categories
	http.get('*/api/categories', async () => {
		await delay(50);
		return HttpResponse.json({ success: true, data: categoriesFixture });
	}),
	http.get('*/api/categories/:slug', async (info) => {
		const url = (info.request as Request).url;
		const m = url.match(/\/api\/categories\/([^/?#]+)/);
		const slug = String(info.params?.slug ?? (m ? decodeURIComponent(m[1]) : ''));
		const cat = categoriesFixture.find((c) => c.slug === slug);
		if (!cat) {
			return HttpResponse.json(
				{ success: false, error: 'Category not found' },
				{ status: 404 },
			);
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
			products = products.filter((p) =>
				p.name_en.toLowerCase().includes(search.toLowerCase()),
			);
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
	http.get('*/api/products/:id', async (info) => {
		const url = (info.request as Request).url;
		const m = url.match(/\/api\/products\/([^/?#]+)/);
		const idStr = String(info.params?.id ?? (m ? decodeURIComponent(m[1]) : ''));
		const id = parseInt(idStr, 10);
		if (Number.isNaN(id)) {
			return HttpResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
		}
		const product = productsFixture.find((p) => p.id === id);
		if (!product) {
			return HttpResponse.json(
				{ success: false, error: 'Product not found' },
				{ status: 404 },
			);
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
	http.get('*/api/stores/:id', async (info) => {
		const url = (info.request as Request).url;
		const m = url.match(/\/api\/stores\/([^/?#]+)/);
		const idStr = String(info.params?.id ?? (m ? decodeURIComponent(m[1]) : ''));
		const id = parseInt(idStr, 10);
		if (Number.isNaN(id)) {
			return HttpResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
		}
		const store = storesFixture.find((s) => s.id === id);
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

	// Auth — supports both success and failure on the same path
	http.post('*/api/auth/login', async ({ request }) => {
		const body = (await request.json().catch(() => ({}))) as {
			email?: string;
			password?: string;
		};
		if (body.email === 'ahmed@gmail.com' && body.password === 'customer123') {
			return HttpResponse.json({
				success: true,
				data: {
					user: {
						id: 5,
						email: 'ahmed@gmail.com',
						full_name: 'Ahmed',
						role: 'customer',
					},
					token: 'test-jwt-token-1234',
				},
			});
		}
		return HttpResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
	}),
	http.post('*/api/auth/register', async () => {
		return HttpResponse.json(
			{ success: false, error: 'Email already in use' },
			{ status: 409 },
		);
	}),

	// Cart
	http.get('*/api/cart/:userId', async () => {
		return HttpResponse.json({ success: true, data: [] });
	}),
	http.post('*/api/cart', async ({ request }) => {
		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		return HttpResponse.json({ success: true, data: { id: 1, ...body } });
	}),
	http.delete('*/api/cart/clear/:userId', async ({ params }) => {
		return HttpResponse.json({ success: true, data: { user_id: Number(params.userId) } });
	}),
	http.delete('*/api/cart/:id', async ({ params }) => {
		return HttpResponse.json({ success: true, data: { id: Number(params.id) } });
	}),

	// Wishlist
	http.get('*/api/wishlist/:userId', async () => {
		return HttpResponse.json({ success: true, data: [] });
	}),
	http.post('*/api/wishlist', async ({ request }) => {
		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		return HttpResponse.json({ success: true, data: { id: 1, ...body } });
	}),
	http.delete('*/api/wishlist/:id', async ({ params }) => {
		return HttpResponse.json({ success: true, data: { id: Number(params.id) } });
	}),

	// Notifications
	http.get('*/api/notifications/:userId', async () => {
		return HttpResponse.json({ success: true, data: [] });
	}),
	http.put('*/api/notifications/:id/read', async ({ params }) => {
		return HttpResponse.json({ success: true, data: { id: Number(params.id) } });
	}),

	// Orders (P0-1: cart-to-order pipeline)
	http.get('*/api/orders', async () => {
		return HttpResponse.json({ success: true, data: ordersFixture });
	}),
	http.get('*/api/orders/:id', async (info) => {
		const url = (info.request as Request).url;
		const m = url.match(/\/api\/orders\/(\d+)/);
		const id = m ? parseInt(m[1], 10) : NaN;
		const order = ordersFixture.find((o) => o.id === id);
		if (!order) {
			return HttpResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
		}
		return HttpResponse.json({
			success: true,
			data: {
				...order,
				items: [
					{
						id: 1,
						order_id: order.id,
						product_id: 1,
						variant_id: null,
						product_name: 'Premium Wireless Headphones',
						product_name_ar: 'سماعات لاسلكية فاخرة',
						product_image: '/category-electronics.jpg',
						quantity: 1,
						unit_price: 25000,
						total_price: 25000,
					},
				],
			},
		});
	}),
	http.post('*/api/orders', async ({ request }) => {
		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		const newId = ordersFixture.length + 1;
		const total = Number(body.total ?? 0);
		const discount = Number(body.discount ?? 0);
		return HttpResponse.json({
			success: true,
			data: {
				id: newId,
				orderNumber: `ORD-${newId.toString(16).toUpperCase().padStart(8, '0')}`,
				discount,
				total,
			},
		});
	}),

	// Addresses
	http.get('*/api/addresses', async () => {
		return HttpResponse.json({ success: true, data: addressesFixture });
	}),
	http.post('*/api/addresses', async ({ request }) => {
		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		return HttpResponse.json({ success: true, data: { id: 1, ...body } });
	}),
	http.delete('*/api/addresses/:id', async () => {
		return HttpResponse.json({ success: true, data: { id: 1 } });
	}),

	// Coupons
	http.get('*/api/coupons/mine', async () => {
		return HttpResponse.json({
			success: true,
			data: [
				{
					id: 1,
					code: 'SAVE10',
					type: 'percentage',
					value: 10,
					min_order_amount: 0,
					max_discount: null,
					starts_at: null,
					expires_at: null,
					description: 'Test coupon',
				},
			],
		});
	}),
	http.post('*/api/coupons/validate', async ({ request }) => {
		const body = (await request.json().catch(() => ({}))) as { code: string; order_subtotal: number };
		if (body.code !== 'SAVE10') {
			return HttpResponse.json(
				{ success: false, error: 'Coupon not found or inactive' },
				{ status: 404 },
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
	http.post('*/api/coupons/redeem', async () => {
		return HttpResponse.json({ success: true, data: { id: 1 } });
	}),

	// Auth — /me
	http.get('*/api/auth/me', async () => {
		return HttpResponse.json({
			success: true,
			data: {
				id: 5,
				email: 'ahmed@gmail.com',
				full_name: 'Ahmed',
				role: 'customer',
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

	// Refunds
	http.post('*/api/refunds', async ({ request }) => {
		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		return HttpResponse.json({ success: true, data: { id: 1, ...body } });
	}),
	http.post('*/api/refunds/:id/resolve', async ({ params }) => {
		return HttpResponse.json({
			success: true,
			data: { id: Number(params.id), status: 'approved' },
		});
	}),

	// Payments
	http.post('*/api/payments', async ({ request }) => {
		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		return HttpResponse.json({ success: true, data: { id: 1, status: 'pending', ...body } });
	}),
	http.get('*/api/payments/order/:orderId', async () => {
		return HttpResponse.json({ success: true, data: [] });
	}),
	http.post('*/api/payments/:id/confirm', async ({ params }) => {
		return HttpResponse.json({ success: true, data: { order_id: 1, id: Number(params.id) } });
	}),

	// ── Admin endpoints (privileged — K.1 fixture data) ─────────────────
	// These mirror `/api/admin/*` server responses. Used by ui-smoke
	// tests so the admin pages exercise the same JSON shape the real
	// backend would return, instead of an empty `[]` proxy.
	http.get('*/api/admin/stats', () => {
		return HttpResponse.json({
			success: true,
			data: {
				counts: {
					users: 15240,
					stores: 1280,
					products: 4250,
					orders: 17700,
					reviews: 6230,
					disputes: 89,
				},
				flags: {
					openDisputes: 12,
					pendingOrders: 138,
					paidOrders: 16820,
					suspendedUsers: 23,
					inactiveStores: 47,
				},
				recent7d: { orders: 318, users: 412 },
				revenueYer: 212200,
			},
		});
	}),
	http.get('*/api/admin/users', () => {
		return HttpResponse.json({
			success: true,
			data: {
				users: [
					{
						id: 1,
						email: 'admin@noufex.test',
						full_name: 'مدير النظام',
						avatar: null,
						role: 'admin',
						status: 'active',
						is_verified: 1,
						email_verified: 1,
						phone_verified: 1,
						two_factor_enabled: 0,
						preferred_language: 'ar',
						gender: null,
						phone: '+967700000001',
						last_login: '2026-06-28T10:15:00Z',
						created_at: '2024-01-01T00:00:00Z',
						updated_at: '2026-06-28T10:15:00Z',
					},
					{
						id: 4,
						email: 'merchant2@shop.test',
						full_name: 'خالد التاجر',
						avatar: null,
						role: 'merchant',
						status: 'suspended',
						is_verified: 0,
						email_verified: 1,
						phone_verified: 0,
						two_factor_enabled: 0,
						preferred_language: 'ar',
						gender: 'male',
						phone: '+967733333333',
						last_login: '2026-05-10T11:00:00Z',
						created_at: '2025-01-20T12:00:00Z',
						updated_at: '2026-06-15T09:00:00Z',
					},
				],
				total: 2,
				limit: 20,
				offset: 0,
			},
		});
	}),
	http.get('*/api/admin/stores', () => {
		return HttpResponse.json({
			success: true,
			data: {
				stores: [
					{
						id: 1,
						owner_id: 2,
						store_name: 'متجر الأناقة اليمنية',
						store_name_en: 'Yemeni Elegance Store',
						store_name_zh: '也门优雅商店',
						slug: 'yemeni-elegance',
						description: '',
						description_en: '',
						description_zh: '',
						logo: '',
						banner: '',
						location: 'صنعاء',
						governorate: 'صنعاء',
						trust_level: 'verified',
						response_rate: 95,
						on_time_delivery: 92,
						rating: 4.7,
						review_count: 234,
						products_count: 128,
						sales_count: 1240,
						followers_count: 870,
						since_year: '2024',
						is_active: 1,
						is_verified: 1,
						created_at: '2024-01-15T10:00:00Z',
						updated_at: '2026-06-29T08:30:00Z',
					},
				],
				total: 1,
				limit: 20,
				offset: 0,
			},
		});
	}),
	http.patch('*/api/admin/users/:id', async ({ params }) => {
		return HttpResponse.json({
			success: true,
			data: { id: Number(params.id), status: 'active', role: 'customer' },
		});
	}),
	http.patch('*/api/admin/stores/:id', async ({ params }) => {
		return HttpResponse.json({
			success: true,
			data: { id: Number(params.id), is_active: true, is_verified: true },
		});
	}),
	http.get('*/api/admin/audit-log', () => {
		return HttpResponse.json({
			success: true,
			data: {
				log: [
					{
						id: 1,
						user_id: 1,
						action: 'user.ban',
						entity_type: 'user',
						entity_id: '4',
						old_values: { status: 'active' },
						new_values: { status: 'suspended' },
						ip_address: '127.0.0.1',
						user_agent: 'Mozilla/5.0',
						created_at: '2026-06-15T09:00:00Z',
					},
				],
				total: 1,
				limit: 50,
				offset: 0,
			},
		});
	}),

	// ── Seller endpoints (merchant self-service) ──────────────────────
	http.get('*/api/seller/dashboard', () => {
		return HttpResponse.json({
			success: true,
			data: {
				store_id: 1,
				active_orders: 8,
				pending_orders: 3,
				revenue: 145000,
				low_stock_products: 4,
			},
		});
	}),
	http.get('*/api/seller/products', () => {
		return HttpResponse.json({
			success: true,
			data: {
				items: [
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
						price: 12500,
						original_price: 15000,
						currency: 'YER',
						moq: 1,
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
						created_at: '2024-01-01T00:00:00Z',
						updated_at: '2026-06-29T08:30:00Z',
					},
				],
				total: 1,
				limit: 50,
				offset: 0,
			},
		});
	}),
	http.get('*/api/seller/orders', () => {
		return HttpResponse.json({
			success: true,
			data: {
				items: [
					{
						id: 101,
						order_number: 'ORD-1243',
						customer_id: 3,
						customer_email: 'customer1@buyer.test',
						store_id: 1,
						status: 'processing',
						payment_status: 'paid',
						payment_method: 'cod',
						subtotal: 128000,
						shipping_cost: 3500,
						discount: 0,
						total: 131500,
						timeline: '[{"status":"ordered","time":"2024-06-15T10:30:00Z"}]',
						created_at: '2024-06-15T10:30:00Z',
						updated_at: '2026-06-29T08:30:00Z',
					},
				],
				total: 1,
				limit: 50,
				offset: 0,
			},
		});
	}),
	http.get('*/api/seller/analytics', () => {
		return HttpResponse.json({
			success: true,
			data: {
				store_id: 1,
				total_orders: 145,
				delivered_orders: 132,
				cancelled_orders: 4,
				unique_customers: 87,
				today_orders: 3,
				gross_revenue: 1845000,
				total_revenue: 1654000,
			},
		});
	}),

	// ── Public health endpoints ─────────────────────────────────────────
	http.get('*/api/health', () => {
		return HttpResponse.json({
			status: 'ok',
			uptime_s: 3600,
			ts: new Date().toISOString(),
		});
	}),
	http.get('*/api/ready', () => {
		return HttpResponse.json({
			status: 'ready',
			uptime_s: 3600,
			checks: { db: { ok: true, ms: 5 } },
		});
	}),

	// ── Messages endpoints (K.6 — used by Messages.tsx) ───────────────
	http.get('*/api/messages/inbox', () => {
		return HttpResponse.json({ success: true, data: { messages: [], total: 0, unread: 0 } });
	}),
	http.get('*/api/messages/sent', () => {
		return HttpResponse.json({ success: true, data: { messages: [], total: 0, unread: 0 } });
	}),
	http.get('*/api/messages/unread-count', () => {
		return HttpResponse.json({ success: true, data: { count: 0 } });
	}),
];
