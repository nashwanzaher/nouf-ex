import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Ticket, Clock, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const SAMPLE_COUPONS = [
	{
		id: 'WELCOME10',
		titleKey: 'customer.coupons.welcome',
		discount: '10%',
		minSpend: '0',
		expiresAt: '2026-12-31',
		tone: 'amber',
	},
	{
		id: 'FREESHIP',
		titleKey: 'customer.coupons.freeship',
		discount: 'Free shipping',
		minSpend: '5,000',
		expiresAt: '2026-09-30',
		tone: 'blue',
	},
	{
		id: 'SUMMER25',
		titleKey: 'customer.coupons.summer',
		discount: '25%',
		minSpend: '10,000',
		expiresAt: '2026-08-31',
		tone: 'rose',
	},
];

export default function CustomerCoupons() {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.language === 'ar';

	const tones: Record<string, string> = {
		amber: 'from-amber-50 to-amber-100 border-amber-200',
		blue: 'from-blue-50 to-blue-100 border-blue-200',
		rose: 'from-rose-50 to-rose-100 border-rose-200',
	};

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
						<p className="text-sm font-extrabold text-gray-900">
							{t('customer.myCoupons')}
						</p>
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
							<p className="text-3xl font-extrabold mt-1">{SAMPLE_COUPONS.length}</p>
							<p className="text-sm text-white/60 mt-0.5">
								{t('customer.coupons.available', 'Available coupons')}
							</p>
						</div>
					</div>
				</div>

				{/* Active coupons */}
				<section>
					<div className="flex items-center justify-between mb-3">
						<h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
							<Sparkles size={16} className="text-[#D4A853]" />
							{t('customer.coupons.active', 'Active coupons')}
						</h2>
					</div>
					<div className="grid sm:grid-cols-2 gap-3">
						{SAMPLE_COUPONS.map((c) => (
							<div
								key={c.id}
								className={cn(
									'rounded-2xl border-2 bg-gradient-to-br p-5 relative overflow-hidden',
									tones[c.tone] ?? tones.amber,
								)}
							>
								<div className="flex items-start justify-between">
									<div>
										<p className="text-xs font-bold uppercase tracking-wider text-gray-700">
											{c.discount}
										</p>
										<p className="text-lg font-extrabold text-gray-900 mt-1">
											{t(c.titleKey, c.id)}
										</p>
									</div>
									<div className="px-3 py-1 rounded-full bg-white/70 text-xs font-bold text-gray-700">
										{c.id}
									</div>
								</div>
								<div className="mt-4 flex items-center justify-between text-xs">
									<span className="text-gray-600">
										{t('customer.coupons.minSpend', 'Min spend')}: {c.minSpend}
									</span>
									<span className="text-gray-600 inline-flex items-center gap-1">
										<Clock size={11} />
										{c.expiresAt}
									</span>
								</div>
							</div>
						))}
					</div>
				</section>

				{/* Empty state for used/expired */}
				<section className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
					<div className="w-14 h-14 rounded-full bg-gray-100 mx-auto flex items-center justify-center mb-3">
						<X size={20} className="text-gray-400" />
					</div>
					<p className="text-sm font-semibold text-gray-700">
						{t('customer.coupons.usedEmpty', 'No used or expired coupons yet')}
					</p>
				</section>
			</div>
		</div>
	);
}
