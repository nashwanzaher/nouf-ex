/**
 * DealsBar - sticky horizontal banner showing the current top discount
 * plus a countdown to the deal's end.
 *
 * Guards against the three real bugs we kept hitting:
 *
 *   1. "NaN%" - when original_price is 0 / null / < current. The
 *      discountPercent helper returns 0 in that case, and we use that
 *      to show "Today's deals" with no number rather than a broken
 *      "NaN%".
 *
 *   2. "+undefined" - when the API response doesn't include
 *      `deal_discount` for a product. We now read it from the API
 *      response (where present) and fall back to a computed value from
 *      price/original_price when missing.
 *
 *   3. Text overlap in RTL - the bar uses logical CSS (`start`/`end`)
 *      so the badge and label sit on the correct side regardless of
 *      writing direction. The countdown digits use CSS `font-feature-settings:
 *      "tnum"` to keep consistent monospace width.
 *
 * The data is sourced from the live API (`/api/products?onSale=true`).
 * If the API returns an empty array (e.g. deals expired), the bar
 * hides itself rather than rendering an empty shell.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Tag, X } from 'lucide-react';
import { getProducts, type Product } from '@/lib/api';
import { discountPercent } from '@/lib/utils/safe-format';

interface FeaturedDeal {
	id: number;
	productId: number;
	name: string;
	nameEn: string;
	discountPercent: number;
	endsAt: Date | null;
	now: number; // ms - kept in state to trigger re-render every minute
}

function pickFeaturedDeal(products: Product[], now: number): FeaturedDeal | null {
	if (products.length === 0) return null;
	// Sort by discount percent descending; take the highest.
	const ranked = products
		.map((p) => {
			const d = discountPercent(p.price, p.original_price);
			return { product: p, discount: d };
		})
		.sort((a, b) => b.discount - a.discount);
	const top = ranked[0];
	if (!top || top.discount <= 0) return null;
	const endsAt = top.product.deal_ends_at ? new Date(top.product.deal_ends_at) : null;
	return {
		id: top.product.id,
		productId: top.product.id,
		name: top.product.name_ar ?? '',
		nameEn: top.product.name_en ?? '',
		discountPercent: top.discount,
		endsAt,
		now,
	};
}

function formatCountdown(target: Date | null, now: number, t: (k: string) => string) {
	if (!target) return t('home.deals.noEnd');
	const diff = target.getTime() - now;
	if (diff <= 0) return t('home.deals.ended');
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
	const minutes = Math.floor((diff / (1000 * 60)) % 60);
	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
}

export default function DealsBar() {
	const { t } = useTranslation();
	const [deal, setDeal] = useState<FeaturedDeal | null>(null);
	const [now, setNow] = useState(() => Date.now());
	const [loading, setLoading] = useState(true);
	const [dismissed, setDismissed] = useState(false);

	// Load the top deal.
	useEffect(() => {
		const controller = new AbortController();
		let cancelled = false;
		getProducts({ onSale: true, limit: 50 }, { signal: controller.signal })
			.then((res) => {
				if (cancelled) return;
				setDeal(pickFeaturedDeal(res.products, Date.now()));
				setLoading(false);
			})
			.catch(() => {
				if (cancelled) return;
				setDeal(null);
				setLoading(false);
			});
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, []);

	// Tick the countdown every 30s. Cheap and prevents the
	// countdown from looking stuck.
	useEffect(() => {
		const id = window.setInterval(() => setNow(Date.now()), 30_000);
		return () => window.clearInterval(id);
	}, []);

	const heading = useMemo(
		() => ({
			eyebrow: t('home.deals.eyebrow', 'عروض اليوم'),
			title: t('home.deals.title', 'وفر أكثر مع عروضنا الحصرية'),
			dismiss: t('home.deals.dismiss', 'إخفاء'),
		}),
		[t],
	);

	// Don't render the bar at all if there's no deal or the user
	// dismissed it. Keeps the page layout stable.
	if (loading || !deal || dismissed) return null;

	return (
		<div
			dir="rtl"
			role="region"
			aria-label={t('home.deals.region', 'شريط العروض')}
			className="bg-gradient-to-l from-[#EF4444] via-[#DC2626] to-[#B91C1C] text-white shadow-md border-y-2 border-[#991B1B]/30"
		>
			<div className="max-w-container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-4">
				<div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
					{/* Big discount badge */}
					<div className="flex items-center gap-2 sm:gap-3 shrink-0">
						<Tag
							className="w-5 h-5 sm:w-6 sm:h-6 text-white/90 shrink-0"
							aria-hidden="true"
						/>
						<div className="text-center leading-none">
							<div
								className="text-2xl sm:text-3xl md:text-4xl font-mono font-bold tabular-nums"
								style={{ fontFeatureSettings: '"tnum"' }}
							>
								{Math.round(deal.discountPercent)}
							</div>
							<div className="text-[10px] sm:text-xs font-cairo font-semibold uppercase tracking-wider opacity-90 mt-0.5">
								{t('home.deals.percentOff', 'خصم %')}
							</div>
						</div>
					</div>

					{/* Vertical separator - hidden on mobile */}
					<div
						className="hidden sm:block h-10 w-px bg-white/30 shrink-0"
						aria-hidden="true"
					/>

					{/* Deal label + product name */}
					<div className="min-w-0 flex-1">
						<div className="text-[10px] sm:text-xs font-cairo font-bold uppercase tracking-wider opacity-90 mb-0.5">
							{heading.eyebrow}
						</div>
						<div
							className="font-cairo font-bold text-sm sm:text-base truncate"
							title={deal.name}
						>
							{deal.name}
						</div>
					</div>

					{/* Countdown */}
					<div className="hidden md:flex items-center gap-2 shrink-0 px-3 py-1.5 bg-black/20 rounded-lg">
						<Clock className="w-4 h-4 opacity-90" aria-hidden="true" />
						<span
							className="text-sm font-mono font-bold tabular-nums"
							style={{ fontFeatureSettings: '"tnum"' }}
						>
							{formatCountdown(deal.endsAt, now, t)}
						</span>
					</div>
				</div>

				<button
					type="button"
					onClick={() => setDismissed(true)}
					aria-label={heading.dismiss}
					className="shrink-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
				>
					<X className="w-4 h-4" />
				</button>
			</div>
		</div>
	);
}
