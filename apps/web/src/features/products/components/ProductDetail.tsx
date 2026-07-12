import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import ToastContainer from '@/components/Toast';
import type { Toast } from '@/components/Toast';
import { useCart } from '@/features/cart/context/CartContext';
import { useProduct, useProducts, useReviews } from '@/hooks/useApi';
import type { Product, Review, Store as StoreType } from '@/hooks/useApi';
import { safeImageUrl } from '@/lib/utils/safe-format';
import {
	Award,
	BadgeCheck,
	Calendar,
	ChevronRight,
	Clock,
	Heart,
	MapPin,
	MessageCircle,
	Minus,
	Package,
	Plus,
	RefreshCw,
	ShieldCheck,
	ShoppingCart,
	Star,
	Store,
	ThumbsUp,
	X,
	ZoomIn,
} from 'lucide-react';
import styles from './ProductDetail.module.css';

/* ─── Main component ─────────────────────────────────────── */

export default function ProductDetail() {
	/* ── hooks setup ──────────────────────────────────── */
	const { id } = useParams<{ id: string }>();
	const { t, i18n } = useTranslation();
	const { dispatch } = useCart();

	/* ── state ────────────────────────────────────────── */
	const [qty, setQty] = useState(1);
	const [added, setAdded] = useState(false);
	const [activeTab, setActiveTab] = useState<'details' | 'company' | 'reviews'>('details');
	const [selectedImage, setSelectedImage] = useState(0);
	const [lightboxOpen, setLightboxOpen] = useState(false);
	const [selectedColor, setSelectedColor] = useState<string | null>(null);
	const [selectedSize, setSelectedSize] = useState<string | null>(null);
	const [toasts, setToasts] = useState<Toast[]>([]);

	/* ── derived constants ───────────────────────────── */
	const isRTL = i18n.language === 'ar';
	const lang = i18n.language;

	/* ── effects: side-effects ───────────────────────── */
	// M14 fix: Escape closes the lightbox.
	useEffect(() => {
		if (!lightboxOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setLightboxOpen(false);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [lightboxOpen]);

	/* ── effects: API data ────────────────────────────── */
	// M7 fix: derive numeric ID from the URL param before any other uses.
	const numericId = Number(id);

	// M7 fix: declare validation BEFORE any other uses.
	const isValidId = Number.isInteger(numericId) && numericId > 0;

	// API hooks — must run BEFORE any early return so React's rule-of-hooks is satisfied.
	const {
		data: productData,
		loading: productLoading,
		error: productError,
	} = useProduct(isValidId ? numericId : 0);
	const { data: reviewsData, loading: reviewsLoading } = useReviews(isValidId ? numericId : 0);
	const { data: relatedData } = useProducts(
		productData?.store_id ? { store: productData.store_id, limit: 5 } : undefined,
	);

	/* ── effects: derived data ────────────────────────── */
	const product = productData as (Product & { store?: StoreType; reviews?: Review[] }) | null;
	// Stabilise the fallback `[]` so the ratingDistribution memo doesn't rebuild every render.
	const reviews = useMemo<Review[]>(() => reviewsData ?? [], [reviewsData]);
	const related = useMemo(
		() => (relatedData?.products ?? []).filter((p) => p.id !== numericId).slice(0, 4),
		[relatedData, numericId],
	);
	const store = product?.store;

	// M15 fix: precompute the rating histogram once per `reviews` change instead of
	// filtering the array 5× per render. Must live BEFORE the early return so the
	// rules-of-hooks invariant holds.
	const ratingDistribution = useMemo(() => {
		const denom = Math.max(reviews.length, 1);
		return [5, 4, 3, 2, 1].map((stars) => ({
			stars,
			pct: Math.round((reviews.filter((r) => r.rating === stars).length / denom) * 100),
		}));
	}, [reviews]);

	/* ── handlers ─────────────────────────────────────── */
	const addToast = (message: string, type: Toast['type'] = 'info') => {
		const tid = Math.random().toString(36).substring(2, 9);
		setToasts((prev) => [...prev, { id: tid, message, type }]);
		setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== tid)), 4000);
	};

	const getName = (p: { name_ar: string; name_en: string; name_zh: string }) =>
		lang === 'en' ? p.name_en : lang === 'zh' ? p.name_zh : p.name_ar;
	const getDesc = (p: {
		description: string;
		description_en: string;
		description_zh: string;
	}) => {
		return lang === 'en' ? p.description_en : lang === 'zh' ? p.description_zh : p.description;
	};
	const getStoreName = (s?: {
		store_name: string;
		store_name_en: string;
		store_name_zh: string;
	}) => {
		if (!s) return '';
		return lang === 'en' ? s.store_name_en : lang === 'zh' ? s.store_name_zh : s.store_name;
	};

	const handleAddToCart = () => {
		if (!product) return;
		const moq = product.moq ?? 1;
		if (qty < moq) {
			addToast(
				t('product.moqNotMet', 'Minimum order quantity is {{moq}}', { moq }),
				'warning',
			);
			return;
		}
		dispatch({
			type: 'ADD',
			payload: {
				productId: String(product.id),
				name: product.name_ar,
				price: product.price,
				quantity: qty,
				image: product.main_image || '',
				merchantName: store?.store_name || '',
			},
		});
		setAdded(true);
		addToast(t('product.addedToCart', 'Added to cart!'), 'success');
		setTimeout(() => setAdded(false), 2000);
	};

	/* ── JSX: invalid ID ──────────────────────────────── */
	// M7 fix: bail with a friendly message on invalid IDs.
	if (!isValidId) {
		return (
			<div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
				<div className="text-6xl font-bold text-aliOrange mb-4">404</div>
				<h2 className="text-xl font-semibold text-aliText mb-2">
					{t('product.invalidId', 'Invalid product ID')}
				</h2>
				<p className="text-aliTextSec mb-6">
					{t('product.invalidIdMessage', 'The product ID')}{' '}
					<code className="bg-aliSurface px-1.5 py-0.5 rounded">{String(id)}</code>{' '}
					{t('product.invalidIdSuffix', 'is not valid.')}
				</p>
				<Link
					to="/"
					className="px-5 py-2 bg-aliOrange text-white rounded-lg hover:bg-aliOrangeHover"
				>
					{t('common.back')}
				</Link>
			</div>
		);
	}

	/* ── JSX: loading ─────────────────────────────────── */
	if (productLoading) {
		return (
			<div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
				<div className="w-10 h-10 border-3 border-[#FF6A00] border-t-transparent rounded-full animate-spin mb-4" />
				<p className="text-[#666]">{t('product.loading', 'Loading...')}</p>
			</div>
		);
	}

	/* ── JSX: error / not found ───────────────────────── */
	if (productError || !product) {
		return (
			<div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
				<div className="w-24 h-24 bg-[#F7F8FA] rounded-full flex items-center justify-center mb-4">
					<ShoppingCart size={40} className="text-[#999]" />
				</div>
				<h2 className="text-xl font-bold text-[#333] mb-2">{t('common.noResults')}</h2>
				<p className="text-sm text-[#999] mb-4">
					{productError || t('product.notFound', 'Product not found')}
				</p>
				<Link
					to="/"
					className="px-6 py-2 bg-[#FF6A00] text-white rounded font-semibold hover:bg-[#E55F00]"
				>
					{t('common.back')}
				</Link>
			</div>
		);
	}

	/* ── derived (after product is loaded) ────────────── */
	// Build image list from API data
	const allImages = product.main_image ? [product.main_image] : ['/product-placeholder.jpg'];
	const discount = product.original_price
		? Math.round((1 - product.price / product.original_price) * 100)
		: 0;
	// Only show colors/sizes if the product actually has them
	const colors = product.colors?.length ? product.colors : [];
	const sizes = product.sizes?.length ? product.sizes : [];
	// Price range for Alibaba-style tiered pricing display
	const minPrice = product.price;
	const maxPrice = Math.round(product.price * 1.08);

	/* ── JSX: main ────────────────────────────────────── */
	return (
		<div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-4" dir={isRTL ? 'rtl' : 'ltr'}>
			<ToastContainer
				toasts={toasts}
				onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
			/>

			{/* Breadcrumb */}
			<nav className="flex items-center gap-2 text-sm mb-4 text-[#666]">
				<Link to="/" className="hover:text-[#FF6A00]">
					{t('nav.home')}
				</Link>
				<ChevronRight size={14} className={isRTL ? 'rotate-180' : ''} />
				<Link to="/categories" className="hover:text-[#FF6A00] capitalize">
					{t('product.breadcrumbProducts', 'Products')}
				</Link>
				<ChevronRight size={14} className={isRTL ? 'rotate-180' : ''} />
				<span className="text-[#333] font-medium truncate max-w-[200px]">
					{getName(product)}
				</span>
			</nav>

			{/* ─── Main Product Section ─── */}
			<div className="grid lg:grid-cols-12 gap-6">
				{/* Left: Image Gallery */}
				<div className="lg:col-span-5 space-y-3">
					<div className="bg-white rounded border border-[#E5E5E5] overflow-hidden relative group">
						<div
							className="aspect-square relative cursor-zoom-in"
							onClick={() => setLightboxOpen(true)}
						>
							<img
								src={safeImageUrl(allImages[selectedImage], { kind: 'product' })}
								alt={getName(product)}
								className="w-full h-full object-cover"
								referrerPolicy="no-referrer"
							/>
							{discount > 0 && (
								<span className="absolute top-3 left-3 bg-[#FF6A00] text-white font-bold px-2 py-1 rounded text-sm">
									-{discount}%
								</span>
							)}
							{/* Badges */}
							<div className="absolute top-3 right-3 flex flex-col gap-1">
								{product.badges?.includes('bestseller') && (
									<span className="bg-[#FF6A00] text-white text-xs font-bold px-2 py-0.5 rounded">
										{t('product.bestsellerBadge', 'BESTSELLER')}
									</span>
								)}
								{product.badges?.includes('new') && (
									<span className="bg-[#1688C9] text-white text-xs font-bold px-2 py-0.5 rounded">
										{t('product.newBadge', 'NEW')}
									</span>
								)}
							</div>
							<div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
								<div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow">
									<ZoomIn size={18} className="text-[#333]" />
								</div>
							</div>
						</div>
					</div>
					{/* Thumbnails */}
					<div className="flex gap-2 overflow-auto pb-1">
						{allImages.map((img, i) => (
							<button
								key={i}
								onClick={() => setSelectedImage(i)}
								className={`w-16 h-16 rounded border-2 flex-shrink-0 overflow-hidden transition-all ${selectedImage === i ? 'border-[#FF6A00] shadow' : 'border-[#E5E5E5] hover:border-[#FF6A00]/50'}`}
							>
								<img
									src={safeImageUrl(img, { kind: 'product' })}
									alt=""
									className="w-full h-full object-cover"
								/>
							</button>
						))}
					</div>
				</div>

				{/* Middle: Product Info */}
				<div className="lg:col-span-4 flex flex-col">
					{/* Title */}
					<h1 className="text-lg lg:text-xl font-bold text-[#333] leading-snug">
						{getName(product)}
					</h1>

					{/* Rating */}
					<div className="flex items-center gap-3 mt-2 flex-wrap">
						<div className="flex items-center gap-0.5">
							{[1, 2, 3, 4, 5].map((s) => (
								<Star
									key={s}
									size={14}
									className={
										s <= Math.round(product.rating)
											? 'text-[#FF6A00] fill-[#FF6A00]'
											: 'text-[#DDD]'
									}
								/>
							))}
						</div>
						<span className="text-sm font-bold text-[#FF6A00]">{product.rating}</span>
						<span className="text-sm text-[#999]">
							({product.review_count} {t('product.reviews')})
						</span>
						<span className="text-sm text-[#999]">|</span>
						<span className="text-sm text-[#666]">
							{product.sold_count} {t('product.soldSuffix', 'sold')}
						</span>
					</div>

					{/* Price - Alibaba style */}
					<div className="mt-4 p-4 bg-[#FFF8F3] rounded border border-[#FFE8D6]">
						<div className="flex items-baseline gap-2 flex-wrap">
							<span className="text-[#FF6A00] text-sm font-medium">
								{t('product.priceLabel', 'Price:')}
							</span>
							<span className="text-2xl font-bold text-[#FF6A00]">
								{minPrice.toLocaleString()} - {maxPrice.toLocaleString()}
							</span>
							<span className="text-sm text-[#666]">{t('product.currency')}</span>
							{product.original_price > 0 && (
								<span className="text-sm text-[#999] line-through">
									{product.original_price.toLocaleString()}
								</span>
							)}
						</div>
						{/* MOQ */}
						<div className="mt-2 flex items-center gap-2">
							<span className="text-xs bg-[#FF6A00]/10 text-[#FF6A00] px-2 py-0.5 rounded font-medium">
								{t('product.moqValue', `MOQ: ${product.moq || 10} pieces`)}
							</span>
							<span className="text-xs bg-[#E8F5E9] text-[#4CAF50] px-2 py-0.5 rounded font-medium flex items-center gap-1">
								<ShieldCheck size={10} />{' '}
								{t('nav.tradeAssurance', 'Trade Assurance')}
							</span>
						</div>
					</div>

					{/* Variants - Colors (only if product has colors) */}
					{colors.length > 0 && (
						<div className="mt-4">
							<span className="text-sm font-medium text-[#333]">
								{t('product.colorLabel', 'Color:')}
							</span>
							<div className="flex flex-wrap gap-2 mt-1.5">
								{colors.map((c) => (
									<button
										key={c}
										onClick={() => setSelectedColor(c)}
										className={`px-3 py-1.5 rounded border text-sm font-medium transition-all ${selectedColor === c ? 'border-[#FF6A00] text-[#FF6A00] bg-[#FFF8F3]' : 'border-[#E5E5E5] text-[#666] hover:border-[#FF6A00]/50'}`}
									>
										{c}
									</button>
								))}
							</div>
						</div>
					)}

					{/* Variants - Sizes (only if product has sizes) */}
					{sizes.length > 0 && (
						<div className="mt-3">
							<span className="text-sm font-medium text-[#333]">
								{t('product.sizeLabel', 'Size:')}
							</span>
							<div className="flex flex-wrap gap-2 mt-1.5">
								{sizes.map((s) => (
									<button
										key={s}
										onClick={() => setSelectedSize(s)}
										className={`w-10 h-10 rounded border text-sm font-medium transition-all flex items-center justify-center ${selectedSize === s ? 'border-[#FF6A00] text-[#FF6A00] bg-[#FFF8F3]' : 'border-[#E5E5E5] text-[#666] hover:border-[#FF6A00]/50'}`}
									>
										{s}
									</button>
								))}
							</div>
						</div>
					)}

					{/* Quantity */}
					<div className="flex items-center gap-4 mt-4">
						<span className="text-sm font-medium text-[#333]">
							{t('cart.quantity')}:
						</span>
						<div className="flex items-center border border-[#E5E5E5] rounded bg-white">
							<button
								onClick={() => setQty(Math.max(1, qty - 1))}
								title={t('product.decreaseQty', 'Decrease quantity')}
								aria-label={t('product.decreaseQty', 'Decrease quantity')}
								className="w-9 h-9 flex items-center justify-center hover:bg-[#F7F8FA] rounded-l transition-colors"
							>
								<Minus size={14} />
							</button>
							<span className="w-10 h-9 flex items-center justify-center font-bold text-[#333] border-x border-[#E5E5E5] text-sm">
								{qty}
							</span>
							<button
								onClick={() => setQty(Math.min(product.stock, qty + 1))}
								title={t('product.increaseQty', 'Increase quantity')}
								aria-label={t('product.increaseQty', 'Increase quantity')}
								className="w-9 h-9 flex items-center justify-center hover:bg-[#F7F8FA] rounded-r transition-colors"
							>
								<Plus size={14} />
							</button>
						</div>
						<span className="text-sm text-[#999]">
							{product.stock} {t('product.availableSuffix', 'available')}
						</span>
					</div>

					{/* CTAs */}
					<div className="flex flex-col gap-2 mt-5">
						<button
							onClick={handleAddToCart}
							disabled={product.stock === 0}
							className={`h-11 rounded font-bold flex items-center justify-center gap-2 transition-all text-sm ${added ? 'bg-green-500 text-white' : product.stock === 0 ? 'bg-[#E5E5E5] text-[#999] cursor-not-allowed' : 'bg-[#FF6A00] text-white hover:bg-[#E55F00] shadow'}`}
						>
							<ShoppingCart size={16} />
							{added
								? t('product.addedShort', 'Added!')
								: t('product.startOrder', 'Start Order')}
						</button>
						<button className="h-11 rounded font-bold border-2 border-[#FF6A00] text-[#FF6A00] hover:bg-[#FFF8F3] transition-all text-sm flex items-center justify-center gap-2">
							<MessageCircle size={16} />
							{t('product.contactSupplier', 'Contact Supplier')}
						</button>
					</div>

					{/* Features */}
					<div className="mt-4 space-y-2">
						{product.features?.map((f, i) => (
							<div key={i} className="flex items-center gap-2 text-sm text-[#666]">
								<BadgeCheck size={14} className="text-[#FF6A00] flex-shrink-0" />
								<span>{f}</span>
							</div>
						))}
					</div>
				</div>

				{/* Right: Supplier Card */}
				<div className="lg:col-span-3">
					<div className="bg-white rounded border border-[#E5E5E5] p-4 sticky top-4">
						{store && (
							<>
								<div className="flex items-center gap-3 pb-4 border-b border-[#E5E5E5]">
									<img
										src={store.logo || '/images/placeholder.svg'}
										alt=""
										className="w-12 h-12 rounded-full object-cover"
									/>
									<div className="flex-1 min-w-0">
										<p className="font-bold text-sm text-[#333] truncate">
											{getStoreName(store)}
										</p>
										<div className="flex items-center gap-1 text-xs text-[#666]">
											<MapPin size={10} />
											<span>{store.location}</span>
										</div>
									</div>
								</div>

								<div className="py-3 space-y-2 border-b border-[#E5E5E5]">
									<div className="flex items-center justify-between text-sm">
										<span className="text-[#999]">
											{t('product.storeRatingLabel', 'Rating')}
										</span>
										<div className="flex items-center gap-1">
											<Star
												size={12}
												className="text-[#FF6A00] fill-[#FF6A00]"
											/>
											<span className="font-bold text-[#333]">
												{store.rating}
											</span>
										</div>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-[#999]">
											{t('product.storeYearsLabel', 'Years')}
										</span>
										<span className="font-bold text-[#333]">
											{store.since_year
												? new Date().getFullYear() -
													parseInt(store.since_year)
												: 0}{' '}
											{t('product.storeYearUnit', 'yrs')}
										</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-[#999]">
											{t('product.storeTransactionsLabel', 'Transactions')}
										</span>
										<span className="font-bold text-[#333]">
											{(store.sales_count ?? 0).toLocaleString()}+
										</span>
									</div>
								</div>

								{/* Trust badges */}
								<div className="py-3 flex flex-wrap gap-1.5 border-b border-[#E5E5E5]">
									{store.trust_level === 'gold' && (
										<span className="flex items-center gap-1 text-xs bg-[#FFF8E1] text-[#FF8F00] px-2 py-0.5 rounded font-medium">
											<Award size={12} />{' '}
											{t('product.goldSupplier', 'Gold Supplier')}
										</span>
									)}
									{store.is_verified === 1 && (
										<span className="flex items-center gap-1 text-xs bg-[#E3F2FD] text-[#1688C9] px-2 py-0.5 rounded font-medium">
											<BadgeCheck size={12} /> {t('nav.verified', 'Verified')}
										</span>
									)}
								</div>

								<div className="pt-3 flex flex-col gap-2">
									<Link
										to={`/store/${store.id}`}
										className="h-9 rounded bg-[#FF6A00] text-white font-bold text-sm flex items-center justify-center hover:bg-[#E55F00] transition-colors"
									>
										{t('product.visitStore', 'Visit Store')}
									</Link>
									<button className="h-9 rounded border border-[#E5E5E5] text-[#666] font-medium text-sm flex items-center justify-center hover:border-[#FF6A00] hover:text-[#FF6A00] transition-colors">
										<Heart size={14} className="mr-1" />
										{t('product.followStore', 'Follow')}
									</button>
								</div>
							</>
						)}

						{/* Trust section */}
						<div className="mt-4 pt-3 border-t border-[#E5E5E5] space-y-2">
							<div className="flex items-center gap-2 text-xs text-[#666]">
								<ShieldCheck size={14} className="text-[#4CAF50]" />
								<span>{t('nav.tradeAssurance', 'Trade Assurance')}</span>
							</div>
							<div className="flex items-center gap-2 text-xs text-[#666]">
								<Clock size={14} className="text-[#1688C9]" />
								<span>{t('product.fastShipping', 'Fast Shipping')}</span>
							</div>
							<div className="flex items-center gap-2 text-xs text-[#666]">
								<RefreshCw size={14} className="text-[#FF6A00]" />
								<span>{t('product.returns7Days', '7-Day Returns')}</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* ─── Tabs Section ─── */}
			<div className="mt-10 bg-white rounded border border-[#E5E5E5]">
				{/* Tab Headers */}
				<div className="flex border-b border-[#E5E5E5] overflow-auto">
					{[
						{
							key: 'details' as const,
							label: t('product.tabDetails', 'Product Details'),
						},
						{
							key: 'company' as const,
							label: t('product.tabCompany', 'Company Profile'),
						},
						{
							key: 'reviews' as const,
							label: `${t('product.tabReviews', 'Reviews')} (${product.review_count})`,
						},
					].map((tab) => (
						<button
							key={tab.key}
							onClick={() => setActiveTab(tab.key)}
							className={`px-6 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? 'border-[#FF6A00] text-[#FF6A00]' : 'border-transparent text-[#666] hover:text-[#333]'}`}
						>
							{tab.label}
						</button>
					))}
				</div>

				{/* Tab Content */}
				<div className="p-6">
					{activeTab === 'details' && (
						<div className="grid md:grid-cols-2 gap-8">
							<div>
								<h3 className="text-base font-bold text-[#333] mb-3">
									{t('product.sectionDescription', 'Product Description')}
								</h3>
								<p className="text-sm text-[#666] leading-relaxed">
									{getDesc(product)}
								</p>
								<div className="mt-4 space-y-2">
									{product.features?.map((f, i) => (
										<div
											key={i}
											className="flex items-center gap-2 text-sm text-[#666]"
										>
											<ChevronRight
												size={14}
												className={`text-[#FF6A00] ${isRTL ? 'rotate-180' : ''}`}
											/>
											<span>{f}</span>
										</div>
									))}
								</div>
							</div>
							{product.specifications &&
								Object.keys(product.specifications).length > 0 && (
									<div>
										<h3 className="text-base font-bold text-[#333] mb-3">
											{t('product.specifications')}
										</h3>
										<div className="border border-[#E5E5E5] rounded overflow-hidden">
											{Object.entries(product.specifications).map(
												([k, v], i, arr) => (
													<div
														key={k}
														className={`flex text-sm ${i !== arr.length - 1 ? 'border-b border-[#E5E5E5]' : ''}`}
													>
														<span className="w-1/3 bg-[#F7F8FA] px-4 py-2.5 text-[#666] font-medium">
															{k}
														</span>
														<span className="w-2/3 px-4 py-2.5 text-[#333]">
															{v}
														</span>
													</div>
												),
											)}
										</div>
									</div>
								)}
						</div>
					)}

					{activeTab === 'company' && store && (
						<div className="grid md:grid-cols-2 gap-8">
							<div className="space-y-4">
								<h3 className="text-base font-bold text-[#333] mb-3">
									{t('product.sectionCompanyInfo', 'Company Information')}
								</h3>
								<div className="space-y-3">
									<div className="flex items-center gap-3 text-sm">
										<Store size={16} className="text-[#FF6A00]" />
										<span className="text-[#666]">
											{t('product.storeNameLabel', 'Store Name:')}
										</span>
										<span className="text-[#333] font-medium">
											{getStoreName(store)}
										</span>
									</div>
									<div className="flex items-center gap-3 text-sm">
										<MapPin size={16} className="text-[#FF6A00]" />
										<span className="text-[#666]">
											{t('product.storeLocationLabel', 'Location:')}
										</span>
										<span className="text-[#333] font-medium">
											{store.location}
										</span>
									</div>
									<div className="flex items-center gap-3 text-sm">
										<Calendar size={16} className="text-[#FF6A00]" />
										<span className="text-[#666]">
											{t('product.storeEstablishedLabel', 'Established:')}
										</span>
										<span className="text-[#333] font-medium">
											{store.since_year}
										</span>
									</div>
									<div className="flex items-center gap-3 text-sm">
										<Package size={16} className="text-[#FF6A00]" />
										<span className="text-[#666]">
											{t('product.storeProductsLabel', 'Products:')}
										</span>
										<span className="text-[#333] font-medium">
											{store.products_count}
										</span>
									</div>
								</div>
							</div>
							<div>
								<h3 className="text-base font-bold text-[#333] mb-3">
									{t('product.sectionCapabilities', 'Capabilities')}
								</h3>
								<div className="space-y-2">
									{[
										t('product.capShipping', 'Shipping to 50+ countries'),
										t('product.capOem', 'OEM/ODM Available'),
										t('product.capSupport247', '24/7 Customer Support'),
										t(
											'product.capQuality',
											'International Quality Certifications',
										),
									].map((cap, i) => (
										<div
											key={i}
											className="flex items-center gap-2 text-sm text-[#666]"
										>
											<BadgeCheck size={14} className="text-[#4CAF50]" />
											<span>{cap}</span>
										</div>
									))}
								</div>
							</div>
						</div>
					)}

					{activeTab === 'reviews' && (
						<div>
							{/* Rating Summary */}
							<div className="flex items-center gap-6 mb-6 p-4 bg-[#F7F8FA] rounded">
								<div className="text-center">
									<p className="text-3xl font-bold text-[#FF6A00]">
										{product.rating}
									</p>
									<div className="flex gap-0.5 justify-center my-1">
										{[1, 2, 3, 4, 5].map((s) => (
											<Star
												key={s}
												size={14}
												className={
													s <= Math.round(product.rating)
														? 'text-[#FF6A00] fill-[#FF6A00]'
														: 'text-[#DDD]'
												}
											/>
										))}
									</div>
									<p className="text-xs text-[#999]">
										{product.review_count} {t('product.reviews')}
									</p>
								</div>
								<div className="flex-1 space-y-1">
									{ratingDistribution.map(({ stars, pct }) => (
										<div
											key={stars}
											className="flex items-center gap-2 text-xs"
										>
											<span className="w-3 text-[#666]">{stars}</span>
											<Star size={10} className="text-[#FF6A00]" />
											<div className="flex-1 h-2 bg-[#E5E5E5] rounded-full overflow-hidden">
												<div
													className={`h-full bg-[#FF6A00] rounded-full ${styles.ratingBar}`}
													style={
														{
															'--rating-pct': `${pct}%`,
														} as React.CSSProperties
													}
												/>
											</div>
											<span className="w-8 text-right text-[#999]">
												{pct}%
											</span>
										</div>
									))}
								</div>
							</div>
							{/* Review List */}
							{reviewsLoading ? (
								<div className="text-center py-8">
									<div className="w-8 h-8 border-3 border-[#FF6A00] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
									<p className="text-sm text-[#999]">
										{t('product.loadingReviews', 'Loading reviews...')}
									</p>
								</div>
							) : (
								<div className="space-y-4">
									{reviews.length === 0 && (
										<div className="text-center py-8 text-[#999]">
											{t('product.noReviewsYet', 'No reviews yet')}
										</div>
									)}
									{reviews.map((r) => (
										<div key={r.id} className="border-b border-[#E5E5E5] pb-4">
											<div className="flex items-center gap-2 mb-2">
												<div className="w-8 h-8 rounded-full bg-[#F7F8FA] flex items-center justify-center text-xs font-bold text-[#666]">
													{(r.customer_name || 'U')
														.charAt(0)
														.toUpperCase()}
												</div>
												<div>
													<p className="text-sm font-bold text-[#333]">
														{r.customer_name || 'User'}
													</p>
													<p className="text-xs text-[#999]">
														{r.created_at?.split('T')[0]}
													</p>
												</div>
												<div
													className={`flex gap-0.5 ${isRTL ? 'mr-auto' : 'ml-auto'}`}
												>
													{[1, 2, 3, 4, 5].map((s) => (
														<Star
															key={s}
															size={12}
															className={
																s <= r.rating
																	? 'text-[#FF6A00] fill-[#FF6A00]'
																	: 'text-[#DDD]'
															}
														/>
													))}
												</div>
											</div>
											{r.title && (
												<p className="text-sm font-semibold text-[#333] mb-1">
													{r.title}
												</p>
											)}
											<p className="text-sm text-[#666] leading-relaxed">
												{r.comment}
											</p>
											<div className="flex items-center gap-3 mt-2">
												<button className="flex items-center gap-1 text-xs text-[#999] hover:text-[#FF6A00] transition-colors">
													<ThumbsUp size={12} />{' '}
													{t('product.helpful', 'Helpful')} (
													{r.helpful_count})
												</button>
												{r.is_verified === 1 && (
													<span className="flex items-center gap-1 text-xs text-[#4CAF50]">
														<BadgeCheck size={12} />{' '}
														{t(
															'product.verifiedBuyer',
															'Verified Buyer',
														)}
													</span>
												)}
											</div>
											{r.merchant_reply && (
												<div className="mt-2 p-3 bg-[#F7F8FA] rounded text-sm">
													<span className="font-semibold text-[#333]">
														{t(
															'product.sellerReplyLabel',
															'Seller Reply:',
														)}
													</span>
													<p className="text-[#666] mt-0.5">
														{r.merchant_reply}
													</p>
												</div>
											)}
										</div>
									))}
								</div>
							)}
						</div>
					)}
				</div>
			</div>

			{/* ─── Related Products ─── */}
			{related.length > 0 && (
				<div className="mt-10">
					<h2 className="text-lg font-bold text-[#333] mb-4">
						{t('product.relatedProducts', 'Related Products')}
					</h2>
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
						{related.map((p) => (
							<Link
								key={p.id}
								to={`/product/${p.id}`}
								className="bg-white rounded border border-[#E5E5E5] hover:shadow-md hover:border-[#FF6A00]/30 transition-all group overflow-hidden"
							>
								<div className="aspect-square bg-[#F7F8FA] overflow-hidden">
									<img
										src={safeImageUrl(p.main_image, { kind: 'product' })}
										alt={getName(p)}
										className="w-full h-full object-cover group-hover:scale-105 transition-transform"
									/>
								</div>
								<div className="p-3">
									<h3 className="text-sm text-[#333] line-clamp-2 group-hover:text-[#FF6A00] transition-colors">
										{getName(p)}
									</h3>
									<div className="flex items-center gap-1 mt-1">
										<span className="text-sm font-bold text-[#FF6A00]">
											{p.price.toLocaleString()}
										</span>
										<span className="text-xs text-[#999]">
											{t('product.currency')}
										</span>
									</div>
									<div className="flex items-center gap-1 mt-1">
										<span className="text-xs text-[#999]">
											MOQ: {p.moq || 10}
										</span>
										<span className="text-xs text-[#999]">|</span>
										<span className="text-xs text-[#999]">
											{p.sold_count} {t('product.soldSuffix', 'sold')}
										</span>
									</div>
								</div>
							</Link>
						))}
					</div>
				</div>
			)}

			{/* Lightbox */}
			{lightboxOpen && (
				<div
					className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
					onClick={() => setLightboxOpen(false)}
				>
					<button
						className="absolute top-4 right-4 text-white p-2 rounded-full bg-white/10 hover:bg-white/20"
						title={t('product.closeLightbox', 'Close')}
						aria-label={t('product.closeLightbox', 'Close')}
					>
						<X size={24} />
					</button>
					<img
						src={safeImageUrl(allImages[selectedImage], { kind: 'product' })}
						alt=""
						className="max-w-full max-h-[90vh] object-contain rounded"
					/>
				</div>
			)}
		</div>
	);
}
