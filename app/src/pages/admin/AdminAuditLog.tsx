/**
 * AdminAuditLog.tsx — K.6 page
 *
 * Read-only view of `admin_audit_log` (database/schema-extra.sql:188).
 * Every admin write (PATCH /api/admin/users|stores|orders|products|
 * disputes — see server/routes/admin.cts:447-647) writes one row here,
 * so this page is the receipts trail the admin needs to see who
 * changed what and when.
 *
 * Routes here only when the user has role='admin' (App.tsx:166).
 */
import { useState, useMemo, useCallback } from 'react';
import {
	Shield,
	Search,
	ChevronLeft,
	ChevronRight,
	Clock,
	User as UserIcon,
	Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAdminAuditLog } from '@/hooks/useApi';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

// Action constants match what server/routes/admin.cts:writeAuditLog
// passes to the INSERT — kept here so the legend at the top of the
// page can render human labels without an extra fetch.
const ACTION_LABELS: Record<string, { label: string; color: string }> = {
	update_user: { label: 'تعديل مستخدم', color: 'bg-blue-50 text-blue-600' },
	update_store: { label: 'تعديل متجر', color: 'bg-amber-50 text-amber-600' },
	update_product: { label: 'تعديل منتج', color: 'bg-emerald-50 text-emerald-600' },
	force_status: { label: 'تغيير حالة الطلب', color: 'bg-purple-50 text-purple-600' },
	update_dispute: { label: 'تحديث نزاع', color: 'bg-red-50 text-red-500' },
	login: { label: 'تسجيل دخول', color: 'bg-slate-50 text-slate-600' },
};

const ENTITY_LABELS: Record<string, string> = {
	user: 'مستخدم',
	store: 'متجر',
	product: 'منتج',
	order: 'طلب',
	dispute: 'نزاع',
};

/** Format a JSONB diff ("old → new" or "— → new") compactly. */
function diffSummary(
	oldValues: Record<string, unknown> | null,
	newValues: Record<string, unknown> | null,
): string {
	if (!newValues) return '—';
	if (!oldValues) {
		const keys = Object.keys(newValues);
		if (keys.length === 0) return '—';
		return `+ ${keys.length} حقول`;
	}
	const changed: string[] = [];
	for (const [k, v] of Object.entries(newValues)) {
		if (JSON.stringify(oldValues[k]) !== JSON.stringify(v)) changed.push(k);
	}
	if (changed.length === 0) return '—';
	if (changed.length === 1) return changed[0]!;
	return `${changed.length} حقول: ${changed.slice(0, 3).join(', ')}${
		changed.length > 3 ? '…' : ''
	}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function AdminAuditLog() {
	const [search, setSearch] = useState('');
	const [actionFilter, setActionFilter] = useState<string>('');
	const [entityFilter, setEntityFilter] = useState<string>('');
	const [currentPage, setCurrentPage] = useState(1);
	const pageSize = 25;

	const apiParams = useMemo(
		() => ({
			action: actionFilter || undefined,
			entity_type: entityFilter || undefined,
			limit: pageSize,
			offset: (currentPage - 1) * pageSize,
		}),
		[actionFilter, entityFilter, currentPage],
	);

	const { data: response, loading, error, refetch } = useAdminAuditLog(apiParams);

	const entries = useMemo(
		() => response?.entries ?? [],
		[response],
	);
	const totalCount = response?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

	// The server doesn't search by text yet, so we filter on the
	// client. Cheap because pageSize is bounded (25 rows).
	const filteredEntries = useMemo(() => {
		if (!search.trim()) return entries;
		const needle = search.toLowerCase();
		return entries.filter(
			(e) =>
				e.action.toLowerCase().includes(needle) ||
				e.entity_type.toLowerCase().includes(needle) ||
				(e.entity_id ?? '').toLowerCase().includes(needle) ||
				String(e.user_id ?? '').includes(needle),
		);
	}, [entries, search]);

	const formatTime = useCallback((iso: string) => {
		try {
			return new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
		} catch {
			return iso;
		}
	}, []);

	return (
		<div className="space-y-5">
			{/* ── Legend ── */}
			<div className="flex flex-wrap items-center gap-2">
				<Shield className="w-4 h-4 text-[#6B6B6B]" />
				<span className="text-xs text-[#6B6B6B] font-cairo">
					سجلّ التدقيق — كل تغيير إداري موثَّق
				</span>
				<Button
					onClick={() => void refetch()}
					variant="outline"
					size="sm"
					className="font-cairo text-xs h-7"
				>
					تحديث
				</Button>
			</div>

			{error && (
				<div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
					تعذّر تحميل السجل: {error}
					<button
						type="button"
						className="ml-2 underline"
						onClick={() => void refetch()}
					>
						إعادة المحاولة
					</button>
				</div>
			)}

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
								placeholder="بحث في الإجراء/الكيان/المعرّف..."
								aria-label="بحث سجل التدقيق"
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setCurrentPage(1);
								}}
								className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#e5e5e5] bg-[#F8F8F8] text-sm font-cairo text-[#111111] placeholder:text-[#AAAAAA] outline-none focus:border-[#D4A853] focus:ring-2 focus:ring-[#D4A853]/20 transition-all"
							/>
						</div>
						<div className="flex gap-2 flex-wrap">
							<select
								value={actionFilter}
								onChange={(e) => {
									setActionFilter(e.target.value);
									setCurrentPage(1);
								}}
								aria-label="Action filter"
								className="text-xs font-cairo px-3 py-2 rounded-xl border border-[#e5e5e5] bg-white text-[#111111] outline-none focus:border-[#D4A853]"
							>
								<option value="">كل الإجراءات</option>
								{Object.entries(ACTION_LABELS).map(([k, v]) => (
									<option key={k} value={k}>
										{v.label}
									</option>
								))}
							</select>
							<select
								value={entityFilter}
								onChange={(e) => {
									setEntityFilter(e.target.value);
									setCurrentPage(1);
								}}
								aria-label="Entity filter"
								className="text-xs font-cairo px-3 py-2 rounded-xl border border-[#e5e5e5] bg-white text-[#111111] outline-none focus:border-[#D4A853]"
							>
								<option value="">كل الكيانات</option>
								{Object.entries(ENTITY_LABELS).map(([k, v]) => (
									<option key={k} value={k}>
										{v}
									</option>
								))}
							</select>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* ── Log Table ── */}
			<Card className="border-0 shadow-sm overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="bg-[#F8F8F8] border-b border-[#EEEEEE]">
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B]">
									التوقيت
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B]">
									الإجراء
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B]">
									الكيان
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B] hidden md:table-cell">
									الفاعل
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B] hidden lg:table-cell">
									التغيير
								</th>
							</tr>
						</thead>
						<tbody>
							{loading && filteredEntries.length === 0 ? (
								<tr>
									<td
										colSpan={5}
										className="px-4 py-8 text-center text-sm text-[#AAAAAA] font-cairo"
									>
										<Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
										جاري التحميل…
									</td>
								</tr>
							) : (
								filteredEntries.map((entry) => {
									const actionMeta =
										ACTION_LABELS[entry.action] ?? {
											label: entry.action,
											color: 'bg-[#F8F8F8] text-[#6B6B6B]',
										};
									const entityLabel =
										ENTITY_LABELS[entry.entity_type] ?? entry.entity_type;
									return (
										<tr
											key={entry.id}
											className="border-b border-[#F5F5F5] hover:bg-[#F8F8F8]/50 transition-colors"
										>
											<td className="px-4 py-3">
												<div className="flex items-center gap-2 font-mono text-xs text-[#111111]">
													<Clock className="w-3 h-3 text-[#AAAAAA]" />
													{formatTime(entry.created_at)}
												</div>
											</td>
											<td className="px-4 py-3">
												<Badge
													variant="outline"
													className={`font-cairo text-[10px] ${actionMeta.color}`}
												>
													{actionMeta.label}
												</Badge>
											</td>
											<td className="px-4 py-3">
												<div className="text-xs">
													<div className="font-cairo text-[#111111]">
														{entityLabel}
													</div>
													{entry.entity_id && (
														<div className="text-[10px] text-[#6B6B6B] font-mono truncate max-w-[8rem]">
															#{entry.entity_id}
														</div>
													)}
												</div>
											</td>
											<td className="px-4 py-3 hidden md:table-cell">
												{entry.user_id ? (
													<div className="flex items-center gap-1.5 text-xs font-cairo text-[#111111]">
														<UserIcon className="w-3 h-3 text-[#AAAAAA]" />
														#{entry.user_id}
													</div>
												) : (
													<span className="text-xs text-[#AAAAAA] font-cairo">
														—
													</span>
												)}
											</td>
											<td className="px-4 py-3 hidden lg:table-cell">
												<span className="text-[11px] text-[#6B6B6B] font-cairo font-mono">
													{diffSummary(
														entry.old_values,
														entry.new_values,
													)}
												</span>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				{filteredEntries.length === 0 && !loading && (
					<div className="py-12 text-center">
						<Shield className="w-12 h-12 text-[#AAAAAA] mx-auto mb-3" />
						<p className="text-sm text-[#6B6B6B] font-cairo">
							لا توجد سجلات مطابقة
						</p>
					</div>
				)}

				{/* Pagination */}
				{totalCount > pageSize && (
					<div className="flex items-center justify-between px-4 py-3 border-t border-[#F5F5F5]">
						<span className="text-xs text-[#6B6B6B] font-cairo">
							{totalCount} سجل
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
