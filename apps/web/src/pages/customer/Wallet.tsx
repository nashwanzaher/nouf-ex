import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Wallet, TrendingUp, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useOrders } from '@/hooks/useApi';
import { formatMoneyCompact } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function CustomerWallet() {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.language === 'ar';
	const { state } = useApp();
	const user = state.user;

	const { data: orders } = useOrders();

	// Derive a simple balance: sum of all order totals minus a flat 0% fee as
	// a placeholder. Real wallet logic (escrow, refunds, payouts) lives in
	// the `wallet` API endpoints which are not yet wired up.
	const stats = (orders ?? []).reduce(
		(acc, o) => {
			const total = Number(o.total ?? 0);
			acc.spent += total;
			if (o.payment_status === 'paid') acc.paid += total;
			if (o.status === 'refunded') acc.refunded += total;
			return acc;
		},
		{ spent: 0 as number, paid: 0 as number, refunded: 0 as number },
	);

	const balance = stats.paid - stats.refunded;

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
							{t('customer.myWallet')}
						</p>
					</div>
				</div>
			</header>

			<div className="max-w-4xl mx-auto px-4 lg:px-6 py-6 space-y-6">
				{/* Balance card */}
				<div className="rounded-2xl bg-gradient-to-br from-[#1A1612] via-[#2A2420] to-[#1A1612] text-white p-6 lg:p-8 relative overflow-hidden">
					<div className="absolute inset-0 opacity-10">
						<div className="absolute -top-12 -end-12 w-64 h-64 rounded-full bg-[#D4A853] blur-3xl" />
					</div>
					<div className="relative">
						<p className="text-xs uppercase tracking-widest text-[#D4A853] font-bold">
							{t('customer.myWallet')}
						</p>
						<p className="text-4xl lg:text-5xl font-extrabold mt-2">
							{formatMoneyCompact(balance, {
								lang: i18n.language as 'ar' | 'en' | 'zh',
							})}
						</p>
						<p className="text-sm text-white/60 mt-1">
							{user?.name ?? t('customer.guest')}
						</p>
					</div>
				</div>

				{/* Stats */}
				<div className="grid grid-cols-3 gap-3">
					<StatCard
						icon={ArrowUpRight}
						label={t('customer.spent', 'Total spent')}
						value={formatMoneyCompact(stats.spent, {
							lang: i18n.language as 'ar' | 'en' | 'zh',
						})}
						tone="blue"
					/>
					<StatCard
						icon={ArrowDownLeft}
						label={t('customer.refunded', 'Refunded')}
						value={formatMoneyCompact(stats.refunded, {
							lang: i18n.language as 'ar' | 'en' | 'zh',
						})}
						tone="red"
					/>
					<StatCard
						icon={TrendingUp}
						label={t('customer.balance', 'Available')}
						value={formatMoneyCompact(balance, {
							lang: i18n.language as 'ar' | 'en' | 'zh',
						})}
						tone="emerald"
					/>
				</div>

				{/* Recent activity */}
				<section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
					<header className="px-5 py-4 border-b border-gray-100">
						<h2 className="text-base font-bold text-gray-900">
							{t('customer.recentActivity')}
						</h2>
					</header>
					<div className="divide-y divide-gray-100">
						{(orders ?? []).slice(0, 6).map((o) => {
							const tone =
								o.status === 'refunded'
									? 'bg-red-50 text-red-700'
									: o.payment_status === 'paid'
										? 'bg-emerald-50 text-emerald-700'
										: 'bg-amber-50 text-amber-700';
							const Icon =
								o.status === 'refunded' ? ArrowDownLeft : ArrowUpRight;
							return (
								<div
									key={o.id}
									className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50"
								>
									<div
										className={cn(
											'w-10 h-10 rounded-lg flex items-center justify-center',
											tone,
										)}
									>
										<Icon size={18} />
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-semibold text-gray-900">
											#{o.order_number ?? o.id}
										</p>
										<p className="text-xs text-gray-500">
											{o.created_at?.slice(0, 10)}
										</p>
									</div>
									<p className="text-sm font-extrabold text-gray-900">
										{formatMoneyCompact(Number(o.total ?? 0), {
											lang: i18n.language as 'ar' | 'en' | 'zh',
										})}
									</p>
								</div>
							);
						})}
						{(orders ?? []).length === 0 && (
							<div className="px-5 py-12 text-center">
								<div className="w-14 h-14 rounded-full bg-gray-100 mx-auto flex items-center justify-center mb-3">
									<Wallet size={20} className="text-gray-400" />
								</div>
								<p className="text-sm font-semibold text-gray-700">
									{t('customer.noOrders')}
								</p>
							</div>
						)}
					</div>
				</section>
			</div>
		</div>
	);
}

function StatCard({
	icon: Icon,
	label,
	value,
	tone,
}: {
	icon: typeof Wallet;
	label: string;
	value: string;
	tone: 'blue' | 'red' | 'emerald';
}) {
	const tones = {
		blue: 'bg-blue-50 text-blue-700',
		red: 'bg-red-50 text-red-700',
		emerald: 'bg-emerald-50 text-emerald-700',
	};
	return (
		<div className="bg-white rounded-2xl border border-gray-200 p-4">
			<div
				className={cn(
					'w-10 h-10 rounded-lg flex items-center justify-center mb-3',
					tones[tone],
				)}
			>
				<Icon size={18} />
			</div>
			<p className="text-lg font-extrabold text-gray-900 truncate">{value}</p>
			<p className="text-xs text-gray-500 mt-0.5">{label}</p>
		</div>
	);
}
