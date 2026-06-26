import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, Users, BarChart3 } from 'lucide-react';
import {
	AreaChart,
	Area,
	BarChart,
	Bar,
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

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const monthlyRevenue = [
	{ name: 'يناير', revenue: 850000, orders: 42 },
	{ name: 'فبراير', revenue: 620000, orders: 31 },
	{ name: 'مارس', revenue: 980000, orders: 49 },
	{ name: 'أبريل', revenue: 1150000, orders: 58 },
	{ name: 'مايو', revenue: 1320000, orders: 66 },
	{ name: 'يونيو', revenue: 2450000, orders: 124 },
];

const dailyOrders = [
	{ name: '١', orders: 8 },
	{ name: '٢', orders: 12 },
	{ name: '٣', orders: 6 },
	{ name: '٤', orders: 15 },
	{ name: '٥', orders: 10 },
	{ name: '٦', orders: 18 },
	{ name: '٧', orders: 22 },
	{ name: '٨', orders: 14 },
	{ name: '٩', orders: 20 },
	{ name: '١٠', orders: 16 },
	{ name: '١١', orders: 24 },
	{ name: '١٢', orders: 19 },
	{ name: '١٣', orders: 11 },
	{ name: '١٤', orders: 7 },
	{ name: '١٥', orders: 13 },
];

const trafficSources = [
	{ name: 'مباشر', value: 35, color: '#D4A853' },
	{ name: 'بحث', value: 28, color: '#2563EB' },
	{ name: 'سوشيال', value: 22, color: '#10B981' },
	{ name: 'إحالة', value: 15, color: '#F59E0B' },
];

const topProductsAnalytics = [
	{
		name: 'ساعة ذكية أبل واتش سلسلة ٩',
		views: 1240,
		carts: 340,
		orders: 86,
		revenue: '٣,٨٧٠,٠٠٠',
		conversion: '٦.٩٪',
	},
	{
		name: 'سماعات AirPods Pro الجيل الثاني',
		views: 980,
		carts: 280,
		orders: 74,
		revenue: '٢,٤٠٥,٠٠٠',
		conversion: '٧.٥٪',
	},
	{
		name: 'هاتف Samsung Galaxy S24 Ultra',
		views: 2100,
		carts: 450,
		orders: 62,
		revenue: '١٧,٦٧٠,٠٠٠',
		conversion: '٣.٠٪',
	},
	{
		name: 'ماك بوك برو ١٤ بوصة M3',
		views: 1560,
		carts: 210,
		orders: 45,
		revenue: '٩,٤٥٠,٠٠٠',
		conversion: '٢.٩٪',
	},
	{
		name: 'آيباد آير الجيل الخامس',
		views: 890,
		carts: 180,
		orders: 38,
		revenue: '٧,٠٣٠,٠٠٠',
		conversion: '٤.٣٪',
	},
	{
		name: 'عسل يمني سدر كيلو',
		views: 1100,
		carts: 290,
		orders: 52,
		revenue: '٦٥٠,٠٠٠',
		conversion: '٤.٧٪',
	},
];

const customerTypes = [
	{ name: 'عملاء جدد', value: 62, color: '#D4A853' },
	{ name: 'عملاء عائدون', value: 38, color: '#2563EB' },
];

const peakHours = [
	{ name: '٦-٩ ص', orders: 12 },
	{ name: '٩-١٢ ص', orders: 28 },
	{ name: '١٢-٣ م', orders: 35 },
	{ name: '٣-٦ م', orders: 42 },
	{ name: '٦-٩ م', orders: 38 },
	{ name: '٩-١٢ ص', orders: 18 },
];

const geographicData = [
	{ city: 'صنعاء', customers: 420, percent: 35 },
	{ city: 'عدن', customers: 280, percent: 23 },
	{ city: 'تعز', customers: 180, percent: 15 },
	{ city: 'حضرموت', customers: 150, percent: 13 },
	{ city: 'إب', customers: 100, percent: 8 },
	{ city: 'أخرى', customers: 70, percent: 6 },
];

const periodOptions = [
	{ key: 'today', label: 'اليوم' },
	{ key: 'yesterday', label: 'أمس' },
	{ key: '7days', label: 'آخر ٧ أيام' },
	{ key: '30days', label: 'آخر ٣٠ يوم' },
	{ key: 'thisMonth', label: 'هذا الشهر' },
	{ key: 'lastMonth', label: 'الشهر الماضي' },
	{ key: 'custom', label: 'مخصص' },
];

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

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

export default function SellerAnalytics() {
	const { t } = useTranslation();
	const [period, setPeriod] = useState('30days');

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
							{t(
								'seller.analyticsSubtitle',
								'Analyze your store performance and sales',
							)}
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
					{[
						{
							icon: DollarSign,
							iconColor: '#10B981',
							bg: 'bg-[rgba(16,185,129,0.1)]',
							label: t('seller.statRevenue', 'Total Revenue'),
							value: '٢,٤٥٠,٠٠٠',
							suffix: ' ر.ي',
							change: '+١٨٪',
							up: true,
						},
						{
							icon: ShoppingBag,
							iconColor: '#2563EB',
							bg: 'bg-[rgba(37,99,235,0.1)]',
							label: t('seller.statOrders', 'Total Orders'),
							value: '١٢٤',
							suffix: '',
							change: '+٨',
							up: true,
						},
						{
							icon: BarChart3,
							iconColor: '#F59E0B',
							bg: 'bg-[rgba(245,158,11,0.1)]',
							label: t('seller.statAvgOrder', 'Average Order Value'),
							value: '١٩,٧٥٠',
							suffix: ' ر.ي',
							change: '+٥٪',
							up: true,
						},
						{
							icon: Users,
							iconColor: '#8B5CF6',
							bg: 'bg-[rgba(139,92,246,0.1)]',
							label: t('seller.visitors', 'Visitors'),
							value: '٣,٤٢٠',
							suffix: '',
							change: '-٢٪',
							up: false,
						},
					].map((stat, i) => (
						<div key={i} className="bg-white rounded-2xl p-4 md:p-5 shadow-sm">
							<div className="flex items-start justify-between mb-3">
								<div
									className={cn(
										'w-10 h-10 rounded-xl flex items-center justify-center',
										stat.bg,
									)}
								>
									<stat.icon
										className="w-5 h-5"
										style={{ color: stat.iconColor }}
										strokeWidth={1.5}
									/>
								</div>
								<span
									className={cn(
										'flex items-center gap-0.5 text-[11px] font-bold font-cairo px-1.5 py-0.5 rounded-md',
										stat.up
											? 'text-[#10B981] bg-[rgba(16,185,129,0.1)]'
											: 'text-[#EF4444] bg-[rgba(239,68,68,0.1)]',
									)}
								>
									{stat.up ? (
										<TrendingUp className="w-3 h-3" />
									) : (
										<TrendingDown className="w-3 h-3" />
									)}
									{stat.change}
								</span>
							</div>
							<p className="text-xs text-[#6B6B6B] font-cairo mb-1">{stat.label}</p>
							<p className="text-lg md:text-xl font-bold text-[#111111] font-mono">
								{stat.value}
								<span className="text-xs text-[#6B6B6B]">{stat.suffix}</span>
							</p>
						</div>
					))}
				</motion.div>

				{/* Revenue Chart */}
				<motion.div variants={item} className="bg-white rounded-2xl p-5 shadow-sm">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-base font-amiri font-bold text-[#1A1612]">
							{t('seller.monthlyRevenue', 'Monthly Revenue')}
						</h3>
					</div>
					<div className="h-72">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={monthlyRevenue}>
								<defs>
									<linearGradient id="revGold" x1="0" y1="0" x2="0" y2="1">
										<stop offset="0%" stopColor="#D4A853" stopOpacity={0.4} />
										<stop offset="100%" stopColor="#D4A853" stopOpacity={0} />
									</linearGradient>
								</defs>
								<CartesianGrid strokeDasharray="3 3" stroke="#F3EDE4" />
								<XAxis
									dataKey="name"
									tick={{ fontSize: 11, fill: '#6B6B6B', fontFamily: 'Cairo' }}
									axisLine={false}
									tickLine={false}
								/>
								<YAxis
									tick={{ fontSize: 11, fill: '#6B6B6B', fontFamily: 'Cairo' }}
									axisLine={false}
									tickLine={false}
									tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
								/>
								<Tooltip
									contentStyle={{
										borderRadius: 12,
										border: '1px solid #F3EDE4',
										fontFamily: 'Cairo',
										fontSize: 12,
									}}
									formatter={(value: number) => [
										`${value.toLocaleString()} ر.ي`,
										t('seller.revenue', 'Revenue'),
									]}
								/>
								<Area
									type="monotone"
									dataKey="revenue"
									stroke="#D4A853"
									strokeWidth={2.5}
									fill="url(#revGold)"
									name={t('seller.revenue', 'Revenue')}
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</motion.div>

				{/* Orders Bar Chart + Traffic Sources */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Daily Orders Bar Chart */}
					<motion.div variants={item} className="bg-white rounded-2xl p-5 shadow-sm">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-base font-amiri font-bold text-[#1A1612]">
								{t('seller.dailyOrders', 'Daily Orders')}
							</h3>
						</div>
						<div className="h-64">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={dailyOrders}>
									<CartesianGrid
										strokeDasharray="3 3"
										stroke="#F3EDE4"
										vertical={false}
									/>
									<XAxis
										dataKey="name"
										tick={{
											fontSize: 10,
											fill: '#6B6B6B',
											fontFamily: 'Cairo',
										}}
										axisLine={false}
										tickLine={false}
									/>
									<YAxis
										tick={{
											fontSize: 11,
											fill: '#6B6B6B',
											fontFamily: 'Cairo',
										}}
										axisLine={false}
										tickLine={false}
									/>
									<Tooltip
										contentStyle={{
											borderRadius: 12,
											border: '1px solid #F3EDE4',
											fontFamily: 'Cairo',
											fontSize: 12,
										}}
										formatter={(value: number) => [
											`${value}`,
											t('seller.orders', 'Orders'),
										]}
									/>
									<Bar
										dataKey="orders"
										fill="#D4A853"
										radius={[6, 6, 0, 0]}
										name={t('seller.orders', 'Orders')}
									/>
								</BarChart>
							</ResponsiveContainer>
						</div>
					</motion.div>

					{/* Traffic Sources Pie Chart */}
					<motion.div variants={item} className="bg-white rounded-2xl p-5 shadow-sm">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-base font-amiri font-bold text-[#1A1612]">
								{t('seller.trafficSources', 'Traffic Sources')}
							</h3>
						</div>
						<div className="h-64 flex items-center">
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={trafficSources}
										cx="50%"
										cy="50%"
										innerRadius={55}
										outerRadius={90}
										paddingAngle={3}
										dataKey="value"
										strokeWidth={0}
									>
										{trafficSources.map((entry, index) => (
											<Cell key={`cell-${index}`} fill={entry.color} />
										))}
									</Pie>
									<Tooltip
										contentStyle={{
											borderRadius: 12,
											border: '1px solid #F3EDE4',
											fontFamily: 'Cairo',
											fontSize: 12,
										}}
										formatter={(value: number) => [`${value}%`, '']}
									/>
									<Legend
										verticalAlign="middle"
										align="left"
										layout="vertical"
										iconType="circle"
										iconSize={8}
										formatter={(value: string) => (
											<span className="text-xs font-cairo mr-1">{value}</span>
										)}
									/>
								</PieChart>
							</ResponsiveContainer>
						</div>
					</motion.div>
				</div>

				{/* Top Products Table */}
				<motion.div variants={item} className="bg-white rounded-2xl p-5 shadow-sm">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-base font-amiri font-bold text-[#1A1612]">
							{t('seller.topProducts', 'Top Performing Products')}
						</h3>
					</div>
					<div className="overflow-x-auto -mx-2">
						<table className="w-full min-w-[700px]">
							<thead>
								<tr className="text-right border-b border-[#F3EDE4]">
									<th className="pb-3 pr-2 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
										{t('seller.tableProduct', 'Product')}
									</th>
									<th className="pb-3 px-2 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
										{t('seller.tableViews', 'Views')}
									</th>
									<th className="pb-3 px-2 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
										{t('seller.tableCarts', 'Carts')}
									</th>
									<th className="pb-3 px-2 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
										{t('seller.tableOrders', 'Orders')}
									</th>
									<th className="pb-3 px-2 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
										{t('seller.revenue', 'Revenue')}
									</th>
									<th className="pb-3 pl-2 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
										{t('seller.conversion', 'Conversion')}
									</th>
								</tr>
							</thead>
							<tbody>
								{topProductsAnalytics.map((product, i) => (
									<tr
										key={i}
										className="border-b border-[#F3EDE4]/50 last:border-0 hover:bg-[#F8F8F8] transition-colors"
									>
										<td className="py-3 pr-2 text-xs font-cairo font-semibold text-[#111111]">
											{product.name}
										</td>
										<td className="py-3 px-2 text-xs font-mono text-[#6B6B6B]">
											{product.views}
										</td>
										<td className="py-3 px-2 text-xs font-mono text-[#6B6B6B]">
											{product.carts}
										</td>
										<td className="py-3 px-2 text-xs font-mono text-[#111111] font-semibold">
											{product.orders}
										</td>
										<td className="py-3 px-2 text-xs font-mono text-[#D4A853] font-semibold">
											{product.revenue} ر.ي
										</td>
										<td className="py-3 pl-2">
											<span className="px-2 py-1 rounded-lg text-[11px] font-bold font-cairo bg-[rgba(16,185,129,0.1)] text-[#10B981]">
												{product.conversion}
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</motion.div>

				{/* Customer Demographics Row */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* New vs Returning */}
					<motion.div variants={item} className="bg-white rounded-2xl p-5 shadow-sm">
						<h3 className="text-base font-amiri font-bold text-[#1A1612] mb-4">
							{t('seller.newVsReturning', 'New vs Returning Customers')}
						</h3>
						<div className="h-48">
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={customerTypes}
										cx="50%"
										cy="50%"
										innerRadius={40}
										outerRadius={70}
										paddingAngle={4}
										dataKey="value"
										strokeWidth={0}
									>
										{customerTypes.map((entry, index) => (
											<Cell key={`cell-${index}`} fill={entry.color} />
										))}
									</Pie>
									<Tooltip
										contentStyle={{
											borderRadius: 12,
											border: '1px solid #F3EDE4',
											fontFamily: 'Cairo',
											fontSize: 12,
										}}
										formatter={(value: number) => [`${value}%`, '']}
									/>
									<Legend
										verticalAlign="bottom"
										iconType="circle"
										iconSize={8}
										formatter={(value: string) => (
											<span className="text-xs font-cairo mr-1">{value}</span>
										)}
									/>
								</PieChart>
							</ResponsiveContainer>
						</div>
					</motion.div>

					{/* Peak Hours */}
					<motion.div variants={item} className="bg-white rounded-2xl p-5 shadow-sm">
						<h3 className="text-base font-amiri font-bold text-[#1A1612] mb-4">
							{t('seller.peakHours', 'Peak Hours')}
						</h3>
						<div className="h-48">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={peakHours}>
									<CartesianGrid
										strokeDasharray="3 3"
										stroke="#F3EDE4"
										vertical={false}
									/>
									<XAxis
										dataKey="name"
										tick={{
											fontSize: 10,
											fill: '#6B6B6B',
											fontFamily: 'Cairo',
										}}
										axisLine={false}
										tickLine={false}
									/>
									<YAxis
										tick={{
											fontSize: 10,
											fill: '#6B6B6B',
											fontFamily: 'Cairo',
										}}
										axisLine={false}
										tickLine={false}
									/>
									<Tooltip
										contentStyle={{
											borderRadius: 12,
											border: '1px solid #F3EDE4',
											fontFamily: 'Cairo',
											fontSize: 12,
										}}
										formatter={(value: number) => [
											`${value}`,
											t('seller.orders', 'Orders'),
										]}
									/>
									<Bar dataKey="orders" fill="#2563EB" radius={[4, 4, 0, 0]} />
								</BarChart>
							</ResponsiveContainer>
						</div>
					</motion.div>

					{/* Geographic Distribution */}
					<motion.div variants={item} className="bg-white rounded-2xl p-5 shadow-sm">
						<h3 className="text-base font-amiri font-bold text-[#1A1612] mb-4">
							{t('seller.geographicDistribution', 'Geographic Distribution')}
						</h3>
						<div className="space-y-3">
							{geographicData.map((city, i) => (
								<div key={i}>
									<div className="flex items-center justify-between mb-1">
										<span className="text-xs font-cairo font-semibold text-[#111111]">
											{city.city}
										</span>
										<div className="flex items-center gap-2">
											<span className="text-xs font-mono text-[#6B6B6B]">
												{city.customers}
											</span>
											<span className="text-[10px] text-[#D4A853] font-mono">
												{city.percent}%
											</span>
										</div>
									</div>
									<div className="h-2 bg-[#F3EDE4] rounded-full overflow-hidden">
										<motion.div
											initial={{ width: 0 }}
											animate={{ width: `${city.percent}%` }}
											transition={{
												duration: 0.8,
												delay: i * 0.1,
												ease: [0.16, 1, 0.3, 1] as [
													number,
													number,
													number,
													number,
												],
											}}
											className="h-full rounded-full bg-gradient-to-l from-[#D4A853] to-[#8B6914]"
										/>
									</div>
								</div>
							))}
						</div>
					</motion.div>
				</div>
			</motion.div>
		</DashboardShell>
	);
}
