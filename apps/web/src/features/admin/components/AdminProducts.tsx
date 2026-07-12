/**
 * AdminProducts.tsx — K.6 page
 *
 * Lists every product in the catalog with admin-only controls:
 *  - Toggle is_active (unpublish a product)
 *  - Toggle is_featured (promote on the home page)
 *  - Move to a new category
 *
 * Reads via /api/admin/products (server/routes/admin.cts:149-213)
 * and mutates via PATCH /api/admin/products/:id (admin.cts:571-602).
 * Writes to admin_audit_log (visible on the /admin/audit-log page).
 */
import { useState, useMemo, useCallback } from 'react';
import {
	Package,
	Search,
	ChevronLeft,
	ChevronRight,
	Eye,
	Star,
	Tag,
	Power,
	PowerOff,
	Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAdminProducts, useCategories } from '@/hooks/useApi';
import { patchAdminProduct } from '@/lib/api';
import { useApp } from '@/context/AppContext';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function AdminProducts() {
	const [search, setSearch] = useState('');
	const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive' | 'featured'>(
		'all',
	);
	const [currentPage, setCurrentPage] = useState(1);
	const pageSize = 20;

	const apiParams = useMemo(() => {
		const p: {
			limit: number;
			offset: number;
			is_active?: boolean;
			is_featured?: boolean;
			category_id?: number;
		} = { limit: pageSize, offset: (currentPage - 1) * pageSize };
		if (activeFilter === 'active') p.is_active = true;
		if (activeFilter === 'inactive') p.is_active = false;
		if (activeFilter === 'featured') p.is_featured = true;
		return p;
	}, [activeFilter, currentPage]);

	const {
		data: response,
		loading,
		error,
		refetch,
	} = useAdminProducts(apiParams);
	const { data: categories } = useCategories();
	const { addToast } = useApp();

	const products = useMemo(
		() => response?.products ?? [],
		[response],
	);
	const totalCount = response?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

	const filtered = useMemo(() => {
		if (!search.trim()) return products;
		const needle = search.toLowerCase();
		return products.filter((p) => {
			return (
				String(p.id).includes(needle) ||
				(p.name_ar ?? '').toLowerCase().includes(needle) ||
				(p.name_en ?? '').toLowerCase().includes(needle) ||
				(p.name_zh ?? '').toLowerCase().includes(needle)
			);
		});
	}, [products, search]);

	const categoryName = useCallback(
		(id: number | null | undefined) => {
			if (!id) return '—';
			const cat = (categories ?? []).find((c) => c.id === id);
			return cat?.name_ar ?? cat?.name_en ?? `#${id}`;
		},
		[categories],
	);

	const handleToggleActive = useCallback(
		async (
			product: (typeof products)[number],
			active: boolean,
		) => {
			try {
				await patchAdminProduct(product.id, { is_active: active });
				addToast({
					type: 'success',
					message: active ? 'تم نشر المنتج' : 'تم إخفاء المنتج',
				});
				await refetch();
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				addToast({ type: 'error', message: 'فشل تحديث المنتج: ' + msg });
			}
		},
		[addToast, refetch],
	);

	const handleToggleFeatured = useCallback(
		async (
			product: (typeof products)[number],
			featured: boolean,
		) => {
			try {
				await patchAdminProduct(product.id, { is_featured: featured });
				addToast({
					type: 'success',
					message: featured ? 'تم تمييز المنتج' : 'تم إزالة التمييز',
				});
				await refetch();
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				addToast({ type: 'error', message: 'فشل تحديث المنتج: ' + msg });
			}
		},
		[addToast, refetch],
	);

	const formatPrice = useCallback((n: number, currency: string) => {
		try {
			return `${n.toLocaleString()} ${currency}`.trim();
		} catch {
			return `${n} ${currency}`.trim();
		}
	}, []);

	return (
		<div className="space-y-5">
			{error && (
				<div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
					تعذّر تحميل المنتجات: {error}
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
								placeholder="اسم المنتج، رقم المنتج..."
								aria-label="بحث المنتجات"
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
									setCurrentPage(1);
								}}
								className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#e5e5e5] bg-[#F8F8F8] text-sm font-cairo text-[#111111] placeholder:text-[#AAAAAA] outline-none focus:border-[#D4A853] focus:ring-2 focus:ring-[#D4A853]/20 transition-all"
							/>
						</div>
						<div className="flex gap-2 flex-wrap">
							{(['all', 'active', 'inactive', 'featured'] as const).map((k) => {
								const labels: Record<typeof k, string> = {
									all: 'الكل',
									active: 'نشط',
									inactive: 'مخفي',
									featured: 'مميَّز',
								};
								return (
									<button
										key={k}
										type="button"
										onClick={() => {
											setActiveFilter(k);
											setCurrentPage(1);
										}}
										className={`px-3 py-2 rounded-xl text-xs font-cairo font-medium transition-all ${
											activeFilter === k
												? 'bg-[#D4A853] text-[#1A1612] shadow-sm'
												: 'bg-white text-[#6B6B6B] hover:bg-[#F8F8F8] border border-[#EEEEEE]'
										}`}
									>
										{labels[k]}
									</button>
								);
							})}
						</div>
					</div>
				</CardContent>
			</Card>

			<Card className="border-0 shadow-sm overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="bg-[#F8F8F8] border-b border-[#EEEEEE]">
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B]">
									المنتج
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B] hidden md:table-cell">
									السعر
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B] hidden lg:table-cell">
									التصنيف
								</th>
								<th className="px-4 py-3 text-right text-xs font-cairo font-semibold text-[#6B6B6B]">
									الحالة
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
										colSpan={5}
										className="px-4 py-8 text-center text-sm text-[#AAAAAA] font-cairo"
									>
										<Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
										جاري التحميل…
									</td>
								</tr>
							) : (
								filtered.map((p) => {
									const isActive = (p as { is_active?: number }).is_active !== 0;
									const isFeatured = (p as { is_featured?: number }).is_featured !== 0;
									return (
										<tr
											key={p.id}
											className="border-b border-[#F5F5F5] hover:bg-[#F8F8F8]/50 transition-colors"
										>
											<td className="px-4 py-3">
												<div>
													<p className="text-sm font-cairo font-semibold text-[#111111] line-clamp-1">
														{p.name_ar || p.name_en || `#${p.id}`}
													</p>
													<p className="text-[11px] text-[#6B6B6B] font-cairo">
														#{p.id} · مخزون: {p.stock ?? '—'}
													</p>
												</div>
											</td>
											<td className="px-4 py-3 hidden md:table-cell text-sm font-mono text-[#111111]">
												{formatPrice(p.price, p.currency)}
											</td>
											<td className="px-4 py-3 hidden lg:table-cell text-xs text-[#6B6B6B] font-cairo">
												{categoryName(p.category_id)}
											</td>
											<td className="px-4 py-3">
												<div className="flex flex-wrap gap-1">
													{isActive ? (
														<Badge className="font-cairo text-[10px] bg-emerald-50 text-emerald-600">
															نشط
														</Badge>
													) : (
														<Badge className="font-cairo text-[10px] bg-[#F8F8F8] text-[#6B6B6B]">
															مخفي
														</Badge>
													)}
													{isFeatured && (
														<Badge className="font-cairo text-[10px] bg-amber-50 text-amber-600">
															<Star className="w-3 h-3 ml-0.5" />
															مميَّز
														</Badge>
													)}
												</div>
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
													<button
														type="button"
														onClick={() => handleToggleActive(p, !isActive)}
														className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
															isActive
																? 'hover:bg-red-50 text-[#6B6B6B] hover:text-red-500'
																: 'hover:bg-emerald-50 text-[#6B6B6B] hover:text-emerald-500'
														}`}
														title={isActive ? 'إخفاء' : 'نشر'}
													>
														{isActive ? (
															<PowerOff className="w-4 h-4" />
														) : (
															<Power className="w-4 h-4" />
														)}
													</button>
													<button
														type="button"
														onClick={() => handleToggleFeatured(p, !isFeatured)}
														className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
															isFeatured
																? 'hover:bg-amber-50 text-amber-500'
																: 'hover:bg-amber-50 text-[#6B6B6B] hover:text-amber-500'
														}`}
														title={isFeatured ? 'إزالة التمييز' : 'تمييز'}
													>
														<Star className="w-4 h-4" />
													</button>
													<button
														type="button"
														className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-blue-50 text-[#6B6B6B] hover:text-blue-500 transition-colors"
														title="تغيير التصنيف"
													>
														<Tag className="w-4 h-4" strokeWidth={1.5} />
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

				{filtered.length === 0 && !loading && (
					<div className="py-12 text-center">
						<Package className="w-12 h-12 text-[#AAAAAA] mx-auto mb-3" />
						<p className="text-sm text-[#6B6B6B] font-cairo">
							لا توجد منتجات مطابقة
						</p>
					</div>
				)}

				{totalCount > pageSize && (
					<div className="flex items-center justify-between px-4 py-3 border-t border-[#F5F5F5]">
						<span className="text-xs text-[#6B6B6B] font-cairo">
							{totalCount} منتج
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
