import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	Eye,
	EyeOff,
	Loader2,
	Star,
	Trash2,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import {
	deleteAdminReview,
	getAdminReviews,
	patchAdminReview,
	type AdminReview,
} from '@/features/admin/api/admin';

export default function AdminReviews() {
	const { t } = useTranslation();
	const { addToast } = useApp();
	const [items, setItems] = useState<AdminReview[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState('');
	const [visibilityFilter, setVisibilityFilter] = useState<
		'all' | 'visible' | 'hidden'
	>('all');
	const [ratingFilter, setRatingFilter] = useState<number | 0>(0);

	const reload = async () => {
		setLoading(true);
		try {
			const res = await getAdminReviews();
			setItems(res.items);
		} catch (e: unknown) {
			addToast({
				type: 'error',
				message: e instanceof Error ? e.message : String(e),
			});
		} finally {
			setLoading(false);
		}
	};
	void reload; // re-exposed for callers; not needed here (effect runs it inline)

	useEffect(() => {
		(async () => {
			setLoading(true);
			try {
				const res = await getAdminReviews();
				setItems(res.items);
			} catch (e: unknown) {
				addToast({
					type: 'error',
					message: e instanceof Error ? e.message : String(e),
				});
			} finally {
				setLoading(false);
			}
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const filtered = useMemo(() => {
		return items.filter((r) => {
			if (visibilityFilter === 'visible' && !r.is_visible) return false;
			if (visibilityFilter === 'hidden' && r.is_visible) return false;
			if (ratingFilter && r.rating !== ratingFilter) return false;
			if (
				search &&
				!`${r.product_name ?? ''} ${r.customer_name ?? ''} ${r.title ?? ''} ${r.comment ?? ''}`
					.toLowerCase()
					.includes(search.toLowerCase())
			)
				return false;
			return true;
		});
	}, [items, search, visibilityFilter, ratingFilter]);

	const toggleVisibility = async (r: AdminReview) => {
		try {
			await patchAdminReview(r.id, { is_visible: !r.is_visible });
			setItems((p) =>
				p.map((x) =>
					x.id === r.id ? { ...x, is_visible: !r.is_visible } : x,
				),
			);
			addToast({
				type: 'success',
				message: r.is_visible
					? t('admin.reviews.hidden', 'Hidden')
					: t('admin.reviews.visible', 'Visible'),
			});
		} catch (e: unknown) {
			addToast({
				type: 'error',
				message: e instanceof Error ? e.message : String(e),
			});
		}
	};

	const handleDelete = async (r: AdminReview) => {
		if (!confirm(t('admin.reviews.confirmDelete', 'Delete this review permanently?')))
			return;
		try {
			await deleteAdminReview(r.id);
			addToast({ type: 'success', message: t('common.saved', 'Deleted') });
			setItems((p) => p.filter((x) => x.id !== r.id));
		} catch (e: unknown) {
			addToast({
				type: 'error',
				message: e instanceof Error ? e.message : String(e),
			});
		}
	};

	const counts = useMemo(
		() => ({
			visible: items.filter((r) => r.is_visible).length,
			hidden: items.filter((r) => !r.is_visible).length,
			avgRating:
				items.length === 0
					? '—'
					: (items.reduce((s, r) => s + r.rating, 0) / items.length).toFixed(1),
		}),
		[items],
	);

	return (
		<div className="min-h-screen bg-[#FAFAF7]">
			<div className="max-w-6xl mx-auto px-4 lg:px-6 py-6 space-y-6">
				<div className="rounded-2xl bg-gradient-to-br from-[#1A1612] via-[#2A2420] to-[#1A1612] text-white p-6 lg:p-8 relative overflow-hidden">
					<div className="absolute inset-0 opacity-10">
						<div className="absolute -top-12 -end-12 w-64 h-64 rounded-full bg-[#D4A853] blur-3xl" />
					</div>
					<div className="relative flex items-center gap-4">
						<div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center">
							<Star size={26} className="text-[#D4A853]" />
						</div>
						<div>
							<p className="text-xs uppercase tracking-widest text-[#D4A853] font-bold">
								{t('admin.navReviews', 'Catalog')}
							</p>
							<h1 className="text-xl font-bold mt-1">
								{t('admin.reviews.title', 'Reviews Moderation')}
							</h1>
							<p className="text-sm text-white/60 mt-1">
								{counts.visible} {t('admin.reviews.visible', 'visible')} · {counts.avgRating}{' '}
								{t('admin.reviews.avgRating', 'avg rating')}
							</p>
						</div>
					</div>
				</div>

				<div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
					<div className="p-4 border-b border-gray-100 flex flex-wrap gap-2">
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder={t('admin.reviews.searchPlaceholder', 'Search by product or customer...')}
							className="flex-1 min-w-[200px] h-10 px-4 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] focus:ring-1 focus:ring-[#D4A853] outline-none"
						/>
						<select
							value={visibilityFilter}
							onChange={(e) =>
								setVisibilityFilter(e.target.value as 'all' | 'visible' | 'hidden')
							}
							className="h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] outline-none"
						>
							<option value="all">{t('common.all', 'All')}</option>
							<option value="visible">{t('admin.reviews.visible', 'Visible')}</option>
							<option value="hidden">{t('admin.reviews.hidden', 'Hidden')}</option>
						</select>
						<select
							value={ratingFilter}
							onChange={(e) => setRatingFilter(Number(e.target.value))}
							className="h-10 px-3 border border-gray-300 rounded-lg text-sm focus:border-[#D4A853] outline-none"
						>
							<option value="0">{t('admin.reviews.allRatings', 'All ratings')}</option>
							{[1, 2, 3, 4, 5].map((n) => (
								<option key={n} value={n}>
									{n} ★
								</option>
							))}
						</select>
					</div>

					{loading ? (
						<div className="p-12 flex items-center justify-center">
							<Loader2 className="w-6 h-6 animate-spin text-gray-400" />
						</div>
					) : filtered.length === 0 ? (
						<div className="p-12 text-center text-sm text-gray-500">
							{t('admin.reviews.empty', 'No reviews match the current filters.')}
						</div>
					) : (
						<div className="divide-y divide-gray-100">
							{filtered.map((r) => (
								<div
									key={r.id}
									className="p-4 flex flex-col sm:flex-row sm:items-start gap-3"
								>
									<div className="shrink-0 w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-2xl">
										{r.rating}★
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 flex-wrap">
											<p className="text-sm font-semibold text-gray-900">
												{r.product_name ?? `#${r.product_id}`}
											</p>
											{r.is_verified && (
												<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
													{t('customer.verifyPurchase', 'Verified')}
												</span>
											)}
											<span
												className={cn(
													'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
													r.is_visible
														? 'bg-emerald-50 text-emerald-700'
														: 'bg-gray-100 text-gray-500',
												)}
											>
												{r.is_visible
													? t('admin.reviews.visible', 'Visible')
													: t('admin.reviews.hidden', 'Hidden')}
											</span>
										</div>
										{r.title && (
											<p className="text-sm font-semibold text-gray-700 mt-1">
												{r.title}
											</p>
										)}
										{r.comment && (
											<p className="text-xs text-gray-600 mt-1 line-clamp-3">
												{r.comment}
											</p>
										)}
										<p className="text-[10px] text-gray-400 mt-2">
											{r.customer_name ?? `user #${r.customer_id}`} ·{' '}
											{r.created_at?.slice(0, 10)}
											{r.helpful_count > 0 && (
												<> · {r.helpful_count} 👍</>
											)}
										</p>
									</div>
									<div className="flex sm:flex-col gap-2 shrink-0">
										<button
											type="button"
											onClick={() => toggleVisibility(r)}
											className={cn(
												'h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1',
												r.is_visible
													? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
													: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
											)}
										>
											{r.is_visible ? (
												<>
													<EyeOff size={12} />
													{t('admin.reviews.hide', 'Hide')}
												</>
											) : (
												<>
													<Eye size={12} />
													{t('admin.reviews.show', 'Show')}
												</>
											)}
										</button>
										<button
											type="button"
											onClick={() => handleDelete(r)}
											className="h-8 px-3 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 inline-flex items-center gap-1"
										>
											<Trash2 size={12} />
											{t('common.delete', 'Delete')}
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
