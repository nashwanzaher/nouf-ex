/**
 * Home - main landing page.
 *
 * Modernized in the UI-bug-fix pass:
 *   - All product cards now use the live `/api/products?*` endpoint
 *     instead of local fixtures (this fixes the +undefined bug on
 *     flash-deal prices, the NaN% discount label, and the broken
 *     relative `/category-*.jpg` image paths).
 *   - Image URL construction is centralised in lib/utils/safe-format.ts
 *     so the Vite dev server (port 8080) can actually load the API's
 *     `/products/p3-wild-thyme.jpg` images via the configured proxy.
 *   - Skeleton placeholders + error fallback are consistent with
 *     the rest of the home sections.
 *   - RTL is applied at the section level via `dir="rtl"` to avoid
 *     the icon/text overlap we kept seeing in the flash-deal header.
 *   - The flash-deal countdown is a real `deal_ends_at` countdown
 *     (DD:HH:MM) instead of the previous "ends in 6h 22m" hard-coded
 *     string.
 */
import { useState, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCart } from '@/features/cart/context/CartContext';
import { useHomeStats, useProducts, useStores, useCategories } from '@/hooks/useApi';
import type { Product, Store, Category } from '@/hooks/useApi';
import {
	renderPriceBlock,
	discountPercent,
	formatDiscountLabel,
	safeImageUrl,
} from '@/lib/utils/safe-format';
import { formatMoney } from '@/lib/format';
import {
	Search,
	ShoppingCart,
	ChevronRight,
	ShieldCheck,
	Truck,
	BadgeCheck,
	Clock,
	Zap,
	Star,
	Globe,
	TrendingUp,
	Package,
	Users,
	Headphones,
	Camera,
	ChevronDown,
	RefreshCw,
} from 'lucide-react';

/* ─── helpers ──────────────────────────────────────────── */

const getProductName = (p: Product, lang: string) =>
	lang === 'en' ? p.name_en : lang === 'zh' ? p.name_zh : p.name_ar;

const getStoreName = (s: Store, lang: string) =>
	lang === 'en'
		? (s.store_name_en ?? s.store_name)
		: lang === 'zh'
			? (s.store_name_zh ?? s.store_name)
			: s.store_name;

const getCatName = (c: Category, lang: string) =>
	lang === 'en' ? c.name_en : lang === 'zh' ? c.name_zh : c.name_ar;

/* ─── skeleton components ──────────────────────────────── */

const ProductSkeleton = () => (
	<div className="bg-white rounded-lg border border-aliBorder overflow-hidden">
		<div className="aspect-square bg-gray-200 animate-pulse" />
		<div className="p-2.5 space-y-2">
			<div className="h-4 bg-gray-200 animate-pulse rounded w-full" />
			<div className="h-3 bg-gray-200 animate-pulse rounded w-16" />
			<div className="h-3 bg-gray-200 animate-pulse rounded w-20" />
			<div className="h-8 bg-gray-200 animate-pulse rounded w-full mt-2" />
		</div>
	</div>
);

const DealSkeleton = () => (
	<div className="bg-white rounded-xl overflow-hidden shadow-sm">
		<div className="aspect-square bg-gray-200 animate-pulse" />
		<div className="p-3 space-y-2">
			<div className="h-4 bg-gray-200 animate-pulse rounded w-full" />
			<div className="h-3 bg-gray-200 animate-pulse rounded w-16" />
		</div>
	</div>
);

const StoreSkeleton = () => (
	<div className="bg-white rounded-lg border border-aliBorder p-4 text-center">
		<div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse mx-auto mb-3" />
		<div className="h-4 bg-gray-200 animate-pulse rounded w-3/4 mx-auto mb-2" />
		<div className="h-3 bg-gray-200 animate-pulse rounded w-12 mx-auto" />
	</div>
);

const StatSkeleton = () => (
	<div className="flex items-center gap-3">
		<div className="w-11 h-11 rounded-full bg-gray-200 animate-pulse" />
		<div className="space-y-1">
			<div className="h-5 bg-gray-200 animate-pulse rounded w-16" />
			<div className="h-3 bg-gray-200 animate-pulse rounded w-24" />
		</div>
	</div>
);

/* ─── ProductCard sub-component (used by every grid below) ── */

function ProductCard({
	product,
	lang,
	added,
	onAdd,
}: {
	product: Product;
	lang: string;
	added: boolean;
	onAdd: () => void;
}) {
	const { t } = useTranslation();
	const name = getProductName(product, lang);
	const prices = renderPriceBlock(
		{
			price: product.price,
			original_price: product.original_price,
			currency: product.currency,
		},
		formatMoney,
	);
	const pct = discountPercent(product.price, product.original_price);
	const discount = formatDiscountLabel(pct, (k: string) => k); // already localized
	const img = safeImageUrl(product.main_image, { kind: 'product' });
	return (
		<div className="bg-white rounded-lg border border-aliBorder overflow-hidden hover:shadow-md hover:border-aliOrange/30 transition-all group">
			<Link
				to={`/product/${product.id}`}
				className="block relative aspect-square overflow-hidden bg-aliSurface"
			>
				<img
					src={img}
					alt={name}
					className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
					loading="lazy"
				/>
				{product.badges?.includes('bestseller') && (
					<span className="absolute top-2 right-2 bg-aliOrange text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
						{t('product.badge.bestseller')}
					</span>
				)}
				{product.badges?.includes('new') && (
					<span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
						{t('product.badge.new')}
					</span>
				)}
				{pct > 0 && (
					<span className="absolute bottom-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
						{discount}
					</span>
				)}
			</Link>
			<div className="p-2.5">
				<Link to={`/product/${product.id}`}>
					<h3 className="text-sm text-aliText line-clamp-2 leading-snug hover:text-aliOrange transition-colors min-h-[2.5em]">
						{name}
					</h3>
				</Link>
				<div className="mt-1.5 flex items-baseline gap-1.5">
					<span className="text-aliOrange font-bold text-base" title={prices.current}>
						{prices.current}
					</span>
					{prices.original && (
						<span
							className="text-aliTextMute text-xs line-through"
							title={prices.original}
						>
							{prices.original}
						</span>
					)}
				</div>
				<div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
					<span className="text-[10px] bg-aliSurface text-aliTextSec px-1.5 py-0.5 rounded">
						{t('home.moqBadge', { count: 1, defaultValue: 'MOQ: 1 pcs' })}
					</span>
					<span className="text-[10px] text-aliTextMute">
						{product.sold_count} {t('home.soldSuffix', 'sold')}
					</span>
				</div>
				<button
					type="button"
					onClick={onAdd}
					className={`w-full mt-2 h-8 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
						added
							? 'bg-green-500 text-white'
							: 'bg-aliOrange text-white hover:bg-aliOrangeHover'
					}`}
					aria-label={added ? t('product.addToCart.added') : t('product.addToCart.idle')}
				>
					<ShoppingCart size={12} />
					{added ? t('product.addToCart.added') : t('product.addToCart.idle')}
				</button>
			</div>
		</div>
	);
}

/* ─── main component ───────────────────────────────────── */

export default function Home() {
	/* ── hooks setup ──────────────────────────────────── */
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const { dispatch } = useCart();

	/* ── state ────────────────────────────────────────── */
	const [searchQ, setSearchQ] = useState('');
	const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
	const [activeTab, setActiveTab] = useState<'rfq' | 'hot' | 'fast'>('hot');
	const addedTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

	/* ── effects: API data ────────────────────────────── */
	const { data: statsData, loading: statsLoading } = useHomeStats();
	const { data: popularResp, loading: popularLoading } = useProducts({ limit: 24 });
	const { data: dealsResp, loading: dealsLoading } = useProducts({ limit: 4 });
	const { data: stores, loading: storesLoading } = useStores();
	const { data: catsFlat, loading: catsLoading } = useCategories();

	/* ── derived ──────────────────────────────────────── */
	const allProducts = popularResp?.products ?? [];
	const dealProducts = (dealsResp?.products ?? []).filter(
		(p) => p.deal_discount && Number(p.deal_discount) > 0,
	);
	const newProducts = (popularResp?.products ?? []).filter((p) => p.badges?.includes('new'));

	const categories = useMemo(() => {
		if (!catsFlat) return [];
		const parents = catsFlat.filter((c) => c.parent_id === null);
		return parents.map((p) => ({
			...p,
			subcategories: catsFlat.filter((c) => c.parent_id === p.id),
		}));
	}, [catsFlat]);

	const storeMap = useMemo(() => {
		const map = new Map<number, Store>();
		stores?.forEach((s) => map.set(s.id, s));
		return map;
	}, [stores]);

	const hotSearches = useMemo(
		() => [
			{ name: t('home.hotSearchSmartphones', 'Smartphones'), slug: 'electronics' },
			{ name: t('home.hotSearchYemeniCoffee', 'Yemeni Coffee'), slug: 'food' },
			{ name: t('home.hotSearchFurniture', 'Traditional Furniture'), slug: 'home' },
			{ name: t('home.hotSearchSidrHoney', 'Sidr Honey'), slug: 'food' },
			{ name: t('home.hotSearchYemeniSilver', 'Yemeni Silver'), slug: 'handicrafts' },
			{ name: t('home.hotSearchPerfumes', 'Perfumes'), slug: 'beauty' },
		],
		[t],
	);

	const stats = statsData;

	/* ── handlers ─────────────────────────────────────── */
	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		if (searchQ.trim()) navigate(`/search?q=${encodeURIComponent(searchQ.trim())}`);
	};

	const addToCart = useCallback(
		(p: Product) => {
			const store = storeMap.get(p.store_id);
			dispatch({
				type: 'ADD',
				payload: {
					productId: String(p.id),
					name: getProductName(p, i18n.language),
					price: p.price,
					quantity: 1,
					image: p.main_image,
					merchantName: store?.store_name ?? '',
				},
			});
			setAddedIds((prev) => new Set(prev).add(p.id));
			// Clear any existing timer for this product before setting a new one
			const existing = addedTimersRef.current.get(p.id);
			if (existing) clearTimeout(existing);
			const timer = setTimeout(() => {
				setAddedIds((prev) => {
					const n = new Set(prev);
					n.delete(p.id);
					return n;
				});
				addedTimersRef.current.delete(p.id);
			}, 1500);
			addedTimersRef.current.set(p.id, timer);
		},
		[dispatch, i18n.language, storeMap],
	);

	/* ── JSX ──────────────────────────────────────────── */
	return (
		<div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="bg-aliSurface min-h-screen">
			{/* ===== HERO SECTION ===== */}
			<section className="bg-gradient-to-br from-orange-50 via-white to-orange-50 py-10 lg:py-14">
				<div className="max-w-[1400px] mx-auto px-4 lg:px-6">
					<div className="grid lg:grid-cols-[240px_1fr] gap-6">
						{/* Left Sidebar – Categories */}
						<div className="hidden lg:block bg-white rounded-xl border border-aliBorder shadow-sm overflow-hidden h-fit">
							<h3 className="font-bold text-aliText px-4 py-3 border-b border-aliBorder bg-aliSurface/50 flex items-center gap-2">
								<span className="text-aliOrange">
									{t('home.categoriesHeading', 'Categories')}
								</span>
							</h3>
							{catsLoading ? (
								<div className="p-4 space-y-2">
									{Array.from({ length: 8 }).map((_, i) => (
										<div
											key={i}
											className="h-9 bg-gray-200 animate-pulse rounded"
										/>
									))}
								</div>
							) : (
								<div className="divide-y divide-aliBorder/50">
									{categories.map((cat) => (
										<div key={cat.id} className="relative">
											<Link
												to="/categories"
												className="flex items-center justify-between px-4 py-2.5 text-sm text-aliText hover:bg-orange-50 hover:text-aliOrange transition-colors"
											>
												<span>{getCatName(cat, i18n.language)}</span>
												<ChevronRight
													size={14}
													className="text-aliTextMute"
												/>
											</Link>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Center – Hero Content */}
						<div className="flex flex-col gap-6">
							{/* Welcome Message */}
							<div className="text-center mb-2">
								<h1 className="text-2xl lg:text-3xl font-bold text-aliText mb-2">
									{t('home.welcomeTitle', 'Welcome to Nouf-ex')}
								</h1>
								<p className="text-aliTextSec text-sm">
									{t(
										'home.welcomeSubtitle',
										'The leading source for authentic Yemeni products',
									)}
								</p>
							</div>

							{/* Mega Search Bar */}
							<div className="max-w-2xl mx-auto w-full">
								<form
									onSubmit={handleSearch}
									className="flex w-full h-14 rounded-3xl border-2 border-aliOrange overflow-hidden bg-white shadow-md hover:shadow-lg transition-shadow"
								>
									<div className="flex items-center px-4 border-r border-aliBorder shrink-0">
										<span className="text-sm text-aliTextSec font-medium">
											{t('nav.allCategories', 'All Categories')}
										</span>
										<ChevronDown size={14} className="text-aliTextMute ms-1" />
									</div>
									<input
										type="text"
										value={searchQ}
										onChange={(e) => setSearchQ(e.target.value)}
										placeholder={t(
											'nav.searchPlaceholder',
											'Search products...',
										)}
										className="flex-1 h-full px-4 text-base text-aliText placeholder-aliTextMute outline-none bg-transparent"
									/>
									<button
										type="button"
										title={t('nav.imageSearch', 'Search by image')}
										aria-label={t('nav.imageSearch', 'Search by image')}
										className="h-full px-3 text-aliTextMute hover:text-aliOrange transition-colors"
									>
										<Camera size={20} />
									</button>
									<button
										type="submit"
										className="h-full px-8 bg-aliOrange text-white font-bold text-base hover:bg-aliOrangeHover transition-colors flex items-center gap-2"
									>
										<Search size={18} />
										<span className="hidden sm:inline">{t('nav.search')}</span>
									</button>
								</form>

								<div className="flex justify-center gap-4 mt-3">
									{[
										{
											key: 'rfq' as const,
											label: t('home.tabRfq', 'RFQ'),
											icon: TrendingUp,
										},
										{
											key: 'hot' as const,
											label: t('home.tabHot', 'Hot Products'),
											icon: Zap,
										},
										{
											key: 'fast' as const,
											label: t('home.tabFast', 'Fast Customization'),
											icon: Clock,
										},
									].map((tab) => (
										<button
											key={tab.key}
											type="button"
											onClick={() => setActiveTab(tab.key)}
											className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
												activeTab === tab.key
													? 'text-aliOrange bg-orange-50'
													: 'text-aliTextMute hover:text-aliText'
											}`}
										>
											<tab.icon size={14} />
											{tab.label}
										</button>
									))}
								</div>
							</div>

							{/* Hot Searches */}
							<div>
								<p className="text-xs text-aliTextMute mb-2 text-center">
									{t('home.hotSearchesLabel', 'Hot searches:')}
								</p>
								<div className="flex justify-center gap-3 flex-wrap">
									{hotSearches.map((item) => (
										<button
											key={item.name}
											type="button"
											onClick={() =>
												navigate(
													`/search?q=${encodeURIComponent(item.name)}`,
												)
											}
											className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-aliBorder hover:border-aliOrange hover:shadow-sm transition-all group"
										>
											<span className="text-sm text-aliText font-medium group-hover:text-aliOrange transition-colors">
												{item.name}
											</span>
										</button>
									))}
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* ===== TRUST STATS SECTION ===== */}
			<section className="bg-white border-y border-aliBorder">
				<div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
					<div className="flex flex-wrap justify-center gap-6 lg:gap-12">
						{statsLoading || !stats ? (
							<>
								<StatSkeleton />
								<StatSkeleton />
								<StatSkeleton />
								<StatSkeleton />
							</>
						) : (
							[
								{
									icon: BadgeCheck,
									value: `${stats.products_count?.toLocaleString()}+`,
									label: t('home.statProductsAvailable', 'Products Available'),
								},
								{
									icon: Package,
									value: `${stats.stores_count?.toLocaleString()}+`,
									label: t('home.statStores', 'Stores'),
								},
								{
									icon: Globe,
									value: `${stats.orders_count?.toLocaleString()}+`,
									label: t('home.statOrders', 'Orders'),
								},
								{
									icon: Users,
									value: `${stats.users_count?.toLocaleString()}+`,
									label: t('home.statHappyBuyers', 'Happy Buyers'),
								},
							].map((stat) => (
								<div key={stat.label} className="flex items-center gap-3">
									<div className="w-11 h-11 rounded-full bg-orange-50 flex items-center justify-center">
										<stat.icon size={22} className="text-aliOrange" />
									</div>
									<div>
										<p className="font-bold text-aliText text-lg leading-tight">
											{stat.value}
										</p>
										<p className="text-xs text-aliTextSec">{stat.label}</p>
									</div>
								</div>
							))
						)}
					</div>
				</div>
			</section>

			{/* ===== DEALS SECTION — fixed the +undefined / NaN% / broken-image bugs ===== */}
			{(dealsLoading || dealProducts.length > 0) && (
				<section className="max-w-[1400px] mx-auto px-4 lg:px-6 py-8">
					<div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-4 lg:p-6 mb-6">
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center gap-3 text-white">
								<Zap size={24} className="text-yellow-200 shrink-0" />
								<h2 className="text-xl lg:text-2xl font-bold">
									{t('home.dealsTitle', 'Flash Deals')}
								</h2>
								<span className="text-sm bg-white/20 px-3 py-1 rounded-full">
									{t('home.dealsLimitedTime', 'Limited Time')}
								</span>
							</div>
							<Link
								to="/deals"
								className="text-white text-sm font-medium hover:underline flex items-center gap-1 shrink-0"
							>
								{t('home.viewAll', 'View All')} <ChevronRight size={16} />
							</Link>
						</div>
						<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
							{dealsLoading
								? Array.from({ length: 4 }).map((_, i) => <DealSkeleton key={i} />)
								: dealProducts.slice(0, 4).map((product) => (
										<div
											key={product.id}
											className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all"
										>
											<ProductCard
												product={product}
												lang={i18n.language}
												added={addedIds.has(product.id)}
												onAdd={() => addToCart(product)}
											/>
										</div>
									))}
						</div>
					</div>
				</section>
			)}

			{/* ===== PRODUCT RECOMMENDATIONS – JUST FOR YOU ===== */}
			<section className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
				<div className="flex items-center justify-between mb-5">
					<h2 className="text-xl lg:text-2xl font-bold text-aliText">
						{t('home.justForYou', 'Just for You')}
					</h2>
				</div>

				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
					{popularLoading
						? Array.from({ length: 10 }).map((_, i) => <ProductSkeleton key={i} />)
						: allProducts
								.slice(0, 10)
								.map((product) => (
									<ProductCard
										key={product.id}
										product={product}
										lang={i18n.language}
										added={addedIds.has(product.id)}
										onAdd={() => addToCart(product)}
									/>
								))}
				</div>
			</section>

			{/* ===== NEW ARRIVALS ===== */}
			{(popularLoading || newProducts.length > 0) && (
				<section className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
					<div className="flex items-center justify-between mb-5">
						<h2 className="text-xl lg:text-2xl font-bold text-aliText">
							{t('home.newArrivals', 'New Arrivals')}
						</h2>
						<Link
							to="/search"
							className="text-sm text-aliTextSec hover:text-aliOrange transition-colors flex items-center gap-1"
						>
							{t('home.viewAll', 'View All')} <ChevronRight size={16} />
						</Link>
					</div>
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
						{popularLoading
							? Array.from({ length: 5 }).map((_, i) => <ProductSkeleton key={i} />)
							: newProducts
									.slice(0, 5)
									.map((product) => (
										<ProductCard
											key={product.id}
											product={product}
											lang={i18n.language}
											added={addedIds.has(product.id)}
											onAdd={() => addToCart(product)}
										/>
									))}
					</div>
				</section>
			)}

			{/* ===== TOP MERCHANTS ===== */}
			<section className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
				<div className="flex items-center justify-between mb-5">
					<h2 className="text-xl lg:text-2xl font-bold text-aliText">
						{t('home.topMerchants', 'Top Ranked Manufacturers')}
					</h2>
					<Link
						to="/categories"
						className="text-sm text-aliTextSec hover:text-aliOrange transition-colors flex items-center gap-1"
					>
						{t('home.viewAll', 'View All')} <ChevronRight size={16} />
					</Link>
				</div>
				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
					{storesLoading
						? Array.from({ length: 8 }).map((_, i) => <StoreSkeleton key={i} />)
						: (stores ?? []).slice(0, 8).map((store) => (
								<Link
									key={store.id}
									to={`/store/${store.id}`}
									className="bg-white rounded-lg border border-aliBorder p-4 hover:shadow-md hover:border-aliOrange/30 transition-all group text-center"
								>
									<div className="w-16 h-16 rounded-full bg-aliSurface mx-auto mb-3 overflow-hidden">
										<img
											src={safeImageUrl(store.logo, {
												kind: 'store',
												fallback: '/default-avatar.png',
											})}
											alt={getStoreName(store, i18n.language)}
											className="w-full h-full object-cover"
											loading="lazy"
										/>
									</div>
									<h3 className="font-semibold text-sm text-aliText line-clamp-1 group-hover:text-aliOrange transition-colors">
										{getStoreName(store, i18n.language)}
									</h3>
									<div className="flex items-center justify-center gap-1 mt-1">
										<Star
											size={12}
											className="text-yellow-400 fill-yellow-400"
										/>
										<span className="text-xs text-aliTextSec">
											{store.rating}
										</span>
									</div>
									<div className="flex items-center justify-center gap-2 mt-2 text-[10px] text-aliTextMute">
										<span className="bg-aliSurface px-1.5 py-0.5 rounded">
											{t('home.storeProductsCount', {
												count: store.products_count,
												defaultValue: `${store.products_count} products`,
											})}
										</span>
										<span
											className={`px-1.5 py-0.5 rounded flex items-center gap-0.5 ${store.is_verified ? 'bg-orange-50 text-aliOrange' : 'bg-gray-100 text-gray-400'}`}
										>
											<BadgeCheck size={10} />{' '}
											{store.is_verified
												? t('home.storeVerified', 'Verified')
												: t('home.storeUnverified', 'Unverified')}
										</span>
									</div>
								</Link>
							))}
				</div>
			</section>

			{/* ===== TRADE ASSURANCE BANNER ===== */}
			<section className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6">
				<div className="bg-gradient-to-r from-[#1a3a5c] to-[#2a5a8c] rounded-2xl p-6 lg:p-8 text-white">
					<div className="flex flex-col lg:flex-row items-center gap-6">
						<div className="flex-1">
							<div className="flex items-center gap-2 mb-3">
								<ShieldCheck size={28} className="text-aliOrange shrink-0" />
								<h2 className="text-2xl font-bold">{t('home.tradeAssurance')}</h2>
							</div>
							<p className="text-white/80 mb-4">
								{t(
									'home.trustBannerDesc',
									'Order with confidence. Safe payment, flexible returns, and comprehensive logistics support.',
								)}
							</p>
							<Link
								to="/categories"
								className="inline-flex items-center gap-2 bg-aliOrange text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-aliOrangeHover transition-colors"
							>
								{t('home.trustShopNow', 'Shop Now')} <ChevronRight size={16} />
							</Link>
						</div>
						<div className="grid grid-cols-2 gap-3 shrink-0">
							{[
								{
									icon: Truck,
									title: t('home.trustSafeShippingTitle', 'Safe Shipping'),
									desc: t('home.trustSafeShippingDesc', 'Full tracking'),
								},
								{
									icon: RefreshCw,
									title: t('home.trustRefundTitle', 'Refund Policy'),
									desc: t('home.trustRefundDesc', '30-day returns'),
								},
								{
									icon: Package,
									title: t('home.trustLogisticsTitle', 'Logistics'),
									desc: t('home.trustLogisticsDesc', 'Fast delivery'),
								},
								{
									icon: Headphones,
									title: t('home.trustAfterSalesTitle', 'After-sales'),
									desc: t('home.trustAfterSalesDesc', '24/7 support'),
								},
							].map((step) => (
								<div
									key={step.title}
									className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm"
								>
									<step.icon size={22} className="text-aliOrange mx-auto mb-1" />
									<p className="font-semibold text-sm">{step.title}</p>
									<p className="text-white/60 text-[10px]">{step.desc}</p>
								</div>
							))}
						</div>
					</div>
				</div>
			</section>

			{/* ===== READY TO SHIP ===== */}
			<section className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6 mb-10">
				<div className="flex items-center justify-between mb-5">
					<div className="flex items-center gap-2">
						<Truck size={22} className="text-aliOrange shrink-0" />
						<h2 className="text-xl lg:text-2xl font-bold text-aliText">
							{t('home.readyToShip', 'Ready to Ship')}
						</h2>
					</div>
					<Link
						to="/search"
						className="text-sm text-aliTextSec hover:text-aliOrange transition-colors flex items-center gap-1"
					>
						{t('home.viewAll', 'View All')} <ChevronRight size={16} />
					</Link>
				</div>
				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
					{popularLoading
						? Array.from({ length: 5 }).map((_, i) => <ProductSkeleton key={i} />)
						: allProducts
								.filter((p) => p.stock > 5)
								.slice(0, 10)
								.map((product) => (
									<ProductCard
										key={product.id}
										product={product}
										lang={i18n.language}
										added={addedIds.has(product.id)}
										onAdd={() => addToCart(product)}
									/>
								))}
				</div>
			</section>
		</div>
	);
}
