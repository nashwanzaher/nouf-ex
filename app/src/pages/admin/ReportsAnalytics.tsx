import { useMemo, useState } from 'react';
import {
	BarChart3,
	Users,
	Store,
	ShoppingBag,
	AlertTriangle,
	DollarSign,
	TrendingUp,
	TrendingDown,
	Download,
	Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
	LineChart,
	Line,
	BarChart,
	Bar,
	AreaChart,
	Area,
	PieChart,
	Pie,
	Cell,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	Legend,
} from 'recharts';
import { useAdminStats } from '@/hooks/useApi';
import type { AdminStats } from '@/lib/api';
import { formatMoney } from '@/lib/format';

/* ------------------------------------------------------------------ */
/*  Chart colors                                                       */
/* ------------------------------------------------------------------ */
const GOLD = '#D4A853';
const GREEN = '#10B981';
const BLUE = '#2563EB';
const RED = '#EF4444';
const AMBER = '#F59E0B';
const PURPLE = '#8B5CF6';

/* ------------------------------------------------------------------ */
/*  Mock data generators                                               */
/* ------------------------------------------------------------------ */
// NOTE: Time-series chart data (revenueData / usersData / ordersData /
// merchantsData / disputesData / growthPie) is kept as a temporary
// fixture. /api/admin/stats only returns aggregate counters and the
// 7-day delta — it has no historical bucket endpoint. A dedicated
// /api/admin/analytics/timeseries?bucket=month (C.7) is needed to
// feed these charts from the DB. The KPI cards below already use
// real data from useAdminStats.
const revenueData = [
	{ name: 'يناير', value: 32000, orders: 2400, commission: 4800 },
	{ name: 'فبراير', value: 35000, orders: 2800, commission: 5250 },
	{ name: 'مارس', value: 30000, orders: 2100, commission: 4500 },
	{ name: 'أبريل', value: 42000, orders: 3500, commission: 6300 },
	{ name: 'مايو', value: 38000, orders: 3100, commission: 5700 },
	{ name: 'يونيو', value: 45200, orders: 3800, commission: 6780 },
];

const usersData = [
	{ name: 'يناير', new: 800, active: 4200, churned: 120 },
	{ name: 'فبراير', new: 950, active: 4800, churned: 90 },
	{ name: 'مارس', new: 700, active: 5100, churned: 150 },
	{ name: 'أبريل', new: 1200, active: 5800, churned: 80 },
	{ name: 'مايو', new: 1050, active: 6400, churned: 110 },
	{ name: 'يونيو', new: 1400, active: 7200, churned: 95 },
];

const ordersData = [
	{ name: 'يناير', completed: 2100, cancelled: 180, returned: 120 },
	{ name: 'فبراير', completed: 2500, cancelled: 150, returned: 100 },
	{ name: 'مارس', completed: 1800, cancelled: 200, returned: 80 },
	{ name: 'أبريل', completed: 3200, cancelled: 130, returned: 90 },
	{ name: 'مايو', completed: 2900, cancelled: 100, returned: 70 },
	{ name: 'يونيو', completed: 3500, cancelled: 110, returned: 60 },
];

const merchantsData = [
	{ name: 'يناير', new: 15, verified: 120, pending: 8 },
	{ name: 'فبراير', new: 22, verified: 135, pending: 12 },
	{ name: 'مارس', new: 18, verified: 142, pending: 10 },
	{ name: 'أبريل', new: 25, verified: 155, pending: 15 },
	{ name: 'مايو', new: 20, verified: 168, pending: 9 },
	{ name: 'يونيو', new: 28, verified: 180, pending: 11 },
];

const disputesData = [
	{ name: 'يناير', filed: 12, resolved: 10, avgDays: 3.2 },
	{ name: 'فبراير', filed: 15, resolved: 13, avgDays: 2.8 },
	{ name: 'مارس', filed: 10, resolved: 9, avgDays: 3.5 },
	{ name: 'أبريل', filed: 18, resolved: 15, avgDays: 2.5 },
	{ name: 'مايو', filed: 14, resolved: 12, avgDays: 3.0 },
	{ name: 'يونيو', filed: 20, resolved: 16, avgDays: 2.2 },
];

const growthPie = [
	{ name: 'صنعاء', value: 45, color: GOLD },
	{ name: 'عدن', value: 25, color: GREEN },
	{ name: 'تعز', value: 15, color: BLUE },
	{ name: 'إب', value: 8, color: PURPLE },
	{ name: 'أخرى', value: 7, color: AMBER },
];

/* ------------------------------------------------------------------ */
/*  Report categories                                                  */
/* ------------------------------------------------------------------ */
interface ReportCategory {
	id: string;
	label: string;
	icon: React.ElementType;
	description: string;
}

const categories: ReportCategory[] = [
	{
		id: 'revenue',
		label: 'مبيعات المنصة',
		icon: BarChart3,
		description: 'الإيرادات وحجم الطلبات',
	},
	{
		id: 'users',
		label: 'المستخدمون',
		icon: Users,
		description: 'التسجيل والاحتفاظ والبيانات الديموغرافية',
	},
	{ id: 'merchants', label: 'المتاجر', icon: Store, description: 'أداء المتاجر ونسب التوثيق' },
	{
		id: 'orders',
		label: 'الطلبات',
		icon: ShoppingBag,
		description: 'تحليل الطلبات ونسب الإلغاء',
	},
	{
		id: 'disputes',
		label: 'النزاعات',
		icon: AlertTriangle,
		description: 'اتجاهات النزاعات وسرعة الحل',
	},
	{ id: 'growth', label: 'النمو', icon: DollarSign, description: 'النمو والتوسع الجغرافي' },
];

const periodOptions = ['أسبوع', 'شهر', 'ربع سنة', 'سنة'];

/* ------------------------------------------------------------------ */
/*  Summary metrics per category                                       */
/* ------------------------------------------------------------------ */
// KPI cards are now built from the live /api/admin/stats payload
// (server/routes/admin-read.cts:329). Fields the endpoint doesn't
// expose (commission rate, churned users, governorate split, …)
// render as "—" with `up: null` so the JSX swaps the trend arrow
// for a muted dash — honest about the data we *don't* have until
// C.7 ships a richer analytics endpoint.
interface CategoryMetric {
	label: string;
	value: string;
	change: string;
	up: boolean | null;
}

const PLACEHOLDER: CategoryMetric = {
	label: '',
	value: '—',
	change: '—',
	up: null,
};

function formatPct(value: number | null | undefined, locale = 'ar-EG'): string {
	if (value == null || Number.isNaN(value)) return '—';
	const sign = value >= 0 ? '+' : '';
	return `${sign}${value.toLocaleString(locale)}٪`;
}

function formatInt(value: number | null | undefined, locale = 'ar-EG'): string {
	if (value == null || Number.isNaN(value)) return '—';
	return value.toLocaleString(locale);
}

// Typed defaults so `counts.foo` narrows correctly without `?? {}` (which
// would widen the type to `{}` and lose every property check).
const EMPTY_COUNTS: AdminStats['counts'] = {
	users: 0,
	stores: 0,
	products: 0,
	orders: 0,
	reviews: 0,
	disputes: 0,
};
const EMPTY_FLAGS: AdminStats['flags'] = {
	openDisputes: 0,
	pendingOrders: 0,
	paidOrders: 0,
	suspendedUsers: 0,
	inactiveStores: 0,
};
const EMPTY_RECENT: AdminStats['recent7d'] = { orders: 0, users: 0 };

function buildCategoryMetrics(
	categoryId: string,
	stats: AdminStats | null | undefined,
): CategoryMetric[] {
	const counts = stats?.counts ?? EMPTY_COUNTS;
	const flags = stats?.flags ?? EMPTY_FLAGS;
	const recent = stats?.recent7d ?? EMPTY_RECENT;
	const revenue = stats?.revenueYer ?? 0;
	const orders = counts.orders;
	const avgOrder = orders > 0 ? Math.round(revenue / orders) : null;

	switch (categoryId) {
		case 'revenue':
			return [
				{
					label: 'إجمالي الإيرادات',
					value: revenue ? formatMoney(revenue) : PLACEHOLDER.value,
					change: '—',
					up: null,
				},
				{
					label: 'إجمالي الطلبات',
					value: formatInt(orders),
					change: formatPct(recent.orders),
					up: recent.orders >= 0,
				},
				{
					label: 'الطلبات المدفوعة',
					value: formatInt(flags.paidOrders),
					change: '—',
					up: null,
				},
				{
					label: 'متوسط قيمة الطلب',
					value: avgOrder != null ? formatMoney(avgOrder) : '—',
					change: '—',
					up: null,
				},
			];
		case 'users':
			return [
				{
					label: 'إجمالي المستخدمين',
					value: formatInt(counts.users),
					change: formatPct(recent.users),
					up: recent.users >= 0,
				},
				{
					label: 'المستخدمون الموقوفون',
					value: formatInt(flags.suspendedUsers),
					change: '—',
					up: null,
				},
				{
					label: 'معدل الاحتفاظ',
					value: PLACEHOLDER.value,
					change: '—',
					up: null,
				},
				{
					label: 'الراحلون',
					value: PLACEHOLDER.value,
					change: '—',
					up: null,
				},
			];
		case 'merchants':
			return [
				{
					label: 'إجمالي المتاجر',
					value: formatInt(counts.stores),
					change: '—',
					up: null,
				},
				{
					label: 'المتاجر غير النشطة',
					value: formatInt(flags.inactiveStores),
					change: '—',
					up: null,
				},
				{
					label: 'قيد التوثيق',
					value: PLACEHOLDER.value,
					change: '—',
					up: null,
				},
				{
					label: 'معدل الرضا',
					value: PLACEHOLDER.value,
					change: '—',
					up: null,
				},
			];
		case 'orders':
			return [
				{
					label: 'إجمالي الطلبات',
					value: formatInt(orders),
					change: formatPct(recent.orders),
					up: recent.orders >= 0,
				},
				{
					label: 'المدفوعة',
					value: formatInt(flags.paidOrders),
					change: '—',
					up: null,
				},
				{
					label: 'قيد الانتظار',
					value: formatInt(flags.pendingOrders),
					change: '—',
					up: null,
				},
				{
					label: 'الملغاة / المسترجعة',
					value: PLACEHOLDER.value,
					change: '—',
					up: null,
				},
			];
		case 'disputes':
			return [
				{
					label: 'إجمالي النزاعات',
					value: formatInt(counts.disputes),
					change: '—',
					up: null,
				},
				{
					label: 'النزاعات المفتوحة',
					value: formatInt(flags.openDisputes),
					change: '—',
					up: null,
				},
				{
					label: 'معدل الحل',
					value:
						counts.disputes && flags.openDisputes != null
							? formatPct(
									Math.round(
										((counts.disputes - flags.openDisputes) / counts.disputes) *
											100,
									),
								)
							: '—',
					change: '—',
					up: null,
				},
				{
					label: 'متوسط الأيام',
					value: PLACEHOLDER.value,
					change: '—',
					up: null,
				},
			];
		case 'growth':
			return [
				{
					label: 'نمو المستخدمين (٧ أيام)',
					value: formatPct(recent.users),
					change: '—',
					up: recent.users >= 0,
				},
				{
					label: 'نمو الطلبات (٧ أيام)',
					value: formatPct(recent.orders),
					change: '—',
					up: recent.orders >= 0,
				},
				{
					label: 'أكبر محافظة',
					value: PLACEHOLDER.value,
					change: '—',
					up: null,
				},
				{
					label: 'نمو المتاجر',
					value: PLACEHOLDER.value,
					change: '—',
					up: null,
				},
			];
		default:
			return [PLACEHOLDER, PLACEHOLDER, PLACEHOLDER, PLACEHOLDER];
	}
}

/* ------------------------------------------------------------------ */
/*  CSV export helper                                                  */
/* ------------------------------------------------------------------ */
function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
	const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = `${filename}.csv`;
	link.click();
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function ReportsAnalytics() {
	const [activeCategory, setActiveCategory] = useState('revenue');
	const [period, setPeriod] = useState('شهر');

	// Live KPIs from /api/admin/stats (server/routes/admin-read.cts:329).
	// The endpoint aggregates counters + 7-day deltas in one CTE-style
	// query. Time-series bucket data isn't part of the response, so the
	// charts below keep their 6-month historical fixture (TODO C.7).
	const { data: stats, loading: statsLoading, error: statsError } = useAdminStats();
	const metrics = useMemo(
		() => buildCategoryMetrics(activeCategory, stats),
		[activeCategory, stats],
	);

	const currentCategory = categories.find((c) => c.id === activeCategory)!;
	const currentDateRange = '١ يناير - ٣٠ يونيو ٢٠٢٤';

	const handleExportCSV = () => {
		const dataMap: Record<string, { headers: string[]; rows: (string | number)[][] }> = {
			revenue: {
				headers: ['الشهر', 'الإيرادات', 'الطلبات', 'العمولات'],
				rows: revenueData.map((d) => [d.name, d.value, d.orders, d.commission]),
			},
			users: {
				headers: ['الشهر', 'جدد', 'نشطون', 'راحلون'],
				rows: usersData.map((d) => [d.name, d.new, d.active, d.churned]),
			},
			merchants: {
				headers: ['الشهر', 'جدد', 'موثقون', 'قيد المراجعة'],
				rows: merchantsData.map((d) => [d.name, d.new, d.verified, d.pending]),
			},
			orders: {
				headers: ['الشهر', 'مكتملة', 'ملغاة', 'مسترجعة'],
				rows: ordersData.map((d) => [d.name, d.completed, d.cancelled, d.returned]),
			},
			disputes: {
				headers: ['الشهر', 'مقدمة', 'محلولة', 'متوسط الأيام'],
				rows: disputesData.map((d) => [d.name, d.filed, d.resolved, d.avgDays]),
			},
			growth: {
				headers: ['المحافظة', 'النسبة'],
				rows: growthPie.map((d) => [d.name, d.value]),
			},
		};
		const data = dataMap[activeCategory];
		if (data) exportToCSV(`report_${activeCategory}`, data.headers, data.rows);
	};

	const renderChart = () => {
		switch (activeCategory) {
			case 'revenue':
				return (
					<ResponsiveContainer width="100%" height="100%">
						<AreaChart
							data={revenueData}
							margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
						>
							<defs>
								<linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
									<stop offset="95%" stopColor={GOLD} stopOpacity={0} />
								</linearGradient>
							</defs>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke="#F0F0F0"
								vertical={false}
							/>
							<XAxis
								dataKey="name"
								tick={{ fontSize: 12, fontFamily: 'Cairo', fill: '#6B6B6B' }}
								axisLine={false}
								tickLine={false}
							/>
							<YAxis
								tick={{ fontSize: 12, fontFamily: 'Cairo', fill: '#6B6B6B' }}
								axisLine={false}
								tickLine={false}
							/>
							<Tooltip
								contentStyle={{
									fontFamily: 'Cairo',
									fontSize: 12,
									borderRadius: 12,
									border: 'none',
									boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
								}}
							/>
							<Legend
								wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }}
								formatter={(v: string) =>
									({
										revenue: 'الإيرادات',
										orders: 'الطلبات',
										commission: 'العمولات',
									})[v] ?? v
								}
							/>
							<Area
								type="monotone"
								dataKey="revenue"
								stroke={GOLD}
								strokeWidth={2}
								fill="url(#revGrad)"
							/>
							<Area
								type="monotone"
								dataKey="commission"
								stroke={GREEN}
								strokeWidth={2}
								fill="transparent"
								strokeDasharray="4 4"
							/>
						</AreaChart>
					</ResponsiveContainer>
				);
			case 'users':
				return (
					<ResponsiveContainer width="100%" height="100%">
						<LineChart
							data={usersData}
							margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
						>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke="#F0F0F0"
								vertical={false}
							/>
							<XAxis
								dataKey="name"
								tick={{ fontSize: 12, fontFamily: 'Cairo', fill: '#6B6B6B' }}
								axisLine={false}
								tickLine={false}
							/>
							<YAxis
								tick={{ fontSize: 12, fontFamily: 'Cairo', fill: '#6B6B6B' }}
								axisLine={false}
								tickLine={false}
							/>
							<Tooltip
								contentStyle={{
									fontFamily: 'Cairo',
									fontSize: 12,
									borderRadius: 12,
									border: 'none',
									boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
								}}
							/>
							<Legend
								wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }}
								formatter={(v: string) =>
									({ new: 'جدد', active: 'نشطون', churned: 'راحلون' })[v] ?? v
								}
							/>
							<Line
								type="monotone"
								dataKey="new"
								stroke={GOLD}
								strokeWidth={2}
								dot={{ r: 4, fill: GOLD }}
							/>
							<Line
								type="monotone"
								dataKey="active"
								stroke={BLUE}
								strokeWidth={2}
								dot={{ r: 4, fill: BLUE }}
							/>
							<Line
								type="monotone"
								dataKey="churned"
								stroke={RED}
								strokeWidth={2}
								dot={{ r: 4, fill: RED }}
								strokeDasharray="4 4"
							/>
						</LineChart>
					</ResponsiveContainer>
				);
			case 'merchants':
				return (
					<ResponsiveContainer width="100%" height="100%">
						<BarChart
							data={merchantsData}
							margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
						>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke="#F0F0F0"
								vertical={false}
							/>
							<XAxis
								dataKey="name"
								tick={{ fontSize: 12, fontFamily: 'Cairo', fill: '#6B6B6B' }}
								axisLine={false}
								tickLine={false}
							/>
							<YAxis
								tick={{ fontSize: 12, fontFamily: 'Cairo', fill: '#6B6B6B' }}
								axisLine={false}
								tickLine={false}
							/>
							<Tooltip
								contentStyle={{
									fontFamily: 'Cairo',
									fontSize: 12,
									borderRadius: 12,
									border: 'none',
									boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
								}}
							/>
							<Legend
								wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }}
								formatter={(v: string) =>
									({ new: 'جدد', verified: 'موثقون', pending: 'قيد المراجعة' })[
										v
									] ?? v
								}
							/>
							<Bar dataKey="new" fill={GOLD} radius={[4, 4, 0, 0]} />
							<Bar dataKey="verified" fill={GREEN} radius={[4, 4, 0, 0]} />
							<Bar dataKey="pending" fill={AMBER} radius={[4, 4, 0, 0]} />
						</BarChart>
					</ResponsiveContainer>
				);
			case 'orders':
				return (
					<ResponsiveContainer width="100%" height="100%">
						<BarChart
							data={ordersData}
							margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
						>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke="#F0F0F0"
								vertical={false}
							/>
							<XAxis
								dataKey="name"
								tick={{ fontSize: 12, fontFamily: 'Cairo', fill: '#6B6B6B' }}
								axisLine={false}
								tickLine={false}
							/>
							<YAxis
								tick={{ fontSize: 12, fontFamily: 'Cairo', fill: '#6B6B6B' }}
								axisLine={false}
								tickLine={false}
							/>
							<Tooltip
								contentStyle={{
									fontFamily: 'Cairo',
									fontSize: 12,
									borderRadius: 12,
									border: 'none',
									boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
								}}
							/>
							<Legend
								wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }}
								formatter={(v: string) =>
									({
										completed: 'مكتملة',
										cancelled: 'ملغاة',
										returned: 'مسترجعة',
									})[v] ?? v
								}
							/>
							<Bar dataKey="completed" fill={GREEN} radius={[4, 4, 0, 0]} />
							<Bar dataKey="cancelled" fill={RED} radius={[4, 4, 0, 0]} />
							<Bar dataKey="returned" fill={AMBER} radius={[4, 4, 0, 0]} />
						</BarChart>
					</ResponsiveContainer>
				);
			case 'disputes':
				return (
					<ResponsiveContainer width="100%" height="100%">
						<LineChart
							data={disputesData}
							margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
						>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke="#F0F0F0"
								vertical={false}
							/>
							<XAxis
								dataKey="name"
								tick={{ fontSize: 12, fontFamily: 'Cairo', fill: '#6B6B6B' }}
								axisLine={false}
								tickLine={false}
							/>
							<YAxis
								tick={{ fontSize: 12, fontFamily: 'Cairo', fill: '#6B6B6B' }}
								axisLine={false}
								tickLine={false}
							/>
							<Tooltip
								contentStyle={{
									fontFamily: 'Cairo',
									fontSize: 12,
									borderRadius: 12,
									border: 'none',
									boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
								}}
							/>
							<Legend
								wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }}
								formatter={(v: string) =>
									({
										filed: 'مقدمة',
										resolved: 'محلولة',
										avgDays: 'متوسط الأيام',
									})[v] ?? v
								}
							/>
							<Line
								type="monotone"
								dataKey="filed"
								stroke={RED}
								strokeWidth={2}
								dot={{ r: 4, fill: RED }}
							/>
							<Line
								type="monotone"
								dataKey="resolved"
								stroke={GREEN}
								strokeWidth={2}
								dot={{ r: 4, fill: GREEN }}
							/>
							<Line
								type="monotone"
								dataKey="avgDays"
								stroke={BLUE}
								strokeWidth={2}
								dot={{ r: 4, fill: BLUE }}
								strokeDasharray="4 4"
							/>
						</LineChart>
					</ResponsiveContainer>
				);
			case 'growth':
				return (
					<div className="flex flex-col md:flex-row items-center gap-8 h-full">
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={growthPie}
									cx="50%"
									cy="50%"
									outerRadius="80%"
									innerRadius="50%"
									dataKey="value"
									label={({ name, percent }) =>
										`${name} ${(percent * 100).toFixed(0)}%`
									}
								>
									{growthPie.map((entry, index) => (
										<Cell key={index} fill={entry.color} />
									))}
								</Pie>
								<Tooltip
									contentStyle={{
										fontFamily: 'Cairo',
										fontSize: 12,
										borderRadius: 12,
										border: 'none',
										boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
									}}
								/>
							</PieChart>
						</ResponsiveContainer>
						<div className="flex flex-wrap md:flex-col gap-3 shrink-0">
							{growthPie.map((item) => (
								<div key={item.name} className="flex items-center gap-2">
									<div
										className="w-3 h-3 rounded-full"
										style={{ backgroundColor: item.color }}
									/>
									<span className="text-xs font-cairo text-[#6B6B6B]">
										{item.name}
									</span>
									<span className="text-xs font-mono font-bold text-[#111111]">
										{item.value}%
									</span>
								</div>
							))}
						</div>
					</div>
				);
			default:
				return null;
		}
	};

	return (
		<div className="space-y-6">
			{/* ── Category Cards ── */}
			<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
				{categories.map((cat) => {
					const Icon = cat.icon;
					const isActive = activeCategory === cat.id;
					return (
						<button
							key={cat.id}
							onClick={() => setActiveCategory(cat.id)}
							className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 ${
								isActive
									? 'border-[#D4A853] bg-amber-50/50 shadow-md'
									: 'border-transparent bg-white hover:bg-[#F8F8F8] shadow-sm'
							}`}
						>
							<div
								className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-[#D4A853]/20' : 'bg-[#F8F8F8]'}`}
							>
								<Icon
									className={`w-5 h-5 ${isActive ? 'text-[#D4A853]' : 'text-[#6B6B6B]'}`}
									strokeWidth={1.5}
								/>
							</div>
							<div className="text-center">
								<p
									className={`text-xs font-cairo font-semibold ${isActive ? 'text-[#D4A853]' : 'text-[#111111]'}`}
								>
									{cat.label}
								</p>
								<p className="text-[10px] text-[#6B6B6B] font-cairo hidden xl:block">
									{cat.description}
								</p>
							</div>
						</button>
					);
				})}
			</div>

			{/* ── Metrics (live /api/admin/stats) ── */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				{metrics.map((m, i) => (
					<Card key={i} className="border-0 shadow-sm">
						<CardContent className="p-4">
							<p className="text-xs text-[#6B6B6B] font-cairo mb-1">{m.label}</p>
							<div className="flex items-center justify-between">
								<p className="text-xl font-mono font-bold text-[#111111]">
									{statsLoading ? (
										<span className="inline-flex items-center gap-1 text-[#AAAAAA]">
											<Loader2 className="w-3 h-3 animate-spin" />
											…
										</span>
									) : (
										m.value
									)}
								</p>
								<span
									className={`flex items-center gap-0.5 text-[10px] font-cairo font-semibold ${
										m.up === true
											? 'text-emerald-500'
											: m.up === false
												? 'text-red-500'
												: 'text-[#AAAAAA]'
									}`}
								>
									{m.up === true ? (
										<TrendingUp className="w-3 h-3" />
									) : m.up === false ? (
										<TrendingDown className="w-3 h-3" />
									) : (
										<span className="opacity-50">·</span>
									)}
									{m.change}
								</span>
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{statsError && (
				<div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm font-cairo">
					تعذّر تحميل الإحصائيات: {statsError}
				</div>
			)}

			{/* ── Chart Card ── */}
			<Card className="border-0 shadow-sm">
				<CardHeader className="pt-5 px-5 pb-3">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<currentCategory.icon
								className="w-5 h-5 text-[#D4A853]"
								strokeWidth={1.5}
							/>
							<div>
								<h3 className="text-[#111111] font-cairo font-bold text-base">
									{currentCategory.label}
								</h3>
								<p className="text-xs text-[#6B6B6B] font-cairo">
									{currentDateRange}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							{/* Period selector */}
							<div className="flex gap-1 bg-[#F8F8F8] rounded-lg p-1">
								{periodOptions.map((p) => (
									<button
										key={p}
										onClick={() => setPeriod(p)}
										className={`px-3 py-1.5 rounded-md text-xs font-cairo font-medium transition-all ${
											period === p
												? 'bg-white text-[#111111] shadow-sm'
												: 'text-[#6B6B6B] hover:text-[#111111]'
										}`}
									>
										{p}
									</button>
								))}
							</div>
							{/* Export */}
							<Button
								onClick={handleExportCSV}
								variant="outline"
								size="sm"
								className="font-cairo text-xs gap-1 border-[#D4A853] text-[#D4A853] hover:bg-amber-50"
							>
								<Download className="w-3.5 h-3.5" />
								تصدير CSV
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="p-5">
					<div className="h-[350px] md:h-[400px]">{renderChart()}</div>
				</CardContent>
			</Card>
		</div>
	);
}
