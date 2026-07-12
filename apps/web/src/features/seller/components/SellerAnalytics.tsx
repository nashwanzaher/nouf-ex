import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { DollarSign, ShoppingBag, BarChart3, Users } from 'lucide-react';
import {
	AreaChart,
	Area,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
	Legend,
} from 'recharts';
import DashboardShell from './DashboardShell';
import { cn } from '@/lib/utils';
import { useSellerAnalytics } from '@/hooks/useApi';
import { formatMoney } from '@/lib/format';

const container = {
	hidden: { opacity: 0 },
	show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
	hidden: { opacity: 0, y: 16 },
	show: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
	},
};

const GOLD = '#D4A853';
const GREEN = '#10B981';
const RED = '#EF4444';
const BLUE = '#2563EB';

const periodOptions = [
	{ key: 'today', label: 'اليوم' },
	{ key: 'yesterday', label: 'أمس' },
	{ key: '7days', label: 'آخر ٧ أيام' },
	{ key: '30days', label: 'آخر ٣٠ يوم' },
	{ key: 'thisMonth', label: 'هذا الشهر' },
	{ key: 'lastMonth', label: 'الشهر الماضي' },
	{ key: 'custom', label: 'مخصص' },
];

export default function SellerAnalytics() {
	const { t } = useTranslation();
	const [period, setPeriod] = useState('30days');
	const { data: analytics, loading } = useSellerAnalytics();

	const stats = loading
		? [
				{ icon: DollarSign, iconColor: GREEN, bg: 'bg-[rgba(16,185,129,0.1)]', label: t('seller.statRevenue', 'Total Revenue'), value: '...', suffix: ' ر.ي' },
				{ icon: ShoppingBag, iconColor: BLUE, bg: 'bg-[rgba(37,99,235,0.1)]', label: t('seller.statOrders', 'Total Orders'), value: '...', suffix: '' },
				{ icon: BarChart3, iconColor: '#F59E0B', bg: 'bg-[rgba(245,158,11,0.1)]', label: t('seller.statAvgOrder', 'Average Order Value'), value: '...', suffix: ' ر.ي' },
				{ icon: Users, iconColor: '#8B5CF6', bg: 'bg-[rgba(139,92,246,0.1)]', label: t('seller.visitors', 'Visitors'), value: '...', suffix: '' },
			]
		: [
				{
					icon: DollarSign,
					iconColor: GREEN,
					bg: 'bg-[rgba(16,185,129,0.1)]',
					label: t('seller.statRevenue', 'Total Revenue'),
					value: analytics?.total_revenue ? formatMoney(analytics.total_revenue) : '٠',
					suffix: ' ر.ي',
				},
				{
					icon: ShoppingBag,
					iconColor: BLUE,
					bg: 'bg-[rgba(37,99,235,0.1)]',
					label: t('seller.statOrders', 'Total Orders'),
					value: analytics?.total_orders ? String(analytics.total_orders) : '٠',
					suffix: '',
				},
				{
					icon: BarChart3,
					iconColor: '#F59E0B',
					bg: 'bg-[rgba(245,158,11,0.1)]',
					label: t('seller.statAvgOrder', 'Average Order Value'),
					value: analytics?.total_revenue && analytics?.total_orders
						? formatMoney(Math.round(analytics.total_revenue / analytics.total_orders))
						: '٠',
					suffix: ' ر.ي',
				},
				{
					icon: Users,
					iconColor: '#8B5CF6',
					bg: 'bg-[rgba(139,92,246,0.1)]',
					label: t('seller.visitors', 'Visitors'),
					value: '—',
					suffix: '',
				},
			];

	return (
		<DashboardShell
			title={t('seller.analytics', 'Analytics')}
			breadcrumb={t('seller.breadcrumbAnalytics', 'Dashboard / Analytics')}
		>
			<motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
				{/* Page Header */}
				<motion.div
					variants={item}
					className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
				>
					<div>
						<h1 className="text-2xl font-amiri font-bold text-[#1A1612]">
							{t('seller.analytics', 'Analytics')}
						</h1>
						<p className="text-sm text-[#6B6B6B] font-cairo">
							{t('seller.analyticsSubtitle', 'Analyze your store performance and sales')}
						</p>
					</div>
					<div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm overflow-x-auto">
						{periodOptions.map((opt) => (
							<button
								key={opt.key}
								onClick={() => setPeriod(opt.key)}
								className={cn(
									'px-3 py-1.5 rounded-lg text-xs font-cairo font-semibold transition-all whitespace-nowrap',
									period === opt.key
										? 'bg-[#D4A853] text-[#1A1612]'
										: 'text-[#6B6B6B] hover:text-[#111111]',
								)}
							>
								{opt.label}
							</button>
						))}
					</div>
				</motion.div>

				{/* Summary Stats */}
				<motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
					{stats.map((stat, i) => (
						<div
							key={i}
							className={`flex items-center gap-3 p-4 bg-white rounded-2xl border border-[#F3EDE4] shadow-sm ${stat.bg}`}
						>
							<div className="w-11 h-11 rounded-full flex items-center justify-center">
								<stat.icon size={22} className={stat.iconColor} />
							</div>
							<div>
								<p className="font-bold text-[#1A1612] text-lg leading-tight">
									{stat.value}
									{stat.suffix && <span className="text-base font-normal ml-1">{stat.suffix}</span>}
								</p>
								<p className="text-xs text-[#AAAAAA]">{stat.label}</p>
							</div>
						</div>
					))}
				</motion.div>

				{/* Charts Section - only show if data available */}
				{!loading && analytics && (
					<>
						{/* Revenue Chart */}
						<motion.div variants={item} className="bg-white rounded-2xl border border-[#F3EDE4] p-6">
							<h2 className="text-lg font-amiri font-bold text-[#1A1612] mb-4">
								{t('seller.revenueChart', 'Revenue Overview')}
							</h2>
							<div className="h-[300px]">
								<ResponsiveContainer width="100%" height="100%">
									<AreaChart data={[]}>
										<defs>
											<linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
												<stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
												<stop offset="95%" stopColor={GOLD} stopOpacity={0} />
											</linearGradient>
										</defs>
										<CartesianGrid strokeDasharray="3 3" stroke="#F3EDE4" />
										<XAxis
											dataKey="name"
											stroke="#AAAAAA"
											fontSize={12}
											fontFamily="Cairo"
											tick={{ fill: '#AAAAAA' }}
										/>
										<YAxis
											stroke="#F3EDE4"
											fontSize={12}
											fontFamily="Cairo"
											tick={{ fill: '#AAAAAA' }}
											tickFormatter={(value) => formatMoney(value).replace(' ر.ي', '')}
										/>
										<Tooltip
											contentStyle={{
												backgroundColor: '#1A1612',
												border: 'none',
												borderRadius: '12px',
												color: '#FFFFFF',
												fontFamily: 'Cairo',
											}}
											formatter={(value: number) => [formatMoney(value), t('seller.revenue', 'Revenue')]}
										/>
										<Area
											type="monotone"
											dataKey="revenue"
											stroke={GOLD}
											strokeWidth={2}
											fillOpacity={1}
											fill="url(#revenueGradient)"
										/>
									</AreaChart>
								</ResponsiveContainer>
							</div>
							<p className="text-xs text-[#AAAAAA] text-center mt-4 font-cairo">
								{t('seller.chartDataUnavailable', 'Chart data not available for selected period')}
							</p>
						</motion.div>

						{/* Orders & Customers Grid */}
						<motion.div variants={item} className="grid lg:grid-cols-2 gap-6">
							{/* Order Status */}
							<div className="bg-white rounded-2xl border border-[#F3EDE4] p-6">
								<h2 className="text-lg font-amiri font-bold text-[#1A1612] mb-4">
									{t('seller.orderStatus', 'Order Status')}
								</h2>
								<div className="h-[280px]">
									<ResponsiveContainer width="100%" height="100%">
										<PieChart>
											<Pie
												data={[
													{ name: t('seller.statusDelivered', 'Delivered'), value: analytics.delivered_orders ?? 0 },
													{ name: t('seller.statusPending', 'Pending'), value: analytics.total_orders ? analytics.total_orders - (analytics.delivered_orders ?? 0) - (analytics.cancelled_orders ?? 0) : 0 },
													{ name: t('seller.statusCancelled', 'Cancelled'), value: analytics.cancelled_orders ?? 0 },
												]}
												cx="50%"
												cy="50%"
												innerRadius={60}
												outerRadius={100}
												paddingAngle={2}
												dataKey="value"
												nameKey="name"
												label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
												labelLine={false}
											>
												<Cell fill={GREEN} />
												<Cell fill={GOLD} />
												<Cell fill={RED} />
											</Pie>
											<Legend />
										</PieChart>
									</ResponsiveContainer>
								</div>
							</div>

							{/* Top Products - placeholder since API doesn't provide */}
							<div className="bg-white rounded-2xl border border-[#F3EDE4] p-6">
								<h2 className="text-lg font-amiri font-bold text-[#1A1612] mb-4">
									{t('seller.topProducts', 'Top Products')}
								</h2>
								<div className="space-y-3">
									{Array.from({ length: 3 }).map((_, i) => (
										<div key={i} className="flex items-center justify-between p-3 bg-[#F8F8F8] rounded-xl">
											<div className="flex items-center gap-3">
												<div className="w-10 h-10 rounded-lg bg-[#F3EDE4] flex items-center justify-center">
													<ShoppingBag size={18} className="text-[#D4A853]" />
												</div>
												<div>
													<p className="font-cairo font-medium text-[#1A1612] text-sm">
														{t('seller.topProductPlaceholder', 'Product data unavailable')}
													</p>
													<p className="text-xs text-[#AAAAAA] font-cairo">
														{t('seller.requiresAnalyticsAPI', 'Requires extended analytics API')}
													</p>
												</div>
											</div>
											<span className="text-sm font-bold text-[#D4A853]">—</span>
										</div>
									))}
								</div>
							</div>
						</motion.div>

						{/* Geographic & Traffic - placeholders */}
						<motion.div variants={item} className="grid lg:grid-cols-2 gap-6">
							<div className="bg-white rounded-2xl border border-[#F3EDE4] p-6">
								<h2 className="text-lg font-amiri font-bold text-[#1A1612] mb-4">
									{t('seller.geographicDistribution', 'Geographic Distribution')}
								</h2>
								<p className="text-sm text-[#AAAAAA] font-cairo text-center py-8">
									{t('seller.geoDataUnavailable', 'Geographic data requires extended analytics API')}
								</p>
							</div>
							<div className="bg-white rounded-2xl border border-[#F3EDE4] p-6">
								<h2 className="text-lg font-amiri font-bold text-[#1A1612] mb-4">
									{t('seller.trafficSources', 'Traffic Sources')}
								</h2>
								<p className="text-sm text-[#AAAAAA] font-cairo text-center py-8">
									{t('seller.trafficDataUnavailable', 'Traffic data requires extended analytics API')}
								</p>
							</div>
						</motion.div>

						{/* Peak Hours & Customer Types - placeholders */}
						<motion.div variants={item} className="grid lg:grid-cols-2 gap-6">
							<div className="bg-white rounded-2xl border border-[#F3EDE4] p-6">
								<h2 className="text-lg font-amiri font-bold text-[#1A1612] mb-4">
									{t('seller.peakHours', 'Peak Hours')}
								</h2>
								<p className="text-sm text-[#AAAAAA] font-cairo text-center py-8">
									{t('seller.peakHoursUnavailable', 'Peak hours data requires extended analytics API')}
								</p>
							</div>
							<div className="bg-white rounded-2xl border border-[#F3EDE4] p-6">
								<h2 className="text-lg font-amiri font-bold text-[#1A1612] mb-4">
									{t('seller.customerTypes', 'Customer Types')}
								</h2>
								<p className="text-sm text-[#AAAAAA] font-cairo text-center py-8">
									{t('seller.customerTypesUnavailable', 'Customer type data requires extended analytics API')}
								</p>
							</div>
						</motion.div>
					</>
				)}

				{loading && (
					<div className="space-y-6">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="bg-white rounded-2xl border border-[#F3EDE4] p-6 animate-pulse">
								<div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
								<div className="h-[300px] bg-gray-200 rounded" />
							</div>
						))}
					</div>
				)}
			</motion.div>
		</DashboardShell>
	);
}