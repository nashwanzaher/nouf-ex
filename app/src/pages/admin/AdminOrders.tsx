/**
 * AdminOrders.tsx — K.6 page
 *
 * Lists every order in the system with admin-only force-status
 * controls. Reads via /api/admin/orders (server/routes/admin.cts:
 * 218-269) and mutates via PATCH /api/admin/orders/:id/status
 * (admin.cts:537-569). Writes to admin_audit_log.
 *
 * "Force status" is the admin override of the seller's normal
 * state-machine transitions (pending → confirmed → shipped →
 * delivered). Triggers when the merchant is unresponsive or the
 * courier can't update.
 */
import { useState, useMemo, useCallback } from 'react';
import {
	ShoppingBag,
	Search,
	ChevronLeft,
	ChevronRight,
	Eye,
	Loader2,
	Wallet,
	AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAdminOrders } from '@/hooks/useApi';
import { patchAdminOrderStatus } from '@/lib/api';
import { useApp } from '@/context/AppContext';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

// Status enum from /api/admin/orders?status= validator
// (server/routes/admin.cts:222-232). Same set as the public
// /api/orders but spelled in singular form.
const ORDER_STATUSES = [
	'pending',
	'confirmed',
	'processing',
	'shipped',
	'delivered',
	'cancelled',
	'refunded',
] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

const STATUS_LABEL: Record<OrderStatus, string> = {
	pending: 'قيد الانتظار',
	confirmed: 'مؤكد',
	processing: 'قيد التجهيز',
	shipped: 'تم الشحن',
	delivered: 'تم التسليم',
	cancelled: 'ملغي',
	refunded: 'مسترد',
};

const STATUS_COLOR: Record<OrderStatus, string> = {
	pending: 'bg-amber-50 text-amber-600',
	confirmed: 'bg-blue-50 text-blue-600',
	processing: 'bg-indigo-50 text-indigo-600',
	shipped: 'bg-purple-50 text-purple-600',
	delivered: 'bg-emerald-50 text-emerald-600',
	cancelled: 'bg-[#F8F8F8] text-[#6B6B6B]',
	refunded: 'bg-red-50 text-red-500',
};

const PAYMENT_LABEL: Record<string, string> = {
	pending: 'غير مدفوع',
	paid: 'مدفوع',
	failed: 'فشل',
	refunded: 'مسترد',
};

const PAYMENT_COLOR: Record<string, string> = {
	pending: 'bg-amber-50 text-amber-600',
	paid: 'bg-emerald-50 text-emerald-600',
	failed: 'bg-red-50 text-red-500',
	refunded: 'bg-[#F8F8F8] text-[#6B6B6B]',
};

/** Pages key: status filter. 'all' is special and excluded
 *  from the validator query. */
const STATUS_TABS: { key: 'all' | OrderStatus; label: string }[] = [
	{ key: 'all', label: 'الكل' },
	{ key: 'pending', label: 'قيد الانتظار' },
	{ key: 'processing', label: 'قيد التجهيز' },
	{ key: 'shipped', label: 'مشحون' },
	{ key: 'delivered', label: 'مسلَّم' },
	{ key: 'cancelled', label: 'ملغي' },
	{ key: 'refunded', label: 'مسترد' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function AdminOrders() {
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
	const [paymentFilter, setPaymentFilter] = useState<string>('');
	const [currentPage, setCurrentPage] = useState(1);
	const pageSize = 20;

	const apiParams = useMemo(() => {
		const p: {
			limit: number;
			offset: number;
			status?: string;
			payment_status?: string;
		} = { limit: pageSize, offset: (currentPage - 1) * pageSize };
		if (statusFilter !== 'all') p.status = statusFilter;
		if (paymentFilter) p.payment_status = paymentFilter;
		return p;
	}, [statusFilter, paymentFilter, currentPage]);

	const {
		data: response,
		loading,
		error,
		refetch,
	} = useAdminOrders(apiParams);
	const { addToast } = useApp();

	const orders = useMemo(
		() => response?.orders ?? [],
		[response],
	);
	const totalCount = response?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

	const filtered = useMemo(() => {
		if (!search.trim()) return orders;
		const needle = search.toLowerCase();
		return orders.filter(
			(o) =>
				String(o.id).includes(needle) ||
				String(o.order_number ?? '')
					.toLowerCase()
					.includes(needle) ||
				String(o.customer_id).includes(needle),
		);
	}, [orders, search]);

	const handleSetStatus = useCallback(
		async (
			order: (typeof orders)[number],
			next: OrderStatus,
		) => {
			try {
				await patchAdminOrderStatus(Number(order.id), { status: next });
				addToast({
					type: 'success',
					message: `تم تحديث الطلب #${order.order_number ?? order.id} إلى "${STATUS_LABEL[next]}"`,
				});
				await refetch();
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				addToast({ type: 'error', message: 'فشل تحديث الطلب: ' + msg });
			}
		},
		[addToast, refetch],
	);

	const formatDate = useCallback((iso: string) => {
		try {
			return new Date(iso).toISOString().slice(0, 16).replace('T', ' ');
		} catch {
			return iso;
		}
	}, []);

	const formatTotal = useCallback((o: (typeof orders)[number]) => {
		const sym = (o as { currency?: string }).currency ?? 'YER';
		return `${Number(o.total).toLocaleString()} ${sym}`;
	}, []);

	return (
		<div className="space-y-5">
			{error && (
				<div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
					تعذّر تحميل الطلبات: {error}
					<button
						type="button"
						className="ml-2 underline"
						onClick={() => void refetch()}
					>
						إعادة المحاولة
					</button>
				</div>
			)}
			{/* ── Status Tabs ── */}
			<div className="flex flex-wrap gap-2">
				{STATUS_TABS.map((tab) => (
					<button
						key={tab.key}
						onClick={() => {
							setStatusFilter(tab.key);
							setCurrentPage(1);
						}}
						type="button"
						className={`px-3 py-2 rounded-xl text-xs font-cairo font-medium transition-all ${
							statusFilter === tab.key
								? 'bg-[#D4A853] text-[#1A1612] shadow-sm'
								: 'bg-white text-[#6B6B6B] hover:bg-[#F8F8F8] border border-[#EEEEEE]'
						}`}
					>
						{tab.label}
					</button>
				))}
			</div>

			<Card className="border-0 shadow-sm">
				<CardContent className="p-4">
					<div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
						<div className="relative w-full lg:w-72">
							<Search
								className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AAAAAA]"
								strokeWidth={1.5}
							/>
							<input
								type="text"
								placeholder="رقم الطلب، معرّف العميل..."
								aria-label="بحث الطلبات"
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setCurrentPage(1);
								}}
								className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#e5e5e5] bg-[#F8F8F8] text-sm font-cairo text-[#111111] placeholder:text-[#AAAAAA] outline-none focus:border-[#D4A853] focus:ring-2 focus:ring-[#D4A853]/20 transition-all"
							/>
						</div>
						<select
							value={paymentFilter}
							onChange={(e) => {
								setPaymentFilter(e.target.value);
								setCurrentPage(1);
							}}
							aria-label="Payment filter"
							className="text-xs font-cairo px-3 py-2 rounded-xl border border-[#e5e5e5] bg-white text-[#111111] outline-none focus:border-[#D4A853]"
						>
							<option value="">كل حالات الدفع</option>
							<option value="pending">غير مدفوع</option>
							<option value="paid">مدفوع</option>
							<option value="failed">فشل</option>
							<option value="refunded">مسترد</option>
						</select>
					</div>
				</CardContent>
			</Card>

			<Card className="border-0 shadow-sm overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="bg-[#F8F8F8] border-b border-[#EEEEEE]">
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B]">
									الطلب
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B] hidden md:table-cell">
									العميل
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B]">
									الحالة
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B] hidden md:table-cell">
									الدفع
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B] hidden lg:table-cell">
									المبلغ
								</th>
								<th className="px-4 py-3 text-center text-xs font-cairo font-semibold text-[#6B6B6B]">
									إجراءات
								</th>
							</tr>
						</thead>
						<tbody>
							{loading && filtered.length === 0 ? (
								<tr>
									<td
										colSpan={6}
										className="px-4 py-8 text-center text-sm text-[#AAAAAA] font-cairo"
									>
										<Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
										جاري التحميل…
									</td>
								</tr>
							) : (
								filtered.map((o) => {
									const status = (o.status ?? 'pending') as OrderStatus;
									const payment = (o.payment_status ?? 'pending') as string;
									return (
										<tr
											key={o.id}
											className="border-b border-[#F5F5F5] hover:bg-[#F8F8F8]/50 transition-colors"
										>
											<td className="px-4 py-3">
												<div>
													<p className="text-sm font-mono font-semibold text-[#111111]">
														#{o.order_number ?? o.id}
													</p>
													<p className="text-[11px] text-[#6B6B6B] font-cairo">
														{formatDate(o.created_at as string)}
													</p>
												</div>
											</td>
											<td className="px-4 py-3 hidden md:table-cell text-xs text-[#6B6B6B] font-cairo">
												#{o.customer_id}
											</td>
											<td className="px-4 py-3">
												<Badge
													className={`font-cairo text-[10px] ${
														STATUS_COLOR[status] ?? STATUS_COLOR.pending
													}`}
												>
													{STATUS_LABEL[status] ?? status}
												</Badge>
											</td>
											<td className="px-4 py-3 hidden md:table-cell">
												<Badge
													className={`font-cairo text-[10px] ${
														PAYMENT_COLOR[payment] ?? PAYMENT_COLOR.pending
													}`}
												>
													{PAYMENT_LABEL[payment] ?? payment}
												</Badge>
											</td>
											<td className="px-4 py-3 hidden lg:table-cell text-sm font-mono text-[#111111]">
												{formatTotal(o)}
											</td>
											<td className="px-4 py-3">
												<div className="flex items-center justify-center gap-1">
													<button
														type="button"
														className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-blue-50 text-[#6B6B6B] hover:text-blue-500 transition-colors"
														title="عرض"
													>
														<Eye className="w-4 h-4" strokeWidth={1.5} />
													</button>
													<select
														value={status}
														onChange={(e) =>
															void handleSetStatus(
																o,
																e.target.value as OrderStatus,
															)
														}
														aria-label="تغيير الحالة"
														className="text-[10px] font-cairo px-2 py-1 rounded-lg border border-[#e5e5e5] bg-white text-[#111111] outline-none focus:border-[#D4A853]"
													>
														{ORDER_STATUSES.map((s) => (
															<option key={s} value={s}>
																{STATUS_LABEL[s]}
															</option>
														))}
													</select>
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				{filtered.length === 0 && !loading && (
					<div className="py-12 text-center">
						<ShoppingBag className="w-12 h-12 text-[#AAAAAA] mx-auto mb-3" />
						<p className="text-sm text-[#6B6B6B] font-cairo">
							لا توجد طلبات مطابقة
						</p>
					</div>
				)}

				{totalCount > pageSize && (
					<div className="flex items-center justify-between px-4 py-3 border-t border-[#F5F5F5]">
						<span className="text-xs text-[#6B6B6B] font-cairo">
							{totalCount} طلب
						</span>
						<div className="flex items-center gap-1">
							<button
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								disabled={currentPage === 1}
								type="button"
								className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F8F8F8] disabled:opacity-30"
							>
								<ChevronRight className="w-4 h-4" />
							</button>
							{Array.from({ length: totalPages }, (_, i) => i + 1)
								.slice(
									Math.max(0, currentPage - 3),
									Math.min(totalPages, currentPage + 2),
								)
								.map((p) => (
									<button
										key={p}
										onClick={() => setCurrentPage(p)}
										type="button"
										className={`w-8 h-8 rounded-lg text-xs font-cairo font-medium ${
											currentPage === p
												? 'bg-[#D4A853] text-[#1A1612]'
												: 'text-[#6B6B6B] hover:bg-[#F8F8F8]'
										}`}
									>
										{p}
									</button>
								))}
							<button
								onClick={() =>
									setCurrentPage((p) => Math.min(totalPages, p + 1))
								}
								disabled={currentPage === totalPages}
								type="button"
								className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F8F8F8] disabled:opacity-30"
							>
								<ChevronLeft className="w-4 h-4" />
							</button>
						</div>
					</div>
				)}
			</Card>
		</div>
	);
}

const _AlertTriangle = AlertTriangle;
const _Wallet = Wallet;
