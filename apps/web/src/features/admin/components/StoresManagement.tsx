import { useState, useMemo, useCallback } from 'react';
import {
	Search,
	ChevronLeft,
	ChevronRight,
	Eye,
	CheckCircle,
	XCircle,
	Clock,
	FileText,
	Shield,
	Star,
	Crown,
	Gem,
	MapPin,
	Phone,
	Mail,
	Calendar,
	Package,
	Users,
	Ban,
	MessageSquare,
	X,
	Check,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAdminStores } from '@/hooks/useApi';
import { patchAdminStore, type AdminStore } from '@/lib/api';
import { useApp } from '@/context/AppContext';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type StoreStatus = 'pending' | 'active' | 'suspended' | 'rejected';
type TrustBadge = 'none' | 'verified' | 'golden' | 'diamond';

interface StoreRecord {
	id: number;
	name: string;
	merchant: string;
	email: string;
	phone: string;
	category: string;
	status: StoreStatus;
	trustBadge: TrustBadge;
	rating: number;
	productsCount: number;
	joinedDate: string;
	governorate: string;
	docCount: number;
}

/** Map the AdminStore shape from /api/admin/stores
 *  (server/routes/admin.cts:95-144) to the table's view model.
 *  Fields NOT exposed by /api/admin/stores get placeholder values
 *  (em-dash) so the column structure is preserved. */
function mapAdminStoreToView(store: AdminStore): StoreRecord {
	return {
		id: store.id,
		name: store.store_name,
		// owner_id, owner name/email/phone, category_id, products_count,
		// docCount are not in the /admin/stores SELECT * projection.
		merchant: '—',
		email: '—',
		phone: '—',
		category: '—',
		status: store.is_active ? 'active' : 'suspended',
		trustBadge: store.is_verified ? 'verified' : 'none',
		rating: store.rating ?? 0,
		productsCount: 0,
		joinedDate: store.created_at,
		governorate: store.governorate ?? '—',
		docCount: 0,
	};
}

const statusConfig: Record<
	StoreStatus,
	{ label: string; color: string; icon: typeof CheckCircle }
> = {
	pending: {
		label: 'قيد المراجعة',
		color: 'bg-amber-50 text-amber-600 border-amber-200',
		icon: Clock,
	},
	active: {
		label: 'نشط',
		color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
		icon: CheckCircle,
	},
	suspended: { label: 'موقوف', color: 'bg-red-50 text-red-500 border-red-200', icon: Ban },
	rejected: {
		label: 'مرفوض',
		color: 'bg-red-50/50 text-red-400 border-red-200 border-dashed',
		icon: XCircle,
	},
};

const trustBadgeConfig: Record<
	TrustBadge,
	{ label: string; icon: typeof Shield | null; color: string }
> = {
	none: { label: 'بدون', icon: null, color: 'text-[#AAAAAA]' },
	verified: { label: 'موثق', icon: Shield, color: 'text-blue-500 bg-blue-50' },
	golden: { label: 'ذهبي', icon: Crown, color: 'text-[#D4A853] bg-amber-50' },
	diamond: { label: 'ماسي', icon: Gem, color: 'text-purple-500 bg-purple-50' },
};

/* Status tab keys; matches the StoreStatus union + 'all'. Counts are
 * computed dynamically from the server response. */
const STATUS_TABS: { key: 'all' | StoreStatus; label: string }[] = [
	{ key: 'all', label: 'الكل' },
	{ key: 'pending', label: 'قيد المراجعة' },
	{ key: 'active', label: 'نشط' },
	{ key: 'suspended', label: 'موقوف' },
	{ key: 'rejected', label: 'مرفوض' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function StoresManagement() {
	const [activeTab, setActiveTab] = useState<'all' | StoreStatus>('all');
	const [search, setSearch] = useState('');
	const [currentPage, setCurrentPage] = useState(1);
	const [selectedStore, setSelectedStore] = useState<StoreRecord | null>(null);
	const [verifyStore, setVerifyStore] = useState<StoreRecord | null>(null);
	const [rejectReason, setRejectReason] = useState('');
	const [pageSize] = useState(10);

	const { addToast } = useApp();

	/* ── Server query ── */
	// Translate the active tab into the API filter. The admin endpoint
	// supports `is_active=true|false` so a `pending`/`rejected` client
	// tab is treated as "all" — the client filter below narrows further.
	const apiParams = useMemo(() => {
		const params: {
			limit: number;
			offset: number;
			is_active?: boolean;
			is_verified?: boolean;
		} = { limit: pageSize, offset: (currentPage - 1) * pageSize };
		if (activeTab === 'active') params.is_active = true;
		if (activeTab === 'suspended') params.is_active = false;
		// verified → backend filter; golden/diamond map to verified=1 for
		// now (admin endpoint does not differentiate gold vs diamond).
		return params;
	}, [activeTab, pageSize, currentPage]);

	const { data: storesResponse, loading, error, refetch } = useAdminStores(apiParams);

	/* ── Derived state ── */
	// Map API rows into the view-model. Until C.4 ships the merchant
	// join, we leave merchant/email/phone/category as "—".
	const allStores = useMemo<StoreRecord[]>(
		() => (storesResponse?.stores ?? []).map(mapAdminStoreToView),
		[storesResponse],
	);

	// Client-side text filter across name (we don't have merchant/email yet).
	const textFiltered = useMemo(() => {
		if (!search.trim()) return allStores;
		const needle = search.toLowerCase();
		return allStores.filter((s) => s.name.toLowerCase().includes(needle));
	}, [allStores, search]);

	// `pending` / `rejected` tabs cannot be enforced server-side today
	// (no flag in stores table), so we filter them client-side. For a
	// sparse seed set this is fine; once K.6 ships we'll switch to a
	// dedicated query param.
	const filteredStores = useMemo(() => {
		if (activeTab === 'all') return textFiltered;
		if (activeTab === 'active' || activeTab === 'suspended') return textFiltered;
		return textFiltered.filter((s) => s.status === activeTab);
	}, [textFiltered, activeTab]);

	const paginatedStores = useMemo(() => {
		const start = (currentPage - 1) * pageSize;
		return filteredStores.slice(start, start + pageSize);
	}, [filteredStores, currentPage, pageSize]);

	const totalCount = storesResponse?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

	/* ── Status counts for tabs (dynamic from server response) ── */
	const statusCounts = useMemo(() => {
		const counts: Record<'all' | StoreStatus, number> = {
			all: allStores.length,
			pending: 0,
			active: 0,
			suspended: 0,
			rejected: 0,
		};
		for (const s of allStores) counts[s.status] += 1;
		return counts;
	}, [allStores]);

	/* ── Server mutations ── */
	// The K.1 admin PATCH endpoints write to admin_audit_log on every
	// successful change. We surface the result via toast + refetch().
	const handleSuspendToggle = useCallback(
		async (target: StoreRecord) => {
			// active → suspended via is_active=false; suspended → active
			// requires also setting is_verified (admin endpoint contract
			// — see server/routes/admin.cts:500-525). When reactivating a
			// previously-unverified store, fall back to verified=true so
			// the store comes back into the verified bucket.
			const nextActive = target.status !== 'active';
			const nextBody: Parameters<typeof patchAdminStore>[1] = {
				is_active: nextActive,
			};
			if (nextActive) nextBody.is_verified = true;
			try {
				await patchAdminStore(target.id, nextBody);
				addToast({
					type: 'success',
					message: nextActive ? 'تم تفعيل المتجر' : 'تم تعليق المتجر',
				});
				await refetch();
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				addToast({ type: 'error', message: 'فشل تحديث المتجر: ' + message });
			}
		},
		[addToast, refetch],
	);

	const handleVerifyAction = useCallback(
		async (_action: 'accept' | 'reject' | 'request', target: StoreRecord) => {
			try {
				if (_action === 'accept') {
					await patchAdminStore(target.id, {
						is_verified: true,
						is_active: true,
					});
					addToast({ type: 'success', message: 'تم توثيق المتجر' });
				} else if (_action === 'reject') {
					await patchAdminStore(target.id, { is_active: false });
					addToast({ type: 'success', message: 'تم رفض المتجر' });
				} else {
					// 'request' = ask for more documents. No API flag
					// exists for this in /api/admin/stores yet — fall
					// back to a deferred message until K.6 ships the
					// request_docs route.
					addToast({
						type: 'info',
						message: 'سيتم إرسال طلب المستندات إلى التاجر (K.6).',
					});
				}
				await refetch();
				setVerifyStore(null);
				setRejectReason('');
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				addToast({ type: 'error', message: 'فشل تحديث المتجر: ' + message });
			}
		},
		[addToast, refetch],
	);

	return (
		<div className="space-y-5">
			{error && (
				<div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
					تعذّر تحميل المتاجر: {error}
					<button type="button" className="ml-2 underline" onClick={() => void refetch()}>
						إعادة المحاولة
					</button>
				</div>
			)}
			{/* ── Search ── */}
			<Card className="border-0 shadow-sm">
				<CardContent className="p-4">
					<div className="relative w-full lg:w-80">
						<Search
							className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AAAAAA]"
							strokeWidth={1.5}
						/>
						<input
							type="text"
							placeholder="اسم المتجر..."
							aria-label="بحث المتاجر"
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								setCurrentPage(1);
							}}
							className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#e5e5e5] bg-[#F8F8F8] text-sm font-cairo text-[#111111] placeholder:text-[#AAAAAA] outline-none focus:border-[#D4A853] focus:ring-2 focus:ring-[#D4A853]/20 transition-all"
						/>
					</div>
				</CardContent>
			</Card>

			{/* ── Filter Tabs ── */}
			<div className="flex flex-wrap gap-2">
				{STATUS_TABS.map((tab) => (
					<button
						key={tab.key}
						onClick={() => {
							setActiveTab(tab.key);
							setCurrentPage(1);
						}}
						type="button"
						className={`px-4 py-2 rounded-xl text-sm font-cairo font-medium transition-all ${
							activeTab === tab.key
								? 'bg-[#D4A853] text-[#1A1612] shadow-sm'
								: 'bg-white text-[#6B6B6B] hover:bg-[#F8F8F8] border border-[#EEEEEE]'
						}`}
					>
						{tab.label}
						{activeTab !== tab.key && (
							<span className="mr-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[#F8F8F8] text-[#6B6B6B]">
								{statusCounts[tab.key]}
							</span>
						)}
					</button>
				))}
			</div>

			{/* ── Stores Table ── */}
			<Card className="border-0 shadow-sm overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="bg-[#F8F8F8] border-b border-[#EEEEEE]">
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B]">
									المتجر
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B] hidden md:table-cell">
									المحافظة
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B]">
									الحالة
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B] hidden lg:table-cell">
									الشارة
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B] hidden sm:table-cell">
									التقييم
								</th>
								<th className="px-4 py-3 text-center text-xs font-cairo font-semibold text-[#6B6B6B]">
									إجراءات
								</th>
							</tr>
						</thead>
						<tbody>
							{loading && paginatedStores.length === 0 ? (
								<tr>
									<td
										colSpan={6}
										className="px-4 py-8 text-center text-sm text-[#AAAAAA] font-cairo"
									>
										جاري التحميل…
									</td>
								</tr>
							) : (
								paginatedStores.map((store) => {
									const status = statusConfig[store.status];
									const StatusIcon = status.icon;
									const trust = trustBadgeConfig[store.trustBadge];
									const TrustIcon = trust.icon;
									return (
										<tr
											key={store.id}
											className="border-b border-[#F5F5F5] hover:bg-[#F8F8F8]/50 transition-colors"
										>
											<td className="px-4 py-3">
												<div className="flex items-center gap-3">
													<Avatar className="w-9 h-9 shrink-0">
														<AvatarFallback className="bg-[#D4A853]/20 text-[#D4A853] font-cairo font-bold text-sm">
															{store.name.charAt(0)}
														</AvatarFallback>
													</Avatar>
													<div className="min-w-0">
														<p className="text-sm font-cairo font-semibold text-[#111111] truncate">
															{store.name}
														</p>
														<p className="text-[11px] text-[#6B6B6B] font-cairo truncate">
															{store.merchant}
														</p>
													</div>
												</div>
											</td>
											<td className="px-4 py-3 hidden md:table-cell">
												<span className="text-xs font-cairo text-[#6B6B6B]">
													{store.governorate}
												</span>
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
											<td className="px-4 py-3 hidden lg:table-cell">
												{TrustIcon ? (
													<Badge
														variant="outline"
														className={`font-cairo text-[10px] gap-1 ${trust.color} border-0`}
													>
														<TrustIcon className="w-3 h-3" />
														{trust.label}
													</Badge>
												) : (
													<span className="text-xs text-[#AAAAAA] font-cairo">
														—
													</span>
												)}
											</td>
											<td className="px-4 py-3 hidden sm:table-cell">
												{store.rating > 0 ? (
													<div className="flex items-center gap-1">
														<Star
															className="w-3.5 h-3.5 text-[#D4A853]"
															strokeWidth={2}
														/>
														<span className="text-xs font-mono text-[#111111]">
															{store.rating}
														</span>
													</div>
												) : (
													<span className="text-xs text-[#AAAAAA] font-cairo">
														—
													</span>
												)}
											</td>
											<td className="px-4 py-3">
												<div className="flex items-center justify-center gap-1">
													<button
														onClick={() => setSelectedStore(store)}
														className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-blue-50 text-[#6B6B6B] hover:text-blue-500 transition-colors"
														title="عرض"
														type="button"
													>
														<Eye
															className="w-4 h-4"
															strokeWidth={1.5}
														/>
													</button>
													{store.status === 'pending' && (
														<button
															onClick={() => setVerifyStore(store)}
															className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-emerald-50 text-[#6B6B6B] hover:text-emerald-500 transition-colors"
															title="تحقق"
															type="button"
														>
															<FileText
																className="w-4 h-4"
																strokeWidth={1.5}
															/>
														</button>
													)}
													{(store.status === 'active' ||
														store.status === 'suspended') && (
														<button
															onClick={() => {
																void handleSuspendToggle(store);
															}}
															className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
																store.status === 'active'
																	? 'hover:bg-red-50 text-[#6B6B6B] hover:text-red-500'
																	: 'hover:bg-emerald-50 text-[#6B6B6B] hover:text-emerald-500'
															}`}
															title={
																store.status === 'active'
																	? 'تعليق'
																	: 'إعادة تفعيل'
															}
															type="button"
														>
															{store.status === 'active' ? (
																<Ban
																	className="w-4 h-4"
																	strokeWidth={1.5}
																/>
															) : (
																<Check
																	className="w-4 h-4"
																	strokeWidth={1.5}
																/>
															)}
														</button>
													)}
													<button
														className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-amber-50 text-[#6B6B6B] hover:text-amber-500 transition-colors"
														title="رسالة"
														type="button"
													>
														<MessageSquare
															className="w-4 h-4"
															strokeWidth={1.5}
														/>
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

				{paginatedStores.length === 0 && !loading && (
					<div className="py-12 text-center">
						<FileText
							className="w-12 h-12 text-[#AAAAAA] mx-auto mb-3"
							strokeWidth={1.5}
						/>
						<p className="text-sm text-[#6B6B6B] font-cairo">لا يوجد متاجر مطابقة</p>
					</div>
				)}

				{/* Pagination */}
				{totalCount > pageSize && (
					<div className="flex items-center justify-between px-4 py-3 border-t border-[#F5F5F5]">
						<span className="text-xs text-[#6B6B6B] font-cairo">{totalCount} متجر</span>
						<div className="flex items-center gap-1">
							<button
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								disabled={currentPage === 1}
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
								onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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

			{/* ── Store Detail Modal ── */}
			<Dialog open={!!selectedStore} onOpenChange={() => setSelectedStore(null)}>
				<DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
					{selectedStore && (
						<>
							<DialogHeader>
								<DialogTitle className="font-cairo text-lg text-[#111111]">
									تفاصيل المتجر
								</DialogTitle>
							</DialogHeader>

							<div className="flex items-center gap-4 pb-4 border-b border-[#F5F5F5]">
								<Avatar className="w-16 h-16">
									<AvatarFallback className="bg-[#D4A853]/20 text-[#D4A853] font-cairo text-2xl font-bold">
										{selectedStore.name.charAt(0)}
									</AvatarFallback>
								</Avatar>
								<div>
									<h3 className="text-lg font-cairo font-bold text-[#111111]">
										{selectedStore.name}
									</h3>
									<div className="flex items-center gap-2 mt-1">
										<Badge
											variant="outline"
											className={`font-cairo text-[10px] ${statusConfig[selectedStore.status].color}`}
										>
											{statusConfig[selectedStore.status].label}
										</Badge>
										{selectedStore.trustBadge !== 'none' && (
											<Badge
												variant="outline"
												className={`font-cairo text-[10px] gap-1 ${trustBadgeConfig[selectedStore.trustBadge].color} border-0`}
											>
												{(() => {
													const Icon =
														trustBadgeConfig[selectedStore.trustBadge]
															.icon;
													return Icon ? (
														<Icon className="w-3 h-3" />
													) : null;
												})()}
												{trustBadgeConfig[selectedStore.trustBadge].label}
											</Badge>
										)}
									</div>
								</div>
							</div>

							<div className="space-y-3 mt-2">
								<InfoRow
									icon={Users}
									label="التاجر"
									value={selectedStore.merchant}
								/>
								<InfoRow icon={Mail} label="البريد" value={selectedStore.email} />
								<InfoRow icon={Phone} label="الهاتف" value={selectedStore.phone} />
								<InfoRow
									icon={MapPin}
									label="المحافظة"
									value={selectedStore.governorate}
								/>
								<InfoRow
									icon={Calendar}
									label="تاريخ الانضمام"
									value={selectedStore.joinedDate}
								/>
								<InfoRow
									icon={Package}
									label="المنتجات"
									value={String(selectedStore.productsCount)}
								/>
								<InfoRow
									icon={Star}
									label="التقييم"
									value={
										selectedStore.rating > 0
											? String(selectedStore.rating)
											: '—'
									}
								/>
								<InfoRow
									icon={FileText}
									label="المستندات"
									value={`${selectedStore.docCount} ملفات`}
								/>

								{/* Trust badge assignment */}
								{selectedStore.status === 'active' && (
									<div className="p-3 rounded-xl bg-[#F8F8F8]">
										<p className="text-xs text-[#6B6B6B] font-cairo mb-2">
											شارة الثقة
										</p>
										<div className="flex gap-2">
											{(
												Object.keys(trustBadgeConfig) as Array<
													keyof typeof trustBadgeConfig
												>
											)
												.filter((k) => k !== 'none')
												.map((key) => {
													const badge = trustBadgeConfig[key];
													const BadgeIcon = badge.icon;
													return (
														<button
															key={key}
															type="button"
															className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cairo font-medium border transition-all ${
																selectedStore.trustBadge === key
																	? `${badge.color} border-current`
																	: 'bg-white text-[#6B6B6B] border-[#EEEEEE] hover:border-[#D4A853]'
															}`}
														>
															{BadgeIcon && (
																<BadgeIcon
																	className="w-3.5 h-3.5"
																	strokeWidth={1.5}
																/>
															)}
															{badge.label}
														</button>
													);
												})}
										</div>
									</div>
								)}
							</div>
						</>
					)}
				</DialogContent>
			</Dialog>

			{/* ── Verification Modal ── */}
			<Dialog
				open={!!verifyStore}
				onOpenChange={() => {
					setVerifyStore(null);
					setRejectReason('');
				}}
			>
				<DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
					{verifyStore && (
						<>
							<DialogHeader>
								<DialogTitle className="font-cairo text-lg text-[#111111]">
									التحقق من المتجر
								</DialogTitle>
							</DialogHeader>

							<div className="flex items-center gap-4 pb-4 border-b border-[#F5F5F5]">
								<Avatar className="w-14 h-14">
									<AvatarFallback className="bg-[#D4A853]/20 text-[#D4A853] font-cairo text-xl font-bold">
										{verifyStore.name.charAt(0)}
									</AvatarFallback>
								</Avatar>
								<div>
									<h3 className="text-base font-cairo font-bold text-[#111111]">
										{verifyStore.name}
									</h3>
									<p className="text-xs text-[#6B6B6B] font-cairo">
										{verifyStore.merchant} · {verifyStore.category}
									</p>
								</div>
							</div>

							{/* Documents */}
							<div className="space-y-2 mt-2">
								<p className="text-sm font-cairo font-semibold text-[#111111]">
									المستندات المقدمة
								</p>
								<div className="grid grid-cols-2 gap-2">
									{Array.from({ length: verifyStore.docCount }, (_, i) => (
										<div
											key={i}
											className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F8F8F8]"
										>
											<FileText
												className="w-4 h-4 text-[#D4A853]"
												strokeWidth={1.5}
											/>
											<span className="text-xs font-cairo text-[#111111]">
												مستند {i + 1}
											</span>
										</div>
									))}
									{verifyStore.docCount === 0 && (
										<p className="text-xs text-[#AAAAAA] font-cairo col-span-2">
											لا توجد مستندات بعد.
										</p>
									)}
								</div>
							</div>

							{/* Merchant Info */}
							<div className="space-y-2 mt-3">
								<p className="text-sm font-cairo font-semibold text-[#111111]">
									معلومات التاجر
								</p>
								<InfoRow icon={Phone} label="الهاتف" value={verifyStore.phone} />
								<InfoRow
									icon={MapPin}
									label="المحافظة"
									value={verifyStore.governorate}
								/>
								<InfoRow icon={Mail} label="البريد" value={verifyStore.email} />
							</div>

							{/* Rejection Reason */}
							<div className="mt-3">
								<label className="text-xs text-[#6B6B6B] font-cairo mb-1 block">
									سبب الرفض (إن وجد)
								</label>
								<Textarea
									value={rejectReason}
									onChange={(e) => setRejectReason(e.target.value)}
									placeholder="اكتب سبب الرفض أو طلب المستندات الإضافية..."
									className="font-cairo text-sm resize-none"
									rows={3}
								/>
							</div>

							{/* Actions */}
							<div className="flex gap-2 mt-4">
								<Button
									onClick={() => handleVerifyAction('accept', verifyStore)}
									className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-cairo gap-1"
								>
									<Check className="w-4 h-4" />
									قبول وتوثيق
								</Button>
								<Button
									onClick={() => handleVerifyAction('request', verifyStore)}
									variant="outline"
									className="font-cairo gap-1 border-amber-400 text-amber-600 hover:bg-amber-50"
								>
									<FileText className="w-4 h-4" />
									طلب مستندات
								</Button>
								<Button
									onClick={() => handleVerifyAction('reject', verifyStore)}
									variant="outline"
									className="font-cairo gap-1 border-red-300 text-red-500 hover:bg-red-50"
								>
									<X className="w-4 h-4" />
									رفض
								</Button>
							</div>
						</>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}

/* ── Helper: Info row ── */
function InfoRow({
	icon: Icon,
	label,
	value,
}: {
	icon: React.ElementType;
	label: string;
	value: string;
}) {
	return (
		<div className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F8F8]">
			<Icon className="w-4 h-4 text-[#AAAAAA] shrink-0" strokeWidth={1.5} />
			<span className="text-xs text-[#6B6B6B] font-cairo shrink-0 w-20">{label}</span>
			<span className="text-sm font-cairo text-[#111111] truncate">{value}</span>
		</div>
	);
}
