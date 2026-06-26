import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useCart } from '../../context/CartContext';
import { useHomeStats, useProducts, useStores, useCategories } from '../../hooks/useApi';
import type { Product, Store, Category } from '../../hooks/useApi';
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
		? s.store_name_en || s.store_name
		: lang === 'zh'
			? s.store_name_zh || s.store_name
			: s.store_name;

const getCatName = (c: Category, lang: string) =>
	lang === 'en' ? c.name_en : lang === 'zh' ? c.name_zh : c.name_ar;

const formatPrice = (price: number) =>
	price >= 1000 ? `${(price / 1000).toFixed(1)}K` : price.toString();

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

/* ─── main component ───────────────────────────────────── */

export default function Home() {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const { dispatch } = useCart();
	const [searchQ, setSearchQ] = useState('');
	const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
	const [activeTab, setActiveTab] = useState<'rfq' | 'hot' | 'fast'>('hot');
	const [hoveredCat, setHoveredCat] = useState<number | null>(null);

	/* ── API data ─────────────────────────────────────── */
	const { data: statsData, loading: statsLoading } = useHomeStats();
	const { data: popularResp, loading: popularLoading } = useProducts({
		limit: 24,
		sort: 'popular',
	});
	const { data: dealsResp, loading: dealsLoading } = useProducts({ limit: 4, sort: 'popular' });
	const { data: stores, loading: storesLoading } = useStores();
	const { data: catsFlat, loading: catsLoading } = useCategories();

	/* ── derived arrays ───────────────────────────────── */
	const allProducts = popularResp?.products ?? [];
	const dealProducts = (dealsResp?.products ?? []).filter((p) => p.deal_discount > 0);
	const newProducts = (popularResp?.products ?? []).filter((p) => p.badges?.includes('new'));

	/* ── category tree ────────────────────────────────── */
	const categories = useMemo(() => {
		if (!catsFlat) return [];
		const parents = catsFlat.filter((c) => c.parent_id === null);
		return parents.map((p) => ({
			...p,
			subcategories: catsFlat.filter((c) => c.parent_id === p.id),
		}));
	}, [catsFlat]);

	/* ── store lookup map ─────────────────────────────── */
	const storeMap = useMemo(() => {
		const map = new Map<number, Store>();
		stores?.forEach((s) => map.set(s.id, s));
		return map;
	}, [stores]);

	/* ── actions ──────────────────────────────────────── */
	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		if (searchQ.trim()) navigate(`/search?q=${encodeURIComponent(searchQ.trim())}`);
	};

	const addToCart = (p: Product) => {
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
		setTimeout(
			() =>
				setAddedIds((prev) => {
					const n = new Set(prev);
					n.delete(p.id);
					return n;
				}),
			1500,
		);
	};

	/* ── static helpers ───────────────────────────────── */
	// M16 fix: memoise so the array isn't recreated on every render of the home page.
	const hotSearches = useMemo(
		() => [
			{
				name: t('home.hotSearchSmartphones', 'Smartphones'),
				img: '/category-electronics.jpg',
			},
			{
				name: t('home.hotSearchYemeniCoffee', 'Yemeni Coffee'),
				img: '/category-food.jpg',
			},
			{
				name: t('home.hotSearchFurniture', 'Traditional Furniture'),
				img: '/category-home.jpg',
			},
			{ name: t('home.hotSearchSidrHoney', 'Sidr Honey'), img: '/category-food.jpg' },
			{
				name: t('home.hotSearchYemeniSilver', 'Yemeni Silver'),
				img: '/category-handicrafts.jpg',
			},
			{ name: t('home.hotSearchPerfumes', 'Perfumes'), img: '/category-beauty.jpg' },
		],
		[t],
	);

	const stats = statsData;

	return (
		<div className="bg-aliSurface min-h-screen">
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
										<div
											key={cat.id}
											className="relative"
											onMouseEnter={() => setHoveredCat(cat.id)}
											onMouseLeave={() => setHoveredCat(null)}
										>
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
											{/* Subcategory flyout */}
											{hoveredCat === cat.id &&
												'subcategories' in cat &&
												(cat as Category & { subcategories: Category[] })
													.subcategories.length > 0 && (
													<div className="absolute top-0 right-full mr-0 w-48 bg-white rounded-xl shadow-lg border border-aliBorder py-2 z-50">
														{(
															cat as Category & {
																subcategories: Category[];
															}
														).subcategories.map((sub) => (
															<Link
																key={sub.id}
																to="/categories"
																className="block px-4 py-2 text-sm text-aliText hover:bg-orange-50 hover:text-aliOrange transition-colors"
															>
																{getCatName(sub, i18n.language)}
															</Link>
														))}
													</div>
												)}
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
										<ChevronDown size={14} className="text-aliTextMute ml-1" />
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
										dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
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

								{/* Search Tabs */}
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
											onClick={() =>
												navigate(
													`/search?q=${encodeURIComponent(item.name)}`,
												)
											}
											className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-aliBorder hover:border-aliOrange hover:shadow-sm transition-all group"
										>
											<div className="w-10 h-10 rounded-md bg-aliSurface overflow-hidden shrink-0">
												<img
													src={item.img}
													alt={item.name}
													className="w-full h-full object-cover group-hover:scale-110 transition-transform"
												/>
											</div>
											<span className="text-sm text-aliText font-medium">
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

			{/* ===== DEALS SECTION ===== */}
			{(dealsLoading || dealProducts.length > 0) && (
				<section className="max-w-[1400px] mx-auto px-4 lg:px-6 py-8">
					<div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-4 lg:p-6 mb-6">
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center gap-3 text-white">
								<Zap size={24} className="text-yellow-200" />
								<h2 className="text-xl lg:text-2xl font-bold">
									{t('home.dealsTitle', 'Flash Deals')}
								</h2>
								<span className="text-sm bg-white/20 px-3 py-1 rounded-full">
									{t('home.dealsLimitedTime', 'Limited Time')}
								</span>
							</div>
							<Link
								to="/deals"
								className="text-white text-sm font-medium hover:underline flex items-center gap-1"
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
											className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group"
										>
											<Link
												to={`/product/${product.id}`}
												className="block relative aspect-square overflow-hidden bg-aliSurface"
											>
												<img
													src={product.main_image}
													alt={getProductName(product, i18n.language)}
													className="w-full h-full object-cover group-hover:scale-105 transition-transform"
												/>
												<span className="absolute top-2 left-2 bg-red-500 text-white font-bold px-2 py-0.5 rounded text-xs">
													-{product.deal_discount}%
												</span>
											</Link>
											<div className="p-3">
												<Link to={`/product/${product.id}`}>
													<h3 className="text-sm text-aliText line-clamp-2 hover:text-aliOrange transition-colors">
														{getProductName(product, i18n.language)}
													</h3>
												</Link>
												<div className="flex items-center gap-2 mt-1.5">
													<span className="text-aliOrange font-bold">
														{formatPrice(product.price)}
													</span>
													{product.original_price > 0 && (
														<span className="text-aliTextMute text-xs line-through">
															{formatPrice(product.original_price)}
														</span>
													)}
													<span className="text-aliTextMute text-xs">
														{t('product.currency')}
													</span>
												</div>
											</div>
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
					<div className="flex items-center gap-2">
						<button className="text-sm text-aliTextSec hover:text-aliOrange transition-colors flex items-center gap-1">
							{t('home.bestsellersTab', 'Bestsellers')}
						</button>
						<span className="text-aliBorder">|</span>
						<button className="text-sm text-aliTextSec hover:text-aliOrange transition-colors">
							{t('home.newestTab', 'Newest')}
						</button>
					</div>
				</div>

				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
					{popularLoading
						? Array.from({ length: 10 }).map((_, i) => <ProductSkeleton key={i} />)
						: allProducts.map((product) => {
								const store = storeMap.get(product.store_id);
								return (
									<div
										key={product.id}
										className="bg-white rounded-lg border border-aliBorder overflow-hidden hover:shadow-md hover:border-aliOrange/30 transition-all group"
									>
										<Link
											to={`/product/${product.id}`}
											className="block relative aspect-square overflow-hidden bg-aliSurface"
										>
											<img
												src={product.main_image}
												alt={getProductName(product, i18n.language)}
												className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
											/>
											{product.badges?.includes('bestseller') && (
												<span className="absolute top-2 right-2 bg-aliOrange text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
													{i18n.language === 'ar'
														? 'الأكثر مبيعاً'
														: 'Hot'}
												</span>
											)}
											{product.badges?.includes('new') && (
												<span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
													{i18n.language === 'ar' ? 'جديد' : 'New'}
												</span>
											)}
										</Link>
										<div className="p-2.5">
											<Link to={`/product/${product.id}`}>
												<h3 className="text-sm text-aliText line-clamp-2 leading-snug hover:text-aliOrange transition-colors min-h-[2.5em]">
													{getProductName(product, i18n.language)}
												</h3>
											</Link>
											<div className="mt-1.5">
												<span className="text-aliOrange font-bold text-base">
													{product.price.toLocaleString()}
												</span>
												<span className="text-aliTextMute text-xs ml-1">
													{t('product.currency')}
												</span>
												{product.original_price > 0 && (
													<span className="text-aliTextMute text-xs line-through ml-1">
														{product.original_price.toLocaleString()}
													</span>
												)}
											</div>
											<div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
												<span className="text-[10px] bg-aliSurface text-aliTextSec px-1.5 py-0.5 rounded">
													{t('home.moqBadge', 'MOQ: {count} pcs', {
														count: Math.max(
															1,
															Math.floor(product.stock / 5),
														),
													})}
												</span>
												<span className="text-[10px] text-aliTextMute">
													{product.sold_count}{' '}
													{t('home.soldSuffix', 'sold')}
												</span>
											</div>
											<div className="flex items-center justify-between mt-2 pt-2 border-t border-aliBorder/50">
												<div className="flex items-center gap-1">
													<span className="text-xs text-aliTextMute">
														{store
															? getStoreName(store, i18n.language)
															: ''}
													</span>
													<span className="text-[10px] bg-orange-100 text-aliOrange px-1 rounded font-medium">
														{store
															? `${store.since_year || '1'}yr`
															: '1yr'}
													</span>
												</div>
												<span className="text-[10px] text-aliTextMute flex items-center gap-0.5">
													<Globe size={10} /> YE
												</span>
											</div>
											<button
												onClick={() => addToCart(product)}
												className={`w-full mt-2 h-8 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
													addedIds.has(product.id)
														? 'bg-green-500 text-white'
														: 'bg-aliOrange text-white hover:bg-aliOrangeHover'
												}`}
											>
												<ShoppingCart size={12} />
												{addedIds.has(product.id)
													? i18n.language === 'ar'
														? 'تمت الإضافة'
														: 'Added!'
													: i18n.language === 'ar'
														? 'أضف للسلة'
														: 'Add to Cart'}
											</button>
										</div>
									</div>
								);
							})}
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
							: newProducts.map((product) => (
									<div
										key={product.id}
										className="bg-white rounded-lg border border-aliBorder overflow-hidden hover:shadow-md hover:border-aliOrange/30 transition-all group"
									>
										<Link
											to={`/product/${product.id}`}
											className="block relative aspect-square overflow-hidden bg-aliSurface"
										>
											<img
												src={product.main_image}
												alt={getProductName(product, i18n.language)}
												className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
											/>
											<span className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
												{t('home.newBadge', 'New')}
											</span>
										</Link>
										<div className="p-2.5">
											<Link to={`/product/${product.id}`}>
												<h3 className="text-sm text-aliText line-clamp-2 hover:text-aliOrange transition-colors">
													{getProductName(product, i18n.language)}
												</h3>
											</Link>
											<div className="mt-1.5">
												<span className="text-aliOrange font-bold text-base">
													{product.price.toLocaleString()}
												</span>
												<span className="text-aliTextMute text-xs ml-1">
													{t('product.currency')}
												</span>
											</div>
											<button
												onClick={() => addToCart(product)}
												className={`w-full mt-2 h-8 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
													addedIds.has(product.id)
														? 'bg-green-500 text-white'
														: 'bg-aliOrange text-white hover:bg-aliOrangeHover'
												}`}
											>
												<ShoppingCart size={12} />
												{addedIds.has(product.id)
													? i18n.language === 'ar'
														? 'تمت الإضافة'
														: 'Added!'
													: i18n.language === 'ar'
														? 'أضف للسلة'
														: 'Add to Cart'}
											</button>
										</div>
									</div>
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
											src={store.logo || '/default-avatar.png'}
											alt={getStoreName(store, i18n.language)}
											className="w-full h-full object-cover"
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
											{t('home.storeProductsCount', '{count} products', {
												count: store.products_count,
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
								<ShieldCheck size={28} className="text-aliOrange" />
								<h2 className="text-2xl font-bold">
									{i18n.language === 'ar' ? 'ضمان التجارة' : 'Trade Assurance'}
								</h2>
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
						<Truck size={22} className="text-aliOrange" />
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
									<div
										key={product.id}
										className="bg-white rounded-lg border border-aliBorder overflow-hidden hover:shadow-md hover:border-aliOrange/30 transition-all group"
									>
										<Link
											to={`/product/${product.id}`}
											className="block relative aspect-square overflow-hidden bg-aliSurface"
										>
											<img
												src={product.main_image}
												alt={getProductName(product, i18n.language)}
												className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
											/>
											<span className="absolute bottom-2 left-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
												<Truck size={10} /> {t('home.readyBadge', 'Ready')}
											</span>
										</Link>
										<div className="p-2.5">
											<Link to={`/product/${product.id}`}>
												<h3 className="text-sm text-aliText line-clamp-2 hover:text-aliOrange transition-colors">
													{getProductName(product, i18n.language)}
												</h3>
											</Link>
											<div className="mt-1.5">
												<span className="text-aliOrange font-bold text-base">
													{product.price.toLocaleString()}
												</span>
												<span className="text-aliTextMute text-xs ml-1">
													{t('product.currency')}
												</span>
											</div>
											<div className="text-[10px] text-aliTextMute mt-1">
												{product.stock} {t('home.inStock', 'in stock')} -{' '}
												{t('home.moqBadge', 'MOQ: {count} pcs', {
													count: Math.max(
														1,
														Math.floor(product.stock / 5),
													),
												})}{' '}
												pcs
											</div>
										</div>
									</div>
								))}
				</div>
			</section>
		</div>
	);
}
