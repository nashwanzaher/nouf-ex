import { useState, useMemo } from 'react';
import {
	AlertTriangle,
	Search,
	ChevronLeft,
	ChevronRight,
	Eye,
	User,
	Store,
	ShoppingBag,
	Clock,
	CheckCircle,
	Scale,
	MessageSquare,
	FileText,
	ArrowLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface DisputeRecord {
	id: string;
	type: string;
	buyer: string;
	merchant: string;
	store: string;
	orderId: string;
	date: string;
	status: 'new' | 'reviewing' | 'resolving' | 'resolved';
	priority: 'urgent' | 'normal' | 'low';
	description: string;
	evidenceCount: number;
	buyerResponse?: string;
	merchantResponse?: string;
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */
const disputesData: DisputeRecord[] = [
	{
		id: 'D-1024',
		type: 'منتج تالف',
		buyer: 'علي محمود',
		merchant: 'خالد محسن',
		store: 'إلكترونيات الغد',
		orderId: 'ORD-5832',
		date: '٢٠٢٤/٠٦/٢٠ ١٠:٣٠',
		status: 'new',
		priority: 'urgent',
		description: 'وصلني المنتج تالف ومكسور، العبوة كانت مفتوحة',
		evidenceCount: 3,
		merchantResponse: '',
	},
	{
		id: 'D-1023',
		type: 'لم يستلم',
		buyer: 'سارة أحمد',
		merchant: 'فاطمة السعدي',
		store: 'التمور الفاخرة',
		orderId: 'ORD-5801',
		date: '٢٠٢٤/٠٦/٢٠ ٠٥:١٥',
		status: 'reviewing',
		priority: 'normal',
		description: 'مر أسبوعان ولم يصل الطلب بعد',
		evidenceCount: 1,
		merchantResponse: 'تم الشحن وفي الطريق',
	},
	{
		id: 'D-1022',
		type: 'منتج مغاير',
		buyer: 'محمد سعيد',
		merchant: 'سمية حسن',
		store: 'عطور الجنوب',
		orderId: 'ORD-5790',
		date: '٢٠٢٤/٠٦/١٩ ١٤:٠٠',
		status: 'resolving',
		priority: 'normal',
		description: 'المنتج مختلف عن الصورة والوصف',
		evidenceCount: 2,
		merchantResponse: 'نقبل الإرجاع',
	},
	{
		id: 'D-1021',
		type: 'رد مبلغ',
		buyer: 'نورة خالد',
		merchant: 'يوسف سعيد',
		store: 'تك ستور',
		orderId: 'ORD-5755',
		date: '٢٠٢٤/٠٦/١٨ ٠٩:٤٥',
		status: 'reviewing',
		priority: 'urgent',
		description: 'أرجعت المنتج منذ أسبوع ولم يصلني المبلغ',
		evidenceCount: 2,
		merchantResponse: '',
	},
	{
		id: 'D-1020',
		type: 'تاجر احتيالي',
		buyer: 'مازن عبدالله',
		merchant: 'أحمد علي',
		store: 'متجر المستقبل',
		orderId: 'ORD-5701',
		date: '٢٠٢٤/٠٦/١٧ ١٦:٢٠',
		status: 'new',
		priority: 'urgent',
		description: 'التاجر لم يرد منذ الدفع والهاتف مغلق',
		evidenceCount: 4,
		merchantResponse: '',
	},
	{
		id: 'D-1019',
		type: 'منتج تالف',
		buyer: 'هند عبدالرحمن',
		merchant: 'ليلى أحمد',
		store: 'أثاث المنزل',
		orderId: 'ORD-5680',
		date: '٢٠٢٤/٠٦/١٦ ١١:٠٠',
		status: 'resolved',
		priority: 'low',
		description: 'وصلت الكرسي بخدوش واضحة',
		evidenceCount: 2,
		merchantResponse: 'تم التسوية والاستبدال',
	},
	{
		id: 'D-1018',
		type: 'منتج مغاير',
		buyer: 'صالح محمد',
		merchant: 'خالد محسن',
		store: 'إلكترونيات الغد',
		orderId: 'ORD-5620',
		date: '٢٠٢٤/٠٦/١٥ ٠٨:٣٠',
		status: 'resolved',
		priority: 'normal',
		description: 'اللون مختلف عن المطلوب',
		evidenceCount: 1,
		merchantResponse: 'تم رد المبلغ',
	},
	{
		id: 'D-1017',
		type: 'لم يستلم',
		buyer: 'ريم خالد',
		merchant: 'هند عبدالرحمن',
		store: 'أزياء الهدى',
		orderId: 'ORD-5590',
		date: '٢٠٢٤/٠٦/١٤ ١٣:١٥',
		status: 'resolving',
		priority: 'normal',
		description: 'لم تصل الشحنة بعد والتوصيل متأخر',
		evidenceCount: 0,
		merchantResponse: 'تم إعادة الشحن',
	},
];

const statusConfig = {
	new: { label: 'جديد', color: 'bg-red-50 text-red-600 border-red-200', icon: AlertTriangle },
	reviewing: {
		label: 'قيد المراجعة',
		color: 'bg-amber-50 text-amber-600 border-amber-200',
		icon: Clock,
	},
	resolving: {
		label: 'قيد الحل',
		color: 'bg-blue-50 text-blue-600 border-blue-200',
		icon: Scale,
	},
	resolved: {
		label: 'محلول',
		color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
		icon: CheckCircle,
	},
};

const priorityConfig = {
	urgent: { label: 'عاجل', color: 'bg-red-500' },
	normal: { label: 'عادي', color: 'bg-amber-500' },
	low: { label: 'منخفض', color: 'bg-emerald-500' },
};

const statusSummary = [
	{ key: 'new', label: 'جديدة', count: 2, color: 'bg-red-500', textColor: 'text-red-600' },
	{
		key: 'reviewing',
		label: 'قيد المراجعة',
		count: 2,
		color: 'bg-amber-500',
		textColor: 'text-amber-600',
	},
	{
		key: 'resolving',
		label: 'قيد الحل',
		count: 2,
		color: 'bg-blue-500',
		textColor: 'text-blue-600',
	},
	{
		key: 'resolved',
		label: 'محلولة',
		count: 2,
		color: 'bg-emerald-500',
		textColor: 'text-emerald-600',
	},
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function DisputesManagement() {
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState<string>('all');
	const [currentPage, setCurrentPage] = useState(1);
	const [selectedDispute, setSelectedDispute] = useState<DisputeRecord | null>(null);
	const [internalNote, setInternalNote] = useState('');
	const [resolutionNotes, setResolutionNotes] = useState('');
	const pageSize = 10;

	/* ── Filtering ── */
	const filteredDisputes = useMemo(() => {
		return disputesData.filter((d) => {
			const matchesSearch =
				search === '' ||
				d.id.includes(search) ||
				d.buyer.includes(search) ||
				d.merchant.includes(search) ||
				d.type.includes(search);
			const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
			return matchesSearch && matchesStatus;
		});
	}, [search, statusFilter]);

	const paginatedDisputes = useMemo(() => {
		const start = (currentPage - 1) * pageSize;
		return filteredDisputes.slice(start, start + pageSize);
	}, [filteredDisputes, currentPage]);

	const totalPages = Math.ceil(filteredDisputes.length / pageSize) || 1;

	const handleResolution = (_type: 'buyer' | 'merchant' | 'split' | 'request') => {
		setSelectedDispute(null);
		setResolutionNotes('');
		setInternalNote('');
	};

	return (
		<div className="space-y-5">
			{/* ── Summary Cards ── */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				{statusSummary.map((s) => (
					<Card key={s.key} className="border-0 shadow-sm">
						<CardContent className="p-4">
							<div className="flex items-center gap-2 mb-2">
								<div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
								<span className="text-xs font-cairo text-[#6B6B6B]">{s.label}</span>
							</div>
							<p className={`text-2xl font-mono font-bold ${s.textColor}`}>
								{s.count}
							</p>
						</CardContent>
					</Card>
				))}
			</div>

			{/* ── Toolbar ── */}
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
								placeholder="رقم النزاع، اسم المشتري أو التاجر..."
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setCurrentPage(1);
								}}
								className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#e5e5e5] bg-[#F8F8F8] text-sm font-cairo text-[#111111] placeholder:text-[#AAAAAA] outline-none focus:border-[#D4A853] focus:ring-2 focus:ring-[#D4A853]/20 transition-all"
							/>
						</div>
						<div className="flex gap-2">
							<select
								value={statusFilter}
								onChange={(e) => {
									setStatusFilter(e.target.value);
									setCurrentPage(1);
								}}
								aria-label="Status filter"
								className="text-xs font-cairo px-3 py-2 rounded-xl border border-[#e5e5e5] bg-white text-[#111111] outline-none focus:border-[#D4A853]"
							>
								<option value="all">جميع الحالات</option>
								<option value="new">جديد</option>
								<option value="reviewing">قيد المراجعة</option>
								<option value="resolving">قيد الحل</option>
								<option value="resolved">محلول</option>
							</select>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* ── Disputes Table ── */}
			<Card className="border-0 shadow-sm overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="bg-[#F8F8F8] border-b border-[#EEEEEE]">
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B]">
									النزاع
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B] hidden md:table-cell">
									المشتري
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B] hidden lg:table-cell">
									التاجر
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B]">
									الحالة
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B] hidden sm:table-cell">
									الأولوية
								</th>
								<th className="px-4 py-3 text-center text-xs font-cairo font-semibold text-[#6B6B6B]">
									إجراءات
								</th>
							</tr>
						</thead>
						<tbody>
							{paginatedDisputes.map((d) => {
								const status = statusConfig[d.status];
								const StatusIcon = status.icon;
								const priority = priorityConfig[d.priority];
								return (
									<tr
										key={d.id}
										className="border-b border-[#F5F5F5] hover:bg-[#F8F8F8]/50 transition-colors"
									>
										<td className="px-4 py-3">
											<div>
												<div className="flex items-center gap-2">
													<span className="text-sm font-cairo font-semibold text-[#111111]">
														{d.id}
													</span>
													<span className="text-[10px] font-cairo text-[#6B6B6B] bg-[#F8F8F8] px-1.5 py-0.5 rounded-md">
														{d.type}
													</span>
												</div>
												<p className="text-[11px] text-[#AAAAAA] font-cairo mt-0.5">
													{d.date}
												</p>
											</div>
										</td>
										<td className="px-4 py-3 hidden md:table-cell">
											<span className="text-sm font-cairo text-[#111111]">
												{d.buyer}
											</span>
										</td>
										<td className="px-4 py-3 hidden lg:table-cell">
											<div>
												<p className="text-sm font-cairo text-[#111111]">
													{d.merchant}
												</p>
												<p className="text-[11px] text-[#6B6B6B] font-cairo">
													{d.store}
												</p>
											</div>
										</td>
										<td className="px-4 py-3">
											<Badge
												variant="outline"
												className={`font-cairo text-[10px] gap-1 ${status.color}`}
											>
												<StatusIcon className="w-3 h-3" />
												{status.label}
											</Badge>
										</td>
										<td className="px-4 py-3 hidden sm:table-cell">
											<span
												className={`text-[10px] px-2 py-0.5 rounded-full text-white font-cairo ${priority.color}`}
											>
												{priority.label}
											</span>
										</td>
										<td className="px-4 py-3">
											<div className="flex items-center justify-center gap-1">
												<button
													onClick={() => setSelectedDispute(d)}
													className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-blue-50 text-[#6B6B6B] hover:text-blue-500 transition-colors"
													title="عرض"
												>
													<Eye className="w-4 h-4" strokeWidth={1.5} />
												</button>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>

				{paginatedDisputes.length === 0 && (
					<div className="py-12 text-center">
						<AlertTriangle
							className="w-12 h-12 text-[#AAAAAA] mx-auto mb-3"
							strokeWidth={1.5}
						/>
						<p className="text-sm text-[#6B6B6B] font-cairo">لا يوجد نزاعات مطابقة</p>
					</div>
				)}

				{/* Pagination */}
				{filteredDisputes.length > pageSize && (
					<div className="flex items-center justify-between px-4 py-3 border-t border-[#F5F5F5]">
						<span className="text-xs text-[#6B6B6B] font-cairo">
							{filteredDisputes.length} نزاع
						</span>
						<div className="flex items-center gap-1">
							<button
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								disabled={currentPage === 1}
								title="Previous page"
								aria-label="Previous page"
								className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F8F8F8] disabled:opacity-30"
							>
								<ChevronRight className="w-4 h-4" />
							</button>
							{Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
								<button
									key={p}
									onClick={() => setCurrentPage(p)}
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
								onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
								disabled={currentPage === totalPages}
								title="Next page"
								aria-label="Next page"
								className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F8F8F8] disabled:opacity-30"
							>
								<ChevronLeft className="w-4 h-4" />
							</button>
						</div>
					</div>
				)}
			</Card>

			{/* ── Dispute Detail Panel (shown inline for desktop) ── */}
			{selectedDispute && (
				<Card className="border-0 shadow-sm overflow-hidden">
					<CardHeader className="pt-5 px-5 pb-0 flex flex-row items-center justify-between">
						<div className="flex items-center gap-3">
							<button
								onClick={() => setSelectedDispute(null)}
								title="Back"
								aria-label="Back"
								className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F8F8F8] text-[#6B6B6B] transition-colors"
							>
								<ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
							</button>
							<div>
								<div className="flex items-center gap-2">
									<h3 className="text-[#111111] font-cairo font-bold text-base">
										{selectedDispute.id}
									</h3>
									<Badge
										variant="outline"
										className={`font-cairo text-[10px] ${statusConfig[selectedDispute.status].color}`}
									>
										{statusConfig[selectedDispute.status].label}
									</Badge>
									<span
										className={`text-[10px] px-2 py-0.5 rounded-full text-white font-cairo ${priorityConfig[selectedDispute.priority].color}`}
									>
										{priorityConfig[selectedDispute.priority].label}
									</span>
								</div>
								<p className="text-xs text-[#6B6B6B] font-cairo">
									{selectedDispute.type} · {selectedDispute.date}
								</p>
							</div>
						</div>
					</CardHeader>

					<CardContent className="p-5">
						<div className="grid lg:grid-cols-3 gap-6">
							{/* ── Column 1: Buyer Info ── */}
							<div className="space-y-4">
								<div className="flex items-center gap-2 mb-3">
									<User className="w-4 h-4 text-blue-500" strokeWidth={1.5} />
									<h4 className="text-sm font-cairo font-bold text-[#111111]">
										المشتري
									</h4>
								</div>
								<div className="p-4 rounded-2xl bg-blue-50/50 space-y-3">
									<div className="flex items-center gap-3">
										<Avatar className="w-10 h-10">
											<AvatarFallback className="bg-blue-100 text-blue-600 font-cairo font-bold">
												{selectedDispute.buyer.charAt(0)}
											</AvatarFallback>
										</Avatar>
										<div>
											<p className="text-sm font-cairo font-semibold text-[#111111]">
												{selectedDispute.buyer}
											</p>
											<p className="text-[11px] text-[#6B6B6B] font-cairo">
												مشتري
											</p>
										</div>
									</div>
									<Separator className="bg-blue-100" />
									<div>
										<p className="text-xs text-[#6B6B6B] font-cairo mb-1">
											الشكوى:
										</p>
										<p className="text-sm font-cairo text-[#111111] leading-relaxed">
											{selectedDispute.description}
										</p>
									</div>
								</div>

								{/* Evidence */}
								{selectedDispute.evidenceCount > 0 && (
									<div>
										<p className="text-xs text-[#6B6B6B] font-cairo mb-2">
											الأدلة ({selectedDispute.evidenceCount}):
										</p>
										<div className="grid grid-cols-3 gap-2">
											{Array.from(
												{ length: selectedDispute.evidenceCount },
												(_, i) => (
													<div
														key={i}
														className="aspect-square rounded-xl bg-[#F8F8F8] border border-dashed border-[#DDD] flex items-center justify-center cursor-pointer hover:border-[#D4A853] transition-colors"
													>
														<FileText
															className="w-5 h-5 text-[#AAAAAA]"
															strokeWidth={1.5}
														/>
													</div>
												),
											)}
										</div>
									</div>
								)}
							</div>

							{/* ── Column 2: Timeline ── */}
							<div className="space-y-4">
								<div className="flex items-center gap-2 mb-3">
									<Scale className="w-4 h-4 text-[#D4A853]" strokeWidth={1.5} />
									<h4 className="text-sm font-cairo font-bold text-[#111111]">
										سير النزاع
									</h4>
								</div>

								<div className="relative pr-4 space-y-6">
									{/* Vertical line */}
									<div className="absolute right-[7px] top-2 bottom-2 w-[2px] bg-[#F0F0F0]" />

									{/* Step 1: Filed */}
									<div className="relative flex items-start gap-3">
										<div className="w-4 h-4 rounded-full bg-red-400 border-2 border-white shadow-sm z-10 shrink-0 mt-1" />
										<div>
											<p className="text-sm font-cairo font-semibold text-[#111111]">
												تم تقديم الشكوى
											</p>
											<p className="text-[11px] text-[#6B6B6B] font-cairo">
												{selectedDispute.date}
											</p>
											<p className="text-xs font-cairo text-[#111111] mt-1">
												{selectedDispute.description}
											</p>
										</div>
									</div>

									{/* Step 2: Merchant Response */}
									<div className="relative flex items-start gap-3">
										<div
											className={`w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 shrink-0 mt-1 ${
												selectedDispute.merchantResponse
													? 'bg-blue-400'
													: 'bg-[#DDD]'
											}`}
										/>
										<div>
											<p className="text-sm font-cairo font-semibold text-[#111111]">
												رد التاجر
											</p>
											{selectedDispute.merchantResponse ? (
												<>
													<p className="text-[11px] text-[#6B6B6B] font-cairo">
														{selectedDispute.date}
													</p>
													<p className="text-xs font-cairo text-[#111111] mt-1">
														{selectedDispute.merchantResponse}
													</p>
												</>
											) : (
												<p className="text-xs text-[#AAAAAA] font-cairo mt-1">
													لم يرد بعد
												</p>
											)}
										</div>
									</div>

									{/* Step 3: Admin Review */}
									<div className="relative flex items-start gap-3">
										<div
											className={`w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 shrink-0 mt-1 ${
												selectedDispute.status !== 'new'
													? 'bg-amber-400'
													: 'bg-[#DDD]'
											}`}
										/>
										<div>
											<p className="text-sm font-cairo font-semibold text-[#111111]">
												مراجعة الإدارة
											</p>
											<p className="text-xs text-[#AAAAAA] font-cairo mt-1">
												{selectedDispute.status === 'new'
													? 'في الانتظار'
													: 'قيد المراجعة'}
											</p>
										</div>
									</div>

									{/* Step 4: Resolution */}
									<div className="relative flex items-start gap-3">
										<div
											className={`w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 shrink-0 mt-1 ${
												selectedDispute.status === 'resolved'
													? 'bg-emerald-400'
													: 'bg-[#DDD]'
											}`}
										/>
										<div>
											<p className="text-sm font-cairo font-semibold text-[#111111]">
												الحل
											</p>
											<p className="text-xs text-[#AAAAAA] font-cairo mt-1">
												{selectedDispute.status === 'resolved'
													? 'تم الحل'
													: 'في الانتظار'}
											</p>
										</div>
									</div>
								</div>

								{/* Internal Notes */}
								<div>
									<label className="text-xs text-[#6B6B6B] font-cairo mb-1.5 block">
										ملاحظات داخلية
									</label>
									<Textarea
										value={internalNote}
										onChange={(e) => setInternalNote(e.target.value)}
										placeholder="اكتب ملاحظات خاصة بالإدارة..."
										className="font-cairo text-sm resize-none"
										rows={3}
									/>
								</div>
							</div>

							{/* ── Column 3: Merchant Info + Resolution ── */}
							<div className="space-y-4">
								<div className="flex items-center gap-2 mb-3">
									<Store className="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
									<h4 className="text-sm font-cairo font-bold text-[#111111]">
										التاجر
									</h4>
								</div>
								<div className="p-4 rounded-2xl bg-emerald-50/50 space-y-3">
									<div className="flex items-center gap-3">
										<Avatar className="w-10 h-10">
											<AvatarFallback className="bg-emerald-100 text-emerald-600 font-cairo font-bold">
												{selectedDispute.merchant.charAt(0)}
											</AvatarFallback>
										</Avatar>
										<div>
											<p className="text-sm font-cairo font-semibold text-[#111111]">
												{selectedDispute.merchant}
											</p>
											<p className="text-[11px] text-[#6B6B6B] font-cairo">
												{selectedDispute.store}
											</p>
										</div>
									</div>
									<Separator className="bg-emerald-100" />
									<div className="flex items-center gap-2 text-xs font-cairo text-[#6B6B6B]">
										<ShoppingBag className="w-3.5 h-3.5" strokeWidth={1.5} />
										طلب: {selectedDispute.orderId}
									</div>
								</div>

								{/* Resolution Panel */}
								{selectedDispute.status !== 'resolved' && (
									<div className="p-4 rounded-2xl bg-[#F8F8F8] space-y-3">
										<h4 className="text-sm font-cairo font-bold text-[#111111] flex items-center gap-2">
											<Scale
												className="w-4 h-4 text-[#D4A853]"
												strokeWidth={1.5}
											/>
											قرار التسوية
										</h4>

										<Textarea
											value={resolutionNotes}
											onChange={(e) => setResolutionNotes(e.target.value)}
											placeholder="سبب القرار..."
											className="font-cairo text-sm resize-none"
											rows={2}
										/>

										<div className="grid grid-cols-1 gap-2">
											<Button
												onClick={() => handleResolution('buyer')}
												size="sm"
												className="bg-blue-500 hover:bg-blue-600 text-white font-cairo text-xs gap-1 w-full"
											>
												<CheckCircle className="w-3.5 h-3.5" />
												صالح المشتري (رد المبلغ)
											</Button>
											<Button
												onClick={() => handleResolution('merchant')}
												size="sm"
												variant="outline"
												className="font-cairo text-xs gap-1 border-emerald-300 text-emerald-600 hover:bg-emerald-50 w-full"
											>
												<CheckCircle className="w-3.5 h-3.5" />
												صالح التاجر
											</Button>
											<Button
												onClick={() => handleResolution('split')}
												size="sm"
												variant="outline"
												className="font-cairo text-xs gap-1 border-amber-300 text-amber-600 hover:bg-amber-50 w-full"
											>
												<Scale className="w-3.5 h-3.5" />
												تسوية (رد جزئي)
											</Button>
											<Button
												onClick={() => handleResolution('request')}
												size="sm"
												variant="outline"
												className="font-cairo text-xs gap-1 border-[#DDD] text-[#6B6B6B] hover:bg-[#F0F0F0] w-full"
											>
												<MessageSquare className="w-3.5 h-3.5" />
												طلب معلومات
											</Button>
										</div>
									</div>
								)}
							</div>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
