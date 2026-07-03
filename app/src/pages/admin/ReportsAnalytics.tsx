import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAdminStats, useAdminTimeSeries } from '@/hooks/useApi';
import type { AdminStats } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import {
    AlertTriangle,
    BarChart3,
    DollarSign,
    Download,
    Loader2,
    ShoppingBag,
    Store,
    TrendingDown,
    TrendingUp,
    Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

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
/*  Time-series chart data (C.7 — added 2026-07-02)                   */
/*                                                                     */
/*  Replaces the previous hard-coded fixtures. Each chart category    */
/*  pulls a single bucket from /api/admin/stats/timeseries keyed by   */
/*  `period`. We remap `{ ts, label, value }` → `{ name, ... }` so the */
/*  recharts dataKeys remain readable.                                */
/* ------------------------------------------------------------------ */
const periodOptions = [
	{ ar: 'أسبوع', days: 7, bucket: 'day' as const },
	{ ar: 'شهر', days: 30, bucket: 'day' as const },
	{ ar: 'ربع سنة', days: 90, bucket: 'week' as const },
	{ ar: 'سنة', days: 365, bucket: 'month' as const },
];

// Governorate split still needs a dedicated endpoint (TODO C.8).
// Kept as a fixture for the "growth" pie chart only.
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
	const { i18n } = useTranslation();
	const locale = i18n.language === 'en' ? 'en-US' : 'ar-EG';
	const [activeCategory, setActiveCategory] = useState('revenue');
	const [periodIdx, setPeriodIdx] = useState(1); // index into periodOptions
	const period = periodOptions[periodIdx];

	// Live KPIs from /api/admin/stats (server/routes/admin-read.cts:329).
	// The endpoint aggregates counters + 7-day deltas in one CTE-style
	// query.
	const { data: stats, loading: statsLoading, error: statsError } = useAdminStats();
	const metrics = useMemo(
		() => buildCategoryMetrics(activeCategory, stats),
		[activeCategory, stats],
	);

	// C.7 — pull one bucket per category keyed by the active period.
	// Each hook fires once per (metric, bucket, days) tuple.
	const { data: revenueSeries } = useAdminTimeSeries({
		metric: 'revenue',
		bucket: period.bucket,
		days: period.days,
	});
	const { data: ordersSeries } = useAdminTimeSeries({
		metric: 'orders',
		bucket: period.bucket,
		days: period.days,
	});
	const { data: usersSeries } = useAdminTimeSeries({
		metric: 'users',
		bucket: period.bucket,
		days: period.days,
	});
	const { data: merchantsSeries } = useAdminTimeSeries({
		metric: 'merchants',
		bucket: period.bucket,
		days: period.days,
	});
	const { data: disputesSeries } = useAdminTimeSeries({
		metric: 'disputes',
		bucket: period.bucket,
		days: period.days,
	});

	/** Map a time-series response into the {name, ...} shape recharts
	 *  expects. `name` mirrors the old `name` field (the bucket label
	 *  in the user's locale, e.g. "يناير" or "W12").
	 *
	 *  Defensive: the live API always returns `{ points: [] }`, but the
	 *  mocked hook in tests can return `{ points: undefined }` (e.g.
	 *  when the underlying pg mock returns an undefined row). The
	 *  `!s?.points` guard handles both cases. */
	const mapSeries = (
		s: { points?: Array<{ ts: string; label: string; value: number }> } | null | undefined,
		extra: Record<string, number> = {},
	): Array<Record<string, string | number>> => {
		if (!s || !s.points) return [];
		return s.points.map((p) => ({ name: p.label, ts: p.ts, value: p.value, ...extra }));
	};

	// Derived chart datasets — each one re-derived when the source series
	// changes. We intentionally do NOT merge time-series from different
	// tables (e.g. orders ≠ merchants per day); the API only exposes one
	// value per bucket per metric, so cross-category joins would require
	// C.8 (per-governorate breakdown).
	const revenueData = useMemo(() => mapSeries(revenueSeries), [revenueSeries]);
	const ordersChartData = useMemo(() => mapSeries(ordersSeries), [ordersSeries]);
	const usersChartData = useMemo(() => mapSeries(usersSeries), [usersSeries]);
	const merchantsData = useMemo(() => mapSeries(merchantsSeries), [merchantsSeries]);
	const disputesData = useMemo(() => mapSeries(disputesSeries), [disputesSeries]);

	const currentCategory = categories.find((c) => c.id === activeCategory)!;
	const currentDateRange = useMemo(() => {
		// Compute the human range from the period — no more hard-coded dates.
		const fmt = new Intl.DateTimeFormat(locale, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
		const end = new Date();
		const start = new Date(end.getTime() - period.days * 86_400_000);
		return `${fmt.format(start)} - ${fmt.format(end)}`;
	}, [period, locale]);

	const handleExportCSV = () => {
		const dataMap: Record<string, { headers: string[]; rows: (string | number)[][] }> = {
			revenue: {
				headers: ['الفترة', 'الإيرادات'],
				rows: revenueData.map((d) => [d.name, d.value]),
			},
			users: {
				headers: ['الفترة', 'المستخدمون الجدد'],
				rows: usersChartData.map((d) => [d.name, d.value]),
			},
			merchants: {
				headers: ['الفترة', 'تجار جدد'],
				rows: merchantsData.map((d) => [d.name, d.value]),
			},
			orders: {
				headers: ['الفترة', 'الطلبات'],
				rows: ordersChartData.map((d) => [d.name, d.value]),
			},
			disputes: {
				headers: ['الفترة', 'النزاعات'],
				rows: disputesData.map((d) => [d.name, d.value]),
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
							<Legend wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }} />
							<Area
								type="monotone"
								dataKey="value"
								name="الإيرادات"
								stroke={GOLD}
								strokeWidth={2}
								fill="url(#revGrad)"
							/>
						</AreaChart>
					</ResponsiveContainer>
				);
			case 'users':
				return (
					<ResponsiveContainer width="100%" height="100%">
						<LineChart
							data={usersChartData}
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
							<Legend wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }} />
							<Line
								type="monotone"
								dataKey="value"
								name="المستخدمون الجدد"
								stroke={GOLD}
								strokeWidth={2}
								dot={{ r: 4, fill: GOLD }}
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
							<Legend wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }} />
							<Bar
								dataKey="value"
								name="تجار جدد"
								fill={GOLD}
								radius={[4, 4, 0, 0]}
							/>
						</BarChart>
					</ResponsiveContainer>
				);
			case 'orders':
				return (
					<ResponsiveContainer width="100%" height="100%">
						<BarChart
							data={ordersChartData}
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
							<Legend wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }} />
							<Bar
								dataKey="value"
								name="الطلبات"
								fill={GREEN}
								radius={[4, 4, 0, 0]}
							/>
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
							<Legend wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }} />
							<Line
								type="monotone"
								dataKey="value"
								name="النزاعات"
								stroke={RED}
								strokeWidth={2}
								dot={{ r: 4, fill: RED }}
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
					// A11Y-P2-05 follow-up (added 2026-07-03): the visible
					// <p> label isn't a heading, so axe can't derive an
					// accessible name from the card structure. We set
					// aria-label explicitly to satisfy the
					// "Cards must have an accessible name" rule and
					// expose the metric to screen readers in a
					// predictable, localization-friendly way.
					<Card
						key={i}
						className="border-0 shadow-sm"
						aria-label={m.label}
					>
						<CardContent className="p-4">
							<p className="text-xs text-[#6B6B6B] font-cairo mb-1">{m.label}</p>
							<div className="flex items-center justify-between">
								<p className="text-xl font-mono font-bold text-[#111111]">
									{statsLoading ? (
										<span className="inline-flex items-center gap-1 text-[#AAAAAA]">
											<Loader2 className="w-3 h-3 animate-spin" />…
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
								{periodOptions.map((p, i) => (
									<button
										key={p.ar}
										onClick={() => setPeriodIdx(i)}
										className={`px-3 py-1.5 rounded-md text-xs font-cairo font-medium transition-all ${
											periodIdx === i
												? 'bg-white text-[#111111] shadow-sm'
												: 'text-[#6B6B6B] hover:text-[#111111]'
										}`}
									>
										{p.ar}
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
