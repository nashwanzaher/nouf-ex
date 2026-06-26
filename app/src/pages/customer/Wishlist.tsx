import { useState, useCallback } from 'react';
import { Link } from 'react-router';
import { Heart, ShoppingCart, X, Package, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CustomerSidebar from './CustomerSidebar';
import { useAuth } from '@/context/AppContext';
import { useServerWishlist } from '@/hooks/useApi';
import { removeFromWishlist as apiRemoveFromWishlist, addToCart as apiAddToCart } from '@/lib/api';
import type { WishlistItem as ApiWishlistItem } from '@/lib/api';

/** Format a price number into Arabic display string */
function formatYer(amount: number): string {
	if (!Number.isFinite(amount)) return '—';
	return `${amount.toLocaleString('en-US')} ر.ي`;
}

/** Pick the right name field based on the current language */
function getName(item: ApiWishlistItem, lang: string): string {
	if (lang === 'zh') return item.name_zh || item.name_en || `منتج #${item.product_id}`;
	if (lang === 'en') return item.name_en || item.name_ar || `Product #${item.product_id}`;
	return item.name_ar || item.name_en || `منتج #${item.product_id}`;
}

function StarRating({ rating }: { rating: number }) {
	const r = rating ?? 0;
	return (
		<div className="flex items-center gap-0.5">
			{[1, 2, 3, 4, 5].map((s) => (
				<Heart
					key={s}
					className={`w-3 h-3 ${s <= Math.floor(r) ? 'text-[#D4A853] fill-[#D4A853]' : 'text-[#AAAAAA]'}`}
					strokeWidth={1.5}
				/>
			))}
			<span className="text-[10px] text-[#6B6B6B] font-cairo mr-1">{r.toFixed(1)}</span>
		</div>
	);
}

export default function Wishlist() {
	const { user, isAuthenticated } = useAuth();
	const userId = isAuthenticated && user ? Number(user.id) : null;

	// ── Real API call via hook ──────────────────────────────────────
	// Coerce `data` to a non-nullable array with `?? []`. The destructure
	// default (`= []`) only kicks in for `undefined`; `HookResult<T>.data`
	// is typed as `T | null`, so without the `??` the compiler narrows
	// `items` back to nullable at the use sites and TS18047 fires.
	const wishlistResult = useServerWishlist(userId);
	const items = wishlistResult.data ?? [];
	const { loading, error, refetch } = wishlistResult;

	// ── Local interaction state ──────────────────────────────────────
	const [removingId, setRemovingId] = useState<number | null>(null);
	const [addedToCart, setAddedToCart] = useState<number | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);

	// ── Remove from wishlist (real API) ─────────────────────────────
	const handleRemove = useCallback(
		async (id: number) => {
			setRemovingId(id);
			setActionError(null);
			try {
				await apiRemoveFromWishlist(id);
				refetch(); // re-fetch from server to keep state in sync
			} catch {
				setActionError('تعذّر حذف المنتج. حاول مرة أخرى.');
			} finally {
				setRemovingId(null);
			}
		},
		[refetch],
	);

	// ── Move to cart (real API) ────────────────────────────────────
	const handleMoveToCart = useCallback(
		async (item: ApiWishlistItem) => {
			if (!userId) return;
			setAddedToCart(item.id);
			setActionError(null);
			try {
				await apiAddToCart({ userId, productId: item.product_id, quantity: 1 });
				// Remove from wishlist after successful cart add
				await apiRemoveFromWishlist(item.id);
				refetch();
			} catch {
				setActionError('تعذّر نقل المنتج إلى السلة. حاول مرة أخرى.');
			} finally {
				setAddedToCart(null);
			}
		},
		[userId, refetch],
	);

	// ── Not authenticated ───────────────────────────────────────────
	if (!isAuthenticated) {
		return (
			<div className="min-h-[100dvh] bg-[#F8F8F8]" dir="rtl">
				<CustomerSidebar />
				<div className="md:mr-60 min-h-[100dvh] flex items-center justify-center p-6">
					<div className="bg-white rounded-2xl p-10 text-center shadow-sm max-w-md">
						<Heart className="w-12 h-12 mx-auto text-[#D4A853] mb-3" strokeWidth={1.5} />
						<h2 className="text-xl font-amiri font-bold text-[#1A1612] mb-2">
							سجّل الدخول لعرض المفضلة
						</h2>
						<p className="text-sm text-[#6B6B6B] font-cairo mb-4">
							سجّل الدخول لحفظ المنتجات في قائمتك الشخصية.
						</p>
						<Button
							asChild
							className="bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo rounded-xl"
						>
							<Link to="/auth/login?next=/customer/wishlist">تسجيل الدخول</Link>
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-[100dvh] bg-[#F8F8F8]" dir="rtl">
			<CustomerSidebar />

			<div className="md:mr-60 min-h-[100dvh]">
				{/* ── Header ── */}
				<div className="bg-white border-b border-[#F3EDE4] px-6 py-4 sticky top-0 z-30">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-2xl font-amiri font-bold text-[#1A1612]">المفضلة</h1>
							<p className="text-sm text-[#6B6B6B] font-cairo mt-1">
								المنتجات التي حفظتها
							</p>
						</div>
						<span className="text-sm text-[#6B6B6B] font-cairo bg-[#F3EDE4] px-3 py-1 rounded-full">
							{items.length} منتج
						</span>
					</div>
				</div>

				<div className="p-6 max-w-5xl mx-auto">
					{/* ── Loading ── */}
					{loading && (
						<div className="bg-white rounded-2xl p-10 text-center shadow-sm">
							<Loader2 className="w-8 h-8 mx-auto text-[#D4A853] animate-spin mb-3" />
							<p className="text-sm text-[#6B6B6B] font-cairo">جاري التحميل…</p>
						</div>
					)}

					{/* ── Error ── */}
					{!loading && error && (
						<div className="bg-white rounded-2xl p-10 text-center shadow-sm">
							<AlertCircle className="w-10 h-10 mx-auto text-[#EF4444] mb-3" strokeWidth={1.5} />
							<h3 className="text-lg font-amiri font-bold text-[#1A1612] mb-2">
								تعذّر تحميل المفضلة
							</h3>
							<p className="text-sm text-[#6B6B6B] font-cairo mb-4">{error}</p>
							<Button
								onClick={() => refetch()}
								className="bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo rounded-xl"
							>
								حاول مرة أخرى
							</Button>
						</div>
					)}

					{/* ── Action error toast ── */}
					{actionError && (
						<div className="mb-4 p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl flex items-center gap-2">
							<AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />
							<p className="text-sm font-cairo text-[#EF4444]">{actionError}</p>
						</div>
					)}

					{/* ── Empty ── */}
					{!loading && !error && items.length === 0 && (
						<div className="bg-white rounded-2xl p-12 text-center shadow-sm">
							<Heart className="w-20 h-20 text-[#AAAAAA] mx-auto mb-4" strokeWidth={1} />
							<h3 className="text-xl font-amiri font-bold text-[#1A1612] mb-2">
								قائمة المفضلة فارغة
							</h3>
							<p className="text-[#6B6B6B] font-cairo text-sm mb-6">
								اضغط على{' '}
								<Heart className="w-4 h-4 inline text-[#AAAAAA]" strokeWidth={1.5} />{' '}
								أثناء التسوق لحفظ المنتجات هنا
							</p>
							<Button
								asChild
								className="bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo rounded-xl"
							>
								<Link to="/">استكشف المنتجات</Link>
							</Button>
						</div>
					)}

					{/* ── Grid ── */}
					{!loading && !error && items.length > 0 && (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
							{items.map((item) => {
								const price = item.price ?? 0;
								const originalPrice = item.original_price ?? 0;
								const hasDiscount = originalPrice > price && originalPrice > 0;
								const discountPct = hasDiscount
									? Math.round(((originalPrice - price) / originalPrice) * 100)
									: 0;
								const isRemoving = removingId === item.id;
								const isAddingToCart = addedToCart === item.id;

								return (
									<div
										key={item.id}
										className={`bg-white rounded-2xl shadow-sm overflow-hidden group transition-all duration-200 ${
											isRemoving ? 'scale-95 opacity-0' : 'opacity-100'
										} ${isAddingToCart ? 'ring-2 ring-[#10B981]' : ''}`}
									>
										{/* Image area */}
										<div className="relative aspect-square bg-[#F8F8F8] flex items-center justify-center overflow-hidden">
											{item.main_image ? (
												<img
													src={item.main_image}
													alt={getName(item, 'ar')}
													className="w-full h-full object-cover"
												/>
											) : (
												<Package className="w-12 h-12 text-[#AAAAAA]" strokeWidth={1} />
											)}

											{/* Remove button */}
											<button
												onClick={() => handleRemove(item.id)}
												disabled={isRemoving || isAddingToCart}
												className="absolute top-3 left-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#EF4444] hover:text-white text-[#6B6B6B] disabled:opacity-50"
											>
												<X className="w-4 h-4" strokeWidth={1.5} />
											</button>

											{/* Discount badge */}
											{hasDiscount && (
												<span className="absolute top-3 right-3 bg-[#EF4444] text-white text-[10px] font-cairo font-semibold px-2 py-1 rounded-full">
													{discountPct}% خصم
												</span>
											)}

											{/* Added to cart overlay */}
											{isAddingToCart && (
												<div className="absolute inset-0 bg-[#10B981]/90 flex items-center justify-center">
													<div className="text-center">
														<CheckIcon />
														<p className="text-white font-cairo font-semibold text-sm mt-2">
															تمت الإضافة
														</p>
													</div>
												</div>
											)}
										</div>

										{/* Content */}
										<div className="p-4">
											<h3 className="font-cairo font-medium text-sm text-[#111111] line-clamp-2 min-h-[2.5rem]">
												{getName(item, 'ar')}
											</h3>
											{item.store_name && (
												<p className="text-[11px] text-[#6B6B6B] font-cairo mt-1">
													{item.store_name}
												</p>
											)}
											<StarRating rating={item.rating ?? 0} />

											<div className="flex items-center gap-2 mt-2">
												<span className="font-mono font-bold text-[#D4A853]">
													{formatYer(price)}
												</span>
												{hasDiscount && (
													<span className="font-mono text-xs text-[#AAAAAA] line-through">
														{formatYer(originalPrice)}
													</span>
												)}
											</div>

											<Button
												onClick={() => handleMoveToCart(item)}
												disabled={isRemoving || isAddingToCart}
												className="w-full mt-3 bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo font-semibold rounded-xl h-10 text-sm disabled:opacity-50"
											>
												{isAddingToCart ? (
													<Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
												) : (
													<>
														<ShoppingCart className="w-4 h-4 ml-1" strokeWidth={1.5} />
														أضف إلى السلة
													</>
												)}
											</Button>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function CheckIcon() {
	return (
		<svg
			className="w-10 h-10 text-white mx-auto"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			strokeWidth={2}
		>
			<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
		</svg>
	);
}
