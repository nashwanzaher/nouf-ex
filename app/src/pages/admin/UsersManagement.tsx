import { useState, useMemo } from 'react';
import {
	Users,
	Search,
	ChevronLeft,
	ChevronRight,
	Eye,
	Ban,
	CheckCircle,
	XCircle,
	Phone,
	Mail,
	Calendar,
	MapPin,
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

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface UserRecord {
	id: number;
	name: string;
	email: string;
	phone: string;
	role: 'customer' | 'merchant' | 'admin';
	store?: string;
	status: 'active' | 'suspended' | 'pending';
	governorate: string;
	registeredDate: string;
	ordersCount: number;
	lastLogin: string;
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */
const usersData: UserRecord[] = [
	{
		id: 1,
		name: 'أحمد عبدالله',
		email: 'ahmed@example.com',
		phone: '777-123-456',
		role: 'customer',
		status: 'active',
		governorate: 'صنعاء',
		registeredDate: '٢٠٢٤/٠١/١٥',
		ordersCount: 12,
		lastLogin: '٢٠٢٤/٠٦/٢٠',
	},
	{
		id: 2,
		name: 'خالد محسن',
		email: 'khaled@store.com',
		phone: '777-234-567',
		role: 'merchant',
		store: 'إلكترونيات الغد',
		status: 'active',
		governorate: 'عدن',
		registeredDate: '٢٠٢٣/١١/٢٠',
		ordersCount: 0,
		lastLogin: '٢٠٢٤/٠٦/١٩',
	},
	{
		id: 3,
		name: 'فاطمة السعدي',
		email: 'fatima@dates.com',
		phone: '777-345-678',
		role: 'merchant',
		store: 'التمور الفاخرة',
		status: 'active',
		governorate: 'تعز',
		registeredDate: '٢٠٢٤/٠٢/١٠',
		ordersCount: 0,
		lastLogin: '٢٠٢٤/٠٦/١٨',
	},
	{
		id: 4,
		name: 'محمد العنسي',
		email: 'admin@noufex.com',
		phone: '777-999-000',
		role: 'admin',
		status: 'active',
		governorate: 'صنعاء',
		registeredDate: '٢٠٢٣/٠٧/٠١',
		ordersCount: 0,
		lastLogin: '٢٠٢٤/٠٦/٢٠',
	},
	{
		id: 5,
		name: 'سارة أحمد',
		email: 'sara@example.com',
		phone: '777-456-789',
		role: 'customer',
		status: 'active',
		governorate: 'الحديدة',
		registeredDate: '٢٠٢٤/٠٣/٠٥',
		ordersCount: 8,
		lastLogin: '٢٠٢٤/٠٦/١٧',
	},
	{
		id: 6,
		name: 'عبدالرحمن علي',
		email: 'abdo@craft.com',
		phone: '777-567-890',
		role: 'merchant',
		store: 'حرف يدوية',
		status: 'pending',
		governorate: 'إب',
		registeredDate: '٢٠٢٤/٠٥/٢٠',
		ordersCount: 0,
		lastLogin: '٢٠٢٤/٠٦/١٥',
	},
	{
		id: 7,
		name: 'سمية حسن',
		email: 'samia@perfume.com',
		phone: '777-678-901',
		role: 'merchant',
		store: 'عطور الجنوب',
		status: 'active',
		governorate: 'عدن',
		registeredDate: '٢٠٢٤/٠١/٢٥',
		ordersCount: 0,
		lastLogin: '٢٠٢٤/٠٦/١٩',
	},
	{
		id: 8,
		name: 'علي محمود',
		email: 'ali@example.com',
		phone: '777-789-012',
		role: 'customer',
		status: 'suspended',
		governorate: 'صنعاء',
		registeredDate: '٢٠٢٤/٠٤/١٢',
		ordersCount: 3,
		lastLogin: '٢٠٢٤/٠٥/٣٠',
	},
	{
		id: 9,
		name: 'نورة خالد',
		email: 'noura@example.com',
		phone: '777-890-123',
		role: 'customer',
		status: 'active',
		governorate: 'تعز',
		registeredDate: '٢٠٢٤/٠٢/٢٨',
		ordersCount: 15,
		lastLogin: '٢٠٢٤/٠٦/١٨',
	},
	{
		id: 10,
		name: 'يوسف سعيد',
		email: 'yousef@tech.com',
		phone: '777-901-234',
		role: 'merchant',
		store: 'تك ستور',
		status: 'active',
		governorate: 'صنعاء',
		registeredDate: '٢٠٢٣/١٢/١٠',
		ordersCount: 0,
		lastLogin: '٢٠٢٤/٠٦/٢٠',
	},
	{
		id: 11,
		name: 'هند عبدالرحمن',
		email: 'hind@fashion.com',
		phone: '777-012-345',
		role: 'merchant',
		store: 'أزياء الهدى',
		status: 'active',
		governorate: 'عدن',
		registeredDate: '٢٠٢٤/٠٣/٠١',
		ordersCount: 0,
		lastLogin: '٢٠٢٤/٠٦/١٦',
	},
	{
		id: 12,
		name: 'صالح محمد',
		email: 'saleh@example.com',
		phone: '777-111-222',
		role: 'customer',
		status: 'pending',
		governorate: 'إب',
		registeredDate: '٢٠٢٤/٠٦/١٠',
		ordersCount: 0,
		lastLogin: '٢٠٢٤/٠٦/١٨',
	},
	{
		id: 13,
		name: 'ليلى أحمد',
		email: 'laila@home.com',
		phone: '777-222-333',
		role: 'merchant',
		store: 'أثاث المنزل',
		status: 'active',
		governorate: 'صنعاء',
		registeredDate: '٢٠٢٤/٠١/١٠',
		ordersCount: 0,
		lastLogin: '٢٠٢٤/٠٦/١٩',
	},
	{
		id: 14,
		name: 'مازن عبدالله',
		email: 'mazen@example.com',
		phone: '777-333-444',
		role: 'customer',
		status: 'active',
		governorate: 'الحديدة',
		registeredDate: '٢٠٢٤/٠٥/٠٥',
		ordersCount: 6,
		lastLogin: '٢٠٢٤/٠٦/٢٠',
	},
	{
		id: 15,
		name: 'ريم خالد',
		email: 'reem@beauty.com',
		phone: '777-444-555',
		role: 'merchant',
		store: 'جمال الطبيعة',
		status: 'suspended',
		governorate: 'تعز',
		registeredDate: '٢٠٢٤/٠٢/١٥',
		ordersCount: 0,
		lastLogin: '٢٠٢٤/٠٥/٢٥',
	},
];

const roleConfig = {
	customer: { label: 'عميل', color: 'bg-blue-50 text-blue-600 border-blue-200' },
	merchant: { label: 'تاجر', color: 'bg-amber-50 text-[#D4A853] border-amber-200' },
	admin: { label: 'مدير', color: 'bg-purple-50 text-purple-600 border-purple-200' },
};

const statusConfig = {
	active: {
		label: 'نشط',
		color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
		icon: CheckCircle,
	},
	suspended: { label: 'معطل', color: 'bg-red-50 text-red-500 border-red-200', icon: XCircle },
	pending: { label: 'معلق', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: Clock },
};

const governorates = ['الكل', 'صنعاء', 'عدن', 'تعز', 'الحديدة', 'إب'];
const roles = ['الكل', 'عميل', 'تاجر', 'مدير'];
const statuses = ['الكل', 'نشط', 'معطل', 'معلق'];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function UsersManagement() {
	const [search, setSearch] = useState('');
	const [roleFilter, setRoleFilter] = useState('الكل');
	const [statusFilter, setStatusFilter] = useState('الكل');
	const [govFilter, setGovFilter] = useState('الكل');
	const [currentPage, setCurrentPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
	const [showFilters, setShowFilters] = useState(false);

	/* ── Filtering ── */
	const filteredUsers = useMemo(() => {
		return usersData.filter((u) => {
			const matchesSearch =
				search === '' ||
				u.name.includes(search) ||
				u.email.includes(search) ||
				u.phone.includes(search);
			const matchesRole =
				roleFilter === 'الكل' ||
				(roleFilter === 'عميل' && u.role === 'customer') ||
				(roleFilter === 'تاجر' && u.role === 'merchant') ||
				(roleFilter === 'مدير' && u.role === 'admin');
			const matchesStatus =
				statusFilter === 'الكل' ||
				(statusFilter === 'نشط' && u.status === 'active') ||
				(statusFilter === 'معطل' && u.status === 'suspended') ||
				(statusFilter === 'معلق' && u.status === 'pending');
			const matchesGov = govFilter === 'الكل' || u.governorate === govFilter;
			return matchesSearch && matchesRole && matchesStatus && matchesGov;
		});
	}, [search, roleFilter, statusFilter, govFilter]);

	/* ── Pagination ── */
	const totalPages = Math.ceil(filteredUsers.length / pageSize);
	const paginatedUsers = useMemo(() => {
		const start = (currentPage - 1) * pageSize;
		return filteredUsers.slice(start, start + pageSize);
	}, [filteredUsers, currentPage, pageSize]);

	const toggleStatus = (_userId: number) => {
		/* mock: no-op */
	};

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
								{roles.map((r) => (
									<option key={r} value={r}>
										{r === 'الكل' ? 'الدور' : r}
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
								{statuses.map((s) => (
									<option key={s} value={s}>
										{s === 'الكل' ? 'الحالة' : s}
									</option>
								))}
							</select>

							<select
								value={govFilter}
								onChange={(e) => {
									setGovFilter(e.target.value);
									setCurrentPage(1);
								}}
								aria-label="Governorate filter"
								className="text-xs font-cairo px-3 py-2 rounded-xl border border-[#e5e5e5] bg-white text-[#111111] outline-none focus:border-[#D4A853]"
							>
								{governorates.map((g) => (
									<option key={g} value={g}>
										{g === 'الكل' ? 'المحافظة' : g}
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
							{paginatedUsers.map((user) => {
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
										<td className="px-4 py-3 hidden lg:table-cell">
											{user.store ? (
												<span className="text-sm font-cairo text-[#111111] flex items-center gap-1">
													<Store
														className="w-3.5 h-3.5 text-[#D4A853]"
														strokeWidth={1.5}
													/>
													{user.store}
												</span>
											) : (
												<span className="text-sm text-[#AAAAAA] font-cairo">
													—
												</span>
											)}
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
												{user.registeredDate}
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
													onClick={() => toggleStatus(user.id)}
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

				{paginatedUsers.length === 0 && (
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
										icon={Mail}
										label="البريد"
										value={selectedUser.email}
									/>
									<InfoRow
										icon={Phone}
										label="الهاتف"
										value={selectedUser.phone}
									/>
									<InfoRow
										icon={MapPin}
										label="المحافظة"
										value={selectedUser.governorate}
									/>
									<InfoRow
										icon={Calendar}
										label="تاريخ التسجيل"
										value={selectedUser.registeredDate}
									/>
									<InfoRow
										icon={Clock}
										label="آخر دخول"
										value={selectedUser.lastLogin}
									/>
									{selectedUser.store && (
										<InfoRow
											icon={Store}
											label="المتجر"
											value={selectedUser.store}
										/>
									)}
								</TabsContent>

								<TabsContent value="orders" className="mt-3">
									{selectedUser.role === 'customer' ? (
										<div className="space-y-2">
											<div className="flex items-center justify-between p-3 rounded-xl bg-[#F8F8F8]">
												<span className="text-sm text-[#6B6B6B] font-cairo">
													إجمالي الطلبات
												</span>
												<span className="text-lg font-mono font-bold text-[#111111]">
													{selectedUser.ordersCount}
												</span>
											</div>
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
													{selectedUser.lastLogin} · IP: 192.168.1.1
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
													{selectedUser.registeredDate}
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
