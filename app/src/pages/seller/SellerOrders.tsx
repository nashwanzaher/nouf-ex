import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

function OrderDetailDrawer({ order, onClose }: { order: Order; onClose: () => void }) {
	const [statusOpen, setStatusOpen] = useState(false);
	const statusOptions = [
		{ key: 'new', label: 'جديد', color: '#2563EB' },
		{ key: 'processing', label: 'قيد المعالجة', color: '#F59E0B' },
		{ key: 'shipped', label: 'تم الشحن', color: '#10B981' },
		{ key: 'delivered', label: 'مكتمل', color: '#10B981' },
		{ key: 'cancelled', label: 'ملغي', color: '#EF4444' },
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
								className="w-8 h-8 rounded-xl hover:bg-[#F8F8F8] flex items-center justify-center transition-colors"
							>
								<X className="w-5 h-5 text-[#6B6B6B]" strokeWidth={1.5} />
							</button>
						</div>

						<div className="p-6 space-y-6">
							{/* Status */}
							<div className="flex items-center justify-between">
								<StatusBadge status={order.status} label={order.statusLabel} />
								<div className="relative">
									<button
										onClick={() => setStatusOpen(!statusOpen)}
										className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F8F8F8] hover:bg-[#F3EDE4] text-xs font-cairo font-semibold text-[#111111] transition-colors"
									>
										<RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
										تغيير الحالة
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
															onClick={() => setStatusOpen(false)}
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
									معلومات العميل
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
									المنتجات
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
													الكمية: {item.qty}
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
									الدفع
								</h3>
								<div className="space-y-2">
									<div className="flex justify-between text-xs">
										<span className="text-[#6B6B6B] font-cairo">
											طريقة الدفع
										</span>
										<span className="font-cairo text-[#111111]">
											{order.paymentMethod}
										</span>
									</div>
									<div className="flex justify-between text-xs">
										<span className="text-[#6B6B6B] font-cairo">
											حالة الدفع
										</span>
										<span
											className={cn(
												'font-cairo font-semibold',
												order.paymentStatus === 'مدفوع'
													? 'text-[#10B981]'
													: 'text-[#EF4444]',
											)}
										>
											{order.paymentStatus}
										</span>
									</div>
									<div className="border-t border-[#F3EDE4] pt-2 flex justify-between text-sm font-bold mt-2">
										<span className="font-cairo text-[#111111]">الإجمالي</span>
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
									سجل الطلب
								</h3>
								<div className="space-y-0">
									{order.timeline.map((t, i) => (
										<div key={i} className="flex gap-3">
											<div className="flex flex-col items-center">
												<div
													className={cn(
														'w-6 h-6 rounded-full flex items-center justify-center',
														t.done ? 'bg-[#10B981]' : 'bg-[#F3EDE4]',
													)}
												>
													{t.done ? (
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
														t.done
															? 'text-[#111111]'
															: 'text-[#AAAAAA]',
													)}
												>
													{t.status}
												</p>
												<p className="text-[10px] text-[#6B6B6B] font-cairo">
													{t.time}
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
									طباعة الفاتورة
								</button>
								<button className="flex items-center justify-center gap-2 px-4 py-3 border border-[#F3EDE4] hover:bg-[#F8F8F8] rounded-xl text-sm font-cairo text-[#6B6B6B] transition-colors">
									<Truck className="w-4 h-4" strokeWidth={1.5} />
									تتبع
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
	const cards = [
		{
			key: 'new',
			label: 'جديد',
			count: '١٢',
			color: '#2563EB',
			bg: 'bg-[rgba(37,99,235,0.1)]',
		},
		{
			key: 'processing',
			label: 'قيد المعالجة',
			count: '٨',
			color: '#F59E0B',
			bg: 'bg-[rgba(245,158,11,0.1)]',
		},
		{
			key: 'shipped',
			label: 'تم الشحن',
			count: '١٥',
			color: '#10B981',
			bg: 'bg-[rgba(16,185,129,0.1)]',
		},
		{
			key: 'delivered',
			label: 'مكتمل',
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
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState('all');
	const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

	const filtered = mockOrders.filter((o) => {
		const matchesSearch =
			o.customer.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search);
		const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
		return matchesSearch && matchesStatus;
	});

	return (
		<DashboardShell title="الطلبات" breadcrumb="لوحة التحكم / إدارة الطلبات">
			<div className="space-y-6">
				{/* Page Header */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<h1 className="text-2xl font-amiri font-bold text-[#1A1612]">الطلبات</h1>
						<span className="px-2.5 py-1 bg-[#EF4444] text-white rounded-xl text-xs font-bold font-cairo">
							١٢ جديد
						</span>
					</div>
					<button className="flex items-center gap-2 px-4 py-2.5 border border-[#D4A853] text-[#D4A853] hover:bg-[#F3EDE4] rounded-xl text-sm font-cairo font-semibold transition-colors w-fit">
						<Download className="w-4 h-4" strokeWidth={1.5} />
						تصدير CSV
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
							placeholder="رقم الطلب، اسم العميل..."
							className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#F3EDE4] focus:border-[#D4A853] focus:ring-2 focus:ring-[rgba(212,168,83,0.2)] outline-none transition-all text-sm font-cairo"
						/>
					</div>
					<div className="flex items-center gap-2">
						<div className="relative">
							<select className="appearance-none px-4 py-2.5 pr-10 rounded-xl border border-[#F3EDE4] focus:border-[#D4A853] outline-none text-sm font-cairo bg-white">
								<option>آخر ٣٠ يوم</option>
								<option>هذا الأسبوع</option>
								<option>الشهر الماضي</option>
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
									<input type="checkbox" className="rounded border-[#AAAAAA]" />
								</th>
								<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
									رقم الطلب
								</th>
								<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
									العميل
								</th>
								<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
									التاريخ
								</th>
								<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
									المنتجات
								</th>
								<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
									المبلغ
								</th>
								<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
									الدفع
								</th>
								<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
									الحالة
								</th>
								<th className="px-4 py-3 text-[11px] font-semibold text-[#6B6B6B] font-cairo">
									إجراءات
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
										{order.items.length} منتج
									</td>
									<td className="px-4 py-3 text-xs font-mono font-semibold text-[#111111]">
										{order.amount}
									</td>
									<td className="px-4 py-3">
										<span
											className={cn(
												'px-2 py-0.5 rounded-lg text-[10px] font-bold font-cairo',
												order.paymentStatus === 'مدفوع'
													? 'text-[#10B981] bg-[rgba(16,185,129,0.1)]'
													: 'text-[#EF4444] bg-[rgba(239,68,68,0.1)]',
											)}
										>
											{order.paymentStatus}
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
											onClick={() => setSelectedOrder(order)}
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
					<button className="w-9 h-9 rounded-xl hover:bg-white flex items-center justify-center text-[#6B6B6B] transition-colors">
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
					<button className="w-9 h-9 rounded-xl hover:bg-white flex items-center justify-center text-[#6B6B6B] transition-colors">
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
							لا توجد طلبات
						</h3>
						<p className="text-sm text-[#6B6B6B] font-cairo">
							لم يتم العثور على طلبات تطابق معايير البحث
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
					/>
				)}
			</AnimatePresence>
		</DashboardShell>
	);
}
