import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useSellerOrders } from '@/hooks/useApi';
import { updateSellerOrderStatus, getSellerOrder } from '@/lib/api';
import type { SellerOrderWithItems } from '@/lib/api';
import { useApp } from '@/context/AppContext';
import {
	Search,
	Download,
	Eye,
	ChevronDown,
	X,
	Package,
	Truck,
	CheckCircle2,
	Clock,
	MapPin,
	Phone,
	CreditCard,
	Printer,
	RefreshCw,
	ArrowLeft,
	ShoppingBag,
	CalendarRange,
} from 'lucide-react';
import DashboardShell from './DashboardShell';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface OrderItem {
	name: string;
	qty: number;
	price: string;
}

interface Order {
	id: string;
	customer: string;
	phone: string;
	date: string;
	amount: string;
	paymentStatus: string;
	status: 'new' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
	statusLabel: string;
	items: OrderItem[];
	address: string;
	paymentMethod: string;
	timeline: { status: string; time: string; done: boolean }[];
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const mockOrders: Order[] = [
	{
		id: '#١٢٤٣',
		customer: 'محمد العبدلي',
		phone: '٠٧٧٧١٢٣٤٥٦٧',
		date: '٢٠٢٤/٠٦/١٥',
		amount: '٤٥,٠٠٠ ر.ي',
		paymentStatus: 'مدفوع',
		status: 'new',
		statusLabel: 'جديد',
		items: [{ name: 'ساعة ذكية أبل واتش سلسلة ٩', qty: 1, price: '٤٥,٠٠٠ ر.ي' }],
		address: 'صنعاء، شارع حدة، جوار جامعة صنعاء',
		paymentMethod: 'الدفع عند الاستلام',
		timeline: [{ status: 'تم استلام الطلب', time: '١٠:٣٠ ص', done: true }],
	},
	{
		id: '#١٢٤٢',
		customer: 'فاطمة السالمي',
		phone: '٠٧٣٣٩٨٧٦٥٤',
		date: '٢٠٢٤/٠٦/١٥',
		amount: '١٢٨,٠٠٠ ر.ي',
		paymentStatus: 'مدفوع',
		status: 'processing',
		statusLabel: 'قيد المعالجة',
		items: [
			{ name: 'سماعات AirPods Pro الجيل الثاني', qty: 2, price: '٦٥,٠٠٠ ر.ي' },
			{ name: 'كيبل شحن USB-C', qty: 1, price: '٣,٠٠٠ ر.ي' },
		],
		address: 'عدن، المنصورة، شارع القصر',
		paymentMethod: 'تحويل بنكي',
		timeline: [
			{ status: 'تم استلام الطلب', time: '٩:١٥ ص', done: true },
			{ status: 'قيد المعالجة', time: '١١:٠٠ ص', done: true },
		],
	},
	{
		id: '#١٢٤١',
		customer: 'خالد الحضرمي',
		phone: '٠٧١١٢٢٣٣٤٤٥',
		date: '٢٠٢٤/٠٦/١٤',
		amount: '٣٤,٥٠٠ ر.ي',
		paymentStatus: 'مدفوع',
		status: 'shipped',
		statusLabel: 'تم الشحن',
		items: [
			{ name: 'بن يمني مطحون فرنسي', qty: 3, price: '٤,٥٠٠ ر.ي' },
			{ name: 'عسل يمني سدر نصف كيلو', qty: 2, price: '٧,٥٠٠ ر.ي' },
		],
		address: 'المكلا، حي الروضة',
		paymentMethod: 'الدفع عند الاستلام',
		timeline: [
			{ status: 'تم استلام الطلب', time: '٢:٠٠ م', done: true },
			{ status: 'قيد المعالجة', time: '٤:٣٠ م', done: true },
			{ status: 'تم الشحن', time: '١١:٠٠ ص اليوم', done: true },
		],
	},
	{
		id: '#١٢٤٠',
		customer: 'سمية القحطاني',
		phone: '٠٧٥٥٦٦٧٧٨٨',
		date: '٢٠٢٤/٠٦/١٤',
		amount: '٨٩,٠٠٠ ر.ي',
		paymentStatus: 'مدفوع',
		status: 'delivered',
		statusLabel: 'مكتمل',
		items: [{ name: 'هاتف Samsung Galaxy S24 Ultra', qty: 1, price: '٨٩,٠٠٠ ر.ي' }],
		address: 'تعز، شارع القاهرة',
		paymentMethod: 'محفظة إلكترونية',
		timeline: [
			{ status: 'تم استلام الطلب', time: '٨:٠٠ ص', done: true },
			{ status: 'قيد المعالجة', time: '١٠:٠٠ ص', done: true },
			{ status: 'تم الشحن', time: '٢:٠٠ م', done: true },
			{ status: 'تم التوصيل', time: '٥:٠٠ م', done: true },
		],
	},
	{
		id: '#١٢٣٩',
		customer: 'عبدالله المرازي',
		phone: '٠٧٨٨٩٩٠٠١١',
		date: '٢٠٢٤/٠٦/١٣',
		amount: '١٥,٠٠٠ ر.ي',
		paymentStatus: 'مسترد',
		status: 'cancelled',
		statusLabel: 'ملغي',
		items: [
			{ name: 'حقيبة ظهر للابتوب', qty: 1, price: '٩,٥٠٠ ر.ي' },
			{ name: 'ماوس لاسلكي', qty: 1, price: '٥,٥٠٠ ر.ي' },
		],
		address: 'إب، شارع الستين',
		paymentMethod: 'الدفع عند الاستلام',
		timeline: [
			{ status: 'تم استلام الطلب', time: '٣:٠٠ م', done: true },
			{ status: 'تم الإلغاء', time: '٥:٠٠ م', done: true },
		],
	},
	{
		id: '#١٢٣٨',
		customer: 'نورة الصنعاني',
		phone: '٠٧٧٧٣٣٤٤٥٥',
		date: '٢٠٢٤/٠٦/١٣',
		amount: '٥٦,٠٠٠ ر.ي',
		paymentStatus: 'مدفوع',
		status: 'new',
		statusLabel: 'جديد',
		items: [
			{ name: 'ثوب يمني تقليدي مطرز', qty: 2, price: '١٥,٠٠٠ ر.ي' },
			{ name: 'حذاء تقليدي يمني', qty: 2, price: '١٣,٠٠٠ ر.ي' },
		],
		address: 'صنعاء، شارع الستين، جوار البنك المركزي',
		paymentMethod: 'الدفع عند الاستلام',
		timeline: [{ status: 'تم استلام الطلب', time: '٧:٤٥ ص', done: true }],
	},
	{
		id: '#١٢٣٧',
		customer: 'طارق المح wigfi',
		phone: '٠٧٣٣٤٤٥٥٦٦',
		date: '٢٠٢٤/٠٦/١٢',
		amount: '٢١٠,٠٠٠ ر.ي',
		paymentStatus: 'مدفوع',
		status: 'processing',
		statusLabel: 'قيد المعالجة',
		items: [{ name: 'ماك بوك برو ١٤ بوصة', qty: 1, price: '٢١٠,٠٠٠ ر.ي' }],
		address: 'حضرموت، المكلا، حي الفيل',
		paymentMethod: 'تحويل بنكي',
		timeline: [
			{ status: 'تم استلام الطلب', time: '٩:٠٠ ص', done: true },
			{ status: 'قيد المعالجة', time: '١:٠٠ م', done: true },
		],
	},
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function StatusBadge({ status, label }: { status: string; label: string }) {
	const map: Record<string, string> = {
		new: 'bg-[#2563EB] text-white',
		processing: 'bg-[#F59E0B] text-white',
		shipped: 'bg-[#10B981] text-white',
		delivered: 'bg-[rgba(16,185,129,0.12)] text-[#10B981]',
		cancelled: 'bg-[rgba(239,68,68,0.12)] text-[#EF4444]',
	};
	return (
		<span
			className={cn(
				'px-2 py-1 rounded-lg text-[11px] font-bold font-cairo',
				map[status] || 'bg-[#AAAAAA] text-white',
			)}
		>
			{label}
		</span>
	);
}

/* ------------------------------------------------------------------ */
/*  Order Detail Drawer                                                */
/* ------------------------------------------------------------------ */

function OrderDetailDrawer({
	order,
	onClose,
	onChangeStatus,
	detailLoading,
	detailError,
}: {
	order: Order;
	onClose: () => void;
	onChangeStatus: (status: Order['status']) => void | Promise<void>;
	detailLoading: boolean;
	detailError: string | null;
}) {
	const { t } = useTranslation();
	const [statusOpen, setStatusOpen] = useState(false);
	const statusOptions: { key: Order['status']; label: string; color: string }[] = [
		{ key: 'new', label: t('seller.statusNew', 'New'), color: '#2563EB' },
		{ key: 'processing', label: t('seller.statusProcessing', 'Processing'), color: '#F59E0B' },
		{ key: 'shipped', label: t('seller.statusShipped', 'Shipped'), color: '#10B981' },
		{ key: 'delivered', label: t('seller.statusDelivered', 'Delivered'), color: '#10B981' },
		{ key: 'cancelled', label: t('seller.statusCancelled', 'Cancelled'), color: '#EF4444' },
	];

	return (
		<AnimatePresence>
			{order && (
				<>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 bg-black/40 z-[200] backdrop-blur-sm"
						onClick={onClose}
					/>
					<motion.div
						initial={{ x: '100%' }}
						animate={{ x: 0 }}
						exit={{ x: '100%' }}
						transition={{ type: 'spring', damping: 28, stiffness: 250 }}
						className="fixed top-0 bottom-0 right-0 w-full max-w-[600px] bg-white z-[201] overflow-y-auto shadow-2xl"
					>
						{/* Drawer Header */}
						<div className="sticky top-0 bg-white border-b border-[#F3EDE4] px-6 py-4 flex items-center justify-between z-10">
							<div>
								<h2 className="text-lg font-amiri font-bold text-[#1A1612]">
									تفاصيل الطلب {order.id}
								</h2>
								<p className="text-xs text-[#6B6B6B] font-cairo">{order.date}</p>
							</div>
							<button
								onClick={onClose}
								title={t('common.close', 'Close')}
								aria-label={t('common.close', 'Close')}
								className="w-8 h-8 rounded-xl hover:bg-[#F8F8F8] flex items-center justify-center transition-colors"
							>
								<X className="w-5 h-5 text-[#6B6B6B]" strokeWidth={1.5} />
							</button>
						</div>

						<div className="p-6 space-y-6">
							{/* Status */}
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<StatusBadge status={order.status} label={order.statusLabel} />
									{detailLoading && (
										<span
											className="text-[11px] text-[#6B6B6B] font-cairo"
											aria-live="polite"
										>
											… جاري تحميل التفاصيل
										</span>
									)}
								</div>
								{detailError && (
									<div className="text-xs text-red-600 font-cairo bg-red-50 px-3 py-1.5 rounded-lg">
										تعذّر تحميل التفاصيل: {detailError}
									</div>
								)}
								<div className="relative">
									<button
										onClick={() => setStatusOpen(!statusOpen)}
										className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F8F8F8] hover:bg-[#F3EDE4] text-xs font-cairo font-semibold text-[#111111] transition-colors"
									>
										<RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
										{t('seller.changeStatus', 'Change status')}
										<ChevronDown
											className={cn(
												'w-3 h-3 transition-transform',
												statusOpen && 'rotate-180',
											)}
											strokeWidth={1.5}
										/>
									</button>
									<AnimatePresence>
										{statusOpen && (
											<>
												<div
													className="fixed inset-0 z-40"
													onClick={() => setStatusOpen(false)}
												/>
												<motion.div
													initial={{ opacity: 0, y: -5 }}
													animate={{ opacity: 1, y: 0 }}
													exit={{ opacity: 0, y: -5 }}
													className="absolute left-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-[#F3EDE4] z-50 overflow-hidden"
												>
													{statusOptions.map((opt) => (
														<button
															key={opt.key}
															onClick={() => {
																setStatusOpen(false);
																void onChangeStatus(opt.key);
															}}
															className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-[#F8F8F8] transition-colors text-right"
														>
															<span
																className="w-2.5 h-2.5 rounded-full shrink-0"
																style={{
																	backgroundColor: opt.color,
																}}
															/>
															<span className="text-xs font-cairo font-semibold text-[#111111]">
																{opt.label}
															</span>
														</button>
													))}
												</motion.div>
											</>
										)}
									</AnimatePresence>
								</div>
							</div>

							{/* Customer Info */}
							<div className="bg-[#F8F8F8] rounded-2xl p-4">
								<h3 className="text-sm font-cairo font-semibold text-[#111111] mb-3 flex items-center gap-2">
									<ShoppingBag
										className="w-4 h-4 text-[#D4A853]"
										strokeWidth={1.5}
									/>
									{t('seller.customerInfo', 'Customer Info')}
								</h3>
								<div className="space-y-2">
									<p className="text-xs font-cairo font-semibold text-[#111111]">
										{order.customer}
									</p>
									<p className="text-xs text-[#6B6B6B] font-cairo flex items-center gap-1.5">
										<Phone className="w-3 h-3" strokeWidth={1.5} />
										{order.phone}
									</p>
									<p className="text-xs text-[#6B6B6B] font-cairo flex items-center gap-1.5">
										<MapPin className="w-3 h-3" strokeWidth={1.5} />
										{order.address}
									</p>
								</div>
							</div>

							{/* Items */}
							<div>
								<h3 className="text-sm font-cairo font-semibold text-[#111111] mb-3 flex items-center gap-2">
									<Package className="w-4 h-4 text-[#D4A853]" strokeWidth={1.5} />
									{t('seller.productsList', 'Products')}
								</h3>
								<div className="space-y-2">
									{order.items.map((item, i) => (
										<div
											key={i}
											className="flex items-center gap-3 p-3 bg-[#F8F8F8] rounded-xl"
										>
											<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F3EDE4] to-[#E8DFD0] flex items-center justify-center shrink-0">
												<Package
													className="w-4 h-4 text-[#D4A853]"
													strokeWidth={1}
												/>
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-xs font-cairo font-semibold text-[#111111] truncate">
													{item.name}
												</p>
												<p className="text-[10px] text-[#6B6B6B] font-cairo">
													{t('seller.qty', 'Qty')}: {item.qty}
												</p>
											</div>
											<span className="text-xs font-mono font-semibold text-[#111111] shrink-0">
												{item.price}
											</span>
										</div>
									))}
								</div>
							</div>

							{/* Payment */}
							<div className="bg-[#F8F8F8] rounded-2xl p-4">
								<h3 className="text-sm font-cairo font-semibold text-[#111111] mb-3 flex items-center gap-2">
									<CreditCard
										className="w-4 h-4 text-[#D4A853]"
										strokeWidth={1.5}
									/>
									{t('seller.paymentSection', 'Payment')}
								</h3>
								<div className="space-y-2">
									<div className="flex justify-between text-xs">
										<span className="text-[#6B6B6B] font-cairo">
											{t('seller.paymentMethod', 'Payment method')}
										</span>
										<span className="font-cairo text-[#111111]">
											{order.paymentMethod}
										</span>
									</div>
									<div className="flex justify-between text-xs">
										<span className="text-[#6B6B6B] font-cairo">
											{t('seller.paymentStatus', 'Payment status')}
										</span>
										<span
											className={cn(
												'font-cairo font-semibold',
												order.paymentStatus === 'paid'
													? 'text-[#10B981]'
													: 'text-[#EF4444]',
											)}
										>
											{order.paymentStatus === 'paid' ? t('seller.paid', 'مدفوع') : t('seller.unpaid', 'غير مدفوع')}
										</span>
									</div>
									<div className="border-t border-[#F3EDE4] pt-2 flex justify-between text-sm font-bold mt-2">
										<span className="font-cairo text-[#111111]">
											{t('seller.total', 'Total')}
										</span>
										<span className="font-mono text-[#D4A853]">
											{order.amount}
										</span>
									</div>
								</div>
							</div>

							{/* Timeline */}
							<div>
								<h3 className="text-sm font-cairo font-semibold text-[#111111] mb-3 flex items-center gap-2">
									<Clock className="w-4 h-4 text-[#D4A853]" strokeWidth={1.5} />
									{t('seller.timeline', 'Order Timeline')}
								</h3>
								<div className="space-y-0">
									{order.timeline.map((step, i) => (
										<div key={i} className="flex gap-3">
											<div className="flex flex-col items-center">
												<div
													className={cn(
														'w-6 h-6 rounded-full flex items-center justify-center',
														step.done ? 'bg-[#10B981]' : 'bg-[#F3EDE4]',
													)}
												>
													{step.done ? (
														<CheckCircle2
															className="w-3.5 h-3.5 text-white"
															strokeWidth={1.5}
														/>
													) : (
														<Clock
															className="w-3.5 h-3.5 text-[#AAAAAA]"
															strokeWidth={1.5}
														/>
													)}
												</div>
												{i < order.timeline.length - 1 && (
													<div className="w-0.5 h-8 bg-[#F3EDE4]" />
												)}
											</div>
											<div className="pb-6">
												<p
													className={cn(
														'text-xs font-cairo font-semibold',
														step.done
															? 'text-[#111111]'
															: 'text-[#AAAAAA]',
													)}
												>
													{step.status}
												</p>
												<p className="text-[10px] text-[#6B6B6B] font-cairo">
													{step.time}
												</p>
											</div>
										</div>
									))}
								</div>
							</div>

							{/* Actions */}
							<div className="flex items-center gap-2 pt-2">
								<button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#D4A853] hover:bg-[#c49a48] text-[#1A1612] rounded-xl text-sm font-cairo font-semibold transition-colors">
									<Printer className="w-4 h-4" strokeWidth={1.5} />
									{t('seller.printInvoice', 'Print Invoice')}
								</button>
								<button className="flex items-center justify-center gap-2 px-4 py-3 border border-[#F3EDE4] hover:bg-[#F8F8F8] rounded-xl text-sm font-cairo text-[#6B6B6B] transition-colors">
									<Truck className="w-4 h-4" strokeWidth={1.5} />
									{t('seller.track', 'Track')}
								</button>
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}

/* ------------------------------------------------------------------ */
/*  Summary Cards                                                      */
/* ------------------------------------------------------------------ */

function SummaryCards({
	activeFilter,
	onFilter,
}: {
	activeFilter: string;
	onFilter: (f: string) => void;
}) {
	const { t } = useTranslation();
	const cards = [
		{
			key: 'new',
			label: t('seller.statusNew', 'New'),
			count: '١٢',
			color: '#2563EB',
			bg: 'bg-[rgba(37,99,235,0.1)]',
		},
		{
			key: 'processing',
			label: t('seller.statusProcessing', 'Processing'),
			count: '٨',
			color: '#F59E0B',
			bg: 'bg-[rgba(245,158,11,0.1)]',
		},
		{
			key: 'shipped',
			label: t('seller.statusShipped', 'Shipped'),
			count: '١٥',
			color: '#10B981',
			bg: 'bg-[rgba(16,185,129,0.1)]',
		},
		{
			key: 'delivered',
			label: t('seller.statusDelivered', 'Delivered'),
			count: '٤٣',
			color: '#D4A853',
			bg: 'bg-[rgba(212,168,83,0.1)]',
		},
	];

	return (
		<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
			{cards.map((card) => (
				<button
					key={card.key}
					onClick={() => onFilter(activeFilter === card.key ? 'all' : card.key)}
					className={cn(
						'text-right p-4 rounded-2xl border-2 transition-all duration-200 hover:shadow-md',
						activeFilter === card.key
							? 'border-[#D4A853] bg-white shadow-sm'
							: 'border-transparent bg-white shadow-sm',
					)}
				>
					<div
						className={cn(
							'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
							card.bg,
						)}
					>
						<ShoppingBag
							className="w-5 h-5"
							style={{ color: card.color }}
							strokeWidth={1.5}
						/>
					</div>
					<p className="text-xs text-[#6B6B6B] font-cairo">{card.label}</p>
					<p className="text-xl font-bold font-mono text-[#111111] mt-0.5">
						{card.count}
					</p>
				</button>
			))}
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function SellerOrders() {
	const { t } = useTranslation();
	const { addToast } = useApp();
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState('all');
	const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [detailError, setDetailError] = useState<string | null>(null);

	const { data: ordersResp, refetch } = useSellerOrders(
		statusFilter === 'all' ? undefined : statusFilter,
	);

	// Local Order shape vs the wire shape from /api/seller/orders (an
	// `{ items: SellerOrder[] }` envelope). Map the wire payload to the
	// local render model so the existing JSX continues to work; the
	// offline mock fixture below covers pre-auth render.
	const apiOrders = useMemo<Order[]>(() => {
		const resp = ordersResp as unknown as { items?: unknown[] } | null;
		const items = resp?.items ?? [];
		return items.map((row): Order => {
			const r = row as Record<string, unknown>;
			return {
				id: `#${String(r.order_number ?? r.id ?? '')}`,
				customer: String(r.customer_email ?? r.customer_id ?? '—'),
				phone: '—',
				date: String(r.created_at ?? '').slice(0, 10),
				amount: `${Number(r.total ?? 0).toLocaleString('ar-EG')} ر.ي`,
				paymentStatus: String(r.payment_status ?? 'pending'),
				status: String(r.status ?? 'pending') as Order['status'],
				statusLabel: String(r.status ?? ''),
				// Detail fields (items, address, paymentMethod, timeline) are
				// fetched on demand from /api/seller/orders/:id when the
				// detail modal opens — they are NOT in the list payload.
				items: [],
				address: '—',
				paymentMethod: '—',
				timeline: [],
			};
		});
	}, [ordersResp]);

	const dataOrders = apiOrders;

	const filtered = dataOrders.filter((o) => {
		const matchesSearch =
			o.customer.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search);
		const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
		return matchesSearch && matchesStatus;
	});

	const advanceStatus = useCallback(
		async (order: Order) => {
			// Server-friendly state machine: pending → confirmed →
			// processing → shipped → delivered. We pick the next status
			// based on the current status. Admins use force_status;
			// sellers use this normal flow.
			const orderNum = String((order.id ?? '').replace(/^#/, ''));
			const next: Record<Order['status'], Order['status'] | null> = {
				new: 'processing',
				processing: 'shipped',
				shipped: 'delivered',
				delivered: null,
				cancelled: null,
			};
			const target = next[order.status];
			if (!target) return;
			try {
				await updateSellerOrderStatus(Number(orderNum) || 0, {
					status: target,
				});
				addToast({
					type: 'success',
					message: `تم تحديث الطلب ${orderNum}`,
				});
				await refetch();
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				addToast({ type: 'error', message: 'فشل تحديث الطلب: ' + msg });
			}
		},
		[addToast, refetch],
	);

	// When the user opens an order from the list, fetch the detail
	// from /api/seller/orders/:id so the modal can show items,
	// timeline, etc. The list endpoint (used above) only returns the
	// order summary for performance.
	const openOrderDetail = useCallback(async (order: Order) => {
		setSelectedOrder(order);
		setDetailError(null);
		const orderId = Number(String(order.id).replace(/^#/, ''));
		if (!orderId) return; // mock row — nothing to fetch
		setDetailLoading(true);
		try {
			const detail: SellerOrderWithItems = await getSellerOrder(orderId);
			setSelectedOrder((prev) =>
				prev
					? {
							...prev,
							items: detail.items.map((it) => ({
								name: `منتج #${it.product_id}`,
								qty: it.quantity,
								price: `${it.unit_price.toLocaleString('ar-EG')} ر.ي`,
							})),
							paymentMethod: detail.payment_method ?? '—',
							timeline: Array.isArray(detail.timeline)
								? detail.timeline.map((step) => {
										const s = step as Record<string, unknown>;
										return {
											status: String(s.status ?? s.label ?? ''),
											time: String(s.time ?? s.at ?? ''),
											done: Boolean(s.done ?? s.completed ?? true),
										};
									})
								: [],
						}
					: prev,
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			setDetailError(msg);
		} finally {
			setDetailLoading(false);
		}
	}, []);

	return (
		<DashboardShell
			title={t('seller.orders', 'Orders')}
			breadcrumb={t('seller.breadcrumbOrders', 'Dashboard / Orders')}
		>
			<div className="space-y-6">
				{/* Page Header */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<h1 className="text-2xl font-amiri font-bold text-[#1A1612]">
							{t('seller.orders', 'Orders')}
						</h1>
						<span className="px-2.5 py-1 bg-[#EF4444] text-white rounded-xl text-xs font-bold font-cairo">
							١٢ {t('seller.new', 'New')}
						</span>
					</div>
					<button className="flex items-center gap-2 px-4 py-2.5 border border-[#D4A853] text-[#D4A853] hover:bg-[#F3EDE4] rounded-xl text-sm font-cairo font-semibold transition-colors w-fit">
						<Download className="w-4 h-4" strokeWidth={1.5} />
						{t('seller.exportCsv', 'Export CSV')}
					</button>
				</div>

				{/* Summary Cards */}
				<SummaryCards activeFilter={statusFilter} onFilter={setStatusFilter} />

				{/* Filter Bar */}
				<div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-3 flex-wrap">
					<div className="relative flex-1 min-w-[200px] max-w-md">
						<Search
							className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AAAAAA]"
							strokeWidth={1.5}
						/>
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={t(
								'seller.searchOrderPlaceholder',
								'Order number, customer name...',
							)}
							aria-label={t('common.search', 'Search')}
							className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#F3EDE4] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo"
						/>
					</div>
					<div className="flex items-center gap-2">
						<div className="relative">
							<select
								aria-label={t('seller.dateRange', 'Date range')}
								className="appearance-none px-4 py-2.5 pr-10 rounded-xl border border-[#F3EDE4] focus:border-[#D4A853] outline-none text-sm font-cairo bg-white"
							>
								<option>{t('seller.last30Days', 'Last 30 days')}</option>
								<option>{t('seller.thisWeek', 'This week')}</option>
								<option>{t('seller.lastMonth', 'Last month')}</option>
							</select>
							<CalendarRange
								className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AAAAAA] pointer-events-none"
								strokeWidth={1.5}
							/>
						</div>
					</div>
				</div>

				{/* Orders Table */}
				<div className="bg-white rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
					<table className="w-full min-w-[900px]">
						<thead>
							<tr className="text-right bg-[#F8F8F8]">
								<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
									<input
										type="checkbox"
										aria-label={t('seller.selectAll', 'Select all')}
										className="rounded border-[#AAAAAA]"
									/>
								</th>
								<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
									{t('seller.orderNumber', 'Order #')}
								</th>
								<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
									{t('seller.customer', 'Customer')}
								</th>
								<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
									{t('seller.date', 'Date')}
								</th>
								<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
									{t('seller.tableOrders', 'Orders')}
								</th>
								<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
									{t('seller.amount', 'Amount')}
								</th>
								<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
									{t('seller.payment', 'Payment')}
								</th>
								<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
									{t('seller.status', 'Status')}
								</th>
								<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
									{t('seller.actions', 'Actions')}
								</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((order) => (
								<motion.tr
									key={order.id}
									layout
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									className="border-b border-[#F3EDE4]/50 last:border-0 hover:bg-[#F8F8F8] transition-colors"
								>
									<td className="px-4 py-3">
										<input
											type="checkbox"
											aria-label={t('seller.selectOrder', 'Select order')}
											className="rounded border-[#AAAAAA]"
										/>
									</td>
									<td className="px-4 py-3 text-xs font-mono font-semibold text-[#D4A853]">
										{order.id}
									</td>
									<td className="px-4 py-3 text-xs font-cairo font-semibold text-[#111111]">
										{order.customer}
									</td>
									<td className="px-4 py-3 text-xs text-[#6B6B6B] font-cairo">
										{order.date}
									</td>
									<td className="px-4 py-3 text-xs text-[#6B6B6B] font-cairo">
										{order.items.length} {t('seller.itemUnit', 'items')}
									</td>
									<td className="px-4 py-3 text-xs font-mono font-semibold text-[#111111]">
										{order.amount}
									</td>
									<td className="px-4 py-3">
										<span
											className={cn(
												'px-2 py-0.5 rounded-lg text-[10px] font-bold font-cairo',
												order.paymentStatus === 'paid'
													? 'text-[#10B981] bg-[rgba(16,185,129,0.1)]'
													: 'text-[#EF4444] bg-[rgba(239,68,68,0.1)]',
											)}
										>
											{order.paymentStatus === 'paid' ? t('seller.paid', 'مدفوع') : t('seller.unpaid', 'غير مدفوع')}
										</span>
									</td>
									<td className="px-4 py-3">
										<StatusBadge
											status={order.status}
											label={order.statusLabel}
										/>
									</td>
									<td className="px-4 py-3">
										<button
											onClick={() => {
												// Open the detail modal AND fetch the
												// full record from /api/seller/orders/:id
												// for items, timeline, etc. The status
												// advance now lives in the modal footer
												// (the dedicated "Advance" button) — it
												// used to be hijacked into this click,
												// which advanced the order every time the
												// admin/operator just wanted to inspect it.
												void openOrderDetail(order);
											}}
											title={t('seller.view', 'View')}
											aria-label={t('seller.view', 'View')}
											className="w-7 h-7 rounded-lg hover:bg-[#F3EDE4] flex items-center justify-center transition-colors"
										>
											<Eye
												className="w-3.5 h-3.5 text-[#6B6B6B]"
												strokeWidth={1.5}
											/>
										</button>
									</td>
								</motion.tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Pagination */}
				<div className="flex items-center justify-center gap-1">
					<button
						title={t('seller.prevPage', 'Previous')}
						aria-label={t('seller.prevPage', 'Previous')}
						className="w-9 h-9 rounded-xl hover:bg-white flex items-center justify-center text-[#6B6B6B] transition-colors"
					>
						<ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
					</button>
					{[1, 2, 3].map((p) => (
						<button
							key={p}
							className={cn(
								'w-9 h-9 rounded-xl flex items-center justify-center text-sm font-mono font-semibold transition-colors',
								p === 1
									? 'bg-[#D4A853] text-[#1A1612]'
									: 'hover:bg-white text-[#6B6B6B]',
							)}
						>
							{p}
						</button>
					))}
					<button
						title={t('seller.nextPage', 'Next')}
						aria-label={t('seller.nextPage', 'Next')}
						className="w-9 h-9 rounded-xl hover:bg-white flex items-center justify-center text-[#6B6B6B] transition-colors"
					>
						<ArrowLeft className="w-4 h-4 rotate-180" strokeWidth={1.5} />
					</button>
				</div>

				{/* Empty State */}
				{filtered.length === 0 && (
					<div className="bg-white rounded-2xl p-12 text-center">
						<div className="w-20 h-20 rounded-2xl bg-[#F3EDE4] flex items-center justify-center mx-auto mb-4">
							<ShoppingBag className="w-8 h-8 text-[#D4A853]" strokeWidth={1.5} />
						</div>
						<h3 className="text-base font-amiri font-bold text-[#111111] mb-1">
							{t('seller.noOrders', 'No orders')}
						</h3>
						<p className="text-sm text-[#6B6B6B] font-cairo">
							{t('seller.noOrdersMatch', 'No orders match your search criteria')}
						</p>
					</div>
				)}
			</div>

			{/* Order Detail Drawer */}
			<AnimatePresence>
				{selectedOrder && (
					<OrderDetailDrawer
						order={selectedOrder}
						onClose={() => setSelectedOrder(null)}
						onChangeStatus={async (status) => {
							// Use the status selected by the user directly
							const orderNum = String((selectedOrder.id ?? '').replace(/^#/, ''));
							try {
								await updateSellerOrderStatus(Number(orderNum) || 0, { status });
								addToast({
									type: 'success',
									message: t('seller.orderUpdated', 'تم تحديث الطلب {{orderNum}}', { orderNum }),
								});
								// Update local state to reflect the change immediately
								setSelectedOrder((prev) =>
									prev ? { ...prev, status, statusLabel: status } : prev,
								);
								await refetch();
							} catch (err) {
								const msg = err instanceof Error ? err.message : String(err);
								addToast({
									type: 'error',
									message: t('seller.orderUpdateFailed', 'فشل تحديث الطلب: {{msg}}', { msg }),
								});
							}
						}}
						detailLoading={detailLoading}
						detailError={detailError}
					/>
				)}
			</AnimatePresence>
		</DashboardShell>
	);
}
