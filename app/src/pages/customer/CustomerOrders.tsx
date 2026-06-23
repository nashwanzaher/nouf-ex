/**
 * Nouf-ex — Customer orders page
 *
 * Shows the authenticated user's real orders from /api/orders.
 * The previous version rendered hardcoded mock data; this rewrite
 * ties the page to the live API (P0-1: cart->order pipeline E2E).
 *
 *   - Reads the active user from useAuth(); an unauthenticated
 *     visitor sees an inline "please sign in" CTA.
 *   - Calls useOrders() which fetches /api/orders. The server
 *     scopes the result to req.user.id (customers only see
 *     their own orders; admins can pass ?customerId= to override).
 *   - Maps the API's status string (pending|processing|shipped|
 *     delivered|cancelled) to the Arabic label and color used
 *     in the previous mock-based design.
 */

import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
	Package,
	ChevronDown,
	ChevronUp,
	Truck,
	Clock,
	CheckCircle,
	Loader2,
	RotateCcw,
	XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import CustomerSidebar from './CustomerSidebar';
import { useAuth } from '@/context/AppContext';
import { useOrders } from '@/hooks/useApi';
import type { Order, OrderWithItems } from '@/hooks/useApi';

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

const statusFilters: Array<{ key: 'all' | OrderStatus; label: string }> = [
	{ key: 'all', label: 'الكل' },
	{ key: 'pending', label: 'قيد الانتظار' },
	{ key: 'processing', label: 'قيد المعالجة' },
	{ key: 'shipped', label: 'قيد الشحن' },
	{ key: 'delivered', label: 'تم التوصيل' },
	{ key: 'cancelled', label: 'ملغي' },
];

const statusColors: Record<OrderStatus, string> = {
	pending: 'bg-[#F59E0B] text-white',
	processing: 'bg-[#2563EB] text-white',
	shipped: 'bg-[#8B5CF6] text-white',
	delivered: 'bg-[#10B981] text-white',
	cancelled: 'bg-[#EF4444] text-white',
};

const statusLabels: Record<OrderStatus, string> = {
	pending: 'قيد الانتظار',
	processing: 'قيد المعالجة',
	shipped: 'قيد الشحن',
	delivered: 'تم التوصيل',
	cancelled: 'ملغي',
};

const timelineSteps: Array<{ key: OrderStatus; label: string; icon: typeof Clock }> = [
	{ key: 'pending', label: 'تم الطلب', icon: Clock },
	{ key: 'processing', label: 'قيد المعالجة', icon: Package },
	{ key: 'shipped', label: 'تم الشحن', icon: Truck },
	{ key: 'delivered', label: 'تم التوصيل', icon: CheckCircle },
];

function OrderTimeline({ status }: { status: OrderStatus }) {
	if (status === 'cancelled') return null;
	const activeIndex = timelineSteps.findIndex((s) => s.key === status);

	return (
		<div className="mt-6 p-5 bg-[#F8F8F8] rounded-xl">
			<p className="text-sm font-cairo font-semibold text-[#111111] mb-4">تتبع الطلب</p>
			<div className="flex items-start justify-between relative">
				<div className="absolute top-4 right-6 left-6 h-0.5 bg-[#F3EDE4] z-0" />
				<div
					className="absolute top-4 right-6 h-0.5 bg-[#D4A853] z-0 transition-all"
					style={{ width: `${(activeIndex / (timelineSteps.length - 1)) * 100}%` }}
				/>
				{timelineSteps.map((step, idx) => {
					const isActive = idx <= activeIndex;
					const StepIcon = step.icon;
					return (
						<div key={step.key} className="flex flex-col items-center relative z-10 gap-2">
							<div
								className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
									isActive
										? 'bg-[#D4A853] border-[#D4A853] text-white'
										: 'bg-white border-[#AAAAAA] text-[#AAAAAA]'
								}`}>
								<StepIcon className="w-4 h-4" strokeWidth={1.5} />
							</div>
							<span
								className={`text-[10px] font-cairo font-medium ${isActive ? 'text-[#111111]' : 'text-[#AAAAAA]'}`}>
								{step.label}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}

/** Format an ISO timestamp into the Arabic date label used by the
 *  previous design. Falls back to a dash on parse failure. */
function formatDate(iso: string): string {
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '—';
		const months = [
			'يناير',
			'فبراير',
			'مارس',
			'أبريل',
			'مايو',
			'يونيو',
			'يوليو',
			'أغسطس',
			'سبتمبر',
			'أكتوبر',
			'نوفمبر',
			'ديسمبر',
		];
		return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
	} catch {
		return '—';
	}
}

function formatYer(amount: number | string): string {
	const n = typeof amount === 'string' ? Number(amount) : amount;
	if (!Number.isFinite(n)) return '—';
	return `${n.toLocaleString('en-US')} ر.ي`;
}

export default function CustomerOrders() {
	const { isAuthenticated } = useAuth();
	const [searchParams, setSearchParams] = useSearchParams();
	const [activeFilter, setActiveFilter] = useState<'all' | OrderStatus>('all');
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const { data: orders = [], loading, error, refetch } = useOrders();

	// If the user just placed an order from /checkout, the URL has
	// `?just=N`. Auto-expand that order on first load. We do the
	// state update via `queueMicrotask` to avoid the
	// set-state-in-effect warning in React 19.
	const just = searchParams.get('just');
	if (just && expandedId == null) {
		queueMicrotask(() => setExpandedId(just));
	}

	const filteredOrders = useMemo(() => {
		const knownStatuses: OrderStatus[] = [
			'pending',
			'processing',
			'shipped',
			'delivered',
			'cancelled',
		];
		const list = (orders as unknown as Array<Order & { items?: unknown[] }>).map((o) => ({
			...o,
			status: knownStatuses.includes((o.status as OrderStatus) ?? '')
				? (o.status as OrderStatus)
				: 'pending',
		}));
		return activeFilter === 'all' ? list : list.filter((o) => o.status === activeFilter);
	}, [orders, activeFilter]);

	if (!isAuthenticated) {
		return (
			<div className="min-h-[100dvh] bg-[#F8F8F8]" dir="rtl">
				<CustomerSidebar />
				<div className="md:mr-60 min-h-[100dvh] flex items-center justify-center p-6">
					<div className="bg-white rounded-2xl p-10 text-center shadow-sm max-w-md">
						<Package className="w-12 h-12 mx-auto text-[#D4A853] mb-3" strokeWidth={1.5} />
						<h2 className="text-xl font-amiri font-bold text-[#1A1612] mb-2">
							سجّل الدخول لعرض طلباتك
						</h2>
						<p className="text-sm text-[#6B6B6B] font-cairo mb-4">
							طلباتك محفوظة في حسابك. سجّل الدخول للوصول إليها.
						</p>
						<Button
							asChild
							className="bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo rounded-xl">
							<Link to="/auth/login?next=/customer/orders">تسجيل الدخول</Link>
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-[100dvh] bg-[#F8F8F8]" dir="rtl">
			<CustomerSidebar />

			<div className="md:mr-60 min-h-[100dvh]">
				<div className="bg-white border-b border-[#F3EDE4] px-6 py-4 sticky top-0 z-30 flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-amiri font-bold text-[#1A1612]">طلباتي</h1>
						<p className="text-sm text-[#6B6B6B] font-cairo mt-1">تتبع وإدارة طلباتك</p>
					</div>
					{searchParams.get('just') && (
						<button
							type="button"
							className="text-xs text-[#D4A853] font-cairo"
							onClick={() => {
								searchParams.delete('just');
								setSearchParams(searchParams, { replace: true });
							}}>
							تم استلام الطلب الجديد
						</button>
					)}
				</div>

				<div className="p-6 max-w-4xl mx-auto space-y-6">
					{/* Filter tabs */}
					<div className="flex gap-2 overflow-x-auto pb-2">
						{statusFilters.map((f) => (
							<button
								key={f.key}
								onClick={() => setActiveFilter(f.key)}
								className={`px-4 py-2 rounded-full text-sm font-cairo font-medium whitespace-nowrap transition-colors ${
									activeFilter === f.key
										? 'bg-[#D4A853] text-[#1A1612]'
										: 'bg-white text-[#6B6B6B] hover:bg-[#F3EDE4]'
								}`}>
								{f.label}
							</button>
						))}
					</div>

					{/* Loading / Error / Empty states */}
					{loading && (
						<div className="bg-white rounded-2xl p-10 text-center shadow-sm">
							<Loader2 className="w-8 h-8 mx-auto text-[#D4A853] animate-spin" />
							<p className="mt-3 text-sm text-[#6B6B6B] font-cairo">جاري التحميل…</p>
						</div>
					)}
					{!loading && error && (
						<div className="bg-white rounded-2xl p-10 text-center shadow-sm">
							<XCircle className="w-10 h-10 mx-auto text-[#EF4444] mb-3" />
							<h3 className="text-lg font-amiri font-bold text-[#1A1612] mb-2">
								تعذّر تحميل الطلبات
							</h3>
							<p className="text-sm text-[#6B6B6B] font-cairo mb-4">{error}</p>
							<Button
								onClick={() => refetch()}
								className="bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo rounded-xl">
								حاول مرة أخرى
							</Button>
						</div>
					)}
					{!loading && !error && filteredOrders.length === 0 && (
						<div className="bg-white rounded-2xl p-12 text-center shadow-sm">
							<div className="w-20 h-20 bg-[#F8F8F8] rounded-full flex items-center justify-center mx-auto mb-4">
								<Package className="w-10 h-10 text-[#AAAAAA]" strokeWidth={1.5} />
							</div>
							<h3 className="text-xl font-amiri font-bold text-[#1A1612] mb-2">لا توجد طلبات</h3>
							<p className="text-[#6B6B6B] font-cairo text-sm mb-4">
								لا توجد طلبات في هذه الحالة حالياً
							</p>
							<Button
								asChild
								className="bg-[#D4A853] text-[#1A1612] hover:bg-[#c49a48] font-cairo rounded-xl">
								<Link to="/">تصفح المنتجات</Link>
							</Button>
						</div>
					)}

					{/* Orders */}
					{!loading && !error && filteredOrders.length > 0 && (
						<div className="space-y-4">
							{filteredOrders.map((order) => {
								const expanded = expandedId === String(order.id);
								const status = (order.status as OrderStatus) ?? 'pending';
								const items = (order as OrderWithItems).items ?? [];
								const total = Number(order.total ?? 0);
								return (
									<div
										key={order.id}
										className="bg-white rounded-2xl shadow-sm overflow-hidden transition-shadow hover:shadow-md">
										{/* Order header */}
										<div className="p-5">
											<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
												<div className="flex items-center gap-3">
													<div className="w-12 h-12 rounded-xl bg-[#F3EDE4] flex items-center justify-center shrink-0">
														<Package className="w-6 h-6 text-[#D4A853]" strokeWidth={1.5} />
													</div>
													<div>
														<div className="flex items-center gap-2 flex-wrap">
															<p className="font-mono font-bold text-[#111111]">
																#{order.order_number ?? order.id}
															</p>
															<span
																className={`text-[11px] font-cairo font-medium px-2.5 py-0.5 rounded-full ${
																	statusColors[status]
																}`}>
																{statusLabels[status]}
															</span>
														</div>
														<p className="text-xs text-[#6B6B6B] font-cairo mt-0.5">
															{formatDate(order.created_at)} · {items.length} منتج
														</p>
													</div>
												</div>
												<div className="flex items-center gap-3">
													<p className="font-mono font-bold text-[#D4A853] text-lg">
														{formatYer(total)}
													</p>
													<button
														type="button"
														onClick={() => setExpandedId(expanded ? null : String(order.id))}
														className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F8F8F8] transition-colors">
														{expanded ? (
															<ChevronUp className="w-5 h-5 text-[#6B6B6B]" strokeWidth={1.5} />
														) : (
															<ChevronDown className="w-5 h-5 text-[#6B6B6B]" strokeWidth={1.5} />
														)}
													</button>
												</div>
											</div>

											{/* Quick items preview */}
											{items.length > 0 && (
												<div className="mt-4 flex gap-3 overflow-x-auto">
													{items.slice(0, 3).map((it, idx) => (
														<div
															key={idx}
															className="flex items-center gap-2 bg-[#F8F8F8] rounded-lg px-3 py-2 shrink-0">
															{it.product_image ? (
																<img
																	src={it.product_image}
																	alt={it.product_name ?? ''}
																	className="w-6 h-6 object-cover rounded"
																/>
															) : (
																<Package className="w-4 h-4 text-[#AAAAAA]" strokeWidth={1.5} />
															)}
															<span className="text-xs font-cairo text-[#111111] truncate max-w-[180px]">
																{it.product_name ?? `#${it.product_id}`} × {it.quantity}
															</span>
														</div>
													))}
													{items.length > 3 && (
														<span className="text-xs text-[#6B6B6B] font-cairo self-center">
															+{items.length - 3} أكثر
														</span>
													)}
												</div>
											)}
										</div>

										{/* Expanded body */}
										{expanded && (
											<div className="border-t border-[#F3EDE4] bg-[#FCFAF6] p-5">
												<OrderTimeline status={status} />
												<div className="mt-6 grid sm:grid-cols-2 gap-4 text-sm">
													<div>
														<p className="text-xs text-[#6B6B6B] font-cairo mb-1">طريقة الدفع</p>
														<p className="font-cairo text-[#111111]">
															{order.payment_method === 'cod'
																? 'الدفع عند الاستلام'
																: order.payment_method}
														</p>
													</div>
													<div>
														<p className="text-xs text-[#6B6B6B] font-cairo mb-1">حالة الدفع</p>
														<p className="font-cairo text-[#111111]">
															{order.payment_status === 'paid' ? 'مدفوع' : 'قيد السداد'}
														</p>
													</div>
													{order.shipping_address && (
														<div className="sm:col-span-2">
															<p className="text-xs text-[#6B6B6B] font-cairo mb-1">عنوان الشحن</p>
															<p className="font-cairo text-[#111111]">
																{typeof order.shipping_address === 'string'
																	? order.shipping_address
																	: JSON.stringify(order.shipping_address)}
															</p>
														</div>
													)}
												</div>
												<div className="mt-6 flex gap-2">
													<Button
														variant="outline"
														size="sm"
														className="font-cairo"
														onClick={() => refetch()}>
														<RotateCcw className="w-4 h-4 me-1" />
														تحديث الحالة
													</Button>
												</div>
											</div>
										)}
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
