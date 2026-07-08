import { useState, useMemo, useCallback } from 'react';
import {
	AlertTriangle,
	Search,
	ChevronLeft,
	ChevronRight,
	Eye,
	User,
	Store,
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
import { useAdminDisputes, useAdminStats } from '@/hooks/useApi';
import { patchAdminDispute } from '@/lib/api';
import { useApp } from '@/context/AppContext';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

// API status enum (server/routes/admin.cts:278): 'open', 'in_review',
// 'resolved', 'rejected'. The page used a 4-way legacy enum
// ('new'|'reviewing'|'resolving'|'resolved'); we accept the API values
// directly and only label them.
type DisputeStatus = 'open' | 'in_review' | 'resolved' | 'rejected';
type DisputePriority = 'low' | 'normal' | 'high' | 'urgent';
type DisputeType =
	| 'not_received'
	| 'damaged'
	| 'wrong_item'
	| 'quality_issue'
	| 'refund_delay'
	| 'other';

interface DisputeRecord {
	id: number;
	code: string; // D-1024 style display
	type: DisputeType;
	typeDisplay: string;
	customerId: number;
	customerName: string; // "—" until backend join ships
	storeId: number;
	storeName: string; // "—" until backend join ships
	orderId: number;
	orderCode: string;
	date: string;
	status: DisputeStatus;
	priority: DisputePriority;
	subject: string;
	description: string;
	evidenceCount: number;
	resolution: string | null;
	resolvedAt: string | null;
}

/** Localized display labels for the dispute type enum coming from the
 *  database. */
const DISPUTE_TYPE_LABELS: Record<DisputeType, string> = {
	not_received: 'لم يستلم',
	damaged: 'منتج تالف',
	wrong_item: 'منتج مغاير',
	quality_issue: 'مشكلة جودة',
	refund_delay: 'تأخير الاسترداد',
	other: 'أخرى',
};

/** Map the API dispute row + its evidence JSONB to the view model.
 *  customer/store names come from joined `users`/`stores` once the
 *  backend adds `?expand=customer,store` support; today the row only
 *  carries the FK so we render "—". */
function mapAdminDisputeToView(
	row: Record<string, unknown>,
	index: number,
): DisputeRecord {
	const id = Number(row.id);
	const typeRaw = (row.type as DisputeType | undefined) ?? 'other';
	const statusRaw = (row.status as DisputeStatus | undefined) ?? 'open';
	const priorityRaw = (row.priority as DisputePriority | undefined) ?? 'normal';
	const evidence = row.evidence;
	const evidenceCount = Array.isArray(evidence) ? evidence.length : 0;
	const orderId = Number(row.order_id ?? 0);
	const customerId = Number(row.customer_id ?? 0);
	const storeId = Number(row.store_id ?? 0);
	const orderCode = orderId > 0 ? `ORD-${orderId}` : `ORD-?`;
	const createdAt = String(row.created_at ?? '');
	return {
		id,
		// Stable display code; keeps the page's existing
		// D-1024 / D-1023 visual layout.
		code: `D-${1048 - index}`,
		type: typeRaw,
		typeDisplay: DISPUTE_TYPE_LABELS[typeRaw] ?? String(typeRaw),
		customerId,
		customerName: '—',
		storeId,
		storeName: '—',
		orderId,
		orderCode,
		date: createdAt.replace('T', ' ').slice(0, 16),
		status: statusRaw,
		priority: priorityRaw,
		subject: String(row.subject ?? ''),
		description: String(row.description ?? ''),
		evidenceCount,
		resolution: (row.resolution as string | null) ?? null,
		resolvedAt: (row.resolved_at as string | null) ?? null,
	};
}

const statusConfig: Record<
	DisputeStatus,
	{ label: string; color: string; icon: typeof AlertTriangle }
> = {
	open: {
		label: 'جديد',
		color: 'bg-amber-50 text-amber-600 border-amber-200',
		icon: AlertTriangle,
	},
	in_review: {
		label: 'قيد المراجعة',
		color: 'bg-blue-50 text-blue-600 border-blue-200',
		icon: Clock,
	},
	resolved: {
		label: 'محلول',
		color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
		icon: CheckCircle,
	},
	rejected: {
		label: 'مرفوض',
		color: 'bg-red-50 text-red-500 border-red-200',
		icon: AlertTriangle,
	},
};

const priorityConfig: Record<
	DisputePriority,
	{ label: string; color: string }
> = {
	urgent: { label: 'عاجل', color: 'bg-red-500' },
	high: { label: 'مرتفع', color: 'bg-orange-500' },
	normal: { label: 'عادي', color: 'bg-blue-500' },
	low: { label: 'منخفض', color: 'bg-emerald-500' },
};

const _TYPE_LABELS = DISPUTE_TYPE_LABELS;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function DisputesManagement() {
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState<string>('all');
	const [currentPage, setCurrentPage] = useState(1);
	const [selectedDispute, setSelectedDispute] = useState<DisputeRecord | null>(
		null,
	);
	const [internalNote, setInternalNote] = useState('');
	const [resolutionNotes, setResolutionNotes] = useState('');
	const pageSize = 10;

	const { addToast } = useApp();

	// Server query: limit/offset + optional status.
	const apiParams = useMemo(() => {
		const p: { limit: number; offset: number; status?: string } = {
			limit: pageSize,
			offset: (currentPage - 1) * pageSize,
		};
		if (statusFilter !== 'all') p.status = statusFilter;
		return p;
	}, [statusFilter, currentPage]);

	const {
		data: disputesResponse,
		loading,
		error,
		refetch,
	} = useAdminDisputes(apiParams);

	// Aggregate counts (use /api/admin/stats which is fast even with millions
	// of rows thanks to the existing summary CTE).
	const { data: adminStats } = useAdminStats();

	const allDisputes = useMemo<DisputeRecord[]>(
		() =>
			(disputesResponse?.disputes ?? []).map((row, idx) =>
				mapAdminDisputeToView(row as unknown as Record<string, unknown>, idx),
			),
		[disputesResponse],
	);

	// Server already filtered by status; the client search is text.
	const textFiltered = useMemo(() => {
		if (!search.trim()) return allDisputes;
		const needle = search.toLowerCase();
		return allDisputes.filter(
			(d) =>
				d.code.toLowerCase().includes(needle) ||
				d.subject.toLowerCase().includes(needle) ||
				d.orderCode.toLowerCase().includes(needle),
		);
	}, [allDisputes, search]);

	const paginatedDisputes = useMemo(() => textFiltered, [textFiltered]);
	const totalCount = disputesResponse?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

	// Tab counts from /api/admin/stats.disputes (the real backend aggregation).
	const statusCounts = useMemo(() => {
		const counts: Record<'all' | DisputeStatus, number> = {
			all: adminStats?.counts?.disputes ?? allDisputes.length,
			open: 0,
			in_review: 0,
			resolved: 0,
			rejected: 0,
		};
		for (const d of allDisputes) counts[d.status] += 1;
		return counts;
	}, [adminStats, allDisputes]);

	// Resolve a dispute via PATCH /api/admin/disputes/:id.
	const handleResolve = useCallback(
		async (dispute: DisputeRecord, decision: 'buyer' | 'seller') => {
			const newStatus: DisputeStatus =
				decision === 'buyer' ? 'resolved' : 'rejected';
			try {
				await patchAdminDispute(dispute.id, {
					status: newStatus,
					resolution: resolutionNotes || undefined,
				});
				addToast({
					type: 'success',
					message:
						newStatus === 'resolved'
							? 'تم حل النزاع لصالح المشتري'
							: 'تم رفض النزاع',
				});
				setResolutionNotes('');
				setSelectedDispute(null);
				await refetch();
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				addToast({ type: 'error', message: 'فشل تحديث النزاع: ' + message });
			}
		},
		[addToast, refetch, resolutionNotes],
	);

	return (
		<div className="space-y-5">
			{error && (
				<div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
					تعذّر تحميل النزاعات: {error}
					<button
						type="button"
						className="ml-2 underline"
						onClick={() => void refetch()}
					>
						إعادة المحاولة
					</button>
				</div>
			)}
			{/* ── Summary Cards ── */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				{(
					[
						{
							key: 'open',
							label: 'جديد',
							color: 'bg-amber-500',
							textColor: 'text-amber-600',
						},
						{
							key: 'in_review',
							label: 'قيد المراجعة',
							color: 'bg-blue-500',
							textColor: 'text-blue-600',
						},
						{
							key: 'resolved',
							label: 'محلولة',
							color: 'bg-emerald-500',
							textColor: 'text-emerald-600',
						},
						{
							key: 'rejected',
							label: 'مرفوضة',
							color: 'bg-red-500',
							textColor: 'text-red-500',
						},
					] as const
				).map((s) => (
					<Card key={s.key} className="border-0 shadow-sm">
						<CardContent className="p-4">
							<div className="flex items-center gap-2 mb-2">
								<div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
								<span className="text-xs font-cairo text-[#6B6B6B]">{s.label}</span>
							</div>
							<p className={`text-2xl font-mono font-bold ${s.textColor}`}>
								{statusCounts[s.key]}
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
								placeholder="رقم النزاع، الموضوع، رقم الطلب..."
								aria-label="بحث النزاعات"
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
								<option value="open">جديد</option>
								<option value="in_review">قيد المراجعة</option>
								<option value="resolved">محلول</option>
								<option value="rejected">مرفوض</option>
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
							{loading && paginatedDisputes.length === 0 ? (
								<tr>
									<td
										colSpan={6}
										className="px-4 py-8 text-center text-sm text-[#AAAAAA] font-cairo"
									>
										جاري التحميل…
									</td>
								</tr>
							) : (
								paginatedDisputes.map((d) => {
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
															{d.code}
														</span>
														<span className="text-[10px] font-cairo text-[#6B6B6B] bg-[#F8F8F8] px-1.5 py-0.5 rounded-md">
															{d.typeDisplay}
														</span>
													</div>
													<p className="text-[11px] text-[#AAAAAA] font-cairo mt-0.5">
														{d.orderCode} · {d.date}
													</p>
												</div>
											</td>
											<td className="px-4 py-3 hidden md:table-cell">
												<span className="text-sm font-cairo text-[#111111]">
													{d.customerName}
												</span>
											</td>
											<td className="px-4 py-3 hidden lg:table-cell">
												<div>
													<p className="text-sm font-cairo text-[#111111]">
														{d.storeName}
													</p>
													<p className="text-[11px] text-[#6B6B6B] font-cairo">
														{DISPUTE_TYPE_LABELS[d.type]}
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
														type="button"
													>
														<Eye className="w-4 h-4" strokeWidth={1.5} />
													</button>
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				{paginatedDisputes.length === 0 && !loading && (
					<div className="py-12 text-center">
						<AlertTriangle
							className="w-12 h-12 text-[#AAAAAA] mx-auto mb-3"
							strokeWidth={1.5}
						/>
						<p className="text-sm text-[#6B6B6B] font-cairo">لا يوجد نزاعات مطابقة</p>
					</div>
				)}

				{/* Pagination */}
				{totalCount > pageSize && (
					<div className="flex items-center justify-between px-4 py-3 border-t border-[#F5F5F5]">
						<span className="text-xs text-[#6B6B6B] font-cairo">
							{totalCount} نزاع
						</span>
						<div className="flex items-center gap-1">
							<button
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								disabled={currentPage === 1}
								title="Previous page"
								aria-label="Previous page"
								type="button"
								className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F8F8F8] disabled:opacity-30"
							>
								<ChevronRight className="w-4 h-4" />
							</button>
							{Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
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
								title="Next page"
								aria-label="Next page"
								type="button"
								className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F8F8F8] disabled:opacity-30"
							>
								<ChevronLeft className="w-4 h-4" />
							</button>
						</div>
					</div>
				)}
			</Card>

			{/* ── Dispute Detail Panel (shown inline) ── */}
			{selectedDispute && (
				<Card className="border-0 shadow-sm overflow-hidden">
					<CardHeader className="pt-5 px-5 pb-0 flex flex-row items-center justify-between">
						<div className="flex items-center gap-3">
							<button
								onClick={() => setSelectedDispute(null)}
								title="Back"
								aria-label="Back"
								type="button"
								className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F8F8F8] text-[#6B6B6B] transition-colors"
							>
								<ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
							</button>
							<div>
								<div className="flex items-center gap-2">
									<h3 className="text-[#111111] font-cairo font-bold text-base">
										{selectedDispute.code}
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
									{selectedDispute.typeDisplay} · {selectedDispute.date}
								</p>
							</div>
						</div>
					</CardHeader>

					<CardContent className="p-5">
						<div className="grid lg:grid-cols-3 gap-6">
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
												{selectedDispute.customerName.charAt(0)}
											</AvatarFallback>
										</Avatar>
										<div>
											<p className="text-sm font-cairo font-semibold text-[#111111]">
												{selectedDispute.customerName}
											</p>
											<p className="text-[11px] text-[#6B6B6B] font-cairo">
												#{selectedDispute.customerId}
											</p>
										</div>
									</div>
									<Separator className="bg-blue-100" />
									<div className="text-xs text-[#6B6B6B] font-cairo">
										<p>رقم الطلب:</p>
										<p className="font-mono text-[#111111]">
											{selectedDispute.orderCode}
										</p>
									</div>
								</div>
							</div>

							<div className="space-y-4">
								<div className="flex items-center gap-2 mb-3">
									<Store className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
									<h4 className="text-sm font-cairo font-bold text-[#111111]">
										التاجر
									</h4>
								</div>
								<div className="p-4 rounded-2xl bg-amber-50/50 space-y-3">
									<div className="flex items-center gap-3">
										<Avatar className="w-10 h-10">
											<AvatarFallback className="bg-amber-100 text-amber-600 font-cairo font-bold">
												{selectedDispute.storeName.charAt(0)}
											</AvatarFallback>
										</Avatar>
										<div>
											<p className="text-sm font-cairo font-semibold text-[#111111]">
												{selectedDispute.storeName}
											</p>
											<p className="text-[11px] text-[#6B6B6B] font-cairo">
												#{selectedDispute.storeId}
											</p>
										</div>
									</div>
									<Separator className="bg-amber-100" />
									<div className="text-xs text-[#6B6B6B] font-cairo">
										<p>الموضوع:</p>
										<p className="text-[#111111]">{selectedDispute.subject}</p>
									</div>
								</div>
							</div>

							<div className="space-y-4">
								<div className="flex items-center gap-2 mb-3">
									<Scale className="w-4 h-4 text-red-500" strokeWidth={1.5} />
									<h4 className="text-sm font-cairo font-bold text-[#111111]">
										التفاصيل
									</h4>
								</div>
								<div className="p-4 rounded-2xl bg-red-50/50 space-y-3">
									<p className="text-xs text-[#111111] font-cairo leading-relaxed">
										{selectedDispute.description}
									</p>
									<Separator className="bg-red-100" />
									<div className="text-xs text-[#6B6B6B] font-cairo flex items-center gap-2">
										<FileText className="w-3.5 h-3.5" />
										<span>{selectedDispute.evidenceCount} مستندات</span>
									</div>
								</div>
							</div>
						</div>

						<Separator className="my-5" />

						<div className="grid md:grid-cols-2 gap-4">
							<div>
								<label className="text-xs text-[#6B6B6B] font-cairo mb-1 block">
									ملاحظات التاجر (للتوثيق)
								</label>
								<Textarea
									value={internalNote}
									onChange={(e) => setInternalNote(e.target.value)}
									placeholder="ملاحظات داخلية…"
									className="font-cairo text-sm resize-none"
									rows={3}
								/>
							</div>
							<div>
								<label className="text-xs text-[#6B6B6B] font-cairo mb-1 block">
									قرار الحل (مرئي للطرفين)
								</label>
								<Textarea
									value={resolutionNotes}
									onChange={(e) => setResolutionNotes(e.target.value)}
									placeholder="اشرح سبب القرار…"
									className="font-cairo text-sm resize-none"
									rows={3}
								/>
							</div>
						</div>

						<div className="flex flex-wrap gap-2 mt-5">
							{selectedDispute.status !== 'resolved' && (
								<Button
									onClick={() => handleResolve(selectedDispute, 'buyer')}
									className="bg-emerald-500 hover:bg-emerald-600 text-white font-cairo"
								>
									<CheckCircle className="w-4 h-4 ml-1" />
									حل النزاع لصالح المشتري
								</Button>
							)}
							{selectedDispute.status !== 'rejected' && (
								<Button
									onClick={() => handleResolve(selectedDispute, 'seller')}
									variant="outline"
									className="font-cairo border-amber-400 text-amber-600 hover:bg-amber-50"
								>
									<MessageSquare className="w-4 h-4 ml-1" />
									رفض النزاع
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
