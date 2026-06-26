import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useCart } from '../context/CartContext';
import { useProducts } from '../hooks/useApi';
import type { Product } from '../hooks/useApi';
import { ShoppingCart, Clock, Zap, Flame, Star, BadgeCheck } from 'lucide-react';
import styles from './Deals.module.css';

interface TimeLeft {
	hours: number;
	minutes: number;
	seconds: number;
}

function useCountdown(targetHours: number = 24): TimeLeft {
	const [timeLeft, setTimeLeft] = useState<TimeLeft>({
		hours: targetHours,
		minutes: 0,
		seconds: 0,
	});

	useEffect(() => {
		const endTime = Date.now() + targetHours * 60 * 60 * 1000;
		const interval = setInterval(() => {
			const diff = Math.max(0, endTime - Date.now());
			setTimeLeft({
				hours: Math.floor(diff / (1000 * 60 * 60)),
				minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
				seconds: Math.floor((diff % (1000 * 60)) / 1000),
			});
			// M13 fix: stop ticking once we hit zero -- avoids pointless work.
			if (diff <= 0) clearInterval(interval);
		}, 1000);
		return () => clearInterval(interval);
	}, [targetHours]);

	return timeLeft;
}

/* Declared at module scope so React treats it as a stable component across renders. */
function TimeBlock({ value, label }: { value: number; label: string }) {
	return (
		<div className="flex flex-col items-center">
			<div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-xl flex items-center justify-center shadow-md">
				<span className="text-2xl sm:text-3xl font-extrabold text-aliText font-mono">
					{String(value).padStart(2, '0')}
				</span>
			</div>
			<span className="text-xs text-white/80 mt-1 font-medium">{label}</span>
		</div>
	);
}

export default function DealsPage() {
	const { t, i18n } = useTranslation();
	const { dispatch } = useCart();
	const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
	const countdown = useCountdown(12);
	const { data: dealsResp } = useProducts({ limit: 100 });

	const getName = useCallback(
		(p: Product) =>
			i18n.language === 'en' ? p.name_en : i18n.language === 'zh' ? p.name_zh : p.name_ar,
		[i18n.language],
	);

	const addToCart = useCallback(
		(p: Product) => {
			dispatch({
				type: 'ADD',
				payload: {
					productId: String(p.id),
					name: getName(p),
					price: p.price,
					quantity: 1,
					image: p.main_image,
					merchantName: '',
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
		},
		[dispatch, getName],
	);

	const allProducts = dealsResp?.products ?? [];
	const deals = allProducts.filter((p: Product) => p.deal_discount && p.deal_discount > 0);
	const hotDeals = deals.filter((p: Product) => (p.deal_discount ?? 0) >= 25);

	return (
		<div className="min-h-screen bg-aliSurface">
			{/* Flash Sale Hero Banner */}
			<div className="bg-gradient-to-r from-red-500 via-orange-500 to-aliOrange">
				<div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-8 lg:py-12">
					<div className="flex flex-col lg:flex-row items-center justify-between gap-6">
						<div className="text-center lg:text-left">
							<div className="flex items-center gap-2 justify-center lg:justify-start mb-2">
								<Flame size={28} className="text-yellow-200" />
								<span className="text-yellow-100 font-semibold text-sm uppercase tracking-wider">
									{t('deals.limitedOffer', 'Limited Time Offer')}
								</span>
							</div>
							<h1 className="text-3xl lg:text-4xl font-extrabold text-white mb-2">
								{t('deals.flashSale', 'Flash Sale')}
							</h1>
							<p className="text-white/80 text-sm lg:text-base max-w-md">
								{t(
									'deals.flashSaleDesc',
									'Huge discounts on selected products for a limited time only!',
								)}
							</p>
						</div>

						{/* Countdown Timer */}
						<div className="flex items-center gap-3 sm:gap-4">
							<TimeBlock value={countdown.hours} label={t('deals.hours', 'Hours')} />
							<span className="text-3xl font-extrabold text-white/60 -mt-4">:</span>
							<TimeBlock
								value={countdown.minutes}
								label={t('deals.minutes', 'Mins')}
							/>
							<span className="text-3xl font-extrabold text-white/60 -mt-4">:</span>
							<TimeBlock
								value={countdown.seconds}
								label={t('deals.seconds', 'Secs')}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Stats Bar */}
			<div className="bg-white border-b border-aliBorder">
				<div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-3 flex flex-wrap items-center justify-center gap-6 text-sm text-aliTextSec">
					<div className="flex items-center gap-1.5">
						<Zap size={16} className="text-aliOrange" />
						<span>
							{t('deals.activeDeals', '{count} active deals', {
								count: deals.length,
							})}
						</span>
					</div>
					<div className="flex items-center gap-1.5">
						<Clock size={16} className="text-aliOrange" />
						<span>{t('deals.endingSoon', 'Ending soon')}</span>
					</div>
					<div className="flex items-center gap-1.5">
						<BadgeCheck size={16} className="text-aliOrange" />
						<span>{t('deals.verifiedProducts', 'Verified products')}</span>
					</div>
				</div>
			</div>

			<div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-8">
				{/* Hot Deals (25%+ off) */}
				{hotDeals.length > 0 && (
					<section className="mb-10">
						<div className="flex items-center gap-2 mb-5">
							<Flame size={22} className="text-red-500" />
							<h2 className="text-xl lg:text-2xl font-bold text-aliText">
								{t('deals.hotDeals', 'Hot Deals')}
								<span className="text-sm font-normal text-aliTextMute ml-2">
									25%+ off
								</span>
							</h2>
						</div>
						<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
							{hotDeals.map((product) => (
								<DealCard
									key={product.id}
									product={product}
									addedIds={addedIds}
									addToCart={addToCart}
									getName={getName}
									t={t}
									hot
								/>
							))}
						</div>
					</section>
				)}

				{/* All Deals */}
				<section>
					<div className="flex items-center gap-2 mb-5">
						<Zap size={22} className="text-aliOrange" />
						<h2 className="text-xl lg:text-2xl font-bold text-aliText">
							{t('deals.allDeals', 'All Deals')}
						</h2>
					</div>
					{deals.length > 0 ? (
						<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
							{deals.map((product) => (
								<DealCard
									key={product.id}
									product={product}
									addedIds={addedIds}
									addToCart={addToCart}
									getName={getName}
									t={t}
								/>
							))}
						</div>
					) : (
						<div className="text-center py-16 bg-white rounded-xl border border-aliBorder">
							<Clock size={48} className="text-aliTextMute mx-auto mb-4" />
							<p className="text-aliTextSec text-lg">
								{t('deals.noDeals', 'No deals at the moment')}
							</p>
							<Link
								to="/"
								className="inline-block mt-4 px-6 py-2.5 bg-aliOrange text-white rounded-lg font-semibold hover:bg-aliOrangeHover transition-colors"
							>
								{t('deals.backToHome', 'Back to Home')}
							</Link>
						</div>
					)}
				</section>
			</div>
		</div>
	);
}

/* Deal Card Sub-component */
function DealCard({
	product,
	addedIds,
	addToCart,
	getName,
	t,
	hot = false,
}: {
	product: Product;
	addedIds: Set<number>;
	addToCart: (p: Product) => void;
	getName: (p: Product) => string;
	t: TFunction;
	hot?: boolean;
}) {
	const discount = product.deal_discount ?? 0;

	return (
		<div
			className={`bg-white rounded-xl overflow-hidden border hover:shadow-lg transition-all group ${
				hot
					? 'border-red-200 hover:border-red-300'
					: 'border-aliBorder hover:border-aliOrange/30'
			}`}
		>
			<Link
				to={`/product/${product.id}`}
				className="block relative aspect-square overflow-hidden bg-aliSurface"
			>
				<img
					src={product.main_image}
					alt={getName(product)}
					className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
				/>
				{/* Discount Badge */}
				<div
					className={`absolute top-2 left-2 ${hot ? 'bg-red-500' : 'bg-aliOrange'} text-white font-bold px-2.5 py-1 rounded-lg text-sm flex items-center gap-1`}
				>
					<Zap size={12} />-{discount}%
				</div>
				{/* Limited badge */}
				<div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
					{t('deals.limitedBadge', 'Limited')}
				</div>
				{/* Progress bar */}
				<div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/10">
					<div
						className={`h-full ${hot ? 'bg-red-500' : 'bg-aliOrange'} transition-all ${styles.stockBar}`}
						style={
							{
								'--deals-pct': `${Math.max(10, 100 - (product.sold_count / (product.sold_count + product.stock)) * 100)}%`,
							} as React.CSSProperties
						}
					/>
				</div>
			</Link>
			<div className="p-3">
				<Link to={`/product/${product.id}`}>
					<h3 className="text-sm text-aliText font-medium line-clamp-2 hover:text-aliOrange transition-colors min-h-[2.5em]">
						{getName(product)}
					</h3>
				</Link>

				{/* Price */}
				<div className="flex items-baseline gap-2 mt-2">
					<span className="text-xl font-bold text-aliOrange">
						{product.price.toLocaleString()}
					</span>
					<span className="text-aliTextMute text-xs">{t('product.currency')}</span>
					{product.original_price && (
						<span className="text-aliTextMute text-sm line-through">
							{product.original_price.toLocaleString()}
						</span>
					)}
				</div>

				{/* Savings */}
				{product.original_price && (
					<p className="text-xs text-green-600 font-medium mt-0.5">
						{t('nav.save', 'Save')}{' '}
						{(product.original_price - product.price).toLocaleString()}{' '}
						{t('product.currency')}
					</p>
				)}

				{/* Rating & Sold */}
				<div className="flex items-center gap-2 mt-2 text-xs text-aliTextSec">
					<div className="flex items-center gap-0.5">
						<Star size={12} className="text-yellow-400 fill-yellow-400" />
						<span>{product.rating}</span>
					</div>
					<span>|</span>
					<span>
						{product.sold_count} {t('deals.soldSuffix', 'sold')}
					</span>
				</div>

				{/* Stock left */}
				<p className="text-[10px] text-red-500 font-medium mt-1">
					{t('deals.onlyLeft', 'Only {count} left!', {
						count: product.stock,
					})}
				</p>

				{/* Add to cart button */}
				<button
					onClick={() => addToCart(product)}
					className={`w-full mt-3 h-10 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
						addedIds.has(product.id)
							? 'bg-green-500 text-white'
							: hot
								? 'bg-red-500 text-white hover:bg-red-600'
								: 'bg-aliOrange text-white hover:bg-aliOrangeHover'
					}`}
				>
					<ShoppingCart size={16} />
					{addedIds.has(product.id)
						? t('deals.addedToCart', 'Added!')
						: t('deals.addToCart', 'Add to Cart')}
				</button>
			</div>
		</div>
	);
}
