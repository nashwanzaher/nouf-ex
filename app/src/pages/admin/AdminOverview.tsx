import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAdminDisputes, useAdminStats, useAdminStores, useAdminTimeSeries, useSystemHealth } from '@/hooks/useApi';
import type { AdminDispute, AdminStore } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import {
    Activity,
    AlertTriangle,
    BarChart3,
    Check,
    ChevronLeft,
    Clock,
    DollarSign,
    FileText,
    Globe,
    RefreshCw,
    Server,
    ShoppingBag,
    Store,
    TrendingDown,
    TrendingUp,
    Users,
    X,
    Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Format an ISO timestamp as Arabic date (e.g. "٢٠٢٤/٠٦/١٨").
 *  Uses Intl.DateTimeFormat with Arabic-Indic digits so it matches
 *  the visual style of the rest of the dashboard. */
function formatArabicDate(iso: string | null | undefined): string {
	if (!iso) return '—';
	try {
		return new Intl.DateTimeFormat('ar-EG-u-nu-arab', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).format(new Date(iso));
	} catch {
		return '—';
	}
}

/** Convert an ISO timestamp to a short Arabic relative-age string
 *  (e.g. "٢ ساعة", "يوم", "يومان"). Matches the previous mock-data
 *  styling so the UI doesn't visually jump after the refactor. */
function formatRelativeAge(iso: string | null | undefined, locale: string): string {
	if (!iso) return '—';
	const created = new Date(iso).getTime();
	if (Number.isNaN(created)) return '—';
	const diffMs = Date.now() - created;
	const minutes = Math.floor(diffMs / 60_000);
	const hours = Math.floor(diffMs / 3_600_000);
	const days = Math.floor(diffMs / 86_400_000);

	if (locale === 'ar') {
		if (minutes < 60) return `${minutes.toLocaleString('ar-EG')} دقيقة`;
		if (hours < 24) return `${hours.toLocaleString('ar-EG')} ساعة`;
		if (days === 1) return 'يوم';
		if (days === 2) return 'يومان';
		if (days < 11) return `${days.toLocaleString('ar-EG')} أيام`;
		return `${days.toLocaleString('ar-EG')} يوم`;
	}
	if (minutes < 60) return `${minutes}m`;
	if (hours < 24) return `${hours}h`;
	return `${days}d`;
}

/** Translate a dispute status enum (server side: open/investigating/
 *  resolved/rejected) into the dashboard's chip styling. */
const DISPUTE_STATUS_STYLES: Record<AdminDispute['status'], { label: string; color: string }> = {
	open: { label: 'جديد', color: 'bg-red-500' },
	investigating: { label: 'قيد المراجعة', color: 'bg-amber-500' },
	resolved: { label: 'محلول', color: 'bg-emerald-500' },
	rejected: { label: 'مرفوض', color: 'bg-gray-400' },
};

/* ------------------------------------------------------------------ */
/*  Time-series chart data (C.7 — added 2026-07-02)                   */
/*                                                                     */
/*  Replaces the previous hard-coded chartData fixture. Three fetches  */
/*  in parallel (revenue/orders/users) keyed by the same period,      */
/*  merged by `ts` so the area chart can stack all three series.      */
/* ------------------------------------------------------------------ */
const periodOptions = [
	{ ar: 'أسبوع', days: 7, bucket: 'day' as const },
	{ ar: 'شهر', days: 30, bucket: 'day' as const },
	{ ar: 'سنة', days: 365, bucket: 'month' as const },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function AdminOverview() {
	const { i18n } = useTranslation();
	const locale = i18n.language === 'en' ? 'en' : 'ar';
	const [periodIdx, setPeriodIdx] = useState(1); // index into periodOptions
	const period = periodOptions[periodIdx];

	// Real stats from /api/admin/stats (server/routes/admin.cts:377-417).
	// The endpoint aggregates counts, 7-day deltas, and revenue in a
	// single round-trip via a CTE; falls back to 0s while loading.
	const { data: stats, loading: statsLoading } = useAdminStats();
	const recentGrowth = stats?.recent7d;

	// C.7 — three parallel time-series fetches keyed by the same period.
	// The `ts` field is the join key; we merge into a single array for
	// the recharts AreaChart below.
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

	/** Merge three series by `ts` into one row per bucket for recharts. */
	const chartData = useMemo(() => {
		const map = new Map<
			string,
			{ ts: string; label: string; revenue: number; orders: number; users: number }
		>();
		for (const p of revenueSeries?.points ?? []) {
			map.set(p.ts, { ts: p.ts, label: p.label, revenue: p.value, orders: 0, users: 0 });
		}
		for (const p of ordersSeries?.points ?? []) {
			const existing = map.get(p.ts);
			if (existing) existing.orders = p.value;
			else map.set(p.ts, { ts: p.ts, label: p.label, revenue: 0, orders: p.value, users: 0 });
		}
		for (const p of usersSeries?.points ?? []) {
			const existing = map.get(p.ts);
			if (existing) existing.users = p.value;
			else map.set(p.ts, { ts: p.ts, label: p.label, revenue: 0, orders: 0, users: p.value });
		}
		return Array.from(map.values());
	}, [revenueSeries, ordersSeries, usersSeries]);

	// Platform health from /api/ready (server/index.ts:108-131).
	// Public endpoint; "degraded" surfaces as a normal state in the
	// hook, not as an error, so the dashboard always renders.
	const { data: health, loading: healthLoading, refetch: refetchHealth } = useSystemHealth();
	const dbOk = health?.checks?.db?.ok ?? null;
	const dbMs = health?.checks?.db?.ms ?? null;
	const uptimeHours = health ? Math.floor(health.uptime_s / 3600) : null;

	// Pending verifications — unverified stores awaiting approval
	// (/api/admin/stores?is_verified=false). Until C.4 ships the
	// merchant-name join, we render "—" for the merchant field.
	const { data: pendingStoresData, loading: pendingStoresLoading } = useAdminStores({
		is_verified: false,
		limit: 5,
	});
	const pendingVerifications = useMemo(
		() =>
			(pendingStoresData?.stores ?? []).map((s: AdminStore) => ({
				id: s.id,
				store: s.store_name,
				merchant: '—',
				date: formatArabicDate(s.created_at),
				docs: 0,
			})),
		[pendingStoresData],
	);

	// Active disputes — open disputes the admin should triage
	// (/api/admin/disputes?status=open). resolved/rejected are
	// mapped through DISPUTE_STATUS_STYLES for the chip color.
	const { data: disputesData, loading: disputesLoading } = useAdminDisputes({
		status: 'open',
		limit: 5,
	});
	const activeDisputes = useMemo(
		() =>
			(disputesData?.disputes ?? []).map((d: AdminDispute) => {
				const status = DISPUTE_STATUS_STYLES[d.status] ?? DISPUTE_STATUS_STYLES.open;
				return {
					id: `D-${d.id}`,
					type: d.category,
					buyer: '—',
					merchant: '—',
					status: status.label,
					statusColor: status.color,
					age: formatRelativeAge(d.created_at, locale),
				};
			}),
		[disputesData, locale],
	);
	const summaryCards = [
		{
			label: 'إجمالي المستخدمين',
			value: stats?.counts?.users ?? 0,
			icon: Users,
			iconColor: 'text-blue-500',
			iconBg: 'bg-blue-50',
			delta: stats?.recent7d?.users,
		},
		{
			label: 'المتاجر النشطة',
			value: stats?.counts?.stores ?? 0,
			icon: Store,
			iconColor: 'text-[#D4A853]',
			iconBg: 'bg-amber-50',
			delta: null,
		},
		{
			label: 'الطلبات',
			value: stats?.counts?.orders ?? 0,
			icon: ShoppingBag,
			iconColor: 'text-emerald-500',
			iconBg: 'bg-emerald-50',
			delta: recentGrowth?.orders,
		},
		{
			label: 'الإيرادات',
			value: stats?.revenueYer ?? 0,
			icon: DollarSign,
			iconColor: 'text-amber-500',
			iconBg: 'bg-amber-50',
			isCurrency: true as const,
			delta: null,
		},
	];

	return (
		<div className="space-y-6">
			{/* ── Stats Cards (live /api/admin/stats) ── */}
			<div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
				{summaryCards.map((stat, i) => {
					const Icon = stat.icon;
					const delta = stat.delta ?? 0;
					const deltaUp = delta >= 0;
					const display =
						stat.isCurrency && stat.value > 0
							? formatMoney(stat.value)
							: stat.value.toLocaleString('ar-EG');
					return (
						<Card key={i} className="border-0 shadow-sm">
							<CardContent className="p-4 md:p-5">
								<div className="flex items-start justify-between mb-3">
									<div
										className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center`}
									>
										<Icon
											className={`w-5 h-5 ${stat.iconColor}`}
											strokeWidth={1.5}
										/>
									</div>
									{stat.delta != null && (
										<div
											className={`flex items-center gap-1 text-xs font-cairo font-semibold ${
												deltaUp ? 'text-emerald-500' : 'text-red-500'
											}`}
										>
											{deltaUp ? (
												<TrendingUp className="w-3 h-3" />
											) : (
												<TrendingDown className="w-3 h-3" />
											)}
											{Math.abs(delta).toLocaleString('ar-EG')}
										</div>
									)}
								</div>
								<p className="text-2xl md:text-[28px] font-mono font-bold text-[#111111] leading-tight">
									{statsLoading ? '…' : display}
								</p>
								<p className="text-xs text-[#6B6B6B] font-cairo mt-1">
									{stat.label}
								</p>
							</CardContent>
						</Card>
					);
				})}
			</div>

			{/* ── Activity Chart ── */}
			<Card className="border-0 shadow-sm">
				<CardHeader className="pb-0 pt-5 px-5">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div>
							<h3 className="text-[#111111] font-cairo font-bold text-base">
								النشاط والأداء
							</h3>
							<p className="text-xs text-[#6B6B6B] font-cairo">
								الإيرادات والطلبات والمستخدمين الجدد
							</p>
						</div>
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
					</div>
				</CardHeader>
				<CardContent className="p-4 md:p-5">
					<div className="h-[280px] md:h-[320px]">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart
								data={chartData}
								margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
							>
								<defs>
									<linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#D4A853" stopOpacity={0.3} />
										<stop offset="95%" stopColor="#D4A853" stopOpacity={0} />
									</linearGradient>
									<linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
										<stop offset="95%" stopColor="#10B981" stopOpacity={0} />
									</linearGradient>
								</defs>
								<CartesianGrid
									strokeDasharray="3 3"
									stroke="#F0F0F0"
									vertical={false}
								/>
								<XAxis
									dataKey="label"
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
										fontSize: 13,
										borderRadius: 12,
										border: 'none',
										boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
									}}
								/>
								<Legend
									wrapperStyle={{
										fontFamily: 'Cairo',
										fontSize: 12,
										paddingTop: 8,
									}}
									formatter={(value: string) => {
										const labels: Record<string, string> = {
											revenue: 'الإيرادات',
											orders: 'الطلبات',
											users: 'المستخدمون',
										};
										return labels[value] ?? value;
									}}
								/>
								<Area
									type="monotone"
									dataKey="revenue"
									stroke="#D4A853"
									strokeWidth={2}
									fillOpacity={1}
									fill="url(#colorRevenue)"
								/>
								<Area
									type="monotone"
									dataKey="orders"
									stroke="#10B981"
									strokeWidth={2}
									fillOpacity={1}
									fill="url(#colorOrders)"
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</CardContent>
			</Card>

			{/* ── Two Column Layout: Verifications + Disputes ── */}
			<div className="grid lg:grid-cols-2 gap-6">
				{/* Pending Verifications */}
				<Card className="border-0 shadow-sm">
					<CardHeader className="pt-5 px-5 pb-3 flex flex-row items-center justify-between">
						<div>
							<h3 className="text-[#111111] font-cairo font-bold text-base">
								متاجر بانتظار التحقق
							</h3>
							<p className="text-xs text-[#6B6B6B] font-cairo">
								{pendingVerifications.length} متجر في الانتظار
							</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							className="text-[#D4A853] hover:text-[#D4A853] hover:bg-amber-50 font-cairo text-xs gap-1"
						>
							عرض الكل
							<ChevronLeft className="w-3 h-3" />
						</Button>
					</CardHeader>
					<CardContent className="px-5 pb-5">
						{pendingStoresLoading && pendingVerifications.length === 0 ? (
							<div className="flex items-center justify-center py-10 text-[#6B6B6B]">
								<Activity className="w-4 h-4 ml-2 animate-spin" strokeWidth={1.5} />
								<span className="text-sm font-cairo">جاري التحميل…</span>
							</div>
						) : pendingVerifications.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-10 text-center">
								<Check
									className="w-8 h-8 text-emerald-500 mb-2"
									strokeWidth={1.5}
								/>
								<p className="text-sm font-cairo text-[#6B6B6B]">
									لا يوجد متاجر بانتظار التحقق
								</p>
							</div>
						) : (
							<div className="space-y-3">
								{pendingVerifications.map((v) => (
									<div
										key={v.id}
										className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F8F8] hover:bg-[#F3EDE4]/50 transition-colors"
									>
										<Avatar className="w-10 h-10 shrink-0">
											<AvatarFallback className="bg-[#D4A853]/20 text-[#D4A853] font-cairo text-sm font-bold">
												{v.store.charAt(0)}
											</AvatarFallback>
										</Avatar>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-cairo font-semibold text-[#111111] truncate">
												{v.store}
											</p>
											<p className="text-[11px] text-[#6B6B6B] font-cairo">
												{v.merchant} · {v.date}
											</p>
										</div>
										<Badge
											variant="secondary"
											className="bg-blue-50 text-blue-600 font-cairo text-[10px] shrink-0"
										>
											<FileText className="w-3 h-3 ml-1 inline" />
											{v.docs} مستندات
										</Badge>
										<div className="flex gap-1 shrink-0">
											<button
												type="button"
												title="قبول"
												className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center"
											>
												<Check className="w-3.5 h-3.5" />
											</button>
											<button
												type="button"
												title="رفض"
												className="w-7 h-7 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
											>
												<X className="w-3.5 h-3.5" />
											</button>
										</div>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				{/* Active Disputes */}
				<Card className="border-0 shadow-sm">
					<CardHeader className="pt-5 px-5 pb-3 flex flex-row items-center justify-between">
						<div>
							<h3 className="text-[#111111] font-cairo font-bold text-base">
								نزاعات نشطة
							</h3>
							<p className="text-xs text-[#6B6B6B] font-cairo">
								{activeDisputes.length} نزاعات تتطلب الانتباه
							</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							className="text-[#D4A853] hover:text-[#D4A853] hover:bg-amber-50 font-cairo text-xs gap-1"
						>
							عرض الكل
							<ChevronLeft className="w-3 h-3" />
						</Button>
					</CardHeader>
					<CardContent className="px-5 pb-5">
						{disputesLoading && activeDisputes.length === 0 ? (
							<div className="flex items-center justify-center py-10 text-[#6B6B6B]">
								<Activity className="w-4 h-4 ml-2 animate-spin" strokeWidth={1.5} />
								<span className="text-sm font-cairo">جاري التحميل…</span>
							</div>
						) : activeDisputes.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-10 text-center">
								<Check
									className="w-8 h-8 text-emerald-500 mb-2"
									strokeWidth={1.5}
								/>
								<p className="text-sm font-cairo text-[#6B6B6B]">
									لا يوجد نزاعات نشطة
								</p>
							</div>
						) : (
							<div className="space-y-2">
								{activeDisputes.map((d) => (
									<div
										key={d.id}
										className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F8F8] hover:bg-red-50/30 transition-colors"
									>
										<div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 shrink-0">
											<AlertTriangle
												className="w-4 h-4 text-[#EF4444]"
												strokeWidth={1.5}
											/>
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-0.5">
												<p className="text-sm font-cairo font-semibold text-[#111111]">
													{d.id}
												</p>
												<span
													className={`text-[10px] px-1.5 py-0.5 rounded-full text-white font-cairo ${d.statusColor}`}
												>
													{d.status}
												</span>
											</div>
											<p className="text-[11px] text-[#6B6B6B] font-cairo truncate">
												{d.type} · {d.buyer} vs {d.merchant}
											</p>
										</div>
										<div className="text-left shrink-0">
											<span className="text-[11px] text-[#6B6B6B] font-cairo flex items-center gap-1">
												<Clock className="w-3 h-3" />
												{d.age}
											</span>
										</div>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* ── Platform Health (live /api/ready) ── */}
			<Card className="border-0 shadow-sm">
				<CardContent className="p-4 md:p-5">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2">
							<Activity className="w-4 h-4 text-[#D4A853]" strokeWidth={1.5} />
							<h3 className="text-[#111111] font-cairo font-bold text-sm">
								حالة المنصة
							</h3>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={healthLoading}
							onClick={() => void refetchHealth()}
							className="text-[#6B6B6B] hover:text-[#111111] font-cairo text-xs"
						>
							<RefreshCw
								className={`w-3 h-3 ml-1 ${healthLoading ? 'animate-spin' : ''}`}
								strokeWidth={1.5}
							/>
							تحديث
						</Button>
					</div>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						{/* Server: db.ok from /api/ready checks */}
						<div
							className={`flex items-center gap-3 p-3 rounded-xl ${
								dbOk === true
									? 'bg-emerald-50'
									: dbOk === false
										? 'bg-red-50'
										: 'bg-[#F8F8F8]'
							}`}
						>
							<div
								className={`w-2 h-2 rounded-full ${
									dbOk === true
										? 'bg-emerald-500 animate-pulse'
										: dbOk === false
											? 'bg-red-500'
											: 'bg-gray-400'
								}`}
							/>
							<div>
								<p className="text-xs text-[#6B6B6B] font-cairo">الخادم</p>
								<p
									className={`text-sm font-cairo font-bold ${
										dbOk === true
											? 'text-emerald-600'
											: dbOk === false
												? 'text-red-600'
												: 'text-[#6B6B6B]'
									}`}
								>
									{healthLoading
										? '…'
										: dbOk === true
											? 'يعمل'
											: dbOk === false
												? 'معطل'
												: 'غير معروف'}
								</p>
							</div>
							<Server
								className={`w-4 h-4 mr-auto ${
									dbOk === true
										? 'text-emerald-400'
										: dbOk === false
											? 'text-red-400'
											: 'text-[#AAAAAA]'
								}`}
								strokeWidth={1.5}
							/>
						</div>

						{/* Stability: 100% if db.ok, otherwise 0%. We don't have
						    a multi-window SLA yet — full SLO matrix is C.7 work. */}
						<div className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F8F8]">
							<Zap className="w-4 h-4 text-[#D4A853]" strokeWidth={1.5} />
							<div>
								<p className="text-xs text-[#6B6B6B] font-cairo">الاستقرار</p>
								<p className="text-sm font-mono font-bold text-[#111111]">
									{healthLoading
										? '…'
										: dbOk === true
											? '١٠٠٪'
											: dbOk === false
												? '٠٪'
												: '—'}
								</p>
							</div>
						</div>

						{/* Uptime: derived from /api/ready's uptime_s field.
						    No active-session counter is exposed by the server
						    yet (would need a sessions table; tracked as C.7). */}
						<div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50">
							<Globe className="w-4 h-4 text-blue-500" strokeWidth={1.5} />
							<div>
								<p className="text-xs text-[#6B6B6B] font-cairo">زمن التشغيل</p>
								<p className="text-sm font-mono font-bold text-blue-600">
									{healthLoading || uptimeHours === null
										? '…'
										: `${uptimeHours.toLocaleString('ar-EG')} ساعة`}
								</p>
							</div>
						</div>

						{/* Response time: db.ms from /api/ready */}
						<div className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F8F8]">
							<Clock className="w-4 h-4 text-[#6B6B6B]" strokeWidth={1.5} />
							<div>
								<p className="text-xs text-[#6B6B6B] font-cairo">
									استجابة قاعدة البيانات
								</p>
								<p className="text-sm font-mono font-bold text-[#111111]">
									{healthLoading || dbMs === null ? '…' : `${dbMs}ms`}
								</p>
							</div>
						</div>
					</div>
					{health?.checks?.db?.detail && (
						<p className="text-xs text-red-600 font-cairo mt-3">
							تفاصيل الخطأ: {health.checks.db.detail}
						</p>
					)}
				</CardContent>
			</Card>

			{/* ── Quick Actions ── */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
				{[
					{
						label: 'التحقق من المتاجر',
						icon: Store,
						color: 'bg-amber-50 text-[#D4A853] hover:bg-amber-100',
					},
					{
						label: 'حل النزاعات',
						icon: AlertTriangle,
						color: 'bg-red-50 text-[#EF4444] hover:bg-red-100',
					},
					{
						label: 'تقرير المستخدمين',
						icon: Users,
						color: 'bg-blue-50 text-blue-500 hover:bg-blue-100',
					},
					{
						label: 'عرض التقارير',
						icon: BarChart3,
						color: 'bg-emerald-50 text-emerald-500 hover:bg-emerald-100',
					},
				].map((action, i) => {
					const Icon = action.icon;
					return (
						<Button
							key={i}
							variant="ghost"
							className={`h-auto py-4 flex flex-col items-center gap-2 rounded-2xl font-cairo text-sm font-medium ${action.color} transition-all`}
						>
							<Icon className="w-6 h-6" strokeWidth={1.5} />
							{action.label}
						</Button>
					);
				})}
			</div>
		</div>
	);
}
