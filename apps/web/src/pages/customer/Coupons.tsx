import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Ticket, Clock, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format';
import { useMyCoupons, type Coupon } from '@/hooks/useApi';

const tones = [
	'from-amber-50 to-amber-100 border-amber-200',
	'from-blue-50 to-blue-100 border-blue-200',
	'from-rose-50 to-rose-100 border-rose-200',
];

function discountLabel(coupon: Coupon, lang: 'ar' | 'en' | 'zh') {
	return coupon.type === 'percentage'
		? `${coupon.value}%`
		: formatMoney(coupon.value, { lang, maximumFractionDigits: 2 });
}

function dateLabel(value: string | null, lang: string) {
	if (!value) return '';
	return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(value));
}

export default function CustomerCoupons() {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.language === 'ar';
	const lang: 'ar' | 'en' | 'zh' = isRTL ? 'ar' : i18n.language === 'zh' ? 'zh' : 'en';
	const { data, loading, error } = useMyCoupons();
	const coupons = data ?? [];

	return (
		<div className="min-h-screen bg-[#FAFAF7]" dir={isRTL ? 'rtl' : 'ltr'}>
			<header className="sticky top-0 z-30 bg-white border-b border-gray-200">
				<div className="max-w-4xl mx-auto px-4 lg:px-6 h-16 flex items-center gap-3">
					<Link
						to="/customer"
						className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100"
					>
						<ArrowRight
							className={cn('w-5 h-5 text-gray-700', isRTL ? 'rotate-180' : '')}
						/>
					</Link>
					<div>
						<p className="text-[10px] uppercase tracking-widest text-[#D4A853] font-bold">
							{t('customer.account')}
						</p>
						<p className="text-sm font-extrabold text-gray-900">{t('customer.myCoupons')}</p>
					</div>
				</div>
			</header>

			<div className="max-w-4xl mx-auto px-4 lg:px-6 py-6 space-y-6">
				<div className="rounded-2xl bg-gradient-to-br from-[#1A1612] via-[#2A2420] to-[#1A1612] text-white p-6 lg:p-8 relative overflow-hidden">
					<div className="absolute inset-0 opacity-10">
						<div className="absolute -top-12 -end-12 w-64 h-64 rounded-full bg-[#D4A853] blur-3xl" />
					</div>
					<div className="relative flex items-center gap-4">
						<div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center">
							<Ticket size={26} className="text-[#D4A853]" />
						</div>
						<div>
							<p className="text-xs uppercase tracking-widest text-[#D4A853] font-bold">
								{t('customer.myCoupons')}
							</p>
							<p className="text-3xl font-extrabold mt-1">{loading ? '…' : coupons.length}</p>
							<p className="text-sm text-white/60 mt-0.5">
								{t('customer.coupons.available', 'Available coupons')}
							</p>
						</div>
					</div>
				</div>

				<section>
					<div className="flex items-center justify-between mb-3">
						<h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
							<Sparkles size={16} className="text-[#D4A853]" />
							{t('customer.coupons.active', 'Active coupons')}
						</h2>
					</div>
					{error ? (
						<div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-sm text-red-700">
							{error}
						</div>
					) : loading ? (
						<div className="grid sm:grid-cols-2 gap-3">
							{[0, 1].map((item) => (
								<div key={item} className="h-36 rounded-2xl bg-gray-200 animate-pulse" />
							))}
						</div>
					) : coupons.length === 0 ? (
						<div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
							<div className="w-14 h-14 rounded-full bg-gray-100 mx-auto flex items-center justify-center mb-3">
								<X size={20} className="text-gray-400" />
							</div>
							<p className="text-sm font-semibold text-gray-700">
								{t('customer.coupons.empty', 'No active coupons are available.')}
							</p>
						</div>
					) : (
						<div className="grid sm:grid-cols-2 gap-3">
							{coupons.map((coupon, index) => (
								<div
									key={coupon.id}
									className={cn(
										'rounded-2xl border-2 bg-gradient-to-br p-5 relative overflow-hidden',
										tones[index % tones.length],
									)}
								>
									<div className="flex items-start justify-between">
										<div>
											<p className="text-xs font-bold uppercase tracking-wider text-gray-700">
												{discountLabel(coupon, lang)}
											</p>
											<p className="text-lg font-extrabold text-gray-900 mt-1">
												{coupon.description ?? coupon.code}
											</p>
										</div>
										<div className="px-3 py-1 rounded-full bg-white/70 text-xs font-bold text-gray-700">
											{coupon.code}
										</div>
									</div>
									<div className="mt-4 flex items-center justify-between text-xs">
										<span className="text-gray-600">
											{t('customer.coupons.minSpend', 'Min spend')}:{' '}
											{formatMoney(coupon.min_order_amount, { lang })}
										</span>
										{coupon.expires_at && (
											<span className="text-gray-600 inline-flex items-center gap-1">
												<Clock size={11} />
												{dateLabel(coupon.expires_at, lang)}
											</span>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</section>
			</div>
		</div>
	);
}
