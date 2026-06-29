import { useState } from 'react';
import {
	Users,
	Store,
	ShoppingBag,
	DollarSign,
	TrendingUp,
	TrendingDown,
	Clock,
	AlertTriangle,
	ChevronLeft,
	Activity,
	Zap,
	Globe,
	Server,
	Check,
	X,
	BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
	AreaChart,
	Area,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	Legend,
} from 'recharts';
import { useAdminStats } from '@/hooks/useApi';
import { formatMoney } from '@/lib/format';

/* ------------------------------------------------------------------ */
/*  Mock data (kept for the chart only — the stat cards below are    */
/*  driven by /api/admin/stats)                                       */
/* ------------------------------------------------------------------ */
const chartData = [
	{ name: 'يناير', revenue: 32000, orders: 2400, users: 800 },
	{ name: 'فبراير', revenue: 35000, orders: 2800, users: 950 },
	{ name: 'مارس', revenue: 30000, orders: 2100, users: 700 },
	{ name: 'أبريل', revenue: 42000, orders: 3500, users: 1200 },
	{ name: 'مايو', revenue: 38000, orders: 3100, users: 1050 },
	{ name: 'يونيو', revenue: 45200, orders: 3800, users: 1400 },
];

const pendingVerifications = [
	{ id: 1, store: 'متجر الأناقة', merchant: 'أحمد عبدالله', date: '٢٠٢٤/٠٦/١٨', docs: 3 },
	{ id: 2, store: 'إلكترونيات الغد', merchant: 'خالد محسن', date: '٢٠٢٤/٠٦/١٧', docs: 2 },
	{ id: 3, store: 'التمور الفاخرة', merchant: 'فاطمة السعدي', date: '٢٠٢٤/٠٦/١٧', docs: 4 },
	{ id: 4, store: 'حرف يدوية', merchant: 'عبدالرحمن علي', date: '٢٠٢٤/٠٦/١٦', docs: 2 },
	{ id: 5, store: 'عطور الجنوب', merchant: 'سمية حسن', date: '٢٠٢٤/٠٦/١٥', docs: 3 },
];

const activeDisputes = [
	{
		id: 'D-1024',
		type: 'منتج تالف',
		buyer: 'علي محمود',
		merchant: 'متجر الإلكترون',
		status: 'جديد',
		statusColor: 'bg-red-500',
		age: '٢ ساعة',
	},
	{
		id: 'D-1023',
		type: 'لم يستلم',
		buyer: 'سارة أحمد',
		merchant: 'أناقة اليمن',
		status: 'قيد المراجعة',
		statusColor: 'bg-amber-500',
		age: '٥ ساعات',
	},
	{
		id: 'D-1022',
		type: 'منتج مغاير',
		buyer: 'محمد سعيد',
		merchant: 'تمور صنعاء',
		status: 'قيد الحل',
		statusColor: 'bg-blue-500',
		age: 'يوم',
	},
	{
		id: 'D-1021',
		type: 'رد مبلغ',
		buyer: 'نورة خالد',
		merchant: 'إلكترونيات الغد',
		status: 'قيد المراجعة',
		statusColor: 'bg-amber-500',
		age: 'يومان',
	},
];

const periodOptions = ['أسبوع', 'شهر', 'سنة'];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function AdminOverview() {
	const [period, setPeriod] = useState('شهر');

	// Real stats from /api/admin/stats (server/routes/admin.cts:377-417).
	// The endpoint aggregates counts, 7-day deltas, and revenue in a
	// single round-trip via a CTE; falls back to 0s while loading.
	const { data: stats, loading: statsLoading } = useAdminStats();
	const recentGrowth = stats?.recent7d;
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
									{delta !== null && (
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
										{v.docs} مستندات
									</Badge>
									<div className="flex gap-1 shrink-0">
										<button className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center">
											<Check className="w-3.5 h-3.5" />
										</button>
										<button className="w-7 h-7 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center">
											<X className="w-3.5 h-3.5" />
										</button>
									</div>
								</div>
							))}
						</div>
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
											{d.buyer} vs {d.merchant}
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
					</CardContent>
				</Card>
			</div>

			{/* ── Platform Health ── */}
			<Card className="border-0 shadow-sm">
				<CardContent className="p-4 md:p-5">
					<div className="flex items-center gap-2 mb-4">
						<Activity className="w-4 h-4 text-[#D4A853]" strokeWidth={1.5} />
						<h3 className="text-[#111111] font-cairo font-bold text-sm">حالة المنصة</h3>
					</div>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50">
							<div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
							<div>
								<p className="text-xs text-[#6B6B6B] font-cairo">الخادم</p>
								<p className="text-sm font-cairo font-bold text-emerald-600">
									يعمل
								</p>
							</div>
							<Server
								className="w-4 h-4 text-emerald-400 mr-auto"
								strokeWidth={1.5}
							/>
						</div>

						<div className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F8F8]">
							<Zap className="w-4 h-4 text-[#D4A853]" strokeWidth={1.5} />
							<div>
								<p className="text-xs text-[#6B6B6B] font-cairo">الاستقرار</p>
								<p className="text-sm font-mono font-bold text-[#111111]">٩٩.٩٪</p>
							</div>
						</div>

						<div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50">
							<Globe className="w-4 h-4 text-blue-500" strokeWidth={1.5} />
							<div>
								<p className="text-xs text-[#6B6B6B] font-cairo">الجلسات النشطة</p>
								<p className="text-sm font-mono font-bold text-blue-600">٣٢٠</p>
							</div>
						</div>

						<div className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F8F8]">
							<Clock className="w-4 h-4 text-[#6B6B6B]" strokeWidth={1.5} />
							<div>
								<p className="text-xs text-[#6B6B6B] font-cairo">متوسط الاستجابة</p>
								<p className="text-sm font-mono font-bold text-[#111111]">١٢٠ms</p>
							</div>
						</div>
					</div>
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
