import { useState, useMemo, useCallback } from 'react';
import {
	Users,
	Search,
	ChevronLeft,
	ChevronRight,
	Eye,
	Ban,
	CheckCircle,
	XCircle,
	Calendar,
	Store,
	Clock,
	Filter,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAdminUsers } from '@/hooks/useApi';
import { patchAdminUser, type AdminUser } from '@/lib/api';
import { useApp } from '@/context/AppContext';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type UserStatus = 'active' | 'suspended' | 'banned';
type UserRole = 'customer' | 'merchant' | 'admin';

/**
 * View model for the table. Mirrors the AdminUser shape from
 * /api/admin/users (server/routes/admin.ts:46-58) but renames a
 * few fields and drops columns the admin users endpoint does not
 * expose (governorate / store / ordersCount).
 */
interface UserRecord {
	id: number;
	name: string;
	email: string;
	phone: string | null;
	role: UserRole;
	status: UserStatus;
	registeredDate: string;
	lastLogin: string | null;
}

function mapAdminUserToView(user: AdminUser): UserRecord {
	return {
		id: user.id,
		name: user.full_name,
		email: user.email,
		phone: user.phone,
		role: user.role,
		status: user.status,
		registeredDate: user.created_at,
		lastLogin: user.last_login,
	};
}

const roleConfig: Record<UserRole, { label: string; color: string }> = {
	customer: { label: 'عميل', color: 'bg-blue-50 text-blue-600 border-blue-200' },
	merchant: { label: 'تاجر', color: 'bg-amber-50 text-[#D4A853] border-amber-200' },
	admin: { label: 'مدير', color: 'bg-purple-50 text-purple-600 border-purple-200' },
};

/** Status enum from /api/admin/users (server). The previous mock used
 *  'pending' for suspended users; the real API distinguishes 'suspended'
 *  (temporary) from 'banned' (permanent).
 */
const statusConfig: Record<UserStatus, { label: string; color: string; icon: typeof CheckCircle }> =
	{
		active: {
			label: 'نشط',
			color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
			icon: CheckCircle,
		},
		suspended: {
			label: 'معطل',
			color: 'bg-amber-50 text-amber-600 border-amber-200',
			icon: XCircle,
		},
		banned: { label: 'محظور', color: 'bg-red-50 text-red-500 border-red-200', icon: XCircle },
	};

/** Filter dropdowns. Values match the API enum (NOT a free-form string) so
 *  useAdminUsers can pass them straight through to the query string.
 */
const roleFilterOptions: { label: string; value: '' | UserRole }[] = [
	{ label: 'الكل', value: '' },
	{ label: 'عميل', value: 'customer' },
	{ label: 'تاجر', value: 'merchant' },
	{ label: 'مدير', value: 'admin' },
];
const statusFilterOptions: { label: string; value: '' | UserStatus }[] = [
	{ label: 'الكل', value: '' },
	{ label: 'نشط', value: 'active' },
	{ label: 'معطل', value: 'suspended' },
	{ label: 'محظور', value: 'banned' },
];

/** ISO timestamp → compact display. Returns em-dash for null/missing
 *  (e.g. a user who has never logged in has `last_login = null`).
 */
function formatDate(iso: string | null | undefined): string {
	if (!iso) return '—';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '—';
	return d.toISOString().slice(0, 10);
}

function formatDateTime(iso: string | null | undefined): string {
	if (!iso) return '—';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '—';
	return d.toISOString().slice(0, 16).replace('T', ' ');
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function UsersManagement() {
	const [search, setSearch] = useState('');
	const [roleFilter, setRoleFilter] = useState('الكل');
	const [statusFilter, setStatusFilter] = useState('الكل');
	const [currentPage, setCurrentPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
	const [showFilters, setShowFilters] = useState(false);

	/* ── Hook + derived state ── */
	const { addToast: addAppToast } = useApp();

	// Build API query params. Empty string means "no filter" → skip param.
	const apiParams = useMemo(() => {
		const p: {
			role?: UserRole;
			is_active?: UserStatus;
			limit: number;
			offset: number;
		} = { limit: pageSize, offset: (currentPage - 1) * pageSize };
		const roleOption = roleFilterOptions.find((o) => o.label === roleFilter);
		if (roleOption?.value) p.role = roleOption.value;
		const statusOption = statusFilterOptions.find((o) => o.label === statusFilter);
		if (statusOption?.value) p.is_active = statusOption.value;
		return p;
	}, [roleFilter, statusFilter, pageSize, currentPage]);

	const {
		data: usersResponse,
		loading,
		error: _fetchError,
		refetch: refetchUsers,
	} = useAdminUsers(apiParams);

	// Map AdminUser → view-model (drops columns the API does not expose).
	const allUsers = useMemo<UserRecord[]>(
		() => (usersResponse?.users ?? []).map(mapAdminUserToView),
		[usersResponse],
	);

	// Client-side text filter across name/email/phone.
	const filteredUsers = useMemo(() => {
		if (!search.trim()) return allUsers;
		const needle = search.toLowerCase();
		return allUsers.filter(
			(u) =>
				u.name.toLowerCase().includes(needle) ||
				u.email.toLowerCase().includes(needle) ||
				(u.phone ?? '').toLowerCase().includes(needle),
		);
	}, [allUsers, search]);

	const totalCount = usersResponse?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

	/* ── Status toggle (PATCH /api/admin/users/:id) ── */
	const toggleStatus = useCallback(
		async (target: UserRecord) => {
			const next: UserStatus = target.status === 'active' ? 'suspended' : 'active';
			try {
				await patchAdminUser(target.id, { status: next });
				addAppToast({
					type: 'success',
					message: next === 'active' ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب',
				});
				await refetchUsers();
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				addAppToast({
					type: 'error',
					message: 'فشل تحديث الحساب' + (message ? ': ' + message : ''),
				});
			}
		},
		[addAppToast, refetchUsers],
	);

	return (
		<div className="space-y-5">
			{/* ── Toolbar ── */}
			<Card className="border-0 shadow-sm">
				<CardContent className="p-4">
					<div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
						{/* Search */}
						<div className="relative w-full lg:w-72">
							<Search
								className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AAAAAA]"
								strokeWidth={1.5}
							/>
							<input
								type="text"
								placeholder="اسم، بريد، هاتف..."
								aria-label="بحث المستخدمين"
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setCurrentPage(1);
								}}
								className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#e5e5e5] bg-[#F8F8F8] text-sm font-cairo text-[#111111] placeholder:text-[#AAAAAA] outline-none focus:border-[#D4A853] focus:ring-2 focus:ring-[#D4A853]/20 transition-all"
							/>
						</div>

						{/* Filters */}
						<div className="flex flex-wrap items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowFilters(!showFilters)}
								className="font-cairo text-xs gap-1 border-[#e5e5e5]"
							>
								<Filter className="w-3.5 h-3.5" />
								الفلاتر
							</Button>

							<select
								value={roleFilter}
								onChange={(e) => {
									setRoleFilter(e.target.value);
									setCurrentPage(1);
								}}
								aria-label="Role filter"
								className="text-xs font-cairo px-3 py-2 rounded-xl border border-[#e5e5e5] bg-white text-[#111111] outline-none focus:border-[#D4A853]"
							>
								{roleFilterOptions.map((o) => (
									<option key={o.label} value={o.label}>
										{o.label}
									</option>
								))}
							</select>

							<select
								value={statusFilter}
								onChange={(e) => {
									setStatusFilter(e.target.value);
									setCurrentPage(1);
								}}
								aria-label="Status filter"
								className="text-xs font-cairo px-3 py-2 rounded-xl border border-[#e5e5e5] bg-white text-[#111111] outline-none focus:border-[#D4A853]"
							>
								{statusFilterOptions.map((o) => (
									<option key={o.label} value={o.label}>
										{o.label}
									</option>
								))}
							</select>

							<Button
								variant="outline"
								size="sm"
								className="font-cairo text-xs gap-1 border-[#D4A853] text-[#D4A853]"
							>
								تصدير
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{loading && (
				<div className="text-center py-8 text-sm text-[#6B6B6B] font-cairo">
					جاري التحميل…
				</div>
			)}
			{/* ── Users Table ── */}
			<Card className="border-0 shadow-sm overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="bg-[#F8F8F8] border-b border-[#EEEEEE]">
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B]">
									المستخدم
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B] hidden md:table-cell">
									الدور
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B] hidden lg:table-cell">
									المتجر
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B]">
									الحالة
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B] hidden sm:table-cell">
									التاريخ
								</th>
								<th className="px-4 py-3 text-center text-xs font-cairo font-semibold text-[#6B6B6B]">
									إجراءات
								</th>
							</tr>
						</thead>
						<tbody>
							{filteredUsers.map((user) => {
								const role = roleConfig[user.role];
								const status = statusConfig[user.status];
								const StatusIcon = status.icon;
								return (
									<tr
										key={user.id}
										className="border-b border-[#F5F5F5] hover:bg-[#F8F8F8]/50 transition-colors"
									>
										<td className="px-4 py-3">
											<div className="flex items-center gap-3">
												<Avatar className="w-9 h-9 shrink-0">
													<AvatarFallback className="bg-[#D4A853]/20 text-[#D4A853] font-cairo font-bold text-sm">
														{user.name.charAt(0)}
													</AvatarFallback>
												</Avatar>
												<div className="min-w-0">
													<p className="text-sm font-cairo font-semibold text-[#111111] truncate">
														{user.name}
													</p>
													<p className="text-[11px] text-[#6B6B6B] font-cairo truncate hidden sm:block">
														{user.email}
													</p>
												</div>
											</div>
										</td>
										<td className="px-4 py-3 hidden md:table-cell">
											<Badge
												variant="outline"
												className={`font-cairo text-[10px] ${role.color}`}
											>
												{role.label}
											</Badge>
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
											<span className="text-xs font-cairo text-[#6B6B6B]">
												{formatDate(user.registeredDate)}
											</span>
										</td>
										<td className="px-4 py-3">
											<div className="flex items-center justify-center gap-1">
												<button
													onClick={() => setSelectedUser(user)}
													className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-blue-50 text-[#6B6B6B] hover:text-blue-500 transition-colors"
													title="عرض"
												>
													<Eye className="w-4 h-4" strokeWidth={1.5} />
												</button>
												<button
													onClick={() => toggleStatus(user)}
													className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
														user.status === 'active'
															? 'hover:bg-red-50 text-[#6B6B6B] hover:text-red-500'
															: 'hover:bg-emerald-50 text-[#6B6B6B] hover:text-emerald-500'
													}`}
													title={
														user.status === 'active' ? 'تعطيل' : 'تفعيل'
													}
												>
													{user.status === 'active' ? (
														<Ban className="w-4 h-4" />
													) : (
														<CheckCircle className="w-4 h-4" />
													)}
												</button>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>

				{filteredUsers.length === 0 && (
					<div className="py-12 text-center">
						<Users
							className="w-12 h-12 text-[#AAAAAA] mx-auto mb-3"
							strokeWidth={1.5}
						/>
						<p className="text-sm text-[#6B6B6B] font-cairo">
							لا يوجد مستخدمين مطابقين للبحث
						</p>
					</div>
				)}

				{/* ── Pagination ── */}
				{filteredUsers.length > 0 && (
					<div className="flex items-center justify-between px-4 py-3 border-t border-[#F5F5F5]">
						<div className="flex items-center gap-2">
							<span className="text-xs text-[#6B6B6B] font-cairo">
								{filteredUsers.length} مستخدم
							</span>
							<select
								value={pageSize}
								onChange={(e) => {
									setPageSize(Number(e.target.value));
									setCurrentPage(1);
								}}
								aria-label="Page size"
								className="text-xs font-cairo px-2 py-1 rounded-lg border border-[#e5e5e5]"
							>
								<option value={5}>٥</option>
								<option value={10}>١٠</option>
								<option value={25}>٢٥</option>
							</select>
						</div>
						<div className="flex items-center gap-1">
							<button
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								disabled={currentPage === 1}
								title="Previous page"
								aria-label="Previous page"
								className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F8F8F8] disabled:opacity-30 transition-opacity"
							>
								<ChevronRight className="w-4 h-4" />
							</button>
							{Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
								<button
									key={p}
									onClick={() => setCurrentPage(p)}
									className={`w-8 h-8 rounded-lg text-xs font-cairo font-medium transition-all ${
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
								className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#F8F8F8] disabled:opacity-30 transition-opacity"
							>
								<ChevronLeft className="w-4 h-4" />
							</button>
						</div>
					</div>
				)}
			</Card>

			{/* ── User Detail Modal ── */}
			<Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
				<DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
					{selectedUser && (
						<>
							<DialogHeader>
								<DialogTitle className="font-cairo text-lg text-[#111111]">
									تفاصيل المستخدم
								</DialogTitle>
							</DialogHeader>

							{/* User header */}
							<div className="flex items-center gap-4 pb-4 border-b border-[#F5F5F5]">
								<Avatar className="w-16 h-16">
									<AvatarFallback className="bg-[#D4A853]/20 text-[#D4A853] font-cairo text-2xl font-bold">
										{selectedUser.name.charAt(0)}
									</AvatarFallback>
								</Avatar>
								<div>
									<h3 className="text-lg font-cairo font-bold text-[#111111]">
										{selectedUser.name}
									</h3>
									<div className="flex items-center gap-2 mt-1">
										<Badge
											variant="outline"
											className={`font-cairo text-[10px] ${roleConfig[selectedUser.role].color}`}
										>
											{roleConfig[selectedUser.role].label}
										</Badge>
										<Badge
											variant="outline"
											className={`font-cairo text-[10px] ${statusConfig[selectedUser.status].color}`}
										>
											{statusConfig[selectedUser.status].label}
										</Badge>
									</div>
								</div>
							</div>

							<Tabs defaultValue="info" className="mt-2">
								<TabsList className="w-full font-cairo">
									<TabsTrigger value="info" className="font-cairo text-xs flex-1">
										معلومات
									</TabsTrigger>
									<TabsTrigger
										value="orders"
										className="font-cairo text-xs flex-1"
									>
										الطلبات
									</TabsTrigger>
									<TabsTrigger
										value="activity"
										className="font-cairo text-xs flex-1"
									>
										النشاط
									</TabsTrigger>
								</TabsList>

								<TabsContent value="info" className="space-y-3 mt-3">
									<InfoRow
										icon={Calendar}
										label="تاريخ التسجيل"
										value={formatDate(selectedUser.registeredDate)}
									/>
									<InfoRow
										icon={Clock}
										label="آخر دخول"
										value={formatDateTime(selectedUser.lastLogin)}
									/>
								</TabsContent>

								<TabsContent value="orders" className="mt-3">
									{selectedUser.role === 'customer' ? (
										<div className="space-y-2">
											<p className="text-xs text-[#6B6B6B] font-cairo">
												سجل الطلبات الكامل قريباً
											</p>
										</div>
									) : (
										<div className="text-center py-8">
											<Store
												className="w-10 h-10 text-[#AAAAAA] mx-auto mb-2"
												strokeWidth={1.5}
											/>
											<p className="text-sm text-[#6B6B6B] font-cairo">
												حساب تاجر — الطلبات متاحة في لوحة التاجر
											</p>
										</div>
									)}
								</TabsContent>

								<TabsContent value="activity" className="mt-3">
									<div className="space-y-3">
										<div className="flex items-start gap-3">
											<div className="w-2 h-2 rounded-full bg-emerald-400 mt-2 shrink-0" />
											<div>
												<p className="text-sm font-cairo text-[#111111]">
													تسجيل دخول ناجح
												</p>
												<p className="text-[11px] text-[#6B6B6B] font-cairo">
													{formatDateTime(selectedUser.lastLogin)} · IP:
													192.168.1.1
												</p>
											</div>
										</div>
										<div className="flex items-start gap-3">
											<div className="w-2 h-2 rounded-full bg-blue-400 mt-2 shrink-0" />
											<div>
												<p className="text-sm font-cairo text-[#111111]">
													تم إنشاء الحساب
												</p>
												<p className="text-[11px] text-[#6B6B6B] font-cairo">
													{formatDate(selectedUser.registeredDate)}
												</p>
											</div>
										</div>
									</div>
								</TabsContent>
							</Tabs>
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
