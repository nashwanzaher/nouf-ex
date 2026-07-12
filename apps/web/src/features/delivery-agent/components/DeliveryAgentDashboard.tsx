import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
	AlertTriangle,
	ArrowRight,
	BarChart3,
	CircleDollarSign,
	Clock,
	Home,
	LogOut,
	MapPin,
	Package,
	PackageCheck,
	Plus,
	Settings,
	Star,
	Truck,
	Zap,
	Activity,
	Wallet,
	X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format';
import {
	useDeliveryAgentDashboard,
	useDeliveryAgentOrders,
	useDeliveryAgentMutations,
} from '@/hooks/useApi';
import {
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
	CartesianGrid,
	Area,
	AreaChart,
} from 'recharts';

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
	confirmed: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
	processing: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
	shipped: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
	out_for_delivery: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
	delivered: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
	cancelled: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
	returned: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500' },
};

const AGENT_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
	offline: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
	active: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
	busy: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
	suspended: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
	on_break: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
};

const ORDER_STEPS = ['confirmed', 'shipped', 'out_for_delivery', 'delivered'] as const;

function statusTimeline(status: string): number {
	switch (status) {
		case 'confirmed':
		case 'processing':
			return 1;
		case 'shipped':
			return 2;
		case 'out_for_delivery':
			return 3;
		case 'delivered':
			return 4;
		default:
			return 0;
	}
}

function OrderTimeline({ status }: { status: string }) {
	const { t } = useTranslation();
	const currentStep = statusTimeline(status);
	return (
		<div className="flex items-center gap-1.5 mt-3" role="list">
			{ORDER_STEPS.map((step, i) => {
				const completed = i < currentStep;
				const active = i === currentStep - 1;
				return (
					<div key={step} className="flex items-center gap-1.5 flex-1">
						<div
							className={cn(
								'flex-1 h-1 rounded-full transition-colors',
								completed || active ? 'bg-[#D4A853]' : 'bg-gray-200',
							)}
						/>
						<span
							className={cn(
								'text-[10px] font-medium shrink-0',
								completed || active ? 'text-[#D4A853]' : 'text-gray-400',
							)}
						>
							{t(`delivery.status.${step}`)}
						</span>
					</div>
				);
			})}
		</div>
	);
}

function KpiTile({
	icon: Icon,
	label,
	value,
	trend,
	trendPct,
	color,
}: {
	icon: typeof PackageCheck;
	label: string;
	value: string;
	trend: 'up' | 'down';
	trendPct: number;
	color: string;
}) {
	return (
		<div className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
			<div className="flex items-start justify-between mb-3">
				<div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
					<Icon size={18} />
				</div>
				<span
					className={cn(
						'text-[10px] font-bold flex items-center gap-0.5',
						trend === 'up' ? 'text-emerald-600' : 'text-red-600',
					)}
				>
					{trend === 'up' ? '↑' : '↓'} {trendPct}%
				</span>
			</div>
			<p className="text-2xl font-extrabold text-gray-900 truncate">{value}</p>
			<p className="text-xs text-gray-500 mt-0.5 font-medium">{label}</p>
		</div>
	);
}

function StatusTile({
	icon: Icon,
	label,
	count,
	color,
}: {
	icon: typeof PackageCheck;
	label: string;
	count: number;
	color: string;
}) {
	return (
		<Link
			to={`/delivery-agent/orders?status=${color}`}
			className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-[#D4A853]/40 transition-all group"
		>
			<div className="flex items-center justify-between mb-2">
				<Icon size={18} className="text-white" />
				{count > 0 && (
					<span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
						{count}
					</span>
				)}
			</div>
			<p className="text-2xl font-extrabold text-gray-900">{count}</p>
			<p className="text-xs text-gray-500 mt-0.5 font-medium">{label}</p>
		</Link>
	);
}

function HealthMetric({
	label,
	value,
	color,
	invert,
}: {
	label: string;
	value: number;
	color: 'emerald' | 'amber';
	invert?: boolean;
}) {
	const isGood = invert ? value < 5 : value >= 80;
	const barColor =
		(isGood && color === 'emerald') || (isGood && color === 'amber')
			? isGood
				? 'bg-emerald-500'
				: 'bg-amber-500'
			: 'bg-red-500';
	return (
		<div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
			<div className="flex items-center justify-between mb-1.5">
				<span className="text-[11px] font-bold text-gray-700">{label}</span>
				<span
					className={cn(
						'text-sm font-extrabold',
						isGood ? 'text-emerald-700' : 'text-amber-700',
					)}
				>
					{value}%
				</span>
			</div>
			<div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
				<div
					className={cn('h-full transition-all', barColor)}
					style={{ width: `${Math.min(value, 100)}%` }}
				/>
			</div>
		</div>
	);
}

export default function DeliveryAgentDashboard() {
	const { t, i18n } = useTranslation();
	const lang: 'ar' | 'en' | 'zh' = (i18n.language as 'ar' | 'en' | 'zh') || 'en';
	const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [showAvailableOrders, setShowAvailableOrders] = useState(false);

	const dashboard = useDeliveryAgentDashboard();
	const orders = useDeliveryAgentOrders();
	const mutations = useDeliveryAgentMutations();

	const isLoading = dashboard.loading || orders.loading;

	const agent = dashboard.data?.agent;
	const stats = dashboard.data?.stats;
	const earningsHistory = dashboard.data?.earningsHistory;
	const recentOrders = useMemo(
		() => (orders.data?.slice(0, 6) ?? []),
		[orders.data],
	);

	const statusCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		(orders.data ?? []).forEach((o) => {
			counts[o.status] = (counts[o.status] ?? 0) + 1;
		});
		return counts;
	}, [orders.data]);

	const handleGoOnline = async () => {
		await mutations.goOnline();
		await mutations.refreshAll();
	};

	const handleGoOffline = async () => {
		await mutations.goOffline();
		await mutations.refreshAll();
	};

	if (!isLoading && (!dashboard.data || dashboard.error)) {
		return (
			<div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
				<div className="w-16 h-16 rounded-full bg-red-50 mx-auto flex items-center justify-center mb-4">
					<AlertTriangle size={28} className="text-red-500" />
				</div>
				<h2 className="text-lg font-bold text-gray-900">{t('delivery.noProfileTitle')}</h2>
				<p className="text-sm text-gray-500 mt-1 mb-5">{t('delivery.noProfileSubtitle')}</p>
				<Link
					to="/delivery-agent/register"
					className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#D4A853] hover:bg-[#B8923F] text-white text-sm font-bold transition-colors"
				>
					<Plus size={14} />
					{t('delivery.registerAgent')}
				</Link>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#FAFAF7]" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
			{/* HERO */}
			<div className="rounded-2xl bg-gradient-to-br from-[#1A1612] via-[#2A2420] to-[#1A1612] text-white p-6 lg:p-8 mb-6 relative overflow-hidden">
				<div className="absolute inset-0 opacity-10">
					<div className="absolute -top-12 -end-12 w-64 h-64 rounded-full bg-[#D4A853] blur-3xl" />
					<div className="absolute -bottom-12 -start-12 w-64 h-64 rounded-full bg-[#D4A853] blur-3xl" />
				</div>
				<div className="relative flex flex-wrap items-center justify-between gap-4">
					<div>
						<p className="text-xs uppercase tracking-widest text-[#D4A853] font-bold">
							{t('delivery.dashboard.title')}
						</p>
						<h1 className="text-2xl lg:text-3xl font-bold mt-1">
							{t('delivery.welcome')} ·{' '}
							<span className="text-[#D4A853]">{agent?.user?.full_name ?? t('delivery.agent')}</span>
						</h1>
						<p className="text-sm text-white/60 mt-1">
							{t('delivery.dashboard.subtitle')}
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						{agent && agent.status !== 'active' ? (
							<button
								onClick={handleGoOnline}
								className="px-4 py-2 rounded-full bg-[#D4A853] hover:bg-[#B8923F] text-sm font-bold transition-colors flex items-center gap-2"
							>
								<Activity size={14} />
								{t('delivery.goOnline')}
							</button>
						) : agent && agent.status === 'active' ? (
							<button
								onClick={handleGoOffline}
								className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-sm font-medium transition-colors flex items-center gap-2"
							>
								<Activity size={14} />
								{t('delivery.goOffline')}
							</button>
						) : (
							<Link
								to="/delivery-agent/register"
								className="px-4 py-2 rounded-full bg-[#D4A853] hover:bg-[#B8923F] text-sm font-bold transition-colors flex items-center gap-2"
							>
								<Plus size={14} />
								{t('delivery.registerAgent')}
							</Link>
						)}
						<Link
							to="/delivery-agent/available-orders"
							className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-sm font-medium transition-colors flex items-center gap-2"
						>
							<Package size={14} />
							{t('delivery.availableOrders')}
						</Link>
					</div>
				</div>

				{/* Agent Status Badge */}
				{agent && (
					<div className="mt-6 flex flex-wrap items-center gap-3">
						<span className="text-xs text-white/60">{t('delivery.status')}:</span>
						<span
							className={cn(
								'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
								AGENT_STATUS_COLORS[agent.status]?.bg,
								AGENT_STATUS_COLORS[agent.status]?.text,
							)}
						>
							<span className={cn('w-1.5 h-1.5 rounded-full', AGENT_STATUS_COLORS[agent.status]?.dot)} />
							{t(`delivery.agentStatus.${agent.status}`)}
						</span>
						{agent.vehicle_type && (
							<span className="px-2.5 py-1 rounded-full bg-white/10 text-xs font-medium">
								{t('delivery.vehicleType')} {t(`delivery.vehicle.${agent.vehicle_type}`)}
							</span>
						)}
					</div>
				)}
			</div>

			{/* KPI STRIP */}
			<div className="max-w-[1400px] mx-auto px-4 lg:px-6 mb-6">
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
					<KpiTile
						icon={CircleDollarSign}
						label={t('delivery.todayEarnings')}
						value={formatMoney(Number(stats?.earnings_today ?? 0), { lang })}
						trend="up"
						trendPct={12}
						color="bg-emerald-50 text-emerald-700"
					/>
					<KpiTile
						icon={PackageCheck}
						label={t('delivery.completedToday')}
						value={String(stats?.completed_today ?? 0)}
						trend="up"
						trendPct={8}
						color="bg-blue-50 text-blue-700"
					/>
					<KpiTile
						icon={Clock}
						label={t('delivery.avgDeliveryTime')}
						value={`${stats?.avg_delivery_time ?? 0} ${t('delivery.minutes')}`}
						trend="down"
						trendPct={3}
						color="bg-purple-50 text-purple-700"
					/>
					<KpiTile
						icon={Star}
						label={t('delivery.rating')}
						value={String(stats?.rating?.toFixed(1) ?? '5.0')}
						trend="up"
						trendPct={1.2}
						color="bg-amber-50 text-amber-700"
					/>
				</div>
			</div>

			{/* STATUS LANES */}
			<div className="max-w-[1400px] mx-auto px-4 lg:px-6 mb-6">
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
					<StatusTile
						icon={Package}
						label={t('delivery.pendingPickup')}
						count={(statusCounts.confirmed || 0) + (statusCounts.processing || 0)}
						color="bg-blue-500 text-blue-700"
					/>
					<StatusTile
						icon={Truck}
						label={t('delivery.outForDelivery')}
						count={statusCounts.out_for_delivery || 0}
						color="bg-amber-500 text-amber-700"
					/>
					<StatusTile
						icon={PackageCheck}
						label={t('delivery.delivered')}
						count={statusCounts.delivered || 0}
						color="bg-emerald-500 text-emerald-700"
					/>
					<StatusTile
						icon={AlertTriangle}
						label={t('delivery.cancelledReturns')}
						count={(statusCounts.cancelled || 0) + (statusCounts.returned || 0)}
						color="bg-red-500 text-red-700"
					/>
				</div>
			</div>

			<div className="max-w-[1400px] mx-auto px-4 lg:px-6">
				<div className="grid lg:grid-cols-3 gap-6 mb-6">
					{/* RECENT ORDERS - 2/3 width */}
					<section className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
						<header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
							<h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
								<Package size={16} className="text-[#D4A853]" />
								{t('delivery.liveDeliveries')}
							</h2>
							<Link
								to="/delivery-agent/orders"
								className="text-xs font-bold text-[#D4A853] hover:text-[#B8923F] flex items-center gap-1"
							>
								{t('common.viewAll')}
								<ArrowRight size={12} className={lang === 'ar' ? 'rotate-180' : ''} />
							</Link>
						</header>
						<div className="divide-y divide-gray-100">
							{orders.loading ? (
								Array.from({ length: 3 }).map((_, i) => (
									<div key={i} className="px-5 py-3 animate-pulse">
										<div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
										<div className="h-3 bg-gray-200 rounded w-1/2" />
									</div>
								))
							) : recentOrders.length === 0 ? (
								<div className="px-5 py-10 text-center">
									<div className="w-12 h-12 rounded-full bg-gray-100 mx-auto flex items-center justify-center mb-2">
										<Package size={18} className="text-gray-400" />
									</div>
									<p className="text-sm font-semibold text-gray-700">{t('delivery.noOrdersYet')}</p>
								</div>
							) : (
								recentOrders.map((order) => {
									const colors = STATUS_COLORS[order.status] ?? STATUS_COLORS.confirmed;
									return (
										<Link
											key={order.id}
											to={`/delivery-agent/orders/${order.id}`}
											className="block p-4 lg:p-5 hover:bg-gray-50 transition-colors group"
										>
											<div className="flex flex-wrap items-start justify-between gap-3 mb-3">
												<div>
													<p className="text-xs text-gray-500">
														{t('delivery.orderNumber')} <span className="font-bold text-gray-900">#{order.order_number ?? order.id}</span>
													</p>
													<p className="text-[10px] text-gray-400 mt-0.5">
														{new Date(order.created_at).toLocaleString()}
														{order.store_name && ` · ${order.store_name}`}
													</p>
												</div>
												<span
													className={cn(
														'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
														colors.bg,
														colors.text,
													)}
												>
													<span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
													{t(`delivery.status.${order.status}`)}
												</span>
											</div>

											<OrderTimeline status={order.status} />

											<div className="flex items-center justify-between mt-3">
												<p className="text-base font-extrabold text-gray-900">
													{formatMoney(Number(order.total ?? 0), { lang })}
												</p>
												<div className="flex items-center gap-2">
													{['shipped', 'out_for_delivery'].includes(order.status) && (
														<span className="text-[10px] font-bold uppercase tracking-wider text-[#D4A853] px-2 py-1 rounded-full bg-[#D4A853]/10">
															{t('delivery.trackOrder')}
														</span>
													)}
													<ArrowRight
														className={cn(
															'w-4 h-4 text-gray-400 group-hover:text-[#D4A853] transition-colors',
															lang === 'ar' ? 'rotate-180' : '',
														)}
													/>
												</div>
											</div>
										</Link>
									);
								})
							)}
						</div>
					</section>

					{/* PERFORMANCE SCORE - 1/3 width */}
					<section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
						<header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
							<h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
								<Zap size={16} className="text-[#D4A853]" />
								{t('delivery.performanceScore')}
							</h2>
						</header>
						<div className="p-5 space-y-4">
							<HealthMetric
								label={t('delivery.onTimeDelivery')}
								value={Math.min(100, Math.round((stats?.completed_today ?? 0) / Math.max(1, stats?.total_assigned ?? 1) * 100))}
								color="emerald"
							/>
							<HealthMetric
								label={t('delivery.cancelRate')}
								value={Math.round((stats?.pending ?? 0) / Math.max(1, stats?.total_assigned ?? 1) * 100)}
								invert
								color="emerald"
							/>
							<HealthMetric
								label={t('delivery.rating')}
								value={Math.round((stats?.rating ?? 5) * 20)}
								color="amber"
							/>
							<HealthMetric
								label={t('delivery.avgTime')}
								value={Math.max(0, 100 - (stats?.avg_delivery_time ?? 30))}
								color="amber"
							/>
						</div>
						<div className="px-5 pb-5 pt-0">
							<div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200">
								<p className="text-xs font-bold text-amber-700 uppercase tracking-wider">
									{t('delivery.tipsTitle')}
								</p>
								<p className="text-sm text-gray-700 mt-1">
									{t('delivery.tipsBody')}
								</p>
							</div>
						</div>
					</section>
				</div>

				{/* EARNINGS CHART + QUICK ACTIONS */}
				<div className="grid lg:grid-cols-2 gap-6 mb-6">
					{/* EARNINGS CHART */}
					<section className="bg-white rounded-2xl border border-gray-200 p-6">
						<div className="flex flex-wrap items-center justify-between gap-3 mb-4">
							<div>
								<h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
									<BarChart3 size={16} className="text-[#D4A853]" />
									{t('delivery.earningsChart')}
								</h2>
								<p className="text-xs text-gray-500 mt-0.5">{t('delivery.vsPrevPeriod')}</p>
							</div>
							<div className="inline-flex rounded-full bg-gray-100 p-1 text-xs font-semibold">
								{(['7d', '30d', '90d'] as const).map((p) => (
									<button
										key={p}
										onClick={() => setPeriod(p)}
										className={cn(
											'px-4 py-1.5 rounded-full transition-colors',
											period === p
												? 'bg-white text-gray-900 shadow-sm'
												: 'text-gray-500 hover:text-gray-900',
										)}
									>
										{t(`delivery.period${p.charAt(0).toUpperCase() + p.slice(1)}`)}
									</button>
								))}
							</div>
						</div>
						<div className="h-64 -mx-2">
							<ResponsiveContainer width="100%" height="100%">
								<AreaChart data={earningsHistory?.slice().reverse() ?? []}>
									<defs>
										<linearGradient id="earn" x1="0" y1="0" x2="0" y2="1">
											<stop offset="5%" stopColor="#D4A853" stopOpacity={0.35} />
											<stop offset="95%" stopColor="#D4A853" stopOpacity={0} />
										</linearGradient>
									</defs>
									<CartesianGrid strokeDasharray="3 3" stroke="#F0EDE5" />
									<XAxis
										dataKey="date"
										stroke="#9CA3AF"
										tick={{ fontSize: 11 }}
										tickLine={false}
										axisLine={false}
									/>
									<YAxis
										stroke="#9CA3AF"
										tick={{ fontSize: 11 }}
										tickLine={false}
										axisLine={false}
									/>
									<Tooltip
										contentStyle={{
											borderRadius: 12,
											border: '1px solid #E5E7EB',
											fontSize: 12,
										}}
										formatter={(v: number) => [formatMoney(v, { lang }), t('delivery.earnings')]}
									/>
									<Area
										type="monotone"
										dataKey="earnings"
										stroke="#D4A853"
										strokeWidth={2}
										fill="url(#earn)"
									/>
								</AreaChart>
							</ResponsiveContainer>
						</div>
						<div className="flex items-center gap-4 mt-3 text-xs">
							<span className="flex items-center gap-1.5 text-gray-600">
								<span className="w-2.5 h-2.5 rounded-full bg-[#D4A853]" />
								{t('delivery.dailyEarnings')}
							</span>
						</div>
					</section>

					{/* QUICK ACTIONS */}
					<section className="bg-white rounded-2xl border border-gray-200 p-6">
						<h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
							<Zap size={16} className="text-[#D4A853]" />
							{t('delivery.quickActions')}
						</h2>
						<div className="grid grid-cols-3 gap-2">
							{[
								{ icon: Package, label: t('delivery.viewOrders'), path: '/delivery-agent/orders', color: 'bg-orange-50 text-orange-700' },
								{ icon: MapPin, label: t('delivery.availableOrders'), path: '/delivery-agent/available-orders', color: 'bg-blue-50 text-blue-700' },
								{ icon: CircleDollarSign, label: t('delivery.earnings'), path: '/delivery-agent/earnings', color: 'bg-emerald-50 text-emerald-700' },
								{ icon: Star, label: t('delivery.ratings'), path: '/delivery-agent/ratings', color: 'bg-amber-50 text-amber-700' },
								{ icon: Wallet, label: t('delivery.wallet'), path: '/delivery-agent/wallet', color: 'bg-purple-50 text-purple-700' },
								{ icon: Settings, label: t('delivery.profile'), path: '/delivery-agent/profile', color: 'bg-gray-100 text-gray-600' },
							].map((q) => (
								<Link
									key={q.path}
									to={q.path}
									className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-200 hover:shadow-md hover:border-[#D4A853]/40 transition-all"
								>
									<div
										className={cn(
											'w-10 h-10 rounded-lg flex items-center justify-center',
											q.color,
										)}
									>
										<q.icon size={18} />
									</div>
									<span className="text-[11px] font-semibold text-gray-700 text-center leading-tight">
										{q.label}
									</span>
								</Link>
							))}
						</div>
					</section>
				</div>

				{/* AVAILABLE ORDERS PREVIEW */}
				{showAvailableOrders && (
					<section className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
						<header className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
							<h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
								<Package size={16} className="text-[#D4A853]" />
								{t('delivery.availableOrdersTitle')}
							</h2>
							<button
								onClick={() => setShowAvailableOrders(false)}
								className="text-xs font-bold text-[#D4A853] hover:text-[#B8923F]"
							>
								{t('common.close')}
							</button>
						</header>
						<div className="divide-y divide-gray-100">
							{/* Available orders would be listed here */}
						</div>
					</section>
				)}
			</div>

			{/* Mobile menu drawer */}
			{mobileMenuOpen && (
				<div className="lg:hidden fixed inset-0 z-50">
					<div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
					<div className="absolute top-0 h-full w-72 bg-white shadow-2xl overflow-y-auto" style={{ right: 0 }}>
						<div className="p-4 border-b border-gray-200 flex items-center justify-between">
							<span className="font-bold text-lg">{t('delivery.dashboard.title')}</span>
							<button onClick={() => setMobileMenuOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
								<X size={16} />
							</button>
						</div>
						<nav className="p-4 space-y-1">
							{[
								{ icon: Home, label: 'delivery.dashboard', path: '/delivery-agent' },
								{ icon: Package, label: 'delivery.orders', path: '/delivery-agent/orders' },
								{ icon: MapPin, label: 'delivery.availableOrders', path: '/delivery-agent/available-orders' },
								{ icon: CircleDollarSign, label: 'delivery.earnings', path: '/delivery-agent/earnings' },
								{ icon: Wallet, label: 'delivery.wallet', path: '/delivery-agent/wallet' },
								{ icon: Star, label: 'delivery.ratings', path: '/delivery-agent/ratings' },
								{ icon: Settings, label: 'delivery.profile', path: '/delivery-agent/profile' },
							].map((item) => (
								<Link
									key={item.path}
									to={item.path}
									onClick={() => setMobileMenuOpen(false)}
									className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
								>
									<item.icon size={18} className="text-gray-500" />
									<span>{t(item.label)}</span>
								</Link>
							))}
							<button onClick={handleGoOffline} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 text-sm font-medium text-red-600">
								<LogOut size={18} />
								<span>{t('nav.logout')}</span>
							</button>
						</nav>
					</div>
				</div>
			)}
		</div>
	);
}